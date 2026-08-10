const STORAGE_KEY = 'worklog-ai-entries';
const $ = (id) => document.getElementById(id);
const getEntries = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveEntries = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const today = new Date();

function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
function demoSummary(work, blocker, next) {
  const items = work.split(/\n+/).map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const bullets = items.length ? items.map(x => `<li>${x}</li>`).join('') : '<li>ยังไม่ได้ระบุรายละเอียดงาน</li>';
  return `<h3>ภาพรวมการทำงาน</h3><p>วันนี้ดำเนินงานตามแผน โดยมีรายละเอียดสำคัญดังนี้</p><ul>${bullets}</ul><h3>ประเด็นติดตาม</h3><p>${blocker || 'ไม่มีประเด็นติดขัดที่ต้องติดตามเป็นพิเศษ'}</p>${next ? `<h3>แผนงานถัดไป</h3><p>${next}</p>` : ''}`;
}
async function requestSummary(work, blocker, next) {
  try {
    const response = await fetch('/api/summarize', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({work, blocker, next}) });
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    if (data.summary) return data.summary;
  } catch (_) { /* demo mode keeps the app usable without a key */ }
  return demoSummary(work, blocker, next);
}
function renderStats() { const entries = getEntries(); $('totalCount').innerHTML = `${entries.length} <small>ครั้ง</small>`; $('weekCount').innerHTML = `${entries.filter(e => (Date.now()-new Date(e.createdAt)) < 7*86400000).length} <small>ครั้ง</small>`; }
function renderHistory() { const entries = getEntries(); $('historyList').innerHTML = entries.length ? entries.map(e => `<article class="history-item"><h3>${e.title}</h3><p>${e.plainSummary}</p></article>`).join('') : '<div class="history-empty">ยังไม่มีประวัติการสรุป<br><small>สรุปงานครั้งแรกของคุณได้จากหน้าภาพรวม</small></div>'; }
function switchView(view) { document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view)); $('dashboardView').style.display = view === 'dashboard' ? 'block' : 'none'; $('resultPanel').style.display = view === 'dashboard' ? 'block' : 'none'; $('historyView').style.display = view === 'history' ? 'block' : 'none'; if (view === 'history') renderHistory(); }

$('dateLabel').textContent = new Intl.DateTimeFormat('th-TH', {day:'numeric', month:'short', year:'numeric'}).format(today);
$('resultTitle').textContent = `สรุปการทำงาน · ${thaiDate.format(today)}`;
renderStats();
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
$('summarizeBtn').addEventListener('click', async () => { const work=$('workInput').value.trim(), blocker=$('blockerInput').value.trim(), next=$('nextInput').value.trim(); if(!work){showToast('ลองใส่งานที่ทำวันนี้ก่อนนะครับ'); $('workInput').focus(); return;} const btn=$('summarizeBtn'); btn.disabled=true; btn.innerHTML='<span>✦</span> กำลังเรียบเรียง...'; const summary=await requestSummary(work,blocker,next); $('summaryBox').innerHTML=summary; const plainSummary=summary.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); const entries=getEntries(); entries.unshift({createdAt:new Date().toISOString(),title:`สรุปการทำงาน · ${thaiDate.format(today)}`,plainSummary,summary}); saveEntries(entries.slice(0,30)); renderStats(); $('savedTime').textContent=`บันทึกเมื่อ ${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`; btn.disabled=false; btn.innerHTML='<span>✦</span> ให้ AI ช่วยสรุป <kbd>⌘ ↵</kbd>'; showToast('สรุปงานและบันทึกเรียบร้อยแล้ว'); });
$('copyBtn').addEventListener('click', async () => { const text=$('summaryBox').innerText; if(text.includes('กรอกงานแล้ว')) return showToast('ยังไม่มีสรุปให้คัดลอก'); await navigator.clipboard.writeText(text); showToast('คัดลอกสรุปแล้ว'); });
$('editBtn').addEventListener('click', () => $('workInput').focus());
$('themeBtn').addEventListener('click', () => document.body.classList.toggle('dark'));
document.addEventListener('keydown', e => { if((e.metaKey||e.ctrlKey)&&e.key==='Enter') $('summarizeBtn').click(); });
