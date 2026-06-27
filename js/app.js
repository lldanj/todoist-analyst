// Entry point: orchestrates data loading, filter state, and rendering.

import * as api from './api.js';
import * as stats from './stats.js';
import * as charts from './charts.js';
import * as ui from './ui.js';
import { getToken, initSettings } from './settings.js';

const refreshBtn = document.getElementById('refresh-btn');

let isLoading = false;
let hasLoadedOnce = false;
let rawData = null; // fetched once; renderAll() filters in-memory

const filters = {
  dateRangeDays: 90,        // null = all fetched data
  selectedProjectIds: new Set(), // empty = all projects
};

// ---------------------------------------------------------------------------
// Filter application
// ---------------------------------------------------------------------------

function applyFilters(raw, now) {
  let { tasks, projects, completedTasks } = raw;
  const allCompletedTasks = completedTasks; // unfiltered, needed for wow

  // Project filter — applies to both active and completed tasks
  if (filters.selectedProjectIds.size > 0) {
    tasks = tasks.filter(t => filters.selectedProjectIds.has(t.project_id));
    completedTasks = completedTasks.filter(t => filters.selectedProjectIds.has(t.projectId));
  }

  // Date filter — completed tasks only (active tasks are always current)
  let periodTasks = completedTasks;
  if (filters.dateRangeDays !== null) {
    const since = new Date(now.getTime() - filters.dateRangeDays * 24 * 60 * 60 * 1000);
    periodTasks = completedTasks.filter(t => new Date(t.completedAt) >= since);
  }

  // Comparison period: the equivalent window immediately before this one
  let compTasks = null;
  if (filters.dateRangeDays !== null) {
    const since = new Date(now.getTime() - filters.dateRangeDays * 24 * 60 * 60 * 1000);
    const compSince = new Date(since.getTime() - filters.dateRangeDays * 24 * 60 * 60 * 1000);
    compTasks = completedTasks.filter(t => {
      const d = new Date(t.completedAt);
      return d >= compSince && d < since;
    });
  }

  return {
    tasks,
    projects,
    labels: raw.labels,
    productivityStats: raw.productivityStats,
    completedTasks: periodTasks,   // date + project filtered
    allCompletedTasks,             // project filtered only (for wow)
    compTasks,                     // prior period for trend comparison
  };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderAll() {
  if (!rawData) return;
  const now = new Date();
  const d = applyFilters(rawData, now);

  const wow = stats.weekOverWeek(d.allCompletedTasks, now);
  ui.renderKpis({
    total: d.tasks.length + (rawData.productivityStats?.totalCompletedAllTime ?? d.completedTasks.length),
    active: stats.countActiveTasks(d.tasks),
    overdue: stats.countOverdueTasks(d.tasks, now),
    completedToday: stats.countCompletedOnDate(d.completedTasks, now),
    completedWeek: stats.countCompletedThisWeek(d.allCompletedTasks, now),
    streak: stats.currentStreak(d.allCompletedTasks, d.productivityStats, now),
    avgCompletion: stats.avgCompletionDays(d.completedTasks),
    avgPerDay14: stats.avgCompletedPerDay(d.allCompletedTasks, 14, now),
  });
  ui.renderWeekOverWeek(wow, document.getElementById('kpi-completed-week'));

  // Insights — compute the effective number of days in the selected window
  let days = filters.dateRangeDays;
  if (days === null) {
    if (d.completedTasks.length > 0) {
      const earliest = Math.min(...d.completedTasks.map(t => new Date(t.completedAt).getTime()));
      days = Math.max(1, Math.ceil((now.getTime() - earliest) / 86400000));
    } else {
      days = 1;
    }
  }
  ui.renderInsightsSummary(stats.insightsSummary(d.completedTasks, d.allCompletedTasks, days, now));

  // Existing charts (active tasks)
  charts.renderTasksByProject(stats.tasksByProject(d.tasks, d.projects));
  charts.renderTasksByAge(stats.tasksByAge(d.tasks, now));
  charts.renderTasksByLabel(stats.tasksByLabel(d.tasks));
  ui.renderOverdueByProject(stats.overdueByProject(d.tasks, d.projects, now));
  ui.renderUpcomingList(stats.upcomingTaskList(d.tasks, d.projects, 7, now));

  // Existing completion charts (now respect date + project filter)
  const trendDays = filters.dateRangeDays ?? 30;
  charts.renderCompletionTrends(stats.completionTrends(d.completedTasks, trendDays, now, d.compTasks));
  charts.renderNetTaskFlow(stats.netTaskFlow(d.tasks, d.completedTasks, Math.min(trendDays, 90), now));
  charts.renderCompletionsOverTime(stats.completionsOverTime(d.completedTasks, Math.min(trendDays, 90), now));
  charts.renderCompletionsByWeekday(stats.completionsByWeekday(d.completedTasks));
  const weeksToShow = Math.max(2, Math.ceil(trendDays / 7));
  charts.renderWeeklyCompletions(stats.weeklyCompletions(d.completedTasks, weeksToShow, now));

  // New tiles
  charts.renderCompletedByProject(stats.completedByProject(d.completedTasks, d.projects));
  charts.renderLeadTime(stats.leadTimeDistribution(d.completedTasks));
  ui.renderBacklogHealth(stats.backlogHealth(d.tasks, now));
  ui.renderRecentlyCompleted(stats.recentlyCompleted(d.completedTasks));

  // Task lists
  ui.renderTasksWithoutLabel(stats.tasksWithoutLabel(d.tasks, d.projects));
  ui.renderTasksWithoutProject(stats.tasksWithoutProject(d.tasks));

  // Recurring + word cloud (active tasks only, unaffected by completion date filter)
  ui.renderRecurringTasks(stats.recurringTasks(d.tasks, now));
  ui.renderWordCloud(stats.wordFrequency(d.tasks));
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadDashboard() {
  if (isLoading) return;
  isLoading = true;
  ui.hideError();
  if (!hasLoadedOnce) ui.showView('loading');

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const until = now.toISOString();

    const [tasks, projects, labels, completedTasks, productivityStats] = await Promise.all([
      api.fetchActiveTasks(),
      api.fetchProjects(),
      api.fetchLabels(),
      api.fetchCompletedTasks({ since, until }),
      api.fetchProductivityStats(),
    ]);

    rawData = { tasks, projects, labels, completedTasks, productivityStats };

    populateProjectFilter(projects);
    ui.setLastUpdated(now);
    renderAll();
    ui.showView('dashboard');
    hasLoadedOnce = true;
  } catch (err) {
    console.error(err);
    let message = err.message || 'Failed to load data from Todoist.';
    let invalidToken = false;
    if (err instanceof api.ApiError && (err.status === 401 || err.status === 403)) {
      message = 'Your Todoist API token appears to be invalid. Please update it in Settings.';
      invalidToken = true;
    }
    ui.showError(message);
    if (!hasLoadedOnce || invalidToken) ui.showView('connect');
    else ui.showView('dashboard');
  } finally {
    isLoading = false;
  }
}

// ---------------------------------------------------------------------------
// Filter controls
// ---------------------------------------------------------------------------

function initDateRangeFilter() {
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.days;
      filters.dateRangeDays = val === '' ? null : Number(val);
      renderAll();
    });
  });
}

function populateProjectFilter(projects) {
  const list = document.getElementById('project-filter-list');
  const btn = document.getElementById('project-filter-btn');
  const dropdown = document.getElementById('project-filter-dropdown');
  if (!list || !btn || !dropdown) return;

  list.innerHTML = '';

  const allRow = document.createElement('label');
  allRow.className = 'project-filter-row';
  allRow.innerHTML = `<input type="checkbox" id="proj-all" checked> <span>All Projects</span>`;
  list.appendChild(allRow);

  const separator = document.createElement('div');
  separator.className = 'border-t border-slate-800 my-1';
  list.appendChild(separator);

  for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name))) {
    const row = document.createElement('label');
    row.className = 'project-filter-row';
    row.innerHTML = `<input type="checkbox" data-proj-id="${p.id}" checked> <span class="truncate">${p.name}</span>`;
    list.appendChild(row);
  }

  function syncAllCheckbox() {
    const all = [...list.querySelectorAll('[data-proj-id]')];
    const allChecked = all.every(cb => cb.checked);
    list.querySelector('#proj-all').checked = allChecked;
    filters.selectedProjectIds = allChecked
      ? new Set()
      : new Set(all.filter(cb => cb.checked).map(cb => cb.dataset.projId));
    const count = filters.selectedProjectIds.size;
    btn.textContent = count === 0 ? 'All Projects' : `${count} Project${count > 1 ? 's' : ''}`;
    btn.textContent += ' ▾';
    renderAll();
  }

  list.querySelector('#proj-all').addEventListener('change', (e) => {
    list.querySelectorAll('[data-proj-id]').forEach(cb => { cb.checked = e.target.checked; });
    syncAllCheckbox();
  });

  list.querySelectorAll('[data-proj-id]').forEach(cb => {
    cb.addEventListener('change', syncAllCheckbox);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden');
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  charts.applyChartTheme();

  initSettings({
    testConnection: api.testConnection,
    onSave: (token) => {
      if (token) {
        rawData = null;
        loadDashboard();
      } else {
        hasLoadedOnce = false;
        ui.showView('connect');
      }
    },
  });

  initDateRangeFilter();
  ui.initVisibilityToggle();
  refreshBtn.addEventListener('click', () => { rawData = null; loadDashboard(); });

  if (getToken()) {
    loadDashboard();
  } else {
    ui.showView('connect');
  }
}

init();
