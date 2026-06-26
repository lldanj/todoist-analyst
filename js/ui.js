// DOM helpers: view switching, KPI rendering, error/loading states.

import { taskUrl, projectOverdueUrl, openInTodoist } from './links.js';

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
  const filterBar = document.getElementById('filter-bar');
  if (filterBar) filterBar.classList.toggle('hidden', view !== 'dashboard');
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

// --- New tile renderers ------------------------------------------------------

export function renderWeekOverWeek({ thisWeek, diff, pct }, el) {
  if (!el) return;
  if (pct === null) {
    el.innerHTML = `${thisWeek}`;
    return;
  }
  const sign = diff >= 0 ? '+' : '';
  const color = diff >= 0 ? 'text-emerald-400' : 'text-rose-400';
  el.innerHTML = `${thisWeek}<span class="${color} text-sm font-semibold ml-1">${sign}${pct}%</span>`;
}

export function renderInsightsSummary({ total, perDay, wow, bestDayCount, activeDays }) {
  const el = document.getElementById('insights-summary');
  if (!el) return;
  const wowText = wow.pct !== null
    ? `<span class="${wow.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${wow.diff >= 0 ? '+' : ''}${wow.pct}% vs last wk</span>`
    : `${wow.thisWeek} this week`;
  el.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="insight-stat">
        <div class="insight-value">${total}</div>
        <div class="insight-label">Completed</div>
      </div>
      <div class="insight-stat">
        <div class="insight-value text-indigo-400">${perDay.toFixed(1)}</div>
        <div class="insight-label">Per Day Avg</div>
      </div>
      <div class="insight-stat">
        <div class="insight-value text-emerald-400">${wow.thisWeek}</div>
        <div class="insight-label">This Week ${wowText}</div>
      </div>
      <div class="insight-stat">
        <div class="insight-value text-amber-400">${bestDayCount}</div>
        <div class="insight-label">Best Day (${activeDays} active days)</div>
      </div>
    </div>`;
}

export function renderBacklogHealth({ score, overdue, veryOld, highPriNoDue, total }) {
  const el = document.getElementById('backlog-health');
  if (!el) return;
  const color = score >= 80 ? '#34d399' : score >= 55 ? '#f59e0b' : '#f43f5e';
  const label = score >= 80 ? 'Healthy' : score >= 55 ? 'Fair' : 'Needs Attention';
  const pct = Math.round((score / 100) * 100);
  el.innerHTML = `
    <div class="flex items-center gap-4 mb-5">
      <div class="relative w-16 h-16 flex-shrink-0">
        <svg class="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" stroke-width="3"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${pct} ${100 - pct}" stroke-linecap="round"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center text-lg font-bold" style="color:${color}">${score}</div>
      </div>
      <div>
        <div class="text-base font-semibold" style="color:${color}">${label}</div>
        <div class="text-xs text-slate-500">${total} active tasks</div>
      </div>
    </div>
    <div class="space-y-2.5">
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">Overdue</span>
        <span class="font-medium ${overdue > 0 ? 'text-rose-400' : 'text-slate-500'}">${overdue}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">60+ days old (unfinished)</span>
        <span class="font-medium ${veryOld > 0 ? 'text-amber-400' : 'text-slate-500'}">${veryOld}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">High priority, no due date</span>
        <span class="font-medium ${highPriNoDue > 0 ? 'text-sky-400' : 'text-slate-500'}">${highPriNoDue}</span>
      </div>
    </div>`;
}

export function renderRecentlyCompleted(tasks) {
  const list = document.getElementById('list-recently-completed');
  if (!list) return;
  list.innerHTML = '';
  if (!tasks.length) {
    const li = document.createElement('li');
    li.className = 'task-list-empty';
    li.textContent = 'No completed tasks in this range.';
    list.appendChild(li);
    return;
  }
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-2';
    const a = document.createElement('a');
    a.href = taskUrl(t.taskId);
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'task-list-link flex-1 min-w-0 truncate';
    a.textContent = t.content;
    const date = document.createElement('span');
    date.className = 'text-xs text-slate-500 flex-shrink-0';
    date.textContent = new Date(t.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    li.appendChild(a);
    li.appendChild(date);
    list.appendChild(li);
  }
}

export function renderOverdueByProject({ labels, data, projectNames }) {
  const el = document.getElementById('overdue-by-project-list');
  if (!el) return;
  el.innerHTML = '';

  const pairs = labels
    .map((label, i) => ({ label, count: data[i], name: projectNames[i] }))
    .filter(p => p.count > 0);

  if (pairs.length === 0) {
    el.innerHTML = '<span class="text-slate-500 text-sm">No overdue tasks — great work!</span>';
    return;
  }

  for (const p of pairs) {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-8 py-1.5 border-t border-slate-800/60 first:border-t-0';

    if (p.name) {
      const a = document.createElement('a');
      a.className = 'overdue-project-link text-sm';
      a.textContent = p.label;
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); openInTodoist(projectOverdueUrl(p.name)); });
      row.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = 'text-sm text-slate-400';
      span.textContent = p.label;
      row.appendChild(span);
    }

    const count = document.createElement('span');
    count.className = 'text-rose-400 font-medium text-sm tabular-nums flex-shrink-0';
    count.textContent = `(${p.count})`;
    row.appendChild(count);

    el.appendChild(row);
  }
}

export function renderRecurringTasks({ total, overdue, dueToday, upcoming, noDue }) {
  const el = document.getElementById('recurring-tasks');
  if (!el) return;
  if (total === 0) {
    el.innerHTML = '<span class="text-slate-500 text-sm">No recurring tasks found.</span>';
    return;
  }
  el.innerHTML = `
    <div class="text-3xl font-bold text-indigo-400 mb-4">${total} <span class="text-sm font-normal text-slate-400">recurring tasks</span></div>
    <div class="space-y-2.5">
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">Overdue</span>
        <span class="font-medium ${overdue > 0 ? 'text-rose-400' : 'text-slate-500'}">${overdue}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">Due Today</span>
        <span class="font-medium ${dueToday > 0 ? 'text-amber-400' : 'text-slate-500'}">${dueToday}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">Upcoming</span>
        <span class="font-medium text-slate-300">${upcoming}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">No Due Date</span>
        <span class="font-medium text-slate-500">${noDue}</span>
      </div>
    </div>`;
}

const CLOUD_COLORS = ['#6366f1','#22d3ee','#f59e0b','#34d399','#f472b6','#a78bfa','#fb923c','#38bdf8','#facc15','#4ade80'];

export function renderWordCloud(words) {
  const el = document.getElementById('word-cloud');
  if (!el) return;
  el.innerHTML = '';
  if (!words.length) {
    el.innerHTML = '<span class="text-slate-500 text-sm">No task content to analyze.</span>';
    return;
  }
  const max = words[0].count;
  const min = words[words.length - 1].count;
  words.forEach(({ word, count }, i) => {
    const ratio = min === max ? 0.5 : (count - min) / (max - min);
    const size = Math.round(11 + ratio * 22);
    const color = CLOUD_COLORS[i % CLOUD_COLORS.length];
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    span.style.color = color;
    span.style.opacity = String(0.55 + ratio * 0.45);
    span.className = 'cursor-default select-none leading-relaxed mx-1 inline-block';
    span.textContent = word;
    span.title = `${count} task${count !== 1 ? 's' : ''}`;
    el.appendChild(span);
  });
}

// --- Section visibility ------------------------------------------------------

const VISIBILITY_KEY = 'analyst_hidden_sections';

function getHiddenSections() {
  try { return new Set(JSON.parse(localStorage.getItem(VISIBILITY_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveHiddenSections(set) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify([...set]));
}

export function applyVisibility() {
  const hidden = getHiddenSections();
  document.querySelectorAll('[data-section]').forEach(el => {
    el.classList.toggle('hidden', hidden.has(el.dataset.section));
  });
}

export function initVisibilityToggle() {
  const btn = document.getElementById('visibility-btn');
  const panel = document.getElementById('visibility-panel');
  if (!btn || !panel) return;

  applyVisibility();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) buildVisibilityPanel(panel);
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}

function buildVisibilityPanel(panel) {
  const hidden = getHiddenSections();
  const sections = [
    { id: 'section-active', label: 'Active Task Charts' },
    { id: 'section-completions', label: 'Completion Charts' },
    { id: 'section-insights', label: 'Insights & Trends' },
    { id: 'section-health', label: 'Backlog Health & Recent' },
    { id: 'section-lead-time', label: 'Task Lead Time' },
    { id: 'section-wordcloud', label: 'Task Topics (Word Cloud)' },
    { id: 'section-lists', label: 'Task Lists (No Label / No Project)' },
  ];
  panel.innerHTML = `<div class="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">Show/Hide Sections</div>`;
  for (const s of sections) {
    const checked = !hidden.has(s.id);
    const row = document.createElement('label');
    row.className = 'flex items-center gap-3 px-3 py-2 hover:bg-slate-800 cursor-pointer rounded';
    row.innerHTML = `
      <input type="checkbox" class="accent-indigo-500" data-section-toggle="${s.id}" ${checked ? 'checked' : ''}>
      <span class="text-sm text-slate-300">${s.label}</span>`;
    row.querySelector('input').addEventListener('change', (e) => {
      const h = getHiddenSections();
      if (e.target.checked) h.delete(s.id); else h.add(s.id);
      saveHiddenSections(h);
      applyVisibility();
    });
    panel.appendChild(row);
  }
}
