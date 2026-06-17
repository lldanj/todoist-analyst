// Entry point: orchestrates data loading and rendering.

import * as api from './api.js';
import * as stats from './stats.js';
import * as charts from './charts.js';
import * as ui from './ui.js';
import { getToken, initSettings } from './settings.js';

const refreshBtn = document.getElementById('refresh-btn');

let isLoading = false;
let hasLoadedOnce = false;

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

    ui.renderKpis({
      active: stats.countActiveTasks(tasks),
      overdue: stats.countOverdueTasks(tasks, now),
      completedToday: stats.countCompletedOnDate(completedTasks, now),
      completedWeek: stats.countCompletedThisWeek(completedTasks, now),
      streak: stats.currentStreak(completedTasks, productivityStats, now),
      avgCompletion: stats.avgCompletionDays(completedTasks),
      avgPerDay14: stats.avgCompletedPerDay(completedTasks, 14, now),
    });

    charts.renderNetTaskFlow(stats.netTaskFlow(tasks, completedTasks, 90, now));
    charts.renderCompletionsOverTime(stats.completionsOverTime(completedTasks, 30, now));
    charts.renderCompletionsByWeekday(stats.completionsByWeekday(completedTasks));
    charts.renderWeeklyCompletions(stats.weeklyCompletions(completedTasks, 8, now));
    charts.renderTasksByProject(stats.tasksByProject(tasks, projects));
    charts.renderTasksByAge(stats.tasksByAge(tasks, now));
    charts.renderTasksByLabel(stats.tasksByLabel(tasks));
    charts.renderOverdueByProject(stats.overdueByProject(tasks, projects, now));
    charts.renderUpcomingWorkload(stats.upcomingWorkload(tasks, 7, now));
    ui.renderTasksWithoutLabel(stats.tasksWithoutLabel(tasks, projects));
    ui.renderTasksWithoutProject(stats.tasksWithoutProject(tasks));

    ui.setLastUpdated(now);
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
    if (!hasLoadedOnce || invalidToken) {
      ui.showView('connect');
    } else {
      ui.showView('dashboard');
    }
  } finally {
    isLoading = false;
  }
}

function init() {
  charts.applyChartTheme();

  initSettings({
    testConnection: api.testConnection,
    onSave: (token) => {
      if (token) {
        loadDashboard();
      } else {
        hasLoadedOnce = false;
        ui.showView('connect');
      }
    },
  });

  refreshBtn.addEventListener('click', loadDashboard);

  if (getToken()) {
    loadDashboard();
  } else {
    ui.showView('connect');
  }
}

init();
