// ===== Titan Studio Sync Engine =====
const TOTAL_WEEKS = 36;
const ROSTER = [
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

// ===== Admin role =====
// Baked-in admins: these student numbers always have admin access.
// Additional admins are persisted in settings.admin_ids.
const DEFAULT_ADMINS = [3, 12];
const isAdmin = id => DEFAULT_ADMINS.includes(id) || (state.settings.admin_ids || []).includes(id);

// Device trust: store the current pin_hash. If admin changes the PIN,
// the stored value no longer matches and the device re-prompts.
const TRUST_KEY = 'admin_trust_v1';
const trustToken = () => state.settings.pin_hash || 'bootstrap';
const isTrustedDevice = () => localStorage.getItem(TRUST_KEY) === trustToken();
const trustThisDevice = () => localStorage.setItem(TRUST_KEY, trustToken());

const showErr = (e, prefix = 'Error') => {
  const msg = e?.message || (typeof e === 'string' ? e : 'unknown');
  toast(`${prefix}: ${msg}`, 'error');
  console.error(prefix, e);
};

const hashPin = async pin => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Allow bootstrap PIN '1234' if no PIN has ever been set.
async function checkPin(input) {
  const stored = state.settings.pin_hash;
  if (!stored) return input === '1234';
  return (await hashPin(input)) === stored;
}

// ===== State =====
const state = {
  settings: {
    start_date: '2026-05-14', weekly_amount: 40, previous_balance: 0, admin_ids: [],
    receiver_label: '', receiver_number: '', receiver_qr_url: '',
  },
  students: [], pending: [], withdrawals: [],
  filter: 'all',
  activeStudent: null,
  detailStudent: null,
  slipFile: null,
};

// ===== DOM / Utils =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = n => `฿${Number(n).toLocaleString()}`;
const methodLabel = m => ({ promptpay: 'PromptPay', kbank: 'KBank', truemoney: 'TrueMoney' }[m] || m);

const weeksElapsed = () => {
  const diff = Date.now() - new Date(state.settings.start_date).getTime();
  return diff < 0 ? 0 : Math.floor(diff / 604800000) + 1;
};
const totalPaid = s => (s.payments || []).reduce((a, p) => a + p.amount, 0);
const owed = s => weeksElapsed() * state.settings.weekly_amount - totalPaid(s);

// ===== UI primitives =====
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.style.borderBottom = `3px solid var(--${type === 'success' ? 'success' : 'error'})`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3000);
}

const openModal = id => $(id).classList.add('active');
window.closeModal = id => $(id).classList.remove('active');

// In-app confirmation (replaces native confirm so it renders above modals reliably)
function confirmAction(title, body, confirmLabel = 'Confirm') {
  return new Promise(resolve => {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    $('confirmYes').textContent = confirmLabel;
    openModal('confirmModal');
    const yes = $('confirmYes'), no = $('confirmNo');
    const cleanup = val => { window.closeModal('confirmModal'); yes.onclick = null; no.onclick = null; resolve(val); };
    yes.onclick = () => cleanup(true);
    no.onclick = () => cleanup(false);
  });
}

function showScreen(id) {
  $$('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const t = $(id);
  t.style.display = 'block';
  requestAnimationFrame(() => t.classList.add('active'));
}

// Role switcher: visible only when the logged-in user is an admin.
function syncRoleTabs(activeRole) {
  const show = state.activeStudent != null && isAdmin(state.activeStudent);
  ['roleTabsAdmin', 'roleTabsStudent'].forEach(tabsId => {
    const el = $(tabsId);
    if (!el) return;
    el.style.display = show ? '' : 'none';
    el.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.role === activeRole);
    });
  });
}

window.setRole = view => {
  if (view === 'admin') {
    showScreen('adminScreen');
    refreshAdmin();
    syncRoleTabs('admin');
  } else {
    showScreen('studentScreen');
    renderStudentDashboard();
    syncRoleTabs('student');
  }
};

// ===== Data =====
async function loadAll() {
  try {
    const [setR, studsR, paysR, pendR, withdsR] = await Promise.all([
      supa.from('settings').select('*').eq('id', 1).single(),
      supa.from('students').select('*').order('id'),
      supa.from('payments').select('*').order('created_at'),
      supa.from('pending').select('*').order('created_at', { ascending: false }),
      supa.from('withdrawals').select('*').order('created_at', { ascending: false }),
    ]);

    // Surface per-table errors loudly so RLS/permission problems are obvious
    [['settings', setR], ['students', studsR], ['payments', paysR], ['pending', pendR], ['withdrawals', withdsR]].forEach(([name, r]) => {
      if (r.error && r.error.code !== 'PGRST116') {
        console.error(`[loadAll] ${name} failed:`, r.error);
        toast(`${name}: ${r.error.message}`, 'error');
      }
    });

    if (setR.data) state.settings = { previous_balance: 0, admin_ids: [], ...setR.data, admin_ids: setR.data.admin_ids || [] };

    const rawStuds = studsR.data?.length ? studsR.data : ROSTER;
    state.students = rawStuds.map(s => ({ ...s, payments: (paysR.data || []).filter(p => p.student_id === s.id) }));
    state.pending = pendR.data || [];
    state.withdrawals = withdsR.data || [];

    $('pendingCount').textContent = state.pending.length;
    const pw = state.withdrawals.filter(w => w.status === 'pending');
    const wBadge = $('pendingWithdrawCount');
    wBadge.style.display = pw.length ? 'inline-block' : 'none';
    wBadge.textContent = pw.length;

    if (state.activeStudent) renderStudentDashboard();
    refreshAdmin();

    // Re-render any open modals so live updates appear without re-opening
    if ($('pendingModal').classList.contains('active')) renderPending();
    if ($('adminWithdrawModal').classList.contains('active')) renderAdminWithdrawals();
    if ($('studentWithdrawModal').classList.contains('active')) renderStudentWithdrawals();
  } catch (e) { toast('Sync Error: ' + (e.message || 'unknown'), 'error'); console.error(e); }
}

function subscribe() {
  supa.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => loadAll())
    .subscribe();
  // Safety net: poll every 20s in case realtime isn't enabled for a table
  setInterval(loadAll, 20000);
}

// ===== Admin =====
function refreshAdmin() {
  let paid = 0, owedSum = 0;
  state.students.forEach(s => { paid += totalPaid(s); const o = owed(s); if (o > 0) owedSum += o; });
  const withdrawn = state.withdrawals.filter(w => w.status === 'approved').reduce((a, w) => a + Number(w.amount), 0);
  const net = paid + Number(state.settings.previous_balance || 0) - withdrawn;

  $('sNetBalance').textContent = fmtMoney(net);
  $('sTotalCollected').textContent = fmtMoney(paid);
  $('sTotalWithdrawn').textContent = fmtMoney(withdrawn);
  $('sTotalOwed').textContent = fmtMoney(owedSum);

  renderAdminGrid();
}

function renderAdminGrid() {
  const grid = $('adminGrid');
  const q = $('adminSearch').value.toLowerCase();
  const list = state.students.filter(s => {
    if (!(s.name.toLowerCase().includes(q) || `#${s.id}`.includes(q))) return false;
    const o = owed(s);
    if (state.filter === 'owed') return o > 0;
    if (state.filter === 'paid') return o <= 0;
    return true;
  });

  grid.innerHTML = list.map(s => {
    const p = totalPaid(s), o = owed(s);
    const nameSafe = s.name.replace(/`/g, '\\`').replace(/'/g, "\\'");
    return `
      <div class="item-card" onclick="openDetail(${s.id})">
        <div class="row mb-md">
          <span class="code-id">#${s.id}</span>
          <span class="badge ${o > 0 ? 'badge-no' : 'badge-ok'}">${o > 0 ? 'Owed' : 'Clear'}</span>
        </div>
        <div class="text-bold mb-md" style="font-size:17px;cursor:text" onclick="event.stopPropagation();editName(${s.id},'${nameSafe}')">${esc(s.name)} ✎</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><span class="label-mini" style="font-size:10px">Paid</span><span class="text-bold">${fmtMoney(p)}</span></div>
          <div style="text-align:right"><span class="label-mini" style="font-size:10px">${o >= 0 ? 'Owes' : 'Ahead'}</span><span class="text-bold ${o > 0 ? 'text-error' : 'text-success'}">${fmtMoney(Math.abs(o))}</span></div>
        </div>
      </div>`;
  }).join('');
}

window.openDetail = id => {
  state.detailStudent = id;
  const s = state.students.find(x => x.id === id);
  if (!s) return;
  $('detailName').textContent = s.name;
  const payments = [...(s.payments || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $('detailHistory').innerHTML = payments.length
    ? payments.map(p => `
        <div class="history-item">
          <div><div class="text-bold">${fmtDate(p.created_at)}</div><div class="text-sm text-dim">${methodLabel(p.method)}</div></div>
          <div class="text-bold text-success">${fmtMoney(p.amount)}</div>
        </div>`).join('')
    : `<div class="empty-state">No history found</div>`;

  // Admin role toggle — default admins (#3, #12) are locked.
  const panel = $('detailAdminPanel'), btn = $('detailAdminToggle');
  if (DEFAULT_ADMINS.includes(id)) {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'block';
    const isCurrent = (state.settings.admin_ids || []).includes(id);
    btn.textContent = isCurrent ? 'Revoke Admin Role' : 'Promote to Admin';
    btn.className = `btn ${isCurrent ? 'btn-danger' : 'btn-p'} full`;
  }
  openModal('detailModal');
};

async function toggleAdminRole() {
  const id = state.detailStudent;
  if (!id || DEFAULT_ADMINS.includes(id)) return;
  const current = state.settings.admin_ids || [];
  const isCurrent = current.includes(id);
  const next = isCurrent ? current.filter(x => x !== id) : [...current, id];
  const { error } = await supa.from('settings').update({ admin_ids: next }).eq('id', 1);
  if (error) return toast('Failed: ' + error.message, 'error');
  state.settings.admin_ids = next;
  toast(isCurrent ? 'Admin role revoked' : 'Promoted to admin');
  window.closeModal('detailModal');
}

function renderPending() {
  $('pendingList').innerHTML = state.pending.length
    ? state.pending.map(p => {
        const s = state.students.find(x => x.id === p.student_id);
        return `
          <div class="item-card review-card">
            <div class="row mb-md">
              <div><div class="text-bold">${s ? esc(s.name) : 'Unknown'}</div><div class="text-sm text-dim">${methodLabel(p.method)} • ${fmtDate(p.created_at)}</div></div>
              <div class="amount-md text-primary">${fmtMoney(p.amount)}</div>
            </div>
            ${p.slip_url ? `<img class="slip" src="${p.slip_url}" onclick="viewSlip('${p.slip_url}')">` : ''}
            <div class="btn-row">
              <button class="btn btn-p flex-1" onclick="verify(${p.id},true)">Approve</button>
              <button class="btn btn-danger flex-1" onclick="verify(${p.id},false)">Reject</button>
            </div>
          </div>`;
      }).join('')
    : `<div class="empty-state">No requests</div>`;
}

window.viewSlip = url => { $('slipViewImg').src = url; openModal('slipViewModal'); };

window.verify = async (id, approve) => {
  const p = state.pending.find(x => x.id === id);
  if (!p) return toast('Pending record not found', 'error');
  if (!approve) {
    const ok = await confirmAction('ปฏิเสธสลิป', 'ยืนยันการปฏิเสธสลิปนี้? การกระทำนี้จะลบรายการออกจากระบบ', 'Reject');
    if (!ok) return;
  }
  try {
    if (approve) {
      const { error: insErr } = await supa.from('payments').insert({ student_id: p.student_id, amount: p.amount, method: p.method, note: p.note || '' });
      if (insErr) throw insErr;
    }
    const { error: delErr } = await supa.from('pending').delete().eq('id', id);
    if (delErr) throw delErr;
    toast(approve ? 'Verified' : 'Rejected');
    window.closeModal('pendingModal');
    await loadAll();
  } catch (e) {
    toast('Error: ' + (e.message || 'unknown'), 'error');
    console.error('verify failed', e);
  }
};

window.editName = async (id, oldName) => {
  const n = prompt('New name:', oldName);
  if (!n || n === oldName) return;
  const { error } = await supa.from('students').update({ name: n }).eq('id', id);
  toast(error ? 'Failed' : 'Updated', error ? 'error' : 'success');
};

// ===== Student =====
function renderStudentList(q = '') {
  const term = q.toLowerCase();
  const filtered = state.students.filter(s => s.name.toLowerCase().includes(term) || `#${s.id}`.includes(term));
  $('studentSelectList').innerHTML = filtered.length
    ? filtered.map(s => `
        <div class="pick-row" onclick="selectStudent(${s.id})">
          <span class="code-id">#${s.id}</span>
          <span class="pick-name">${esc(s.name)}</span>
        </div>`).join('')
    : `<div class="empty-state" style="padding:32px 16px">No match</div>`;
}

window.selectStudent = async id => {
  state.activeStudent = id;
  await loadAll();
  if (isAdmin(id) && !isTrustedDevice()) {
    state.pendingAdminId = id;
    $('pinInput').value = '';
    $('pinError').style.display = 'none';
    openModal('pinModal');
    setTimeout(() => $('pinInput').focus(), 50);
    return;
  }
  if (isAdmin(id)) {
    showScreen('adminScreen');
    syncRoleTabs('admin');
  } else {
    showScreen('studentScreen');
    syncRoleTabs('student');
  }
};

function renderStudentDashboard() {
  const s = state.students.find(x => x.id === state.activeStudent);
  if (!s) return;
  $('studentViewName').textContent = s.name;
  const o = owed(s), paid = totalPaid(s);
  $('svOwed').textContent = o > 0 ? fmtMoney(o) : '฿0';
  $('svPaid').textContent = fmtMoney(paid);
  const weeklyAmt = state.settings.weekly_amount;
  const elapsed = weeksElapsed();
  const weeksPaid = weeklyAmt > 0 ? Math.floor(paid / weeklyAmt) : 0;
  $('svWeeks').textContent = `${weeksPaid} / ${elapsed}`;
  const pct = elapsed > 0 ? Math.min(100, (weeksPaid / elapsed) * 100) : 0;
  $('svProgress').style.width = pct + '%';

  const combined = [
    ...state.pending.filter(p => p.student_id === state.activeStudent).map(p => ({ ...p, isPending: true })),
    ...(s.payments || []).map(p => ({ ...p, isPending: false })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderReceiver();

  $('studentHistory').innerHTML = combined.length
    ? combined.map(p => `
        <div class="history-item ${p.isPending ? 'left-bar-warning' : 'left-bar-success'}">
          <div>
            <div class="text-bold text-md">${fmtDate(p.created_at)}</div>
            <div class="text-sm text-dim">${p.isPending ? 'Pending Verification' : 'Verified'} • ${methodLabel(p.method)}</div>
          </div>
          <div class="amount-md ${p.isPending ? 'text-warning' : 'text-success'}">${fmtMoney(p.amount)}</div>
        </div>`).join('')
    : `<div class="item-card empty-state">No activity yet</div>`;
}

// ===== Receiver (pay-to) card =====
function renderReceiver() {
  const qr = state.settings.receiver_qr_url;
  const label = state.settings.receiver_label;
  const number = state.settings.receiver_number;
  const img = $('receiverQr'), empty = $('receiverQrEmpty'), wrap = $('receiverQrWrap');
  if (qr) { img.src = qr; img.classList.add('show'); empty.style.display = 'none'; }
  else { img.classList.remove('show'); empty.style.display = 'flex'; }
  wrap.classList.toggle('empty', !qr);
  $('receiverLabel').textContent = label || 'ยังไม่ระบุผู้รับ';
  $('receiverNumberText').textContent = number || '—';
}

window.copyReceiver = async () => {
  const num = state.settings.receiver_number;
  const btn = $('receiverNumber');
  if (!num) return toast('ยังไม่ตั้งค่าเลขบัญชี', 'error');
  try {
    await navigator.clipboard.writeText(num);
    btn.classList.add('copied');
    const orig = $('receiverNumberText').textContent;
    $('receiverNumberText').textContent = 'คัดลอกแล้ว ✓';
    setTimeout(() => {
      btn.classList.remove('copied');
      $('receiverNumberText').textContent = orig;
    }, 1400);
  } catch { toast('ไม่สามารถคัดลอกได้', 'error'); }
};

window.expandQr = () => {
  const url = state.settings.receiver_qr_url;
  if (!url) return toast('ยังไม่มี QR Code', 'error');
  viewSlip(url);
};

window.downloadQr = async () => {
  const url = state.settings.receiver_qr_url;
  if (!url) return toast('ยังไม่มี QR Code', 'error');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch ' + res.status);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const dl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dl; a.download = `payment-qr.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(dl), 1000);
    toast('ดาวน์โหลด QR แล้ว');
  } catch (e) {
    toast('ดาวน์โหลดไม่สำเร็จ', 'error');
    console.error('[qr] download failed', e);
  }
};

async function uploadReceiverQr(file) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `receiver/qr_${Date.now()}.${ext}`;
  const { error } = await supa.storage.from('slips').upload(fileName, file);
  if (error) { toast('QR Upload Error: ' + error.message, 'error'); return null; }
  return supa.storage.from('slips').getPublicUrl(fileName).data.publicUrl;
}

// ===== Upload (student slip) =====
function setupUpload() {
  const area = $('uploadArea'), input = $('slipFile');
  const handleFile = file => {
    if (!file?.type.startsWith('image/')) return toast('Invalid file', 'error');
    state.slipFile = file;
    $('slipPreview').src = URL.createObjectURL(file);
    $('slipPreview').style.display = 'block';
    $('uploadPlaceholder').style.display = 'none';
    $('uploadForm').style.display = 'block';
  };
  area.onclick = () => input.click();
  input.onchange = e => handleFile(e.target.files[0]);
  area.ondragover = e => { e.preventDefault(); area.classList.add('dragover'); };
  area.ondragleave = () => area.classList.remove('dragover');
  area.ondrop = e => { e.preventDefault(); area.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); };

  $('submitSlip').onclick = async () => {
    const btn = $('submitSlip'), amount = +$('slipAmount').value;
    if (isNaN(amount) || amount <= 0) return toast('Invalid amount', 'error');
    if (!state.slipFile) return toast('No slip attached', 'error');
    btn.textContent = 'Uploading...'; btn.disabled = true;
    try {
      const fileName = `${Date.now()}_${state.activeStudent}.jpg`;
      await supa.storage.from('slips').upload(fileName, state.slipFile);
      const { data } = supa.storage.from('slips').getPublicUrl(fileName);
      await supa.from('pending').insert({
        student_id: state.activeStudent, amount,
        method: $('slipMethod').value, note: $('slipNote').value,
        slip_url: data.publicUrl,
      });
      toast('Submitted');
      $('cancelSlip').click();
      $('slipAmount').value = state.settings.weekly_amount;
      $('slipNote').value = '';
      $('slipFile').value = '';
      state.slipFile = null;
    } catch (e) { toast('Failed', 'error'); console.error(e); }
    finally { btn.textContent = 'Submit for Verification'; btn.disabled = false; }
  };
}

// ===== Withdrawals =====
async function uploadWithdrawImage(file, folder) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supa.storage.from('slips').upload(fileName, file);
  if (error) { toast('Upload Error', 'error'); return null; }
  return supa.storage.from('slips').getPublicUrl(fileName).data.publicUrl;
}

function renderStudentWithdrawals() {
  const myW = state.withdrawals.filter(w => w.student_id === state.activeStudent);
  $('studentWithdrawHistory').innerHTML = myW.length
    ? myW.map(w => `
        <div class="item-card ${w.status === 'approved' ? 'left-bar-success' : 'left-bar-warning'}" style="margin-bottom:8px;padding:14px;cursor:default">
          <div class="row mb-sm">
            <strong style="font-size:15px">${esc(w.reason)}</strong>
            <span class="amount-md">${fmtMoney(w.amount)}</span>
          </div>
          <div class="text-sm text-dim mb-sm">${fmtDate(w.created_at)} • ${w.status === 'approved' ? 'โอนแล้ว' : 'รอดำเนินการ'}</div>
          <div class="btn-row" style="gap:8px;flex-wrap:wrap">
            ${w.transfer_slip_url ? `<button class="btn btn-s text-sm" style="padding:6px 12px" onclick="viewSlip('${w.transfer_slip_url}')">ดูสลิป</button>` : ''}
            ${w.status === 'approved' ? `<button class="btn btn-p text-sm" style="padding:6px 12px" onclick="openReceipt(${w.id})">ใบเสร็จ</button>` : ''}
          </div>
        </div>`).join('')
    : `<p class="empty-state" style="padding:20px">ยังไม่มีประวัติ</p>`;
}

function renderAdminWithdrawals() {
  const pending = state.withdrawals.filter(w => w.status === 'pending');
  const approved = state.withdrawals.filter(w => w.status === 'approved');

  $('adminPendingWithdrawList').innerHTML = pending.length
    ? pending.map(w => {
        const s = state.students.find(x => x.id === w.student_id);
        return `
          <div class="item-card left-bar-warning" style="margin-bottom:12px;cursor:default">
            <div class="row mb-sm">
              <div><div class="text-bold">${s ? esc(s.name) : 'Unknown'}</div><div class="text-sm text-dim">${esc(w.reason)} • ${fmtDate(w.created_at)}</div></div>
              <div class="amount-md text-warning">${fmtMoney(w.amount)}</div>
            </div>
            ${w.qr_url ? `<div class="text-center mt-md"><img src="${w.qr_url}" style="max-height:200px;border-radius:8px;cursor:pointer" onclick="viewSlip('${w.qr_url}')"><div class="text-sm text-dim mt-md">คลิกเพื่อดูรูป QR Code</div></div>` : ''}
            <div class="btn-row mt-md">
              <button class="btn btn-p flex-1" onclick="openApproveWithdraw(${w.id})">แนบสลิปโอน</button>
              <button class="btn btn-danger flex-1" onclick="rejectWithdraw(${w.id})">ยกเลิก</button>
            </div>
          </div>`;
      }).join('')
    : `<p class="text-dim text-md">ไม่มีรายการรอโอน</p>`;

  $('adminApprovedWithdrawList').innerHTML = approved.length
    ? approved.map(w => {
        const s = state.students.find(x => x.id === w.student_id);
        return `
          <div class="item-card left-bar-success" style="margin-bottom:8px;padding:12px;cursor:default">
            <div class="row mb-sm">
              <strong>${s ? esc(s.name) : 'Unknown'} — ${esc(w.reason)}</strong>
              <span class="text-bold text-error">− ${fmtMoney(w.amount)}</span>
            </div>
            <div class="text-sm text-dim mb-sm">${fmtDate(w.created_at)}</div>
            <div class="btn-row" style="gap:8px;flex-wrap:wrap">
              ${w.transfer_slip_url ? `<button class="btn btn-s text-sm" style="padding:6px 12px" onclick="viewSlip('${w.transfer_slip_url}')">ดูสลิป</button>` : ''}
              <button class="btn btn-p text-sm" style="padding:6px 12px" onclick="openReceipt(${w.id})">ใบเสร็จ</button>
            </div>
          </div>`;
      }).join('')
    : `<p class="text-dim text-md">ไม่มีประวัติ</p>`;
}

window.openReceipt = id => {
  const w = state.withdrawals.find(x => x.id === id);
  if (!w) return toast('ไม่พบข้อมูล', 'error');
  const s = state.students.find(x => x.id === w.student_id);
  $('rcNo').textContent = `#${String(w.id).padStart(5, '0')}`;
  $('rcDate').textContent = fmtDate(w.created_at);
  $('rcStudent').textContent = s ? s.name : '—';
  $('rcReason').textContent = w.reason || '—';
  $('rcAmount').textContent = fmtMoney(w.amount);
  $('rcTotal').textContent = fmtMoney(w.amount);
  $('rcStamp').textContent = w.status === 'approved' ? 'PAID' : 'PENDING';
  $('rcStamp').style.color = w.status === 'approved' ? '#2E8A3E' : '#C56646';
  $('rcStamp').style.borderColor = w.status === 'approved' ? '#2E8A3E' : '#C56646';
  if (w.transfer_slip_url) {
    $('rcSlip').src = w.transfer_slip_url;
    $('rcSlipWrap').style.display = 'block';
  } else {
    $('rcSlipWrap').style.display = 'none';
  }
  $('rcGenerated').textContent = new Date().toLocaleString('en-GB');
  openModal('receiptModal');
};

window.downloadReceipt = () => window.print();

window.openApproveWithdraw = id => {
  $('approveWithdrawId').value = id;
  $('adminTransferSlipFile').value = '';
  openModal('approveWithdrawModal');
};

window.rejectWithdraw = async id => {
  const ok = await confirmAction('ลบคำขอเบิกเงิน', 'ต้องการลบคำขอเบิกเงินนี้ใช่หรือไม่?', 'Delete');
  if (!ok) return;
  try {
    const { error } = await supa.from('withdrawals').delete().eq('id', id);
    if (error) throw error;
    toast('ลบคำขอแล้ว');
    await loadAll();
    renderAdminWithdrawals();
  } catch (e) { toast('Error: ' + (e.message || 'unknown'), 'error'); console.error(e); }
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  subscribe();
  $('loadingOverlay').classList.add('hidden');

  // Login: the picker IS the login screen.
  renderStudentList();
  $('studentSearch').oninput = debounce(e => renderStudentList(e.target.value), 200);

  // Admin PIN sheet (only appears for admin IDs on untrusted devices).
  const submitPin = async () => {
    const input = $('pinInput').value;
    if (!input) return;
    if (!(await checkPin(input))) {
      $('pinError').style.display = 'block';
      $('pinInput').value = '';
      $('pinInput').focus();
      return;
    }
    trustThisDevice();
    window.closeModal('pinModal');
    showScreen('adminScreen');
    syncRoleTabs('admin');
  };
  $('pinSubmit').onclick = submitPin;
  $('pinInput').onkeydown = e => { if (e.key === 'Enter') submitPin(); };

  // Admin search & filter
  $('adminSearch').oninput = debounce(refreshAdmin, 300);
  $('adminFilters').onclick = e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    $$('#adminFilters .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.filter = t.dataset.filter;
    refreshAdmin();
  };

  // Manual entry
  $('adminAddPayment').onclick = () => {
    $('recStudent').innerHTML = state.students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    openModal('recordModal');
  };
  $('recConfirm').onclick = async () => {
    const a = +$('recAmount').value;
    const method = document.querySelector('input[name="recMethod"]:checked');
    if (!method) return toast('Please select method', 'error');
    if (isNaN(a) || a <= 0) return toast('Invalid amount', 'error');
    await supa.from('payments').insert({
      student_id: +$('recStudent').value, amount: a,
      method: method.value, note: $('recNote').value,
    });
    $('recAmount').value = state.settings.weekly_amount;
    $('recNote').value = '';
    window.closeModal('recordModal');
    toast('Saved');
  };

  // Detail modal actions
  $('detailDeleteLast').onclick = async () => {
    const s = state.students.find(x => x.id === state.detailStudent);
    if (!s?.payments.length) return toast('No payments to void', 'error');
    const last = [...s.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const ok = await confirmAction('Void Last Payment', `Void payment of ฿${last.amount} from ${fmtDate(last.created_at)}?`, 'Void');
    if (!ok) return;
    try {
      const { error } = await supa.from('payments').delete().eq('id', last.id);
      if (error) throw error;
      toast('Payment Voided');
      window.closeModal('detailModal');
      await loadAll();
    } catch (e) { toast('Void Failed: ' + (e.message || 'unknown'), 'error'); console.error(e); }
  };
  $('detailPay').onclick = () => {
    $('recStudent').innerHTML = state.students.map(s => `<option value="${s.id}" ${s.id === state.detailStudent ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    window.closeModal('detailModal');
    openModal('recordModal');
  };

  // Settings
  $('adminSettingsBtn').onclick = () => {
    $('setStartDate').value = state.settings.start_date;
    $('setWeeklyAmount').value = state.settings.weekly_amount;
    $('setPrevBalance').value = state.settings.previous_balance || 0;
    $('setReceiverLabel').value = state.settings.receiver_label || '';
    $('setReceiverNumber').value = state.settings.receiver_number || '';
    $('setReceiverQrFile').value = '';
    $('setPin').value = '';
    openModal('settingsModal');
  };
  $('setSave').onclick = async () => {
    const btn = $('setSave');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const update = {
        start_date: $('setStartDate').value,
        weekly_amount: +$('setWeeklyAmount').value,
        previous_balance: +$('setPrevBalance').value,
        receiver_label: $('setReceiverLabel').value.trim(),
        receiver_number: $('setReceiverNumber').value.trim(),
      };
      const qrFile = $('setReceiverQrFile').files[0];
      if (qrFile) {
        const url = await uploadReceiverQr(qrFile);
        if (url) update.receiver_qr_url = url;
      }
      const newPin = $('setPin').value.trim();
      if (newPin) update.pin_hash = await hashPin(newPin);

      const { error } = await supa.from('settings').update(update).eq('id', 1);
      if (error) throw error;
      Object.assign(state.settings, update);
      if (newPin) trustThisDevice();
      renderReceiver();
      toast('Updated');
      window.closeModal('settingsModal');
      refreshAdmin();
    } catch (e) {
      toast('Failed: ' + (e.message || 'unknown'), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save Configuration';
    }
  };
  $('forgetTrust').onclick = () => {
    localStorage.removeItem(TRUST_KEY);
    toast('Device trust cleared');
  };

  $('detailAdminToggle').onclick = toggleAdminRole;
  $('exportData').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = 'backup.json';
    a.click();
  };

  // Upload UI reset
  $('cancelSlip').onclick = () => {
    $('slipPreview').style.display = 'none';
    $('uploadPlaceholder').style.display = 'block';
    $('uploadForm').style.display = 'none';
  };

  $('showPending').onclick = async () => {
    await loadAll();
    renderPending();
    openModal('pendingModal');
  };

  // Student withdrawal flow
  $('studentWithdrawBtn').onclick = () => { renderStudentWithdrawals(); openModal('studentWithdrawModal'); };
  $('submitStudentWithdrawBtn').onclick = async () => {
    const btn = $('submitStudentWithdrawBtn');
    const amount = +$('swAmount').value, reason = $('swReason').value.trim(), qr = $('swQrFile').files[0];
    if (!amount || amount <= 0 || !reason || !qr) return toast('กรุณาใส่ข้อมูลและแนบ QR Code', 'error');
    btn.textContent = 'กำลังส่ง...'; btn.disabled = true;
    try {
      const qr_url = await uploadWithdrawImage(qr, 'qr_codes');
      if (!qr_url) throw new Error('อัปโหลด QR ไม่สำเร็จ');
      const { error } = await supa.from('withdrawals').insert({
        student_id: state.activeStudent, amount, reason, qr_url, status: 'pending',
      });
      if (error) throw error;

      $('swAmount').value = ''; $('swReason').value = ''; $('swQrFile').value = '';
      toast('ส่งคำขอแล้ว รอ Admin โอนเงิน');
      await loadAll();
      renderStudentWithdrawals();
    } catch (e) {
      toast('Error: ' + (e.message || 'unknown'), 'error');
      console.error('[withdraw] failed', e);
    }
    finally { btn.textContent = 'ส่งคำร้องขอเบิกเงิน'; btn.disabled = false; }
  };

  // Admin withdrawal flow — refetch fresh data before opening
  $('showWithdrawalsAdmin').onclick = async () => {
    await loadAll();
    renderAdminWithdrawals();
    openModal('adminWithdrawModal');
  };
  $('confirmApproveWithdrawBtn').onclick = async () => {
    const btn = $('confirmApproveWithdrawBtn');
    const id = $('approveWithdrawId').value, slip = $('adminTransferSlipFile').files[0];
    if (!slip) return toast('กรุณาแนบสลิปการโอน!', 'error');
    btn.textContent = 'กำลังอัปโหลด...'; btn.disabled = true;
    try {
      const transfer_slip_url = await uploadWithdrawImage(slip, 'transfers');
      const { error } = await supa.from('withdrawals').update({ status: 'approved', transfer_slip_url }).eq('id', id);
      if (error) throw error;
      toast('อนุมัติเรียบร้อย');
      window.closeModal('approveWithdrawModal');
      await loadAll();
      renderAdminWithdrawals();
    } catch (e) { toast('เกิดข้อผิดพลาด', 'error'); console.error(e); }
    finally { btn.textContent = 'อัปโหลดสลิป & อนุมัติ'; btn.disabled = false; }
  };

  $('logoutAdmin').onclick = () => location.reload();
  $('logoutStudent').onclick = () => location.reload();
  setupUpload();
});
