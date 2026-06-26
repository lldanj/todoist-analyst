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
    total: document.getElementById('kpi-total'),
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

export function renderKpis({ total, active, overdue, completedToday, completedWeek, streak, avgCompletion, avgPerDay14 }) {
  els.kpi.total.textContent = total;
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
  const card = els.noLabel.count.closest('.chart-card');
  const compactMsg = card?.querySelector('.task-list-compact-msg');
  const list = els.noLabel.list;

  els.noLabel.count.textContent = count;

  if (count === 0) {
    card?.classList.add('chart-card--compact');
    compactMsg?.classList.remove('hidden');
    list.innerHTML = '';
    return;
  }

  card?.classList.remove('chart-card--compact');
  compactMsg?.classList.add('hidden');
  list.innerHTML = '';
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

export function renderTasksWithoutProject({ count, tasks }) {
  const card = els.noProject.count.closest('.chart-card');
  const compactMsg = card?.querySelector('.task-list-compact-msg');

  els.noProject.count.textContent = count;

  if (count === 0) {
    card?.classList.add('chart-card--compact');
    compactMsg?.classList.remove('hidden');
    els.noProject.list.innerHTML = '';
    return;
  }

  card?.classList.remove('chart-card--compact');
  compactMsg?.classList.add('hidden');
  renderTaskListCard(els.noProject, { count, tasks });
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

export function renderUpcomingList(tasks) {
  const list = document.getElementById('list-upcoming');
  if (!list) return;
  list.innerHTML = '';

  if (!tasks.length) {
    const li = document.createElement('li');
    li.className = 'task-list-empty';
    li.textContent = 'Nothing due in the next 7 days.';
    list.appendChild(li);
    return;
  }

  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'flex flex-col gap-0.5 py-2 border-t border-slate-800/60 first:border-t-0';

    // Top row: task name + date badge
    const top = document.createElement('div');
    top.className = 'flex items-start justify-between gap-2';

    const a = document.createElement('a');
    a.href = taskUrl(t.id);
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'task-list-link flex-1 min-w-0';
    a.textContent = t.content;

    const badge = document.createElement('span');
    badge.className = 'text-xs font-medium flex-shrink-0 mt-px';
    if (t.status === 'overdue') {
      const due = new Date(`${t.dueDateStr}T00:00:00`);
      badge.className += ' text-rose-400';
      badge.textContent = `Overdue · ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } else if (t.status === 'today') {
      badge.className += ' text-amber-400';
      badge.textContent = 'Today';
    } else {
      const due = new Date(`${t.dueDateStr}T00:00:00`);
      badge.className += ' text-slate-500';
      badge.textContent = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    top.appendChild(a);
    top.appendChild(badge);

    // Bottom row: project + labels
    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-1.5 text-xs text-slate-500 flex-wrap';

    if (t.project) {
      const proj = document.createElement('span');
      proj.textContent = t.project;
      meta.appendChild(proj);
    }

    for (const label of t.labels) {
      if (t.project || meta.children.length > 0) {
        const dot = document.createElement('span');
        dot.className = 'text-slate-700';
        dot.textContent = '·';
        meta.appendChild(dot);
      }
      const chip = document.createElement('span');
      chip.className = 'text-indigo-400';
      chip.textContent = label;
      meta.appendChild(chip);
    }

    li.appendChild(top);
    if (meta.children.length) li.appendChild(meta);
    list.appendChild(li);
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
  const canvas = document.getElementById('word-cloud');
  if (!canvas) return;

  // Size the canvas to its CSS display size before drawing
  canvas.width = canvas.offsetWidth || 600;
  canvas.height = 320;

  if (!words.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No task content to analyze.', canvas.width / 2, canvas.height / 2);
    return;
  }

  let colorIndex = 0;
  const list = words.map(({ word, count }) => [word, count]);

  WordCloud(canvas, {
    list,
    gridSize: Math.round(canvas.width / 60),
    weightFactor: (size) => Math.pow(size, 0.9) * (canvas.width / 140),
    fontFamily: "'Inter', system-ui, sans-serif",
    color: () => CLOUD_COLORS[colorIndex++ % CLOUD_COLORS.length],
    rotateRatio: 0.25,
    rotationSteps: 2,
    backgroundColor: 'transparent',
    minSize: 10,
    shuffle: true,
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
