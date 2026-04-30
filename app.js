// ===== Supabase Payment Tracker =====
const TOTAL = 35;
let S = { start_date: '2026-05-14', weekly_amount: 40, pin_hash: '' };
let students = []; // [{id, name, payments:[]}]
let pendingList = [];
let currentFilter = 'all';
let activeStudentId = null;
let detailStudentId = null;
let slipFileRef = null;

// ===== SHA-256 Hash (so PIN is never stored as plain text) =====
async function hashPin(pin) {
    const data = new TextEncoder().encode(pin);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Helpers =====
const weeksElapsed = () => { const d = new Date() - new Date(S.start_date); return d < 0 ? 0 : Math.floor(d / 604800000) + 1; };
const totalPaid = s => (s.payments || []).reduce((a, p) => a + p.amount, 0);
const owed = s => weeksElapsed() * S.weekly_amount - totalPaid(s);
const ml = m => ({ promptpay: 'PromptPay', kbank: 'KBank', truemoney: 'TrueMoney', cash: 'Cash' }[m] || m);
const mb = m => `badge-${m}`;
const esc = str => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function toast(msg, type = 'success') {
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function openModal(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
window.openModal = openModal; window.closeModal = closeModal;

// ===== Supabase Data =====
async function loadSettings() {
    const { data } = await supa.from('settings').select('*').eq('id', 1).single();
    if (data) S = data;
}
async function saveSettings() {
    await supa.from('settings').update(S).eq('id', 1);
}

async function loadStudents() {
    const { data: studs } = await supa.from('students').select('*').order('id');
    const { data: pays } = await supa.from('payments').select('*').order('created_at');
    students = (studs || []).map(s => ({
        ...s,
        payments: (pays || []).filter(p => p.student_id === s.id)
    }));
}

async function loadPending() {
    const { data } = await supa.from('pending').select('*').order('created_at', { ascending: false });
    pendingList = data || [];
}

function listenPending() {
    supa.channel('pending-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pending' }, async () => {
            await loadPending();
            document.getElementById('pendingCount').textContent = pendingList.length;
            document.getElementById('pendingCount').style.display = pendingList.length > 0 ? '' : 'none';
            if (activeStudentId) renderStudentView();
        })
        .subscribe();
}

// ===== Admin Stats =====
function updateAdminStats() {
    const w = weeksElapsed();
    let paid = 0, owedTotal = 0, owedC = 0, clearC = 0, overC = 0;
    students.forEach(s => {
        paid += totalPaid(s);
        const o = owed(s);
        if (o > 0) { owedTotal += o; owedC++; } else if (o < 0) overC++; else clearC++;
    });
    document.getElementById('sTotalStudents').textContent = TOTAL;
    document.getElementById('sTotalCollected').textContent = `฿${paid.toLocaleString()}`;
    document.getElementById('sTotalOwed').textContent = `฿${owedTotal.toLocaleString()}`;
    const exp = w * S.weekly_amount * TOTAL;
    document.getElementById('sRate').textContent = exp > 0 ? `${Math.round(paid / exp * 100)}%` : '0%';
    document.getElementById('sWeek').textContent = w;
    document.getElementById('sStart').textContent = fmtDate(S.start_date);
    document.getElementById('sExpected').textContent = `฿${(w * S.weekly_amount).toLocaleString()}`;
    document.getElementById('cAll').textContent = TOTAL;
    document.getElementById('cOwed').textContent = owedC;
    document.getElementById('cPaid').textContent = clearC;
    document.getElementById('cOver').textContent = overC;
    document.getElementById('pendingCount').textContent = pendingList.length;
    document.getElementById('pendingCount').style.display = pendingList.length > 0 ? '' : 'none';
}

function renderAdminGrid() {
    const grid = document.getElementById('adminGrid');
    const q = document.getElementById('adminSearch').value.toLowerCase();
    grid.innerHTML = '';
    const list = students.filter(s => {
        if (!(s.name.toLowerCase().includes(q) || `#${s.id}`.includes(q))) return false;
        const o = owed(s);
        if (currentFilter === 'owed') return o > 0;
        if (currentFilter === 'paid') return o === 0;
        if (currentFilter === 'overpaid') return o < 0;
        return true;
    });
    if (!list.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">No students found</div>'; return; }
    list.forEach(s => {
        const p = totalPaid(s), o = owed(s);
        let sc, sb, st;
        if (o > 0) { sc = 'status-owed'; sb = 'status-badge-owed'; st = 'Owed'; }
        else if (o < 0) { sc = 'status-overpaid'; sb = 'status-badge-overpaid'; st = 'Ahead'; }
        else { sc = 'status-clear'; sb = 'status-badge-clear'; st = 'Clear'; }
        const methods = [...new Set((s.payments || []).map(p => p.method))].map(m => `<span class="method-badge ${mb(m)}">${ml(m)}</span>`).join('');
        const card = document.createElement('div');
        card.className = `student-card ${sc}`;
        card.innerHTML = `
            <div class="card-top"><span class="student-number">#${s.id}</span><span class="student-status ${sb}">${st}</span></div>
            <div class="student-name"><input type="text" value="${esc(s.name)}" data-id="${s.id}" class="name-input" onclick="event.stopPropagation()"></div>
            <div class="card-amounts">
                <div class="amount-group"><span class="amount-label">Paid</span><span class="amount-paid ${p === 0 ? 'amount-zero' : ''}">฿${p.toLocaleString()}</span></div>
                <div class="amount-group" style="text-align:right"><span class="amount-label">${o >= 0 ? 'Owes' : 'Ahead'}</span><span class="${o > 0 ? 'amount-owed' : o < 0 ? 'amount-paid' : 'amount-paid amount-zero'}">฿${Math.abs(o).toLocaleString()}</span></div>
            </div>
            ${methods ? `<div class="card-methods">${methods}</div>` : ''}`;
        card.addEventListener('click', () => openDetail(s.id));
        grid.appendChild(card);
    });
    grid.querySelectorAll('.name-input').forEach(inp => {
        inp.addEventListener('change', async e => {
            const id = +e.target.dataset.id;
            const newName = e.target.value.trim() || `Student ${id}`;
            await supa.from('students').update({ name: newName }).eq('id', id);
            const st = students.find(s => s.id === id);
            if (st) st.name = newName;
            toast(`Renamed to "${newName}"`);
        });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    });
}

function refreshAdmin() { updateAdminStats(); renderAdminGrid(); }

// ===== Detail Modal =====
function openDetail(id) {
    detailStudentId = id;
    const s = students.find(x => x.id === id);
    if (!s) return;
    document.getElementById('detailName').textContent = `${s.name} (#${s.id})`;
    document.getElementById('dPaid').textContent = `฿${totalPaid(s).toLocaleString()}`;
    const o = owed(s);
    const el = document.getElementById('dOwed');
    el.textContent = `฿${Math.abs(o).toLocaleString()}`;
    el.style.color = o > 0 ? 'var(--red)' : o < 0 ? 'var(--green)' : 'var(--text-dim)';
    document.getElementById('dWeeks').textContent = `${S.weekly_amount > 0 ? Math.floor(totalPaid(s) / S.weekly_amount) : 0} / ${weeksElapsed()}`;
    const hist = document.getElementById('detailHistory');
    if (!(s.payments || []).length) { hist.innerHTML = '<p class="no-data">No payments yet</p>'; }
    else {
        hist.innerHTML = [...s.payments].reverse().map(p => `
            <div class="history-item">
                <div class="history-left"><span class="history-method method-badge ${mb(p.method)}">${ml(p.method)}</span>
                    <div class="history-info"><span class="history-date">${fmtDate(p.created_at)}</span>${p.note ? `<span class="history-note">${esc(p.note)}</span>` : ''}</div>
                </div>
                <span class="history-amount">฿${p.amount.toLocaleString()}</span>
            </div>`).join('');
    }
    openModal('detailModal');
}

// ===== Pending =====
function renderPending() {
    const el = document.getElementById('pendingList');
    if (!pendingList.length) { el.innerHTML = '<p class="no-data">No pending slips</p>'; return; }
    el.innerHTML = pendingList.map(p => {
        const s = students.find(x => x.id === p.student_id);
        return `<div class="pending-item">
            <div class="pending-top"><span class="pending-name">${s ? esc(s.name) : 'Unknown'} (#${p.student_id})</span><span class="pending-amount">฿${p.amount.toLocaleString()}</span></div>
            <div class="pending-meta">${ml(p.method)} · ${fmtDate(p.created_at)}${p.note ? ` · ${esc(p.note)}` : ''}</div>
            ${p.slip_url ? `<img src="${p.slip_url}" class="pending-slip" onclick="document.getElementById('slipViewImg').src=this.src;openModal('slipViewModal')">` : ''}
            <div class="pending-actions">
                <button class="btn btn-success" onclick="approvePending(${p.id})">✓ Approve</button>
                <button class="btn btn-danger" onclick="rejectPending(${p.id})">✗ Reject</button>
            </div>
        </div>`;
    }).join('');
}

window.approvePending = async function (pendingId) {
    const p = pendingList.find(x => x.id === pendingId);
    if (!p) return;
    await supa.from('payments').insert({ student_id: p.student_id, amount: p.amount, method: p.method, note: p.note || '' });
    await supa.from('pending').delete().eq('id', pendingId);
    await loadStudents(); await loadPending();
    const s = students.find(x => x.id === p.student_id);
    renderPending(); refreshAdmin();
    toast(`Approved for ${s ? s.name : 'student'}`);
};

window.rejectPending = async function (pendingId) {
    const p = pendingList.find(x => x.id === pendingId);
    if (p && p.slip_url) {
        const path = p.slip_url.split('/slips/')[1];
        if (path) await supa.storage.from('slips').remove([decodeURIComponent(path)]);
    }
    await supa.from('pending').delete().eq('id', pendingId);
    await loadPending();
    renderPending(); refreshAdmin();
    toast('Rejected', 'error');
};

// ===== Student View =====
function renderStudentView() {
    if (!activeStudentId) return;
    const s = students.find(x => x.id === activeStudentId);
    if (!s) return;
    document.getElementById('studentViewName').textContent = s.name;
    document.getElementById('studentViewSub').textContent = `Student #${s.id} · Payment Status`;
    const o = owed(s);
    document.getElementById('svOwed').textContent = o > 0 ? `฿${o.toLocaleString()}` : '฿0';
    document.getElementById('svPaid').textContent = `฿${totalPaid(s).toLocaleString()}`;
    document.getElementById('svWeeks').textContent = `${S.weekly_amount > 0 ? Math.floor(totalPaid(s) / S.weekly_amount) : 0} / ${weeksElapsed()}`;
    const hist = document.getElementById('studentHistory');
    const myPending = pendingList.filter(p => p.student_id === activeStudentId);
    const allItems = [
        ...myPending.map(p => ({ ...p, isPending: true })),
        ...(s.payments || []).map(p => ({ ...p, isPending: false }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!allItems.length) { hist.innerHTML = '<p class="no-data">No payments yet. Upload a slip above!</p>'; return; }
    hist.innerHTML = allItems.map(p => `
        <div class="history-item">
            <div class="history-left"><span class="history-method method-badge ${mb(p.method)}">${ml(p.method)}</span>
                <div class="history-info"><span class="history-date">${fmtDate(p.created_at)}</span>${p.note ? `<span class="history-note">${esc(p.note)}</span>` : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
                <span class="history-amount">฿${p.amount.toLocaleString()}</span>
                <span class="history-status ${p.isPending ? 'status-pending' : 'status-approved'}">${p.isPending ? 'Pending' : 'Approved'}</span>
            </div>
        </div>`).join('');
}

// ===== Slip Upload =====
function setupUpload() {
    const area = document.getElementById('uploadArea');
    const fileInput = document.getElementById('slipFile');
    const preview = document.getElementById('slipPreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const form = document.getElementById('uploadForm');

    area.addEventListener('click', () => { if (!slipFileRef) fileInput.click(); });
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => { e.preventDefault(); area.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    document.getElementById('cancelSlip').addEventListener('click', resetUpload);
    document.getElementById('submitSlip').addEventListener('click', async () => {
        if (!slipFileRef || !activeStudentId) return;
        const amount = parseInt(document.getElementById('slipAmount').value);
        if (!amount || amount <= 0) { toast('Enter valid amount', 'error'); return; }
        const btn = document.getElementById('submitSlip');
        btn.textContent = 'Uploading...'; btn.disabled = true;
        try {
            const fileName = `${Date.now()}_${activeStudentId}.jpg`;
            const { error: upErr } = await supa.storage.from('slips').upload(fileName, slipFileRef, { contentType: slipFileRef.type });
            if (upErr) throw upErr;
            const { data: urlData } = supa.storage.from('slips').getPublicUrl(fileName);
            await supa.from('pending').insert({
                student_id: activeStudentId,
                amount,
                method: document.getElementById('slipMethod').value,
                note: document.getElementById('slipNote').value.trim(),
                slip_url: urlData.publicUrl
            });
            resetUpload();
            await loadPending();
            renderStudentView();
            toast('Slip submitted for admin review!');
        } catch (err) {
            console.error(err);
            toast('Upload failed: ' + err.message, 'error');
        }
        btn.textContent = 'Submit for Review'; btn.disabled = false;
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) { toast('Please upload an image', 'error'); return; }
        slipFileRef = file;
        const reader = new FileReader();
        reader.onload = e => {
            preview.src = e.target.result; preview.style.display = 'block';
            placeholder.style.display = 'none'; form.style.display = 'block';
            document.getElementById('slipAmount').value = S.weekly_amount;
            detectMethod(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    function resetUpload() {
        slipFileRef = null; preview.style.display = 'none'; placeholder.style.display = '';
        form.style.display = 'none'; fileInput.value = '';
    }
    function detectMethod(src) {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = Math.min(img.width, 400); c.height = Math.min(img.height, 100);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let r = 0, g = 0, b = 0, n = d.length / 4;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
            r /= n; g /= n; b /= n;
            const sel = document.getElementById('slipMethod');
            if (g > r && g > b && g > 100) sel.value = 'kbank';
            else if (b > r && b > g && b > 100) sel.value = 'promptpay';
            else if (r > g && r > b && r > 150 && g < 130) sel.value = 'truemoney';
        };
        img.src = src;
    }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadSettings();
        await loadStudents();
        await loadPending();
        listenPending();
    } catch (err) {
        console.error('Supabase error:', err);
        toast('Connection error — check Supabase config', 'error');
    }
    document.getElementById('loadingOverlay').classList.add('hidden');

    // Login
    document.getElementById('loginAdmin').addEventListener('click', () => openModal('pinModal'));
    document.getElementById('loginStudent').addEventListener('click', () => { renderStudentList(''); openModal('studentSelectModal'); });

    // PIN (compared as hash — plain PIN never stored)
    const checkPin = async () => {
        const inputHash = await hashPin(document.getElementById('pinInput').value);
        if (inputHash === S.pin_hash) {
            closeModal('pinModal'); document.getElementById('pinInput').value = '';
            document.getElementById('pinError').style.display = 'none';
            showScreen('adminScreen'); refreshAdmin();
        } else document.getElementById('pinError').style.display = 'block';
    };
    document.getElementById('pinSubmit').addEventListener('click', checkPin);
    document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });

    // Student select
    document.getElementById('studentSearch').addEventListener('input', e => renderStudentList(e.target.value));
    function renderStudentList(q) {
        const list = document.getElementById('studentSelectList');
        const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || `#${s.id}`.includes(q));
        list.innerHTML = filtered.map(s => {
            const o = owed(s);
            return `<div class="student-list-item" data-id="${s.id}">
                <span class="sli-name">${esc(s.name)} <span style="color:var(--text-muted);font-weight:400">#${s.id}</span></span>
                <span class="sli-owed ${o <= 0 ? 'sli-clear' : ''}">${o > 0 ? `Owes ฿${o.toLocaleString()}` : 'Clear ✓'}</span>
            </div>`;
        }).join('');
        list.querySelectorAll('.student-list-item').forEach(item => {
            item.addEventListener('click', async () => {
                activeStudentId = +item.dataset.id;
                closeModal('studentSelectModal');
                await loadStudents(); await loadPending();
                showScreen('studentScreen'); renderStudentView();
            });
        });
    }

    // Logout
    document.getElementById('logoutAdmin').addEventListener('click', () => showScreen('loginScreen'));
    document.getElementById('logoutStudent').addEventListener('click', () => { activeStudentId = null; showScreen('loginScreen'); });

    // Admin filters
    document.getElementById('adminFilters').addEventListener('click', e => {
        const tab = e.target.closest('.filter-tab'); if (!tab) return;
        document.querySelectorAll('#adminFilters .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); currentFilter = tab.dataset.filter; renderAdminGrid();
    });
    document.getElementById('adminSearch').addEventListener('input', renderAdminGrid);

    // Record payment
    document.getElementById('adminAddPayment').addEventListener('click', () => {
        document.getElementById('recStudent').innerHTML = students.map(s => `<option value="${s.id}">${esc(s.name)} (#${s.id}) — owes ฿${Math.max(0, owed(s)).toLocaleString()}</option>`).join('');
        document.getElementById('recAmount').value = S.weekly_amount;
        document.getElementById('recNote').value = '';
        openModal('recordModal');
    });
    document.getElementById('recConfirm').addEventListener('click', async () => {
        const id = +document.getElementById('recStudent').value;
        const amt = parseInt(document.getElementById('recAmount').value);
        const method = document.querySelector('input[name="recMethod"]:checked').value;
        const note = document.getElementById('recNote').value.trim();
        if (!amt || amt <= 0) { toast('Invalid amount', 'error'); return; }
        await supa.from('payments').insert({ student_id: id, amount: amt, method, note });
        await loadStudents();
        closeModal('recordModal'); refreshAdmin();
        const s = students.find(x => x.id === id);
        toast(`฿${amt} recorded for ${s ? s.name : 'student'}`);
    });

    // Detail actions
    document.getElementById('detailDeleteLast').addEventListener('click', async () => {
        const s = students.find(x => x.id === detailStudentId);
        if (!s || !(s.payments || []).length) { toast('Nothing to delete', 'error'); return; }
        if (confirm('Delete the last payment?')) {
            const last = s.payments[s.payments.length - 1];
            await supa.from('payments').delete().eq('id', last.id);
            await loadStudents(); refreshAdmin(); openDetail(detailStudentId);
            toast('Payment deleted');
        }
    });
    document.getElementById('detailPay').addEventListener('click', () => {
        closeModal('detailModal');
        document.getElementById('recStudent').innerHTML = students.map(s => `<option value="${s.id}" ${s.id === detailStudentId ? 'selected' : ''}>${esc(s.name)} (#${s.id})</option>`).join('');
        document.getElementById('recAmount').value = S.weekly_amount;
        openModal('recordModal');
    });

    // Pending
    document.getElementById('showPending').addEventListener('click', () => { renderPending(); openModal('pendingModal'); });

    // Settings
    document.getElementById('adminSettings').addEventListener('click', () => {
        document.getElementById('setDate').value = S.start_date;
        document.getElementById('setAmount').value = S.weekly_amount;
        document.getElementById('setPin').value = ''; // never show the PIN
        document.getElementById('setPin').placeholder = 'Enter new PIN (leave blank to keep current)';
        openModal('settingsModal');
    });
    document.getElementById('saveSettings').addEventListener('click', async () => {
        const d = document.getElementById('setDate').value;
        const a = parseInt(document.getElementById('setAmount').value);
        const p = document.getElementById('setPin').value.trim();
        if (!d || !a || a <= 0) { toast('Fill all fields', 'error'); return; }
        S.start_date = d; S.weekly_amount = a;
        if (p) S.pin_hash = await hashPin(p); // only update PIN if changed
        await saveSettings();
        closeModal('settingsModal'); refreshAdmin();
        toast('Settings saved');
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = { settings: S, students, pending: pendingList };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `payment-tracker-${new Date().toISOString().split('T')[0]}.json`;
        a.click(); toast('Exported');
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const data = JSON.parse(await f.text());
            if (data.students) {
                for (const s of data.students) {
                    await supa.from('students').update({ name: s.name }).eq('id', s.id);
                    if (s.payments) {
                        for (const p of s.payments) {
                            await supa.from('payments').insert({ student_id: s.id, amount: p.amount, method: p.method, note: p.note || '' });
                        }
                    }
                }
                if (data.settings) { S = data.settings; await saveSettings(); }
                await loadStudents();
                closeModal('settingsModal'); refreshAdmin();
                toast('Imported');
            }
        } catch { toast('Import error', 'error'); }
        e.target.value = '';
    });

    // Reset
    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (confirm('DELETE all data?')) {
            await supa.from('payments').delete().neq('id', 0);
            await supa.from('pending').delete().neq('id', 0);
            for (let i = 1; i <= TOTAL; i++) await supa.from('students').update({ name: `Student ${i}` }).eq('id', i);
            S = { id: 1, start_date: '2026-05-14', weekly_amount: 40, pin_hash: await hashPin('11223344') };
            await saveSettings();
            await loadStudents(); pendingList = [];
            closeModal('settingsModal'); refreshAdmin();
            toast('All data reset');
        }
    });

    setupUpload();
});
