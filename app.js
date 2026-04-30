// ===== Titan Studio Sync Engine =====
const TOTAL = 35;
let S = { start_date: '2026-05-14', weekly_amount: 40, pin_hash: '' };
let students = []; 
let pendingList = [];
let currentFilter = 'all';
let activeStudentId = null;
let detailStudentId = null;
let slipFileRef = null;

async function hashPin(pin) {
    const data = new TextEncoder().encode(pin);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const weeksElapsed = () => { const d = new Date() - new Date(S.start_date); return d < 0 ? 0 : Math.floor(d / 604800000) + 1; };
const totalPaid = s => (s.payments || []).reduce((a, p) => a + p.amount, 0);
const owed = s => weeksElapsed() * S.weekly_amount - totalPaid(s);
const ml = m => ({ promptpay: 'PromptPay', kbank: 'KBank', truemoney: 'TrueMoney', cash: 'Cash' }[m] || m);
const esc = str => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function toast(msg, type = 'success') {
    const t = document.createElement('div'); t.className = `toast`; t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
window.openModal = openModal; window.closeModal = closeModal;

async function loadSettings() {
    const { data } = await supa.from('settings').select('*').eq('id', 1).single();
    if (data) S = data;
}
async function saveSettings() { await supa.from('settings').update(S).eq('id', 1); }

async function loadStudents() {
    const { data: studs } = await supa.from('students').select('*').order('id');
    const { data: pays } = await supa.from('payments').select('*').order('created_at');
    students = (studs || []).map(s => ({ ...s, payments: (pays || []).filter(p => p.student_id === s.id) }));
}

async function loadPending() {
    const { data } = await supa.from('pending').select('*').order('created_at', { ascending: false });
    pendingList = data || [];
}

function listenPending() {
    supa.channel('pending-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'pending' }, async () => {
        await loadPending();
        document.getElementById('pendingCount').textContent = pendingList.length;
        if (activeStudentId) renderStudentView();
    }).subscribe();
}

function refreshAdmin() {
    const w = weeksElapsed();
    let paid = 0, owedTotal = 0;
    students.forEach(s => { paid += totalPaid(s); const o = owed(s); if (o > 0) owedTotal += o; });
    
    document.getElementById('sTotalStudents').textContent = students.length;
    document.getElementById('sTotalCollected').textContent = `฿${paid.toLocaleString()}`;
    document.getElementById('sTotalOwed').textContent = `฿${owedTotal.toLocaleString()}`;
    const exp = w * S.weekly_amount * TOTAL;
    document.getElementById('sRate').textContent = exp > 0 ? `${Math.round(paid / exp * 100)}%` : '0%';
    document.getElementById('pendingCount').textContent = pendingList.length;
    renderAdminGrid();
}

function renderAdminGrid() {
    const grid = document.getElementById('adminGrid');
    const q = document.getElementById('adminSearch').value.toLowerCase();
    grid.innerHTML = '';
    const list = students.filter(s => {
        if (!(s.name.toLowerCase().includes(q) || `#${s.id}`.includes(q))) return false;
        const o = owed(s);
        if (currentFilter === 'owed') return o > 0;
        if (currentFilter === 'paid') return o <= 0;
        return true;
    });

    list.forEach(s => {
        const p = totalPaid(s), o = owed(s);
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-card-top">
                <span style="color:var(--text-dim);font-family:monospace;font-size:12px">#${s.id}</span>
                <span class="badge ${o > 0 ? 'badge-no' : 'badge-ok'}">${o > 0 ? 'Owed' : 'Clear'}</span>
            </div>
            <div class="item-name">${esc(s.name)}</div>
            <div class="item-details">
                <div><span style="display:block;font-size:11px;color:var(--text-dim);text-transform:uppercase">Paid</span><span style="font-weight:700">฿${p.toLocaleString()}</span></div>
                <div style="text-align:right"><span style="display:block;font-size:11px;color:var(--text-dim);text-transform:uppercase">${o >= 0 ? 'Owes' : 'Ahead'}</span><span style="font-weight:700;color:${o > 0 ? 'var(--error)' : 'var(--success)'}">฿${Math.abs(o).toLocaleString()}</span></div>
            </div>`;
        card.onclick = () => openDetail(s.id);
        grid.appendChild(card);
    });
}

function openDetail(id) {
    detailStudentId = id;
    const s = students.find(x => x.id === id);
    if (!s) return;
    document.getElementById('detailName').textContent = s.name;
    const hist = document.getElementById('detailHistory');
    if (!(s.payments || []).length) hist.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-dim)">No history</p>';
    else {
        hist.innerHTML = [...s.payments].reverse().map(p => `
            <div class="history-item">
                <div><div style="font-weight:700;font-size:14px">${fmtDate(p.created_at)}</div><div style="font-size:12px;color:var(--text-dim)">${ml(p.method)}</div></div>
                <div style="font-weight:800;color:var(--success)">฿${p.amount.toLocaleString()}</div>
            </div>`).join('');
    }
    openModal('detailModal');
}

function renderStudentList(q) {
    const list = document.getElementById('studentSelectList');
    const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || `#${s.id}`.includes(q));
    list.innerHTML = filtered.map(s => {
        const o = owed(s);
        return `<div class="item-card" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;padding:18px 24px" onclick="selectStudent(${s.id})">
            <span style="font-weight:700;font-size:16px">${esc(s.name)}</span>
            <span style="font-size:13px;color:${o > 0 ? 'var(--error)' : 'var(--text-dim)'}">${o > 0 ? `฿${o.toLocaleString()}` : 'Clear'}</span>
        </div>`;
    }).join('');
}

window.selectStudent = async (id) => {
    activeStudentId = id;
    closeModal('studentSelectModal');
    await loadStudents(); await loadPending();
    showScreen('studentScreen');
    renderStudentView();
};

function renderStudentView() {
    const s = students.find(x => x.id === activeStudentId);
    if (!s) return;
    document.getElementById('studentViewName').textContent = s.name;
    const o = owed(s);
    document.getElementById('svOwed').textContent = o > 0 ? `฿${o.toLocaleString()}` : '฿0';
    document.getElementById('svPaid').textContent = `฿${totalPaid(s).toLocaleString()}`;
    document.getElementById('svWeeks').textContent = `${S.weekly_amount > 0 ? Math.floor(totalPaid(s) / S.weekly_amount) : 0} / ${weeksElapsed()}`;
    
    const hist = document.getElementById('studentHistory');
    const combined = [
        ...pendingList.filter(p => p.student_id === activeStudentId).map(p => ({ ...p, isPending: true })),
        ...(s.payments || []).map(p => ({ ...p, isPending: false }))
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    if (!combined.length) hist.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-dim)">No activity</p>';
    else {
        hist.innerHTML = combined.map(p => `
            <div class="history-item">
                <div><div style="font-weight:700;font-size:14px">${fmtDate(p.created_at)}</div><div style="font-size:12px;color:var(--text-dim)">${p.isPending ? 'Pending Verification' : 'Verified'}</div></div>
                <div style="font-weight:800;color:${p.isPending ? '#fff' : 'var(--success)'}">฿${p.amount.toLocaleString()}</div>
            </div>`).join('');
    }
}

function renderPending() {
    const el = document.getElementById('pendingList');
    if (!pendingList.length) { el.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-dim)">No requests</p>'; return; }
    el.innerHTML = pendingList.map(p => {
        const s = students.find(x => x.id === p.student_id);
        return `<div class="item-card" style="margin-bottom:16px;cursor:default">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                <div><div style="font-weight:800;font-size:15px">${s ? esc(s.name) : 'Unknown'}</div><div style="font-size:12px;color:var(--text-dim)">${ml(p.method)} &bull; ${fmtDate(p.created_at)}</div></div>
                <div style="font-weight:800;font-size:18px">฿${p.amount.toLocaleString()}</div>
            </div>
            ${p.slip_url ? `<img src="${p.slip_url}" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;cursor:pointer" onclick="document.getElementById('slipViewImg').src=this.src;openModal('slipViewModal')">` : ''}
            <div style="display:flex;gap:10px">
                <button class="btn btn-p" style="flex:1" onclick="approvePending(${p.id})">Approve</button>
                <button class="btn btn-s" style="flex:1;color:var(--error)" onclick="rejectPending(${p.id})">Reject</button>
            </div>
        </div>`;
    }).join('');
}

window.approvePending = async function (id) {
    const p = pendingList.find(x => x.id === id);
    if (!p) return;
    await supa.from('payments').insert({ student_id: p.student_id, amount: p.amount, method: p.method, note: p.note || '' });
    await supa.from('pending').delete().eq('id', id);
    await loadStudents(); await loadPending();
    renderPending(); refreshAdmin();
    toast('Verified');
};

window.rejectPending = async function (id) {
    await supa.from('pending').delete().eq('id', id);
    await loadPending(); renderPending(); refreshAdmin();
    toast('Rejected', 'error');
};

function setupUpload() {
    const area = document.getElementById('uploadArea');
    const fileInput = document.getElementById('slipFile');
    area.onclick = () => fileInput.click();
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        slipFileRef = file;
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('slipPreview').src = ev.target.result;
            document.getElementById('slipPreview').style.display = 'block';
            document.getElementById('uploadPlaceholder').style.display = 'none';
            document.getElementById('uploadForm').style.display = 'block';
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('cancelSlip').onclick = () => {
        slipFileRef = null;
        document.getElementById('slipPreview').style.display = 'none';
        document.getElementById('uploadPlaceholder').style.display = 'block';
        document.getElementById('uploadForm').style.display = 'none';
    };

    document.getElementById('submitSlip').onclick = async () => {
        const btn = document.getElementById('submitSlip');
        btn.textContent = 'Uploading...'; btn.disabled = true;
        const fileName = `${Date.now()}.jpg`;
        await supa.storage.from('slips').upload(fileName, slipFileRef);
        const { data } = supa.storage.from('slips').getPublicUrl(fileName);
        await supa.from('pending').insert({
            student_id: activeStudentId,
            amount: parseInt(document.getElementById('slipAmount').value),
            method: document.getElementById('slipMethod').value,
            note: document.getElementById('slipNote').value,
            slip_url: data.publicUrl
        });
        location.reload();
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings(); await loadStudents(); await loadPending(); listenPending();
    document.getElementById('loadingOverlay').classList.add('hidden');

    document.getElementById('loginAdmin').onclick = () => openModal('pinModal');
    document.getElementById('loginStudent').onclick = () => { renderStudentList(''); openModal('studentSelectModal'); };
    
    document.getElementById('pinSubmit').onclick = async () => {
        const h = await hashPin(document.getElementById('pinInput').value);
        if (h === S.pin_hash) { showScreen('adminScreen'); refreshAdmin(); closeModal('pinModal'); }
        else document.getElementById('pinError').style.display = 'block';
    };

    document.getElementById('studentSearch').oninput = e => renderStudentList(e.target.value);
    document.getElementById('adminSearch').oninput = refreshAdmin;
    
    document.getElementById('adminFilters').onclick = e => {
        const t = e.target.closest('.tab'); if (!t) return;
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); currentFilter = t.dataset.filter; refreshAdmin();
    };

    document.getElementById('logoutAdmin').onclick = () => location.reload();
    document.getElementById('logoutStudent').onclick = () => location.reload();
    document.getElementById('showPending').onclick = () => { renderPending(); openModal('pendingModal'); };

    document.getElementById('adminAddPayment').onclick = () => {
        document.getElementById('recStudent').innerHTML = students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        openModal('recordModal');
    };

    document.getElementById('recConfirm').onclick = async () => {
        await supa.from('payments').insert({
            student_id: +document.getElementById('recStudent').value,
            amount: +document.getElementById('recAmount').value,
            method: document.querySelector('input[name="recMethod"]:checked').value,
            note: document.getElementById('recNote').value
        });
        location.reload();
    };

    setupUpload();
});
