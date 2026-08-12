import { formatWorkDate, saveEntries, saveWeeklyEntries } from './core.js';

export function createDataClient({ getClient, getUser, onRemoteLoaded = () => {} }) {
  const client = () => getClient();
  const user = () => getUser();
  const unavailable = () => !client() || !user();

  async function loadRemoteEntries() {
    const [{ data: rows, error }, weeklyResult] = await Promise.all([
      client().from('work_logs').select('*').order('created_at', { ascending: false }).limit(30),
      client().from('weekly_summaries').select('*').order('created_at', { ascending: false }).limit(12),
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
    onRemoteLoaded();
  }

  async function refreshRemoteEntries() {
    try {
      await loadRemoteEntries();
    } catch (error) {
      throw error;
    }
  }

  async function saveToSupabase({ work, blocker, next, summary, category, voice, format }) {
    if (unavailable()) return { error: new Error('ยังไม่ได้เข้าสู่ระบบ') };
    const baseRecord = { user_id: user().id, work_date: new Date().toISOString().slice(0, 10), work_text: work, blocker_text: blocker || null, next_text: next || null, ai_summary: summary };
    const result = await client().from('work_logs').insert({ ...baseRecord, category, voice_mode: voice, output_mode: format }).select('id').single();
    if (result.error && /schema cache|category.*column/i.test(result.error.message || '')) return client().from('work_logs').insert(baseRecord).select('id').single();
    return result;
  }

  async function updateRemoteSummary(id, summary) {
    if (!id || unavailable()) return { error: null };
    return client().from('work_logs').update({ ai_summary: summary }).eq('id', id).eq('user_id', user().id);
  }

  async function updateRemoteEntry(id, { work, blocker, next, summary }) {
    if (!id || unavailable()) return { error: null };
    return client().from('work_logs').update({ work_text: work, blocker_text: blocker || null, next_text: next || null, ai_summary: summary }).eq('id', id).eq('user_id', user().id);
  }

  async function updateRemoteRating(id, rating, feedback) {
    if (!id || unavailable()) return { error: null };
    const result = await client().from('work_logs').update({ ai_rating: rating, ai_feedback: feedback || null }).eq('id', id).eq('user_id', user().id);
    if (result.error && /ai_feedback.*column|schema cache/i.test(result.error.message || '')) return client().from('work_logs').update({ ai_rating: rating }).eq('id', id).eq('user_id', user().id);
    return result;
  }

  async function deleteRemoteEntry(id) {
    if (!id || unavailable()) return { error: null };
    return client().from('work_logs').delete().eq('id', id).eq('user_id', user().id).select('id');
  }

  async function saveWeeklyToSupabase(start, end, summary) {
    if (unavailable()) return { error: new Error('ยังไม่ได้เข้าสู่ระบบ') };
    return client().from('weekly_summaries').insert({ user_id: user().id, week_start: start, week_end: end, ai_summary: summary }).select('id').single();
  }

  async function updateWeeklySummary(id, summary) {
    if (!id || unavailable()) return { error: null };
    return client().from('weekly_summaries').update({ ai_summary: summary }).eq('id', id).eq('user_id', user().id);
  }

  async function deleteWeeklySummary(id) {
    if (!id || unavailable()) return { error: null };
    return client().from('weekly_summaries').delete().eq('id', id).eq('user_id', user().id).select('id');
  }

  return { refreshRemoteEntries, saveToSupabase, updateRemoteSummary, updateRemoteEntry, updateRemoteRating, deleteRemoteEntry, saveWeeklyToSupabase, updateWeeklySummary, deleteWeeklySummary };
}
