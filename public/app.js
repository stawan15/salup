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
    createdAt: row.created_at,
    title: `สรุปการทำงาน · ${row.work_date}`,
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
  return await supabaseClient.from('work_logs').insert({
    user_id: supabaseUser.id,
    work_date: new Date().toISOString().slice(0, 10),
    work_text: work,
    blocker_text: blocker || null,
    next_text: next || null,
    ai_summary: summary,
    category,
    voice_mode: voice,
    output_mode: format,
  });
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
    ? entries.map((entry) => `<article class="history-item"><div class="history-item-top"><time>${escapeHtml(entry.title)}</time><div class="history-tags"><span>${escapeHtml(labels[entry.format] || 'บทรายงาน')}</span><span>${escapeHtml(entry.category || 'ทั่วไป')}</span></div></div><p>${escapeHtml(entry.plainSummary)}</p></article>`).join('')
    : '<div class="history-empty">ยังไม่มีประวัติที่ตรงกับตัวกรองนี้</div>';
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
  entries.unshift({ createdAt, title: `สรุปการทำงาน · ${thaiDate.format(today)}`, plainSummary, summary, category, voice, format });
  saveEntries(entries.slice(0, 30));
  const { error } = await saveToSupabase({ work, blocker, next, summary, category, voice, format });
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
$('editBtn').addEventListener('click', () => $('workInput').focus());
$('themeBtn').addEventListener('click', () => document.body.classList.toggle('dark'));
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') $('summarizeBtn').click(); });

initSupabase();
