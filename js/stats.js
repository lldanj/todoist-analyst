// Pure data-transform functions: turn raw Todoist data into the values and
// chart datasets the dashboard renders. No DOM access here.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Buckets for "Active Tasks by Age", based on each task's creation date
// (`added_at`). minDays/maxDays are inclusive-lower/exclusive-upper bounds
// on age in days; omitted bounds are open-ended.
const AGE_BUCKETS = [
  { label: 'Past Week', maxDays: 7 },
  { label: '1 Week – 1 Month', minDays: 7, maxDays: 30 },
  { label: '1 – 6 Months', minDays: 30, maxDays: 180 },
  { label: '6 Months – 1 Year', minDays: 180, maxDays: 365 },
  { label: 'Over 1 Year', minDays: 365 },
];

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-based start of week.
function startOfWeek(date) {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(d, -offset);
}

function shortDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- KPIs ---------------------------------------------------------------

export function countActiveTasks(tasks) {
  return tasks.length;
}

export function countOverdueTasks(tasks, now = new Date()) {
  const todayStr = toLocalDateStr(now);
  return tasks.filter((t) => t.due?.date && t.due.date < todayStr).length;
}

export function countCompletedOnDate(completedTasks, date) {
  const dateStr = toLocalDateStr(date);
  return completedTasks.filter((t) => toLocalDateStr(new Date(t.completedAt)) === dateStr).length;
}

export function countCompletedThisWeek(completedTasks, now = new Date()) {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  return completedTasks.filter((t) => {
    const d = new Date(t.completedAt);
    return d >= weekStart && d < weekEnd;
  }).length;
}

/** Average number of tasks completed per day over the trailing window. */
export function avgCompletedPerDay(completedTasks, days = 14, now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, -(days - 1));
  const count = completedTasks.filter((t) => {
    const d = new Date(t.completedAt);
    return d >= start && d <= now;
  }).length;
  return count / days;
}

/**
 * Current daily streak: prefers the value from Todoist's productivity
 * stats; falls back to counting consecutive days (ending today or
 * yesterday) with at least one completed task.
 */
export function currentStreak(completedTasks, productivityStats, now = new Date()) {
  if (productivityStats?.currentDailyStreak != null) {
    return productivityStats.currentDailyStreak;
  }

  const completedDates = new Set(completedTasks.map((t) => toLocalDateStr(new Date(t.completedAt))));
  const today = startOfDay(now);

  let cursor = today;
  if (!completedDates.has(toLocalDateStr(cursor))) {
    cursor = addDays(cursor, -1); // streak may have ended yesterday
    if (!completedDates.has(toLocalDateStr(cursor))) return 0;
  }

  let streak = 0;
  while (completedDates.has(toLocalDateStr(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// --- Charts ---------------------------------------------------------------

export function completionsOverTime(completedTasks, days = 30, now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, -(days - 1));

  const counts = new Map();
  for (const t of completedTasks) {
    const d = startOfDay(new Date(t.completedAt));
    if (d < start || d > today) continue;
    const key = toLocalDateStr(d);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const labels = [];
  const data = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    labels.push(shortDateLabel(d));
    data.push(counts.get(toLocalDateStr(d)) || 0);
  }
  return { labels, data };
}

export function completionsByWeekday(completedTasks) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = new Array(7).fill(0);

  for (const t of completedTasks) {
    const d = new Date(t.completedAt);
    const idx = (d.getDay() + 6) % 7; // 0 = Monday
    data[idx] += 1;
  }

  return { labels, data };
}

export function weeklyCompletions(completedTasks, weeks = 8, now = new Date()) {
  const currentWeekStart = startOfWeek(now);
  const firstWeekStart = addDays(currentWeekStart, -(weeks - 1) * 7);

  const counts = new Map();
  for (const t of completedTasks) {
    const weekStart = startOfWeek(new Date(t.completedAt));
    if (weekStart < firstWeekStart || weekStart > currentWeekStart) continue;
    const key = toLocalDateStr(weekStart);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const labels = [];
  const data = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDays(firstWeekStart, i * 7);
    labels.push(shortDateLabel(weekStart));
    data.push(counts.get(toLocalDateStr(weekStart)) || 0);
  }
  return { labels, data };
}

export function tasksByProject(tasks, projects, maxSlices = 7) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const counts = new Map(); // projectId -> count
  const names = new Map(); // projectId -> name

  for (const t of tasks) {
    const id = t.project_id;
    counts.set(id, (counts.get(id) || 0) + 1);
    names.set(id, nameById.get(id) || 'Unknown');
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((sum, [, count]) => sum + count, 0);

  const labels = top.map(([id]) => names.get(id));
  const data = top.map(([, count]) => count);
  const ids = top.map(([id]) => id);
  if (restTotal > 0) {
    labels.push('Other');
    data.push(restTotal);
    ids.push(null);
  }

  return { labels, data, ids };
}

export function tasksByLabel(tasks) {
  const counts = new Map();
  for (const t of tasks) {
    for (const label of t.labels || []) {
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([name]) => name),
    data: sorted.map(([, count]) => count),
  };
}

function taskListSummary(tasks, predicate) {
  const matches = tasks.filter(predicate);
  const sorted = [...matches].sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
  return { count: matches.length, tasks: sorted.map((t) => ({ id: t.id, content: t.content })) };
}

// Project lists treated as "parked" rather than actionable — tasks here are
// excluded from the without-a-label breakdown even if they lack a label.
const EXCLUDED_PROJECT_NAMES = new Set(['someday maybe', 'reference']);

/**
 * Active tasks with no label, grouped by project (alphabetically), omitting
 * tasks in the "Someday Maybe" and "Reference" projects since those are
 * parked lists rather than actionable work.
 */
export function tasksWithoutLabel(tasks, projects) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  const matches = tasks.filter((t) => {
    if (t.labels && t.labels.length > 0) return false;
    const projectName = nameById.get(t.project_id) || 'No Project';
    return !EXCLUDED_PROJECT_NAMES.has(projectName.toLowerCase());
  });

  const byProject = new Map(); // projectName -> tasks
  for (const t of matches) {
    const projectName = nameById.get(t.project_id) || 'No Project';
    if (!byProject.has(projectName)) byProject.set(projectName, []);
    byProject.get(projectName).push({ id: t.id, content: t.content });
  }

  const groups = [...byProject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectName, projectTasks]) => ({ projectName, tasks: projectTasks }));

  return { count: matches.length, groups };
}

export function tasksWithoutProject(tasks) {
  return taskListSummary(tasks, (t) => !t.project_id);
}

export function upcomingWorkload(tasks, days = 7, now = new Date()) {
  const today = startOfDay(now);
  const counts = new Map();

  for (const t of tasks) {
    if (!t.due?.date) continue;
    // `due.date` is "YYYY-MM-DD" for all-day tasks but can include a time
    // component (e.g. "YYYY-MM-DDTHH:MM:SS") for tasks with a specific due
    // time; take just the date part so this always parses as local midnight.
    const dueDate = startOfDay(new Date(`${t.due.date.slice(0, 10)}T00:00:00`));
    const diffDays = Math.round((dueDate - today) / MS_PER_DAY);
    if (diffDays < 0 || diffDays >= days) continue;
    const key = toLocalDateStr(dueDate);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const labels = [];
  const data = [];
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    labels.push(i === 0 ? 'Today' : shortDateLabel(d));
    data.push(counts.get(toLocalDateStr(d)) || 0);
    dates.push(i === 0 ? 'today' : d);
  }
  return { labels, data, dates };
}

/**
 * Buckets active tasks by how long ago they were created (`added_at`),
 * so neglected tasks (created long ago, still open) stand out. Each
 * bucket also carries its day-range so the caller can build a Todoist
 * "created" filter link for the tasks in that group.
 */
export function tasksByAge(tasks, now = new Date()) {
  const counts = new Array(AGE_BUCKETS.length).fill(0);

  for (const t of tasks) {
    if (!t.added_at) continue;
    const ageDays = (now - new Date(t.added_at)) / MS_PER_DAY;
    const idx = AGE_BUCKETS.findIndex(
      (b) => (b.minDays === undefined || ageDays >= b.minDays)
          && (b.maxDays === undefined || ageDays < b.maxDays)
    );
    if (idx !== -1) counts[idx] += 1;
  }

  return {
    labels: AGE_BUCKETS.map((b) => b.label),
    data: counts,
    ranges: AGE_BUCKETS.map((b) => ({ minDays: b.minDays, maxDays: b.maxDays })),
  };
}

/**
 * Tasks created vs. tasks completed per day over the trailing window, so a
 * growing/shrinking backlog is visible even when "completed" alone looks
 * healthy. "Created" counts both still-active and now-completed tasks by
 * their `added_at` date.
 */
export function netTaskFlow(tasks, completedTasks, days = 90, now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, -(days - 1));

  const created = new Map();
  const completed = new Map();

  const tally = (map, dateValue) => {
    const d = startOfDay(new Date(dateValue));
    if (d < start || d > today) return;
    const key = toLocalDateStr(d);
    map.set(key, (map.get(key) || 0) + 1);
  };

  for (const t of tasks) {
    if (t.added_at) tally(created, t.added_at);
  }
  for (const t of completedTasks) {
    if (t.addedAt) tally(created, t.addedAt);
    tally(completed, t.completedAt);
  }

  const labels = [];
  const createdData = [];
  const completedData = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = toLocalDateStr(d);
    labels.push(shortDateLabel(d));
    createdData.push(created.get(key) || 0);
    completedData.push(completed.get(key) || 0);
  }
  return { labels, created: createdData, completed: completedData };
}

/**
 * Overdue active tasks grouped by project, so neglected work is pinpointed
 * to where it lives rather than just totaled. `projectNames` carries the
 * project name for each bar (null for "Other") to build a filter link.
 */
export function overdueByProject(tasks, projects, now = new Date(), maxSlices = 7) {
  const todayStr = toLocalDateStr(now);
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const counts = new Map();

  for (const t of tasks) {
    if (!t.due?.date || t.due.date >= todayStr) continue;
    const id = t.project_id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((sum, [, count]) => sum + count, 0);

  const labels = top.map(([id]) => nameById.get(id) || 'Unknown');
  const data = top.map(([, count]) => count);
  const projectNames = top.map(([id]) => nameById.get(id) || 'Unknown');
  if (restTotal > 0) {
    labels.push('Other');
    data.push(restTotal);
    projectNames.push(null);
  }

  return { labels, data, projectNames };
}

/**
 * Average time (in days) between a task being created and completed.
 * Returns null if the completed-tasks data doesn't include creation
 * dates, so the KPI can show "–" instead of a misleading 0.
 */
export function avgCompletionDays(completedTasks) {
  const diffs = [];
  for (const t of completedTasks) {
    if (!t.addedAt || !t.completedAt) continue;
    const diff = (new Date(t.completedAt) - new Date(t.addedAt)) / MS_PER_DAY;
    if (diff >= 0) diffs.push(diff);
  }
  if (diffs.length === 0) return null;
  const avg = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  return Math.round(avg);
}

