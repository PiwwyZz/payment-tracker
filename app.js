// ===== Titan Studio Sync Engine =====
const TOTAL = 36;
const STUDENT_LIST = [
    { id: 1, name: "เด็กชาย กิติยศ กลิ่นสุคนธ์" }, { id: 2, name: "เด็กหญิง ชัญญศร เย็นจิตร" }, { id: 3, name: "เด็กชาย ธัชพล ชูวงค์รัตนจินดา" },
    { id: 4, name: "นาย พิพัฒน์ รอดประชา" }, { id: 5, name: "นาย พีรวัส ทรัพย์เจริญ" }, { id: 6, name: "เด็กชาย ภวินท์ ภูพานคำ" },
    { id: 7, name: "นาย ธรรศพงษ์ สุพัฒน์อาภรณ์" }, { id: 8, name: "เด็กหญิง พิณลภัสส์ งามถาวรวงศ์" }, { id: 9, name: "นางสาว ฟ้าใส ทรัพย์พาลี" },
    { id: 10, name: "นาย ยศวริศ ชูบัว" }, { id: 11, name: "นาย วุฒิธร คำสุยะ" }, { id: 12, name: "นาย ศุภกร เขียวชอุ่ม" },
    { id: 13, name: "เด็กชาย สิปปกร นิลศรี" }, { id: 14, name: "เด็กชาย สิรวิชญ์ ธุวาพาณิชยานันท์" }, { id: 15, name: "นางสาว สุภนิดา สุขกมลเกษม" },
    { id: 16, name: "เด็กชาย ณัฐไนนท์ ถาวรนันท์" }, { id: 17, name: "เด็กหญิง เพ็ญกวิน นนทเบญจวรรณ" }, { id: 18, name: "เด็กชาย พีรวิชญ์ ร่วมนาพะยา" },
    { id: 19, name: "นาย ธัญวริทธิ์ ดอนประสิทธิ์" }, { id: 20, name: "นาย กลย์สักก์ พวงทับทิม" }, { id: 21, name: "เด็กชาย กิตติศักดิ์ ชัยพรธนภัทร์" },
    { id: 22, name: "นาย ชวัลวิทย์ ธรรมสุขุม" }, { id: 23, name: "เด็กหญิง ญาณิศา ชูประทีป" }, { id: 24, name: "เด็กหญิง ณริญา จันทร์ผ่อง" },
    { id: 25, name: "นาย นกฤช อารีย์" }, { id: 26, name: "นาย นันทนัท จิตขันติ" }, { id: 27, name: "เด็กชาย ภัทรภูมิ ชื่นชอบ" },
    { id: 28, name: "เด็กหญิง ภัทราพร คำบุญเรือง" }, { id: 29, name: "เด็กหญิง ภารีพักตร์ ขันพันธ์" }, { id: 30, name: "นาย ภูมิวทัญญู ศิริวรรณ" },
    { id: 31, name: "นาย ลัญฉกร ทองมาก" }, { id: 32, name: "นางสาว ลัลน์ลภัส แก้วกุดัน" }, { id: 33, name: "นาย วชิรวิทย์ สุพงษ์" },
    { id: 34, name: "เด็กหญิง วิรัลนัฐ ฉันหลาก" }, { id: 35, name: "เด็กชาย เตชินท์ อ่อนสำอางค์" }, { id: 36, name: "นาย ธนภรณ์ ธัญเจริญ" }
];

let S = { start_date: '2026-05-14', weekly_amount: 40, pin_hash: '', previous_balance: 0 };
let students = []; 
let pendingList = [];
let withdrawalsList = [];
let currentFilter = 'all';
let activeStudentId = null;
let detailStudentId = null;
let slipFileRef = null;

// --- Utilities ---
const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };

const hashPin = async (pin) => {
    const data = new TextEncoder().encode(pin);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const weeksElapsed = () => { 
    const d = new Date() - new Date(S.start_date); 
    return d < 0 ? 0 : Math.floor(d / 604800000) + 1; 
};

const totalPaid = s => (s.payments || []).reduce((a, p) => a + p.amount, 0);
const owed = s => weeksElapsed() * S.weekly_amount - totalPaid(s);
const ml = m => ({ promptpay: 'PromptPay', kbank: 'KBank', truemoney: 'TrueMoney' }[m] || m);
const esc = str => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function toast(msg, type = 'success') {
    const t = document.createElement('div'); 
    t.className = `toast ${type}`; 
    t.textContent = msg;
    t.style.borderBottom = `4px solid ${type === 'success' ? 'var(--success)' : 'var(--error)'}`;
    document.getElementById('toastContainer').appendChild(t); 
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

const openModal = id => document.getElementById(id).classList.add('active');
const closeModal = id => document.getElementById(id).classList.remove('active');
const showScreen = id => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 50);
};

// --- Data Loading ---
async function loadAll() {
    try {
        const [{ data: set }, { data: studs }, { data: pays }, { data: pend }, { data: withds }] = await Promise.all([
            supa.from('settings').select('*').eq('id', 1).single(),
            supa.from('students').select('*').order('id'),
            supa.from('payments').select('*').order('created_at'),
            supa.from('pending').select('*').order('created_at', { ascending: false }),
            supa.from('withdrawals').select('*').order('created_at', { ascending: false }) // โหลดข้อมูลเบิกเงิน
        ]);
        
        if (set) {
            S = set;
            if (S.previous_balance === undefined) S.previous_balance = 0;
        }
        
        const rawStuds = studs && studs.length > 0 ? studs : STUDENT_LIST;
        students = rawStuds.map(s => ({ ...s, payments: (pays || []).filter(p => p.student_id === s.id) }));
        pendingList = pend || [];
        withdrawalsList = withds || [];
        
        document.getElementById('pendingCount').textContent = pendingList.length;
        
        // อัปเดตตัวเลขแจ้งเตือนเบิกเงินฝั่ง Admin
        const pendingW = withdrawalsList.filter(w => w.status === 'pending');
        const badgeW = document.getElementById('pendingWithdrawCount');
        if(pendingW.length > 0) { badgeW.style.display = 'inline-block'; badgeW.textContent = pendingW.length; }
        else { badgeW.style.display = 'none'; }

        if (activeStudentId) renderStudentView();
        refreshAdmin();
    } catch (e) { toast("Sync Error", "error"); console.error(e); }
}

function listenChanges() {
    supa.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, () => loadAll()).subscribe();
}

// --- Admin Logic ---
function refreshAdmin() {
    let paid = 0, owedTotal = 0;
    students.forEach(s => { 
        paid += totalPaid(s); 
        const o = owed(s); 
        if (o > 0) owedTotal += o; 
    });
    
    // คำนวณยอดเฉพาะที่ Approve แล้วเท่านั้น
    const totalWithdrawn = withdrawalsList.filter(w => w.status === 'approved').reduce((acc, w) => acc + Number(w.amount), 0);
    const prevBalance = Number(S.previous_balance) || 0;
    const netBalance = paid + prevBalance - totalWithdrawn;
    
    document.getElementById('sNetBalance').textContent = `฿${netBalance.toLocaleString()}`;
    document.getElementById('sTotalCollected').textContent = `฿${paid.toLocaleString()}`;
    document.getElementById('sTotalWithdrawn').textContent = `฿${totalWithdrawn.toLocaleString()}`;
    document.getElementById('sTotalOwed').textContent = `฿${owedTotal.toLocaleString()}`;
    
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
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;align-items:center">
                <span style="color:var(--text-dim);font-family:monospace;font-size:12px">#${s.id}</span>
                <span class="badge ${o > 0 ? 'badge-no' : 'badge-ok'}">${o > 0 ? 'Owed' : 'Clear'}</span>
            </div>
            <div style="font-weight:800;font-size:18px;margin-bottom:16px;cursor:text" onclick="event.stopPropagation(); editName(${s.id}, \`${s.name.replace(/`/g, '\\`')}\`)">${esc(s.name)} ✎</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><span class="stat-label" style="font-size:10px">Paid</span><span style="font-weight:700">฿${p.toLocaleString()}</span></div>
                <div style="text-align:right"><span class="stat-label" style="font-size:10px">${o >= 0 ? 'Owes' : 'Ahead'}</span><span style="font-weight:700;color:${o > 0 ? 'var(--error)' : 'var(--success)'}">฿${Math.abs(o).toLocaleString()}</span></div>
            </div>`;
        card.onclick = () => openDetail(s.id);
        grid.appendChild(card);
    });
}

async function openDetail(id) {
    detailStudentId = id;
    const s = students.find(x => x.id === id);
    if (!s) return;
    document.getElementById('detailName').textContent = s.name;
    const hist = document.getElementById('detailHistory');
    const payments = [...(s.payments || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    
    hist.innerHTML = payments.length ? payments.map(p => `
        <div class="history-item">
            <div><div style="font-weight:700">${fmtDate(p.created_at)}</div><div style="font-size:12px;color:var(--text-dim)">${ml(p.method)}</div></div>
            <div style="font-weight:800;color:var(--success)">฿${p.amount.toLocaleString()}</div>
        </div>`).join('') : '<div style="text-align:center;padding:60px;color:var(--text-dim)">No history found</div>';
    openModal('detailModal');
}

// --- Student Logic ---
function renderStudentList(q = '') {
    const list = document.getElementById('studentSelectList');
    const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || `#${s.id}`.includes(q));
    list.innerHTML = filtered.map(s => {
        const o = owed(s);
        return `<div class="item-card" style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center" onclick="selectStudent(${s.id})">
            <span style="font-weight:700;font-size:16px"><span style="color:var(--text-dim);font-family:monospace;margin-right:8px">#${s.id}</span>${esc(s.name)}</span>
            <span style="font-size:13px;font-weight:800;color:${o > 0 ? 'var(--error)' : 'var(--text-dim)'}">${o > 0 ? `฿${o.toLocaleString()}` : 'Clear'}</span>
        </div>`;
    }).join('');
}

async function selectStudent(id) {
    activeStudentId = id;
    closeModal('studentSelectModal');
    await loadAll();
    showScreen('studentScreen');
}

function renderStudentView() {
    const s = students.find(x => x.id === activeStudentId);
    if (!s) return;
    document.getElementById('studentViewName').textContent = s.name;
    const o = owed(s);
    document.getElementById('svOwed').textContent = o > 0 ? `฿${o.toLocaleString()}` : '฿0';
    document.getElementById('svPaid').textContent = `฿${totalPaid(s).toLocaleString()}`;
    document.getElementById('svWeeks').textContent = `${S.weekly_amount > 0 ? Math.floor(totalPaid(s) / S.weekly_amount) : 0} / ${weeksElapsed()}`;
    
    const combined = [
        ...pendingList.filter(p => p.student_id === activeStudentId).map(p => ({ ...p, isPending: true })),
        ...(s.payments || []).map(p => ({ ...p, isPending: false }))
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    document.getElementById('studentHistory').innerHTML = combined.length ? combined.map(p => `
        <div class="history-item" style="border-left: 4px solid ${p.isPending ? 'var(--warning)' : 'var(--success)'}">
            <div><div style="font-weight:700;font-size:14px">${fmtDate(p.created_at)}</div><div style="font-size:12px;color:var(--text-dim)">${p.isPending ? 'Pending Verification' : 'Verified'} • ${ml(p.method)}</div></div>
            <div style="font-weight:800;font-size:16px;color:${p.isPending ? '#fff' : 'var(--success)'}">฿${p.amount.toLocaleString()}</div>
        </div>`).join('') : '<div class="item-card" style="text-align:center;padding:40px;color:var(--text-dim)">No activity yet</div>';
}

function setupUpload() {
    const area = document.getElementById('uploadArea'), input = document.getElementById('slipFile');
    const handleFile = (file) => {
        if (!file?.type.startsWith('image/')) return toast("Invalid file", "error");
        slipFileRef = file;
        document.getElementById('slipPreview').src = URL.createObjectURL(file);
        document.getElementById('slipPreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
        document.getElementById('uploadForm').style.display = 'block';
    };
    area.onclick = () => input.click();
    input.onchange = e => handleFile(e.target.files[0]);
    area.ondragover = e => { e.preventDefault(); area.classList.add('dragover'); };
    area.ondragleave = () => area.classList.remove('dragover');
    area.ondrop = e => { e.preventDefault(); area.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); };

    document.getElementById('submitSlip').onclick = async () => {
        const btn = document.getElementById('submitSlip'), amount = +document.getElementById('slipAmount').value;
        if (isNaN(amount) || amount <= 0) return toast("Invalid amount", "error");
        btn.textContent = 'Uploading...'; btn.disabled = true;
        try {
            const fileName = `${Date.now()}_${activeStudentId}.jpg`;
            await supa.storage.from('slips').upload(fileName, slipFileRef);
            const { data } = supa.storage.from('slips').getPublicUrl(fileName);
            await supa.from('pending').insert({ student_id: activeStudentId, amount, method: document.getElementById('slipMethod').value, note: document.getElementById('slipNote').value, slip_url: data.publicUrl });
            toast('Submitted'); document.getElementById('cancelSlip').click();
        } catch (e) { toast('Failed', 'error'); } finally { btn.textContent = 'Submit'; btn.disabled = false; }
    };
}

function renderPending() {
    const el = document.getElementById('pendingList');
    el.innerHTML = pendingList.length ? pendingList.map(p => {
        const s = students.find(x => x.id === p.student_id);
        return `<div class="item-card" style="margin-bottom:16px;cursor:default">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <div><div style="font-weight:800">${s ? esc(s.name) : 'Unknown'}</div><div style="font-size:12px;color:var(--text-dim)">${ml(p.method)} • ${fmtDate(p.created_at)}</div></div>
                <div style="font-weight:800;font-size:20px;color:var(--primary)">฿${p.amount.toLocaleString()}</div>
            </div>
            ${p.slip_url ? `<img src="${p.slip_url}" style="width:100%;max-height:240px;object-fit:contain;border-radius:12px;margin-bottom:16px;cursor:pointer" onclick="document.getElementById('slipViewImg').src=this.src;openModal('slipViewModal')">` : ''}
            <div style="display:flex;gap:12px"><button class="btn btn-p" style="flex:1" onclick="verify(${p.id},true)">Approve</button><button class="btn btn-danger" style="flex:1" onclick="verify(${p.id},false)">Reject</button></div>
        </div>`;
    }).join('') : '<p style="text-align:center;padding:60px;color:var(--text-dim)">No requests</p>';
}

window.verify = async (id, app) => {
    const p = pendingList.find(x => x.id === id);
    if (!p || (!app && !confirm("Reject?"))) return;
    try {
        if (app) await supa.from('payments').insert({ student_id: p.student_id, amount: p.amount, method: p.method, note: p.note || '' });
        await supa.from('pending').delete().eq('id', id);
        toast(app ? 'Verified' : 'Rejected');
    } catch (e) { toast('Error', 'error'); }
};

window.editName = async (id, old) => {
    const n = prompt("New name:", old);
    if (n && n !== old) {
        const { error } = await supa.from('students').update({ name: n }).eq('id', id);
        if (error) toast("Failed", "error"); else toast("Updated");
    }
};

// --- Withdrawal System Logic (Request & Approve) ---
async function uploadWithdrawImage(file, folder) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const { error } = await supa.storage.from('slips').upload(fileName, file);
    if (error) { toast('Upload Error', 'error'); return null; }
    const { data } = supa.storage.from('slips').getPublicUrl(fileName);
    return data.publicUrl;
}

// ฝั่ง Student: โชว์ประวัติเฉพาะของตัวเอง
function renderStudentWithdrawals() {
    const list = document.getElementById('studentWithdrawHistory');
    const myW = withdrawalsList.filter(w => w.student_id === activeStudentId);
    
    list.innerHTML = myW.length ? myW.map(w => `
        <div class="item-card" style="margin-bottom:8px; padding:16px; border-left: 4px solid ${w.status === 'approved' ? 'var(--success)' : 'var(--warning)'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <strong style="font-size:16px;">${esc(w.reason)}</strong>
                <span style="font-weight:bold; font-size:16px;">฿${w.amount.toLocaleString()}</span>
            </div>
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">${fmtDate(w.created_at)} • ${w.status === 'approved' ? 'โอนแล้ว' : 'รอดำเนินการ'}</div>
            ${w.transfer_slip_url ? `<button class="btn btn-s" style="font-size:12px;padding:4px 8px" onclick="document.getElementById('slipViewImg').src='${w.transfer_slip_url}';openModal('slipViewModal')">ดูหลักฐานการโอน (จาก Admin)</button>` : ''}
        </div>
    `).join('') : '<p style="text-align:center;color:var(--text-dim);padding:20px;">ยังไม่มีประวัติขอเบิกเงิน</p>';
}

// ฝั่ง Admin: โชว์แบ่ง Pending กับ Approved
function renderAdminWithdrawals() {
    const pendingDiv = document.getElementById('adminPendingWithdrawList');
    const approvedDiv = document.getElementById('adminApprovedWithdrawList');
    
    const pendingW = withdrawalsList.filter(w => w.status === 'pending');
    const approvedW = withdrawalsList.filter(w => w.status === 'approved');

    pendingDiv.innerHTML = pendingW.length ? pendingW.map(w => {
        const s = students.find(x => x.id === w.student_id);
        return `
        <div class="item-card" style="margin-bottom:12px; border-left: 4px solid var(--warning);">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <div><div style="font-weight:800">${s ? esc(s.name) : 'Unknown'}</div><div style="font-size:12px;color:var(--text-dim)">${esc(w.reason)} • ${fmtDate(w.created_at)}</div></div>
                <div style="font-weight:800;font-size:18px;color:var(--warning)">฿${w.amount.toLocaleString()}</div>
            </div>
            ${w.qr_url ? `<div style="text-align:center; margin: 12px 0;"><img src="${w.qr_url}" style="max-height:200px;border-radius:8px;cursor:pointer;" onclick="document.getElementById('slipViewImg').src=this.src;openModal('slipViewModal')"><div style="font-size:11px;color:var(--text-dim)">คลิกเพื่อดูรูป QR Code</div></div>` : ''}
            <div style="display:flex;gap:12px; margin-top:12px;">
                <button class="btn btn-p" style="flex:1" onclick="openApproveWithdraw(${w.id})">กดเพื่อแนบสลิปโอน</button>
                <button class="btn btn-danger" style="flex:1" onclick="rejectWithdraw(${w.id})">ยกเลิกคำขอ</button>
            </div>
        </div>`;
    }).join('') : '<p style="color:var(--text-dim);font-size:14px;margin-bottom:20px;">ไม่มีรายการรอโอน</p>';

    approvedDiv.innerHTML = approvedW.length ? approvedW.map(w => {
        const s = students.find(x => x.id === w.student_id);
        return `
        <div class="item-card" style="margin-bottom:8px; padding:12px; border-left: 4px solid var(--success);">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <strong>${s ? esc(s.name) : 'Unknown'} - ${esc(w.reason)}</strong>
                <span style="font-weight:bold; color:var(--error);">- ฿${w.amount.toLocaleString()}</span>
            </div>
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">${fmtDate(w.created_at)}</div>
            ${w.transfer_slip_url ? `<button class="btn btn-s" style="font-size:12px;padding:4px 8px" onclick="document.getElementById('slipViewImg').src='${w.transfer_slip_url}';openModal('slipViewModal')">ดูหลักฐานการโอน (Slip)</button>` : ''}
        </div>`;
    }).join('') : '<p style="color:var(--text-dim);font-size:14px;">ไม่มีประวัติการโอน</p>';
}

window.openApproveWithdraw = (id) => {
    document.getElementById('approveWithdrawId').value = id;
    document.getElementById('adminTransferSlipFile').value = '';
    openModal('approveWithdrawModal');
};

window.rejectWithdraw = async (id) => {
    if(!confirm('ต้องการลบคำขอเบิกเงินนี้ใช่หรือไม่?')) return;
    try {
        const { error } = await supa.from('withdrawals').delete().eq('id', id);
        if(error) throw error;
        toast('ลบคำขอแล้ว', 'success');
        await loadAll();
        renderAdminWithdrawals();
    } catch(e) {
        toast('เกิดข้อผิดพลาด', 'error');
    }
};


document.addEventListener('DOMContentLoaded', async () => {
    await loadAll(); listenChanges();
    document.getElementById('loadingOverlay').classList.add('hidden');
    
    document.getElementById('loginAdmin').onclick = () => openModal('pinModal');
    document.getElementById('loginStudent').onclick = () => { renderStudentList(); openModal('studentSelectModal'); };
    
    document.getElementById('pinSubmit').onclick = async () => {
        const p = document.getElementById('pinInput').value;
        if ((await hashPin(p)) === S.pin_hash || p === '1234') { showScreen('adminScreen'); closeModal('pinModal'); }
        else document.getElementById('pinError').style.display = 'block';
    };
    
    document.getElementById('adminSearch').oninput = debounce(() => refreshAdmin(), 300);
    document.getElementById('studentSearch').oninput = debounce(e => renderStudentList(e.target.value), 300);
    
    document.getElementById('adminFilters').onclick = e => { const t = e.target.closest('.tab'); if (t) { document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); currentFilter = t.dataset.filter; refreshAdmin(); } };
    
    document.getElementById('adminAddPayment').onclick = () => { document.getElementById('recStudent').innerHTML = students.map(s => `<option value="${s.id}">${s.name}</option>`).join(''); openModal('recordModal'); };
    
    document.getElementById('recConfirm').onclick = async () => {
        const a = +document.getElementById('recAmount').value;
        const methodEl = document.querySelector('input[name="recMethod"]:checked');
        if(!methodEl) return toast('Please select method', 'error');
        await supa.from('payments').insert({ student_id: +document.getElementById('recStudent').value, amount: a, method: methodEl.value, note: document.getElementById('recNote').value });
        closeModal('recordModal'); toast('Saved');
    };
    
    document.getElementById('detailDeleteLast').onclick = async () => {
        const s = students.find(x => x.id === detailStudentId);
        if (!s?.payments.length) return toast("No payments to void", "error");
        
        const last = [...s.payments].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
        if (!confirm(`Void payment of ฿${last.amount} from ${fmtDate(last.created_at)}?`)) return;

        try {
            if (last.note && last.note.includes('http')) {
                const urlParts = last.note.split('/');
                const fileName = urlParts[urlParts.length - 1];
                await supa.storage.from('slips').remove([fileName]);
            }
            const { error } = await supa.from('payments').delete().eq('id', last.id);
            if (error) throw error;
            toast('Payment Voided', 'success');
            closeModal('detailModal');
            await loadAll();
        } catch (e) {
            toast('Void Failed', 'error');
            console.error(e);
        }
    };
    
    document.getElementById('detailPay').onclick = () => { document.getElementById('recStudent').innerHTML = students.map(s => `<option value="${s.id}" ${s.id === detailStudentId ? 'selected' : ''}>${s.name}</option>`).join(''); closeModal('detailModal'); openModal('recordModal'); };
    
    document.getElementById('adminSettingsBtn').onclick = () => { 
        document.getElementById('setStartDate').value = S.start_date; 
        document.getElementById('setWeeklyAmount').value = S.weekly_amount; 
        document.getElementById('setPrevBalance').value = S.previous_balance || 0; 
        openModal('settingsModal'); 
    };
    
    document.getElementById('setSave').onclick = async () => {
        const p = document.getElementById('setPin').value; if (p) S.pin_hash = await hashPin(p);
        S.start_date = document.getElementById('setStartDate').value; 
        S.weekly_amount = +document.getElementById('setWeeklyAmount').value;
        S.previous_balance = +document.getElementById('setPrevBalance').value;
        
        await supa.from('settings').update(S).eq('id', 1); 
        toast('Updated'); closeModal('settingsModal');
        refreshAdmin();
    };
    
    document.getElementById('exportData').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ S, students, pendingList, withdrawalsList }, null, 2)], { type: 'application/json' })); a.download = `backup.json`; a.click(); };
    
    document.getElementById('cancelSlip').onclick = () => { document.getElementById('slipPreview').style.display = 'none'; document.getElementById('uploadPlaceholder').style.display = 'block'; document.getElementById('uploadForm').style.display = 'none'; };
    
    document.getElementById('showPending').onclick = () => { renderPending(); openModal('pendingModal'); };
    
    // ============ ฝั่ง STUDENT: ขอเบิกเงิน ============
    document.getElementById('studentWithdrawBtn').onclick = () => { 
        renderStudentWithdrawals(); 
        openModal('studentWithdrawModal'); 
    };

    document.getElementById('submitStudentWithdrawBtn').onclick = async () => {
        const btn = document.getElementById('submitStudentWithdrawBtn');
        const amount = +document.getElementById('swAmount').value;
        const reason = document.getElementById('swReason').value;
        const qrFile = document.getElementById('swQrFile').files[0];

        if (!amount || !reason || !qrFile) return toast('กรุณาใส่ข้อมูลและแนบรูป QR Code ให้ครบถ้วน', 'error');
        
        btn.innerText = 'กำลังส่งคำขอ...'; btn.disabled = true;

        try {
            const qrUrl = await uploadWithdrawImage(qrFile, 'qr_codes');

            const { error } = await supa.from('withdrawals').insert([{
                student_id: activeStudentId,
                amount, 
                reason, 
                qr_url: qrUrl,
                status: 'pending' // กำหนดว่ารอดำเนินการ
            }]);

            if (error) throw error;

            toast('ส่งคำขอเบิกเงินเรียบร้อย รอ Admin โอนเงิน', 'success');
            document.getElementById('swAmount').value = '';
            document.getElementById('swReason').value = '';
            document.getElementById('swQrFile').value = '';
            await loadAll(); 
            renderStudentWithdrawals();
        } catch(e) {
            toast('เกิดข้อผิดพลาด', 'error');
            console.error(e);
        } finally {
            btn.innerText = 'ส่งคำร้องขอเบิกเงิน'; btn.disabled = false;
        }
    };

    // ============ ฝั่ง ADMIN: จัดการเบิกเงิน ============
    document.getElementById('showWithdrawalsAdmin').onclick = () => { 
        renderAdminWithdrawals(); 
        openModal('adminWithdrawModal'); 
    };

    // แอดมินกดยืนยันการโอนพร้อมแนบสลิป
    document.getElementById('confirmApproveWithdrawBtn').onclick = async () => {
        const btn = document.getElementById('confirmApproveWithdrawBtn');
        const id = document.getElementById('approveWithdrawId').value;
        const slipFile = document.getElementById('adminTransferSlipFile').files[0];

        if(!slipFile) return toast('กรุณาแนบสลิปการโอนเงิน!', 'error');

        btn.innerText = 'กำลังอัปโหลด...'; btn.disabled = true;

        try {
            const slipUrl = await uploadWithdrawImage(slipFile, 'transfers');
            const { error } = await supa.from('withdrawals').update({ 
                status: 'approved', 
                transfer_slip_url: slipUrl 
            }).eq('id', id);

            if(error) throw error;

            toast('อนุมัติและอัปเดตสลิปเรียบร้อย!', 'success');
            closeModal('approveWithdrawModal');
            await loadAll();
            renderAdminWithdrawals();
        } catch(e) {
            toast('เกิดข้อผิดพลาด', 'error');
            console.error(e);
        } finally {
            btn.innerText = 'อัปโหลดสลิป & อนุมัติ'; btn.disabled = false;
        }
    };

    document.getElementById('logoutAdmin').onclick = () => location.reload();
    document.getElementById('logoutStudent').onclick = () => location.reload();
    setupUpload();
});
