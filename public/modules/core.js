export const STORAGE_KEY = 'worklog-ai-entries';
export const WEEKLY_STORAGE_KEY = 'worklog-ai-weekly-entries';
export const DRAFT_KEY = 'worklog-ai-draft';
export const REMINDER_KEY = 'worklog-ai-reminder';
export const AI_USAGE_KEY = 'worklog-ai-usage';

export const readStorage = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (error) {
    localStorage.removeItem(key);
    return [];
  }
};

export const getEntries = () => readStorage(STORAGE_KEY);
export const saveEntries = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
export const getWeeklyEntries = () => readStorage(WEEKLY_STORAGE_KEY);
export const saveWeeklyEntries = (entries) => localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(entries));
export const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
export const today = new Date();
export const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
export const formatWorkDate = (value) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
export const plainToHtml = (value) => String(value || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('') || '<p>ยังไม่มีข้อความ</p>';
export const htmlToText = (value) => {
  const container = document.createElement('div');
  container.innerHTML = value || '';
  return container.innerText.trim();
};
export const getReminder = () => readStorage(REMINDER_KEY);
