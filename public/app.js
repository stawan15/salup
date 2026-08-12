const STORAGE_KEY = 'worklog-ai-entries';
const WEEKLY_STORAGE_KEY = 'worklog-ai-weekly-entries';
const DRAFT_KEY = 'worklog-ai-draft';
const REMINDER_KEY = 'worklog-ai-reminder';
const AI_USAGE_KEY = 'worklog-ai-usage';
let supabaseClient = null;
let supabaseUser = null;
let authMode = 'login';
let historyFormat = 'all';
let historyCategory = 'all';
let historySearch = '';
let pendingDailySave = null;

const $ = (id) => document.getElementById(id);
const readStorage = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (error) { localStorage.removeItem(key); return []; } };
const getEntries = () => readStorage(STORAGE_KEY);
const saveEntries = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const getWeeklyEntries = () => readStorage(WEEKLY_STORAGE_KEY);
const saveWeeklyEntries = (entries) => localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(entries));
const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const today = new Date();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const formatWorkDate = (value) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const plainToHtml = (value) => String(value || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('') || '<p>ยังไม่มีข้อความ</p>';
const htmlToText = (value) => { const container = document.createElement('div'); container.innerHTML = value || ''; return container.innerText.trim(); };
const getStyleExamples = () => getEntries().filter((entry) => entry.rating).sort((a, b) => b.rating - a.rating).slice(0, 5).map((entry) => ({ rating: entry.rating, feedback: entry.feedback || '', format: entry.format || 'report', text: htmlToText(entry.summary || entry.plainSummary).slice(0, 700) }));
const getReminder = () => readStorage(REMINDER_KEY);

function initReminder() {
  const reminder = getReminder();
  $('reminderEnabled').checked = Boolean(reminder.enabled);
  $('reminderTime').value = reminder.time || '17:00';
}

async function saveReminder() {
  const enabled = $('reminderEnabled').checked;
  if (enabled && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  localStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled, time: $('reminderTime').value, lastNotified: getReminder().lastNotified || '' }));
  $('reminderPanel').classList.add('hidden');
  showToast(enabled ? 'เปิดการเตือนแล้ว · ทำงานเมื่อเปิดเว็บอยู่' : 'ปิดการเตือนแล้ว');
  checkReminder();
}

function checkReminder() {
  const reminder = getReminder();
  if (!reminder.enabled) return;
  const now = new Date();
  if (![2, 4].includes(now.getDay())) return;
  const todayKey = localDateString(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (currentTime < (reminder.time || '17:00') || reminder.lastNotified === todayKey) return;
  const nextReminder = { ...reminder, lastNotified: todayKey };
  localStorage.setItem(REMINDER_KEY, JSON.stringify(nextReminder));
  if ('Notification' in window && Notification.permission === 'granted') new Notification('น้องโน้ตเตือนแล้ว', { body: 'ถึงเวลาบันทึกและสรุปงานวันนี้แล้วครับ' });
  else showToast('ถึงเวลาบันทึกและสรุปงานวันนี้แล้วครับ');
}

function saveDraft() {
  const draft = { work: $('workInput').value, blocker: $('blockerInput').value, next: $('nextInput').value, category: $('categoryMode').value, voice: $('voiceMode').value, format: $('outputMode').value };
  if (draft.work || draft.blocker || draft.next) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  else localStorage.removeItem(DRAFT_KEY);
  $('draftStatus').innerHTML = '<span class="status-dot"></span> ร่างถูกเก็บไว้ในเครื่อง';
}

function restoreDraft() {
  const draft = readStorage(DRAFT_KEY);
  if (!draft.work && !draft.blocker && !draft.next) return;
  $('workInput').value = draft.work || '';
  $('blockerInput').value = draft.blocker || '';
  $('nextInput').value = draft.next || '';
  if (draft.category) $('categoryMode').value = draft.category;
  if (draft.voice) $('voiceMode').value = draft.voice;
  if (draft.format) $('outputMode').value = draft.format;
  $('draftStatus').innerHTML = '<span class="status-dot"></span> กู้คืนร่างล่าสุดแล้ว';
}

function renderLearningStatus() {
  const count = getEntries().filter((entry) => entry.rating).length;
  const usage = getAiUsage();
  $('learningStatus').textContent = `${count ? `feedback ${count} ครั้ง` : 'ยังไม่มี feedback'} · ใช้ AI วันนี้ ${usage.count}/30`;
}

function getAiUsage() {
  const todayKey = localDateString(new Date());
  const usage = readStorage(AI_USAGE_KEY);
  return usage.date === todayKey ? usage : { date: todayKey, count: 0 };
}

function recordAiUse() {
  const usage = getAiUsage();
  usage.count += 1;
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
  renderLearningStatus();
}

function assertAiAvailable() {
  if (getAiUsage().count >= 30) throw new Error('วันนี้ใช้ AI ครบ 30 ครั้งแล้ว ลองใหม่พรุ่งนี้');
}

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
  const [{ data: rows, error }, weeklyResult] = await Promise.all([
    supabaseClient.from('work_logs').select('*').order('created_at', { ascending: false }).limit(30),
    supabaseClient.from('weekly_summaries').select('*').order('created_at', { ascending: false }).limit(12),
  ]);
  if (error) throw error;
  saveEntries((rows || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    title: `สรุปการทำงาน · ${formatWorkDate(row.work_date)}`,
    plainSummary: (row.ai_summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    summary: row.ai_summary || '',
    rating: row.ai_rating || null,
    feedback: row.ai_feedback || '',
    workDate: row.work_date,
    workText: row.work_text || '',
    blockerText: row.blocker_text || '',
    nextText: row.next_text || '',
    category: row.category || 'ทั่วไป',
    voice: row.voice_mode || 'neutral',
    format: row.output_mode || 'report',
  })));
  if (!weeklyResult.error) saveWeeklyEntries((weeklyResult.data || []).map((row) => ({ id: row.id, start: row.week_start, end: row.week_end, summary: row.ai_summary, createdAt: row.created_at })));
  renderStats();
  renderHistory();
  renderWeeklySource();
  renderWeeklyHistory();
  renderLearningStatus();
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

async function updateRemoteEntry(id, { work, blocker, next, summary }) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('work_logs').update({ work_text: work, blocker_text: blocker || null, next_text: next || null, ai_summary: summary }).eq('id', id).eq('user_id', supabaseUser.id);
}

async function updateRemoteRating(id, rating, feedback) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  const result = await supabaseClient.from('work_logs').update({ ai_rating: rating, ai_feedback: feedback || null }).eq('id', id).eq('user_id', supabaseUser.id);
  if (result.error && /ai_feedback.*column|schema cache/i.test(result.error.message || '')) {
    return await supabaseClient.from('work_logs').update({ ai_rating: rating }).eq('id', id).eq('user_id', supabaseUser.id);
  }
  return result;
}

async function deleteRemoteEntry(id) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('work_logs').delete().eq('id', id).eq('user_id', supabaseUser.id).select('id');
}

async function saveWeeklyToSupabase(start, end, summary) {
  if (!supabaseClient || !supabaseUser) return { error: new Error('ยังไม่ได้เข้าสู่ระบบ') };
  return await supabaseClient.from('weekly_summaries').insert({ user_id: supabaseUser.id, week_start: start, week_end: end, ai_summary: summary }).select('id').single();
}

async function updateWeeklySummary(id, summary) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('weekly_summaries').update({ ai_summary: summary }).eq('id', id).eq('user_id', supabaseUser.id);
}

async function deleteWeeklySummary(id) {
  if (!id || !supabaseClient || !supabaseUser) return { error: null };
  return await supabaseClient.from('weekly_summaries').delete().eq('id', id).eq('user_id', supabaseUser.id).select('id');
}

async function requestSummary(work, blocker, next, voice, format, category) {
  assertAiAvailable();
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work, blocker, next, voice, format, category, styleExamples: getStyleExamples() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Gemini API ยังไม่พร้อมใช้งาน');
  if (!data.summary) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา');
  recordAiUse();
  return data.summary;
}

async function requestWeeklySummary(entries, voice) {
  assertAiAvailable();
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'weekly', voice, format: 'report', category: 'สรุปประจำสัปดาห์', entries, styleExamples: getStyleExamples() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Gemini API ยังไม่พร้อมใช้งาน');
  if (!data.summary) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา');
  recordAiUse();
  return data.summary;
}

function renderStats() {
  const entries = getEntries();
  $('totalCount').innerHTML = `${entries.length} <small>ครั้ง</small>`;
  $('weekCount').innerHTML = `${entries.filter((entry) => (Date.now() - new Date(entry.createdAt)) < 7 * 86400000).length} <small>ครั้ง</small>`;
  renderInsights(entries);
}

function renderInsights(entries = getEntries()) {
  const categoryCounts = Object.entries(entries.reduce((counts, entry) => { const key = entry.category || 'ทั่วไป'; counts[key] = (counts[key] || 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
  const blockers = entries.flatMap((entry) => (entry.blockerText || '').split(/\n+/).map((text) => text.trim()).filter((text) => text && text !== 'ไม่มี'));
  const average = entries.filter((entry) => entry.rating).reduce((sum, entry, _index, rated) => sum + entry.rating / rated.length, 0);
  $('topCategoryInsight').textContent = categoryCounts.length ? `${categoryCounts[0][0]} · ${categoryCounts[0][1]} ครั้ง` : 'ยังไม่มีข้อมูล';
  $('averageRatingInsight').textContent = average ? `${average.toFixed(1)} / 5 ดาว` : 'ยังไม่มีคะแนน';
  $('blockerInsight').textContent = blockers[0] ? (blockers[0].length > 28 ? `${blockers[0].slice(0, 28)}…` : blockers[0]) : 'ยังไม่มีข้อมูล';
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  $('weekStart').value = localDateString(start);
  $('weekEnd').value = localDateString(end);
}

function getWeekLogs() {
  const start = $('weekStart').value;
  const end = $('weekEnd').value;
  return getEntries().filter((entry) => {
    const date = entry.workDate || entry.createdAt?.slice(0, 10);
    return date && date >= start && date <= end;
  });
}

function renderWeeklySource() {
  if (!$('weeklySource')) return;
  const logs = getWeekLogs();
  $('weeklySource').textContent = logs.length
    ? `พบ ${logs.length} บันทึกในช่วงวันที่เลือก · ระบบจะรวมงาน ปัญหา และแผนงานถัดไปให้`
    : 'ยังไม่พบบันทึกงานในช่วงวันที่เลือก';
}

function renderWeeklyResult(entry) {
  if (!entry) return;
  $('weeklySummaryBox').innerHTML = entry.summary;
  $('weeklyResultTitle').textContent = `สรุปประจำสัปดาห์ · ${formatWorkDate(entry.start)} – ${formatWorkDate(entry.end)}`;
  $('weeklySavedTime').textContent = `บันทึกเมื่อ ${new Date(entry.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderWeeklyHistory() {
  const list = $('weeklyHistoryList');
  if (!list) return;
  const entries = getWeeklyEntries();
  list.innerHTML = entries.length
    ? entries.map((entry, index) => `<article class="weekly-history-item" data-weekly-index="${index}"><div class="weekly-history-content"><strong>สัปดาห์ที่ ${formatWorkDate(entry.start)} – ${formatWorkDate(entry.end)}</strong><p class="weekly-history-preview">${escapeHtml(htmlToText(entry.summary).slice(0, 180))}...</p><div class="weekly-history-editor hidden"><textarea>${escapeHtml(htmlToText(entry.summary))}</textarea><div><button class="weekly-cancel secondary-button" type="button">ยกเลิก</button><button class="weekly-save primary-button" type="button">บันทึก</button></div></div></div><div class="weekly-history-actions"><button class="weekly-history-copy secondary-button" type="button">คัดลอก</button><button class="weekly-edit secondary-button" type="button">แก้ไข</button><button class="weekly-delete history-delete" type="button">ลบ</button></div></article>`).join('')
    : '<div class="history-empty">ยังไม่มีสรุปรายสัปดาห์</div>';
  list.querySelectorAll('.weekly-history-copy').forEach((button) => button.addEventListener('click', async () => {
    const entry = entries[Number(button.closest('.weekly-history-item').dataset.weeklyIndex)];
    await navigator.clipboard.writeText(htmlToText(entry.summary));
    showToast('คัดลอกสรุปรายสัปดาห์แล้ว');
  }));
  list.querySelectorAll('.weekly-history-item').forEach((item) => {
    const entry = entries[Number(item.dataset.weeklyIndex)];
    const editor = item.querySelector('.weekly-history-editor');
    item.querySelector('.weekly-edit').addEventListener('click', () => { editor.classList.remove('hidden'); item.querySelector('.weekly-edit').classList.add('hidden'); });
    item.querySelector('.weekly-cancel').addEventListener('click', () => { editor.classList.add('hidden'); item.querySelector('.weekly-edit').classList.remove('hidden'); });
    item.querySelector('.weekly-save').addEventListener('click', async () => {
      const text = editor.querySelector('textarea').value.trim();
      if (!text) return showToast('สรุปต้องมีข้อความ');
      const result = await updateWeeklySummary(entry.id, plainToHtml(text));
      if (result.error) return showToast(`แก้ไขไม่ได้: ${result.error.message}`);
      entry.summary = plainToHtml(text);
      saveWeeklyEntries(entries);
      renderWeeklyHistory();
      showToast('แก้ไขสรุปรายสัปดาห์แล้ว');
    });
    item.querySelector('.weekly-delete').addEventListener('click', async () => {
      if (!window.confirm('ลบสรุปรายสัปดาห์นี้ใช่ไหม?')) return;
      const result = await deleteWeeklySummary(entry.id);
      if (result.error) return showToast(`ลบไม่ได้: ${result.error.message}`);
      if (entry.id && (!result.data || result.data.length === 0)) return showToast('ลบไม่ได้: ยังไม่มีสิทธิ์ DELETE');
      saveWeeklyEntries(entries.filter((candidate) => candidate.createdAt !== entry.createdAt));
      renderWeeklyHistory();
      showToast('ลบสรุปรายสัปดาห์แล้ว');
    });
  });
}

function ratingStars(rating = null) {
  return [1, 2, 3, 4, 5].map((value) => `<button type="button" class="rating-star ${value <= (rating || 0) ? 'is-selected' : ''}" data-rating="${value}" aria-label="${value} ดาว">★</button>`).join('');
}

function bindRating(container, getEntry) {
  container?.querySelectorAll('.rating-star').forEach((button) => button.addEventListener('click', async () => {
    const entry = getEntry();
    if (!entry) return showToast('ยังไม่มีสรุปให้รีวิว');
    const rating = Number(button.dataset.rating);
    const feedback = container.querySelector('.feedback-select')?.value || '';
    const result = await updateRemoteRating(entry.id, rating, feedback);
    if (result.error) return showToast(`บันทึกคะแนนไม่ได้: ${result.error.message}`);
    entry.rating = rating;
    entry.feedback = feedback;
    saveEntries(getEntries());
    renderLearningStatus();
    renderResultRating(entry.rating);
    if ($('historyView').style.display !== 'none') renderHistory();
    showToast(`บันทึกคะแนน ${rating}/5 แล้ว ระบบจะนำไปปรับสำนวนครั้งถัดไป`);
  }));
}

function renderResultRating(rating = null) {
  const container = $('resultRating');
  if (!container) return;
  const entry = getEntries()[0];
  container.querySelector('.rating-stars').innerHTML = ratingStars(rating);
  container.querySelector('.feedback-select').value = entry?.feedback || '';
  bindRating(container, () => getEntries()[0]);
}

function renderHistory() {
  const labels = { report: 'บทรายงาน', speech: 'บทพูด', chat: 'ภาษาพูด', bullet: 'สรุปเป็นข้อ' };
  const entries = getEntries().filter((entry) =>
    (historyFormat === 'all' || entry.format === historyFormat)
    && (historyCategory === 'all' || entry.category === historyCategory)
    && (!historySearch || `${entry.title} ${entry.plainSummary} ${entry.category || ''}`.toLowerCase().includes(historySearch)),
  );
  $('historyList').innerHTML = entries.length
    ? entries.map((entry) => `<article class="history-item" data-entry-key="${escapeHtml(entry.createdAt)}"><div class="history-item-top"><time>${escapeHtml(entry.title)}</time><div class="history-item-actions"><div class="history-tags"><span>${escapeHtml(labels[entry.format] || 'บทรายงาน')}</span><span>${escapeHtml(entry.category || 'ทั่วไป')}</span></div><button class="history-copy" type="button">คัดลอก</button><button class="history-edit" type="button">แก้ไข</button><button class="history-delete" type="button">ลบ</button></div></div><p class="history-preview">${escapeHtml(entry.plainSummary)}</p><div class="history-rating"><span>รีวิวสำนวน</span><div class="rating-stars">${ratingStars(entry.rating)}</div><select class="feedback-select" aria-label="เหตุผลของคะแนน"><option value="">เหตุผล</option><option value="เป็นธรรมชาติ" ${entry.feedback === 'เป็นธรรมชาติ' ? 'selected' : ''}>เป็นธรรมชาติ</option><option value="กระชับดี" ${entry.feedback === 'กระชับดี' ? 'selected' : ''}>กระชับดี</option><option value="เหมาะกับงาน" ${entry.feedback === 'เหมาะกับงาน' ? 'selected' : ''}>เหมาะกับงาน</option><option value="ทางการเกินไป" ${entry.feedback === 'ทางการเกินไป' ? 'selected' : ''}>ทางการเกินไป</option><option value="ยาวเกินไป" ${entry.feedback === 'ยาวเกินไป' ? 'selected' : ''}>ยาวเกินไป</option><option value="ใช้คำซ้ำ" ${entry.feedback === 'ใช้คำซ้ำ' ? 'selected' : ''}>ใช้คำซ้ำ</option></select></div><div class="history-editor hidden"><label class="editor-field"><span>งานต้นฉบับ</span><textarea class="source-work">${escapeHtml(entry.workText || '')}</textarea></label><label class="editor-field"><span>สิ่งที่ติดขัด</span><textarea class="source-blocker">${escapeHtml(entry.blockerText || '')}</textarea></label><label class="editor-field"><span>งานถัดไป</span><textarea class="source-next">${escapeHtml(entry.nextText || '')}</textarea></label><label class="editor-field"><span>หรือแก้สรุปโดยตรง</span><textarea class="source-summary">${escapeHtml(entry.plainSummary)}</textarea></label><div><button class="history-cancel" type="button">ยกเลิก</button><button class="history-regenerate" type="button">สร้างสรุปใหม่จากต้นฉบับ</button><button class="history-save" type="button">บันทึกข้อความนี้</button></div></div></article>`).join('')
    : '<div class="history-empty">ยังไม่มีประวัติที่ตรงกับตัวกรองนี้</div>';
  document.querySelectorAll('.history-item').forEach((item) => {
    const entryForRating = () => getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
    bindRating(item.querySelector('.history-rating'), entryForRating);
    item.querySelector('.feedback-select')?.addEventListener('change', async (event) => {
      const entry = entryForRating();
      if (!entry || !entry.rating) return showToast('ให้คะแนนก่อนเลือกเหตุผลนะครับ');
      const result = await updateRemoteRating(entry.id, entry.rating, event.target.value);
      if (result.error) return showToast(`บันทึก feedback ไม่ได้: ${result.error.message}`);
      entry.feedback = event.target.value;
      saveEntries(getEntries());
      showToast('บันทึก feedback แล้ว');
    });
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
      const text = editor.querySelector('.source-summary').value.trim();
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
    item.querySelector('.history-regenerate')?.addEventListener('click', async () => {
      const entry = getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
      if (!entry) return;
      const work = editor.querySelector('.source-work').value.trim();
      if (!work) return showToast('กรุณาใส่งานต้นฉบับก่อนสร้างใหม่');
      const regenerateButton = item.querySelector('.history-regenerate');
      regenerateButton.disabled = true;
      regenerateButton.textContent = 'กำลังสร้างใหม่...';
      try {
        const summary = await requestSummary(work, editor.querySelector('.source-blocker').value.trim(), editor.querySelector('.source-next').value.trim(), entry.voice || 'neutral', entry.format || 'report', entry.category || 'ทั่วไป');
        const result = await updateRemoteEntry(entry.id, { work, blocker: editor.querySelector('.source-blocker').value.trim(), next: editor.querySelector('.source-next').value.trim(), summary });
        if (result.error) throw result.error;
        entry.workText = work;
        entry.blockerText = editor.querySelector('.source-blocker').value.trim();
        entry.nextText = editor.querySelector('.source-next').value.trim();
        entry.summary = summary;
        entry.plainSummary = htmlToText(summary);
        saveEntries(getEntries());
        renderHistory();
        showToast('สร้างสรุปใหม่จากต้นฉบับแล้ว');
      } catch (error) {
        showToast(`สร้างใหม่ไม่ได้: ${error.message}`);
      }
      regenerateButton.disabled = false;
      regenerateButton.textContent = 'สร้างสรุปใหม่จากต้นฉบับ';
    });
    item.querySelector('.history-delete')?.addEventListener('click', async () => {
      const entry = getEntries().find((candidate) => candidate.createdAt === item.dataset.entryKey);
      if (!entry || !window.confirm('ลบสรุปนี้ออกจากประวัติใช่ไหม?')) return;
      const result = await deleteRemoteEntry(entry.id);
      if (result.error) return showToast(`ลบสรุปไม่ได้: ${result.error.message}`);
      if (entry.id && (!result.data || result.data.length === 0)) return showToast('ลบไม่สำเร็จ: Supabase ยังไม่มีสิทธิ์ DELETE สำหรับบัญชีนี้');
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
  $('weeklyView').style.display = view === 'weekly' ? 'block' : 'none';
  if (view === 'history') renderHistory();
  if (view === 'weekly') renderWeeklySource();
}

$('authToggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
$('forgotPasswordBtn').addEventListener('click', async () => {
  const email = $('authEmail').value.trim();
  if (!email) return showToast('กรุณากรอกอีเมลก่อนขอเปลี่ยนรหัสผ่าน');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  $('authMessage').textContent = error ? error.message : 'ส่งลิงก์เปลี่ยนรหัสผ่านไปที่อีเมลแล้ว';
});
$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('authSubmit');
  button.disabled = true;
  button.textContent = 'กำลังดำเนินการ...';
  $('authMessage').textContent = '';
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const name = $('authName').value.trim();
  try {
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
  } catch (error) {
    $('authMessage').textContent = `เชื่อมต่อไม่ได้: ${error.message}`;
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
setCurrentWeek();
renderStats();
renderResultRating(getEntries()[0]?.rating || null);
renderWeeklyHistory();
renderLearningStatus();
restoreDraft();
initReminder();
checkReminder();
setInterval(checkReminder, 60000);

document.querySelectorAll('#workInput, #blockerInput, #nextInput, #categoryMode, #voiceMode, #outputMode').forEach((field) => {
  field.addEventListener('input', saveDraft);
  field.addEventListener('change', saveDraft);
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$('reminderBtn').addEventListener('click', () => $('reminderPanel').classList.toggle('hidden'));
$('saveReminderBtn').addEventListener('click', saveReminder);
document.querySelectorAll('.history-filter').forEach((button) => button.addEventListener('click', () => {
  historyFormat = button.dataset.format;
  document.querySelectorAll('.history-filter').forEach((item) => item.classList.toggle('active', item === button));
  renderHistory();
}));
$('historyCategory').addEventListener('change', (event) => {
  historyCategory = event.target.value;
  renderHistory();
});
$('historySearch').addEventListener('input', (event) => {
  historySearch = event.target.value.trim().toLowerCase();
  renderHistory();
});
$('exportHistoryBtn').addEventListener('click', () => {
  const payload = { exportedAt: new Date().toISOString(), daily: getEntries(), weekly: getWeeklyEntries() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `worklog-${localDateString(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('ส่งออกประวัติแล้ว');
});
$('importHistoryBtn').addEventListener('click', () => $('importHistoryInput').click());
$('importHistoryInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.daily) || !Array.isArray(payload.weekly)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
    if (!window.confirm('นำเข้าข้อมูลนี้รวมกับประวัติในเครื่องใช่ไหม?')) return;
    const existing = getEntries();
    const importedDaily = payload.daily.map(({ id, ...entry }) => entry);
    const importedWeekly = payload.weekly.map(({ id, ...entry }) => entry);
    const merged = [...existing, ...importedDaily].filter((entry, index, all) => all.findIndex((item) => item.createdAt === entry.createdAt) === index).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    saveEntries(merged.slice(0, 100));
    saveWeeklyEntries([...getWeeklyEntries(), ...importedWeekly].filter((entry, index, all) => all.findIndex((item) => item.createdAt === entry.createdAt) === index).slice(0, 50));
    renderStats();
    renderHistory();
    renderWeeklyHistory();
    showToast('นำเข้าข้อมูลในเครื่องแล้ว · ข้อมูลเดิมบน Supabase ไม่ถูกเขียนทับ');
  } catch (error) {
    showToast(`นำเข้าไม่ได้: ${error.message}`);
  } finally {
    event.target.value = '';
  }
});
function exportText() {
  const entries = getEntries();
  if (!entries.length) { showToast('ยังไม่มีประวัติให้ส่งออก'); return ''; }
  return entries.map((entry) => `## ${entry.title}\n\n${htmlToText(entry.summary || entry.plainSummary)}\n`).join('\n');
}
function downloadFile(name, content, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
$('exportMarkdownBtn').addEventListener('click', () => {
  const text = exportText();
  if (text) { downloadFile(`worklog-${localDateString(new Date())}.md`, text, 'text/markdown;charset=utf-8'); showToast('ส่งออก Markdown แล้ว'); }
});
$('exportWordBtn').addEventListener('click', () => {
  const text = exportText();
  if (text) { const html = `<html><meta charset="utf-8"><body style="font-family:Sarabun,Arial">${text.split('\n').map((line) => line.startsWith('## ') ? `<h2>${escapeHtml(line.slice(3))}</h2>` : `<p>${escapeHtml(line)}</p>`).join('')}</body></html>`; downloadFile(`worklog-${localDateString(new Date())}.doc`, html, 'application/msword'); showToast('ส่งออก Word แล้ว'); }
});
$('exportPdfBtn').addEventListener('click', () => {
  const text = exportText();
  if (!text) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return showToast('เปิดหน้าต่าง PDF ไม่ได้ กรุณาอนุญาต popup');
  printWindow.document.write(`<html><meta charset="utf-8"><title>Worklog</title><body style="font-family:Sarabun,Arial;line-height:1.8;max-width:800px;margin:40px auto">${text.split('\n').map((line) => line.startsWith('## ') ? `<h2>${escapeHtml(line.slice(3))}</h2>` : `<p>${escapeHtml(line)}</p>`).join('')}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
});
$('weekStart').addEventListener('change', renderWeeklySource);
$('weekEnd').addEventListener('change', renderWeeklySource);

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
  const localEntry = { createdAt, title: `สรุปการทำงาน · ${thaiDate.format(today)}`, plainSummary, summary, category, voice, format, workDate: new Date().toISOString().slice(0, 10), workText: work, blockerText: blocker, nextText: next };
  const { data: savedRow, error } = await saveToSupabase({ work, blocker, next, summary, category, voice, format });
  if (error) {
    pendingDailySave = localEntry;
    $('retrySaveBtn').classList.remove('hidden');
    $('savedTime').textContent = 'ยังบันทึกไม่สำเร็จ';
    button.disabled = false;
    button.innerHTML = 'สรุปงาน <span>→</span>';
    showToast(`สรุปแล้วแต่บันทึกไม่ได้: ${error.message} · กดลองบันทึกอีกครั้ง`);
    return;
  }
  if (savedRow?.id) localEntry.id = savedRow.id;
  const entries = getEntries();
  entries.unshift(localEntry);
  saveEntries(entries.slice(0, 30));
  pendingDailySave = null;
  $('retrySaveBtn').classList.add('hidden');
  renderResultRating(localEntry.rating || null);
  $('workInput').value = '';
  $('blockerInput').value = '';
  $('nextInput').value = '';
  localStorage.removeItem(DRAFT_KEY);
  $('draftStatus').innerHTML = '<span class="status-dot"></span> พร้อมรับบันทึกใหม่';
  renderStats();
  $('savedTime').textContent = `บันทึกเมื่อ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
  button.disabled = false;
  button.innerHTML = 'สรุปงาน <span>→</span>';
  showToast('สรุปด้วย AI และบันทึกเรียบร้อยแล้ว');
});

$('retrySaveBtn').addEventListener('click', async () => {
  if (!pendingDailySave) return;
  const button = $('retrySaveBtn');
  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';
  const draft = pendingDailySave;
  const { data, error } = await saveToSupabase({ work: draft.workText, blocker: draft.blockerText, next: draft.nextText, summary: draft.summary, category: draft.category, voice: draft.voice, format: draft.format });
  if (error) {
    button.disabled = false;
    button.textContent = 'ลองบันทึกอีกครั้ง';
    return showToast(`ยังบันทึกไม่ได้: ${error.message}`);
  }
  if (data?.id) draft.id = data.id;
  saveEntries([draft, ...getEntries()].slice(0, 30));
  pendingDailySave = null;
  button.classList.add('hidden');
  button.disabled = false;
  button.textContent = 'ลองบันทึกอีกครั้ง';
  $('workInput').value = '';
  $('blockerInput').value = '';
  $('nextInput').value = '';
  localStorage.removeItem(DRAFT_KEY);
  $('draftStatus').innerHTML = '<span class="status-dot"></span> พร้อมรับบันทึกใหม่';
  renderStats();
  renderLearningStatus();
  showToast('บันทึกงานสำเร็จแล้ว');
});

$('weeklySummarizeBtn').addEventListener('click', async () => {
  const start = $('weekStart').value;
  const end = $('weekEnd').value;
  const logs = getWeekLogs();
  if (!start || !end || start > end) return showToast('กรุณาเลือกช่วงวันที่ให้ถูกต้อง');
  if (!logs.length) return showToast('ยังไม่มีบันทึกงานในช่วงวันที่เลือก');
  const button = $('weeklySummarizeBtn');
  button.disabled = true;
  button.textContent = 'กำลังรวมงาน...';
  try {
    const summary = await requestWeeklySummary(logs.map((entry) => ({ date: entry.workDate || entry.createdAt.slice(0, 10), category: entry.category || 'ทั่วไป', work: entry.workText || entry.plainSummary, blocker: entry.blockerText || '', next: entry.nextText || '' })), $('voiceMode').value);
    const weeklyEntry = { start, end, summary, createdAt: new Date().toISOString() };
    const { data: savedRow, error } = await saveWeeklyToSupabase(start, end, summary);
    if (error && !/weekly_summaries|schema cache|relation/i.test(error.message || '')) throw error;
    if (savedRow?.id) weeklyEntry.id = savedRow.id;
    const weeklyEntries = getWeeklyEntries();
    weeklyEntries.unshift(weeklyEntry);
    saveWeeklyEntries(weeklyEntries.slice(0, 12));
    renderWeeklyResult(weeklyEntry);
    renderWeeklyHistory();
    showToast(error ? 'สรุปแล้ว แต่ยังไม่ได้บันทึกถาวร · รัน migration weekly_summaries ใน Supabase' : 'สรุปรายสัปดาห์และบันทึกเรียบร้อยแล้ว');
  } catch (error) {
    showToast(`สรุปรายสัปดาห์ไม่ได้: ${error.message}`);
  }
  button.disabled = false;
  button.innerHTML = 'สรุปสัปดาห์ <span>→</span>';
});

$('weeklyCopyBtn').addEventListener('click', async () => {
  const text = $('weeklySummaryBox').innerText;
  if (text.includes('สรุปรายสัปดาห์จะแสดงตรงนี้')) return showToast('ยังไม่มีสรุปให้คัดลอก');
  await navigator.clipboard.writeText(text);
  showToast('คัดลอกสรุปรายสัปดาห์แล้ว');
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
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').classList.add('hidden');
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') $('summarizeBtn').click(); });

initSupabase();
