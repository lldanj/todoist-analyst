// DOM helpers: view switching, KPI rendering, error/loading states.

import { taskUrl } from './links.js';

const els = {
  connectScreen: document.getElementById('connect-screen'),
  loadingState: document.getElementById('loading-state'),
  dashboard: document.getElementById('dashboard'),
  errorBanner: document.getElementById('error-banner'),
  errorBannerText: document.getElementById('error-banner-text'),
  errorBannerClose: document.getElementById('error-banner-close'),
  lastUpdated: document.getElementById('last-updated'),
  kpi: {
    active: document.getElementById('kpi-active'),
    overdue: document.getElementById('kpi-overdue'),
    completedToday: document.getElementById('kpi-completed-today'),
    completedWeek: document.getElementById('kpi-completed-week'),
    streak: document.getElementById('kpi-streak'),
    avgCompletion: document.getElementById('kpi-avg-completion'),
    avgPerDay14: document.getElementById('kpi-avg-per-day-14'),
  },
  noLabel: {
    count: document.getElementById('count-no-label'),
    list: document.getElementById('list-no-label'),
  },
  noProject: {
    count: document.getElementById('count-no-project'),
    list: document.getElementById('list-no-project'),
  },
};

const VIEWS = {
  connect: els.connectScreen,
  loading: els.loadingState,
  dashboard: els.dashboard,
};

/** Shows exactly one of the top-level views: 'connect' | 'loading' | 'dashboard'. */
export function showView(view) {
  for (const [name, el] of Object.entries(VIEWS)) {
    el.classList.toggle('hidden', name !== view);
  }
}

export function showError(message) {
  els.errorBannerText.textContent = message;
  els.errorBanner.classList.remove('hidden');
}

export function hideError() {
  els.errorBanner.classList.add('hidden');
}

els.errorBannerClose.addEventListener('click', hideError);

export function renderKpis({ active, overdue, completedToday, completedWeek, streak, avgCompletion, avgPerDay14 }) {
  els.kpi.active.textContent = active;
  els.kpi.overdue.textContent = overdue;
  els.kpi.completedToday.textContent = completedToday;
  els.kpi.completedWeek.textContent = completedWeek;
  els.kpi.streak.textContent = streak === 1 ? '1 day' : `${streak} days`;
  els.kpi.avgCompletion.textContent = avgCompletion == null ? '–' : avgCompletion === 1 ? '1 day' : `${avgCompletion} days`;
  els.kpi.avgPerDay14.textContent = avgPerDay14.toFixed(1);
}

function taskLink(t) {
  const a = document.createElement('a');
  a.href = taskUrl(t.id);
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'task-list-link';
  a.textContent = t.content;
  return a;
}

function renderTaskListCard({ count, list }, { count: taskCount, tasks }) {
  count.textContent = taskCount;
  list.innerHTML = '';
  if (tasks.length === 0) {
    const li = document.createElement('li');
    li.className = 'task-list-empty';
    li.textContent = 'None — nice work!';
    list.appendChild(li);
    return;
  }
  for (const t of tasks) {
    const li = document.createElement('li');
    li.appendChild(taskLink(t));
    list.appendChild(li);
  }
}

export function renderTasksWithoutLabel({ count, groups }) {
  els.noLabel.count.textContent = count;
  const list = els.noLabel.list;
  list.innerHTML = '';
  if (groups.length === 0) {
    const li = document.createElement('li');
    li.className = 'task-list-empty';
    li.textContent = 'None — nice work!';
    list.appendChild(li);
    return;
  }
  for (const group of groups) {
    const header = document.createElement('li');
    header.className = 'task-list-group-header';
    header.textContent = group.projectName;
    list.appendChild(header);
    for (const t of group.tasks) {
      const li = document.createElement('li');
      li.appendChild(taskLink(t));
      list.appendChild(li);
    }
  }
}

export function renderTasksWithoutProject(data) {
  renderTaskListCard(els.noProject, data);
}

export function setLastUpdated(date) {
  els.lastUpdated.textContent = `Updated ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
