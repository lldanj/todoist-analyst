// Todoist API v1 client. All calls are made directly from the browser using
// the user's personal API token (Todoist's API sends
// `Access-Control-Allow-Origin: *`, so no backend proxy is needed).

import { getToken } from './settings.js';

const BASE_URL = 'https://api.todoist.com/api/v1';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiRequest(path, { params = {}, method = 'GET', token } = {}) {
  const authToken = token || getToken();
  if (!authToken) {
    throw new ApiError('No Todoist API token configured.', 0);
  }

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (err) {
    throw new ApiError('Network error reaching Todoist API.', 0);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError('Invalid or expired API token.', res.status);
    }
    throw new ApiError(`Todoist API request failed (${res.status}).`, res.status);
  }

  return res.json();
}

/**
 * Fetches every page of a cursor-paginated (or plain array) endpoint.
 */
async function fetchAllPages(path, params = {}, { maxPages = 10 } = {}) {
  let results = [];
  let cursor;

  for (let page = 0; page < maxPages; page++) {
    const data = await apiRequest(path, { params: { ...params, cursor, limit: params.limit || 200 } });

    if (Array.isArray(data)) {
      results = results.concat(data);
      break;
    }

    if (Array.isArray(data.results)) {
      results = results.concat(data.results);
    }

    cursor = data.next_cursor;
    if (!cursor) break;
  }

  return results;
}

export async function fetchActiveTasks() {
  return fetchAllPages('/tasks');
}

export async function fetchProjects() {
  return fetchAllPages('/projects');
}

export async function fetchLabels() {
  return fetchAllPages('/labels');
}

/**
 * Quick connectivity/token check used by the settings modal's
 * "Test Connection" button. Uses the in-progress token, not the saved one.
 */
export async function testConnection(token) {
  try {
    await apiRequest('/projects', { token, params: { limit: 1 } });
    return { ok: true, message: 'Connection successful!' };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, message: 'Invalid API token.' };
    }
    return { ok: false, message: err.message || 'Connection failed.' };
  }
}

/**
 * Fetches completed tasks within a date range (RFC3339 datetimes).
 * Returns a normalized array of { id, taskId, content, projectId, completedAt }.
 *
 * The exact field names returned by /tasks/completed_by_completion_date
 * vary slightly between API versions, so this normalizes several known
 * variants. If the endpoint itself is unavailable, returns [] and the
 * caller degrades gracefully (relevant KPIs/charts are simply omitted).
 */
export async function fetchCompletedTasks({ since, until, maxPages = 5 } = {}) {
  let results = [];
  let cursor;

  try {
    for (let page = 0; page < maxPages; page++) {
      const data = await apiRequest('/tasks/completed/by_completion_date', {
        params: { since, until, limit: 200, cursor },
      });

      const items = Array.isArray(data) ? data : data.items || data.results || [];
      results = results.concat(items);

      cursor = data.next_cursor;
      if (!cursor) break;
    }
  } catch (err) {
    console.warn('Completed tasks unavailable:', err);
    return [];
  }

  return results.map((item) => ({
    id: item.id,
    taskId: item.task_id ?? item.item_id ?? item.v2_task_id ?? item.id,
    content: item.content,
    projectId: item.project_id ?? item.v2_project_id ?? null,
    completedAt: item.completed_at ?? item.completed_date ?? item.date_completed ?? null,
    addedAt: item.added_at ?? null,
  })).filter((item) => item.completedAt);
}

const HIST_COUNT_CACHE_KEY = 'analyst_historical_completed_count';
const HIST_COUNT_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetches completed task counts for all history by walking backwards in
 * 90-day windows until a window returns 0 tasks (or maxWindows is reached).
 * Results are cached in localStorage for 6 hours so subsequent loads are fast.
 *
 * @param {number} recent90DayCount - count already fetched by the main load
 *   (window 0: today → 90 days ago), so we don't double-fetch it
 * @param {number} maxWindows - how many 90-day windows to look back (default
 *   30 ≈ 7.5 years)
 * @param {function} onProgress - optional callback(totalSoFar) for live KPI updates
 */
export async function fetchHistoricalCompletedCount(recent90DayCount, maxWindows = 30, onProgress) {
  // Return cached value if fresh
  try {
    const cached = JSON.parse(localStorage.getItem(HIST_COUNT_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.fetchedAt < HIST_COUNT_CACHE_TTL) {
      return cached.count;
    }
  } catch {}

  const now = new Date();
  let total = recent90DayCount;
  let consecutiveEmpty = 0;
  const MAX_CONSECUTIVE_EMPTY = 3; // tolerate silent API gaps before giving up

  // Walk backwards starting from window 1 (window 0 is the main 90-day fetch)
  for (let i = 1; i <= maxWindows; i++) {
    const until = new Date(now.getTime() - i * 90 * 24 * 60 * 60 * 1000);
    const since = new Date(until.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 10 pages × 200 tasks = up to 2,000 tasks per 90-day window
    const tasks = await fetchCompletedTasks({ since: since.toISOString(), until: until.toISOString(), maxPages: 10 });

    if (tasks.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
    } else {
      consecutiveEmpty = 0;
      total += tasks.length;
      if (onProgress) onProgress(total);
    }
  }

  try {
    localStorage.setItem(HIST_COUNT_CACHE_KEY, JSON.stringify({ count: total, fetchedAt: Date.now() }));
  } catch {}

  return total;
}

/**
 * Clears the historical completed count cache (called on manual refresh).
 */
export function clearHistoricalCountCache() {
  try { localStorage.removeItem(HIST_COUNT_CACHE_KEY); } catch {}
}

/**
 * Fetches productivity stats. Returns a normalized object or null if the
 * endpoint is unavailable / returns an unrecognized shape, so dependent UI
 * (current streak KPI) can degrade gracefully.
 */
export async function fetchProductivityStats() {
  let data;
  try {
    data = await apiRequest('/tasks/completed/stats');
  } catch (err) {
    console.warn('Productivity stats unavailable:', err);
    return null;
  }

  if (!data || typeof data !== 'object') return null;

  const goals = data.goals || {};
  const currentDailyStreak = goals.current_daily_streak?.count ?? null;
  const currentWeeklyStreak = goals.current_weekly_streak?.count ?? null;

  // days_items holds historical per-day completion counts used for karma;
  // summing them gives a much more complete "all-time completed" total than
  // the 90-day window we fetch from the completed tasks endpoint.
  const daysItems = data.days_items || [];
  const totalCompletedAllTime = daysItems.reduce((sum, d) => sum + (d.total_completed || 0), 0);

  return {
    currentDailyStreak,
    currentWeeklyStreak,
    totalCompletedAllTime,
  };
}
