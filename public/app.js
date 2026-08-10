const STORAGE_KEY = 'worklog-ai-entries';
let supabaseClient = null;
let supabaseUser = null;
let authMode = 'login';
let historyFormat = 'all';
let historyCategory = 'all';

const $ = (id) => document.getElementById(id);
const getEntries = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveEntries = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const today = new Date();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const formatWorkDate = (value) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const plainToHtml = (value) => String(value || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('') || '<p>ยังไม่มีข้อความ</p>';
const htmlToText = (value) => { const container = document.createElement('div'); container.innerHTML = value || ''; return container.innerText.trim(); };

function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function showAuth() {
  $('authScreen').classList.remove('is-hidden');
  $('appShell').classList.add('is-hidden');
}

function showApp() {
  $('authScreen').classList.add('is-hidden');
  $('appShell').classList.remove('is-hidden');
  const label = supabaseUser?.user_metadata?.full_name || supabaseUser?.email || 'สมาชิก';
  $('profileName').textContent = label;
  $('avatar').textContent = label.trim().charAt(0).toUpperCase();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('authTitle').textContent = signup ? 'สร้างบัญชี' : 'เข้าสู่ระบบ';
  $('authKicker').textContent = signup ? 'CREATE YOUR WORKSPACE' : 'PERSONAL WORKSPACE';
  $('authDescription').textContent = signup ? 'เริ่มเก็บบันทึกงานของคุณในพื้นที่ส่วนตัว' : 'บันทึกงานของคุณให้เป็นระเบียบ และเปิดดูได้ทุกที่';
  $('authNameField').classList.toggle('hidden', !signup);
  $('authName').required = signup;
  $('authSubmit').textContent = signup ? 'สร้างบัญชี' : 'เข้าสู่ระบบ';
  $('authSwitchText').textContent = signup ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?';
  $('authToggle').textContent = signup ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  $('authMessage').textContent = '';
}

async function initSupabase() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    if (!config.url || !config.key || !window.supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
    supabaseClient = window.supabase.createClient(config.url, config.key);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session?.user?.is_anonymous) {
      await supabaseClient.auth.signOut();
      showAuth();
    } else if (sessionData.session) {
      supabaseUser = sessionData.session.user;
      showApp();
      await refreshRemoteEntries();
    } else {
      showAuth();
    }
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.is_anonymous) return;
      if (session) {
        supabaseUser = session.user;
        showApp();
        refreshRemoteEntries().catch((error) => showToast(`โหลดประวัติไม่ได้: ${error.message}`));
      }
    });
  } catch (error) {
    showAuth();
    $('authMessage').textContent = error.message;
  }
}

async function loadRemoteEntries() {
  const { data: rows, error } = await supabaseClient
    .from('work_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  saveEntries((rows || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    title: `สรุปการทำงาน · ${formatWorkDate(row.work_date)}`,
    plainSummary: (row.ai_summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    summary: row.ai_summary || '',
    category: row.category || 'ทั่วไป',
    voice: row.voice_mode || 'neutral',
    format: row.output_mode || 'report',
  })));
  renderStats();
  renderHistory();
}

async function refreshRemoteEntries() {
  try {
    await loadRemoteEntries();
  } catch (error) {
    showToast(`โหลดประวัติไม่ได้: ${error.message}`);
  }
}

async function saveToSupabase({ work, blocker, next, summary, category, voice, format }) {
  if (!supabaseClient || !supabaseUser) return { error: new Error('ยังไม่ได้เข้าสู่ระบบ') };
  const baseRecord = {
    user_id: supabaseUser.id,
    work_date: new Date().toISOString().slice(0, 10),
    work_text: work,
    blocker_text: blocker || null,
    next_text: next || null,
    ai_summary: summary,
  };
  const result = await supabaseClient.from('work_logs').insert({
    ...baseRecord,
    category,
    voice_mode: voice,
    output_mode: format,
  }).select('id').single();
  // Keep saving older projects while Supabase has not refreshed the new schema yet.
  if (result.error && /schema cache|category.*column/i.test(result.error.message || '')) {
    return await supabaseClient.from('work_logs').insert(baseRecord).select('id').single();
  }
  return result;
}

async function updateRemoteSummary(id, summary) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('work_logs').update({ ai_summary: summary }).eq('id', id).eq('user_id', supabaseUser.id);
}

async function deleteRemoteEntry(id) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('work_logs').delete().eq('id', id).eq('user_id', supabaseUser.id);
}

async function requestSummary(work, blocker, next, voice, format, category) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work, blocker, next, voice, format, category }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Gemini API ยังไม่พร้อมใช้งาน');
  if (!data.summary) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา');
  return data.summary;
}

function renderStats() {
  const entries = getEntries();
  $('totalCount').innerHTML = `${entries.length} <small>ครั้ง</small>`;
  $('weekCount').innerHTML = `${entries.filter((entry) => (Date.now() - new Date(entry.createdAt)) < 7 * 86400000).length} <small>ครั้ง</small>`;
}

function renderHistory() {
  const labels = { report: 'บทรายงาน', speech: 'บทพูด', chat: 'ภาษาพูด', bullet: 'สรุปเป็นข้อ' };
  const entries = getEntries().filter((entry) =>
    (historyFormat === 'all' || entry.format === historyFormat)
    && (historyCategory === 'all' || entry.category === historyCategory),
  );
  $('historyList').innerHTML = entries.length
    ? entries.map((entry) => `<article class="history-item" data-entry-key="${escapeHtml(entry.createdAt)}"><div class="history-item-top"><time>${escapeHtml(entry.title)}</time><div class="history-item-actions"><div class="history-tags"><span>${escapeHtml(labels[entry.format] || 'บทรายงาน')}</span><span>${escapeHtml(entry.category || 'ทั่วไป')}</span></div><button class="history-copy" type="button">คัดลอก</button><button class="history-edit" type="button">แก้ไข</button><button class="history-delete" type="button">ลบ</button></div></div><p class="history-preview">${escapeHtml(entry.plainSummary)}</p><div class="history-editor hidden"><textarea>${escapeHtml(entry.plainSummary)}</textarea><div><button class="history-cancel" type="button">ยกเลิก</button><button class="history-save" type="button">บันทึกการแก้ไข</button></div></div></article>`).join('')
    : '<div class="history-empty">ยังไม่มีประวัติที่ตรงกับตัวกรองนี้</div>';
  document.querySelectorAll('.history-item').forEach((item) => {
    const copyButton = item.querySelector('.history-copy');
    const editButton = item.querySelector('.history-edit');
    const editor = item.querySelector('.history-editor');
    copyButton?.addEventListener('click', async () => {
      const entry = getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
      if (!entry) return;
      try {
        await navigator.clipboard.writeText(htmlToText(entry.summary) || entry.plainSummary);
        showToast('คัดลอกสรุปแล้ว');
      } catch (error) {
        showToast('คัดลอกไม่ได้ ลองคัดลอกข้อความด้วยตัวเองครับ');
      }
    });
    editButton?.addEventListener('click', () => { editor.classList.remove('hidden'); editButton.classList.add('hidden'); editor.querySelector('textarea').focus(); });
    item.querySelector('.history-cancel')?.addEventListener('click', () => { editor.classList.add('hidden'); editButton.classList.remove('hidden'); });
    item.querySelector('.history-save')?.addEventListener('click', async () => {
      const entry = getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
      if (!entry) return;
      const text = editor.querySelector('textarea').value.trim();
      if (!text) return showToast('สรุปต้องมีข้อความอย่างน้อย 1 บรรทัด');
      const summary = plainToHtml(text);
      const result = await updateRemoteSummary(entry.id, summary);
      if (result.error) return showToast(`บันทึกการแก้ไขไม่ได้: ${result.error.message}`);
      entry.summary = summary;
      entry.plainSummary = text.replace(/\s+/g, ' ').trim();
      saveEntries(getEntries());
      renderHistory();
      showToast('แก้ไขสรุปและบันทึกแล้ว');
    });
    item.querySelector('.history-delete')?.addEventListener('click', async () => {
      const entry = getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
      if (!entry || !window.confirm('ลบสรุปนี้ออกจากประวัติใช่ไหม?')) return;
      const result = await deleteRemoteEntry(entry.id);
      if (result.error) return showToast(`ลบสรุปไม่ได้: ${result.error.message}`);
      saveEntries(getEntries().filter((candidate) => candidate.createdAt !== entry.createdAt));
      renderStats();
      renderHistory();
      showToast('ลบสรุปแล้ว');
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.toggle('active', nav.dataset.view === view));
  $('dashboardView').style.display = view === 'dashboard' ? 'block' : 'none';
  $('resultPanel').style.display = view === 'dashboard' ? 'block' : 'none';
  $('historyView').style.display = view === 'history' ? 'block' : 'none';
  if (view === 'history') renderHistory();
}

$('authToggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('authSubmit');
  button.disabled = true;
  button.textContent = 'กำลังดำเนินการ...';
  $('authMessage').textContent = '';
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const name = $('authName').value.trim();
  const result = authMode === 'signup'
    ? await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: window.location.origin } })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) {
    $('authMessage').textContent = result.error.message;
  } else if (authMode === 'signup' && !result.data.session) {
    $('authMessage').textContent = 'สมัครสำเร็จ กรุณาเช็กอีเมลเพื่อยืนยันบัญชี';
  } else {
    supabaseUser = result.data.user;
    showApp();
    await refreshRemoteEntries();
  }
  button.disabled = false;
  button.textContent = authMode === 'signup' ? 'สร้างบัญชี' : 'เข้าสู่ระบบ';
});

$('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(STORAGE_KEY);
  showAuth();
  setAuthMode('login');
});

$('dateLabel').textContent = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(today);
$('todayLabel').textContent = thaiDate.format(today);
$('resultTitle').textContent = `สรุปการทำงาน · ${thaiDate.format(today)}`;
renderStats();

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('.history-filter').forEach((button) => button.addEventListener('click', () => {
  historyFormat = button.dataset.format;
  document.querySelectorAll('.history-filter').forEach((item) => item.classList.toggle('active', item === button));
  renderHistory();
}));
$('historyCategory').addEventListener('change', (event) => {
  historyCategory = event.target.value;
  renderHistory();
});

$('summarizeBtn').addEventListener('click', async () => {
  const work = $('workInput').value.trim();
  const blocker = $('blockerInput').value.trim();
  const next = $('nextInput').value.trim();
  const category = $('categoryMode').value;
  const voice = $('voiceMode').value;
  const format = $('outputMode').value;
  if (!work) {
    showToast('กรุณาใส่งานที่ทำวันนี้ก่อน');
    $('workInput').focus();
    return;
  }
  const button = $('summarizeBtn');
  button.disabled = true;
  button.textContent = 'กำลังสรุป...';
  let summary;
  try {
    summary = await requestSummary(work, blocker, next, voice, format, category);
  } catch (error) {
    button.disabled = false;
    button.innerHTML = 'สรุปงาน <span>→</span>';
    showToast(`AI ใช้งานไม่ได้: ${error.message}`);
    return;
  }
  $('summaryBox').innerHTML = summary;
  const plainSummary = summary.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const createdAt = new Date().toISOString();
  const entries = getEntries();
  const localEntry = { createdAt, title: `สรุปการทำงาน · ${thaiDate.format(today)}`, plainSummary, summary, category, voice, format };
  entries.unshift(localEntry);
  saveEntries(entries.slice(0, 30));
  const { data: savedRow, error } = await saveToSupabase({ work, blocker, next, summary, category, voice, format });
  if (savedRow?.id) {
    localEntry.id = savedRow.id;
    saveEntries(entries.slice(0, 30));
  }
  if (!error) {
    $('workInput').value = '';
    $('blockerInput').value = '';
    $('nextInput').value = '';
  }
  renderStats();
  $('savedTime').textContent = `บันทึกเมื่อ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
  button.disabled = false;
  button.innerHTML = 'สรุปงาน <span>→</span>';
  showToast(error ? `บันทึกไม่สำเร็จ: ${error.message}` : 'สรุปด้วย AI และบันทึกเรียบร้อยแล้ว');
});

$('copyBtn').addEventListener('click', async () => {
  const text = $('summaryBox').innerText;
  if (text.includes('สรุปของวันนี้')) return showToast('ยังไม่มีสรุปให้คัดลอก');
  await navigator.clipboard.writeText(text);
  showToast('คัดลอกสรุปแล้ว');
});
let resultEditing = false;
$('editBtn').addEventListener('click', async () => {
  const box = $('summaryBox');
  if (box.querySelector('.summary-placeholder')) return showToast('ยังไม่มีสรุปให้แก้ไข');
  if (!resultEditing) {
    resultEditing = true;
    box.contentEditable = 'true';
    box.classList.add('is-editing');
    $('editBtn').textContent = 'บันทึกสรุป';
    box.focus();
    return;
  }
  const text = box.innerText.trim();
  const latest = getEntries()[0];
  const summary = plainToHtml(text);
  if (latest) {
    latest.summary = summary;
    latest.plainSummary = text.replace(/\s+/g, ' ').trim();
    saveEntries(getEntries());
    const result = await updateRemoteSummary(latest.id, summary);
    if (result.error) return showToast(`บันทึกการแก้ไขไม่ได้: ${result.error.message}`);
  }
  box.innerHTML = summary;
  box.contentEditable = 'false';
  box.classList.remove('is-editing');
  resultEditing = false;
  $('editBtn').textContent = 'แก้ไขสรุป';
  renderStats();
  showToast('แก้ไขสรุปและบันทึกแล้ว');
});
$('themeBtn').addEventListener('click', () => document.body.classList.toggle('dark'));
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') $('summarizeBtn').click(); });

initSupabase();
