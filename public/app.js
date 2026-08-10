const STORAGE_KEY = 'worklog-ai-entries';
let supabaseClient = null;
let supabaseUser = null;
let authMode = 'login';
const $ = (id) => document.getElementById(id);
const getEntries = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveEntries = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const today = new Date();

function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3000); }
function showAuth() { $('authScreen').classList.remove('is-hidden'); $('appShell').classList.add('is-hidden'); }
function showApp() { $('authScreen').classList.add('is-hidden'); $('appShell').classList.remove('is-hidden'); const label = supabaseUser?.user_metadata?.full_name || supabaseUser?.email || 'สมาชิก'; $('profileName').textContent = label; $('avatar').textContent = label.trim().charAt(0).toUpperCase(); }
function setAuthMode(mode) { authMode = mode; const signup = mode === 'signup'; $('authTitle').textContent = signup ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'; $('authKicker').textContent = signup ? 'CREATE YOUR WORKSPACE' : 'PERSONAL WORKSPACE'; $('authDescription').textContent = signup ? 'เริ่มเก็บบันทึกงานของคุณในพื้นที่ส่วนตัว' : 'บันทึกงานของคุณให้เป็นระเบียบ และเปิดดูได้ทุกที่'; $('authNameField').classList.toggle('hidden', !signup); $('authName').required = signup; $('authSubmit').textContent = signup ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'; $('authSwitchText').textContent = signup ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'; $('authToggle').textContent = signup ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'; $('authMessage').textContent = ''; }
async function initSupabase() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    if (!config.url || !config.key || !window.supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
    supabaseClient = window.supabase.createClient(config.url, config.key);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session?.user?.is_anonymous) { await supabaseClient.auth.signOut(); showAuth(); }
    else if (sessionData.session) { supabaseUser = sessionData.session.user; showApp(); await loadRemoteEntries(); }
    else showAuth();
    supabaseClient.auth.onAuthStateChange((_event, session) => { if (session?.user?.is_anonymous) return; if (session) { supabaseUser = session.user; showApp(); loadRemoteEntries(); } });
  } catch (error) { showAuth(); $('authMessage').textContent = error.message; }
}
async function loadRemoteEntries() { const { data: rows, error } = await supabaseClient.from('work_logs').select('*').order('created_at', { ascending: false }).limit(30); if (error) throw error; saveEntries((rows || []).map(row => ({ createdAt: row.created_at, title: `สรุปการทำงาน · ${row.work_date}`, plainSummary: (row.ai_summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), summary: row.ai_summary || '' }))); renderStats(); renderHistory(); }
async function saveToSupabase({ work, blocker, next, summary }) { if (!supabaseClient || !supabaseUser) return { error: new Error('ยังไม่ได้เข้าสู่ระบบ') }; return await supabaseClient.from('work_logs').insert({ user_id: supabaseUser.id, work_date: new Date().toISOString().slice(0, 10), work_text: work, blocker_text: blocker || null, next_text: next || null, ai_summary: summary }); }
async function requestSummary(work, blocker, next) { try { const response = await fetch('/api/summarize', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({work, blocker, next}) }); if (!response.ok) throw new Error('API unavailable'); const data = await response.json(); if (data.summary) return data.summary; } catch (_) {} return `<h3>ภาพรวมการทำงาน</h3><p>${work.replace(/\n/g, '<br>')}</p><h3>ประเด็นติดตาม</h3><p>${blocker || 'ไม่มีประเด็นติดขัดที่ต้องติดตามเป็นพิเศษ'}</p>${next ? `<h3>แผนงานถัดไป</h3><p>${next}</p>` : ''}`; }
function renderStats() { const entries = getEntries(); $('totalCount').innerHTML = `${entries.length} <small>ครั้ง</small>`; $('weekCount').innerHTML = `${entries.filter(e => (Date.now()-new Date(e.createdAt)) < 7*86400000).length} <small>ครั้ง</small>`; }
function renderHistory() { const entries = getEntries(); $('historyList').innerHTML = entries.length ? entries.map(e => `<article class="history-item"><time>${e.title}</time><p>${e.plainSummary}</p></article>`).join('') : '<div class="history-empty">ยังไม่มีประวัติการสรุป</div>'; }
function switchView(view) { document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view)); $('dashboardView').style.display = view === 'dashboard' ? 'block' : 'none'; $('resultPanel').style.display = view === 'dashboard' ? 'block' : 'none'; $('historyView').style.display = view === 'history' ? 'block' : 'none'; if (view === 'history') renderHistory(); }

$('authToggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
$('authForm').addEventListener('submit', async (event) => { event.preventDefault(); const button=$('authSubmit'); button.disabled=true; button.textContent='กำลังดำเนินการ...'; $('authMessage').textContent=''; const email=$('authEmail').value.trim(), password=$('authPassword').value, name=$('authName').value.trim(); const result=authMode==='signup' ? await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin}}) : await supabaseClient.auth.signInWithPassword({email,password}); if (result.error) $('authMessage').textContent=result.error.message; else if (authMode==='signup' && !result.data.session) $('authMessage').textContent='สมัครสำเร็จ กรุณาเช็กอีเมลเพื่อยืนยันบัญชี'; else { supabaseUser=result.data.user; showApp(); await loadRemoteEntries(); } button.disabled=false; button.textContent=authMode==='signup'?'สร้างบัญชี':'เข้าสู่ระบบ'; });
$('logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); localStorage.removeItem(STORAGE_KEY); showAuth(); setAuthMode('login'); });
$('dateLabel').textContent = new Intl.DateTimeFormat('th-TH', {day:'numeric', month:'short', year:'numeric'}).format(today); $('todayLabel').textContent = thaiDate.format(today); $('resultTitle').textContent = `สรุปการทำงาน · ${thaiDate.format(today)}`; renderStats();
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
$('summarizeBtn').addEventListener('click', async () => { const work=$('workInput').value.trim(), blocker=$('blockerInput').value.trim(), next=$('nextInput').value.trim(); if(!work){showToast('กรุณาใส่งานที่ทำวันนี้ก่อน'); $('workInput').focus(); return;} const btn=$('summarizeBtn'); btn.disabled=true; btn.textContent='กำลังสรุป...'; const summary=await requestSummary(work,blocker,next); $('summaryBox').innerHTML=summary; const plainSummary=summary.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); const createdAt=new Date().toISOString(); const entries=getEntries(); entries.unshift({createdAt,title:`สรุปการทำงาน · ${thaiDate.format(today)}`,plainSummary,summary}); saveEntries(entries.slice(0,30)); const { error }=await saveToSupabase({work,blocker,next,summary}); renderStats(); $('savedTime').textContent=`บันทึกเมื่อ ${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`; btn.disabled=false; btn.innerHTML='สรุปงาน <span>→</span>'; showToast(error ? `บันทึกไม่สำเร็จ: ${error.message}` : 'บันทึกงานเรียบร้อยแล้ว'); });
$('copyBtn').addEventListener('click', async () => { const text=$('summaryBox').innerText; if(text.includes('สรุปของวันนี้')) return showToast('ยังไม่มีสรุปให้คัดลอก'); await navigator.clipboard.writeText(text); showToast('คัดลอกสรุปแล้ว'); });
$('editBtn').addEventListener('click', () => $('workInput').focus()); $('themeBtn').addEventListener('click', () => document.body.classList.toggle('dark')); document.addEventListener('keydown', e => { if((e.metaKey||e.ctrlKey)&&e.key==='Enter') $('summarizeBtn').click(); });
initSupabase();
