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
