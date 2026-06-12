// Chart.js setup: shared dark theme + one render function per chart.
// `Chart` is loaded globally via the Chart.js UMD CDN bundle in index.html.

import { projectUrl, labelUrl, dueDateUrl, createdAgeUrl, openInTodoist } from './links.js';

const GRID_COLOR = 'rgba(148, 163, 184, 0.08)';
const TEXT_COLOR = '#94a3b8';
const ACCENT = '#6366f1';

// Categorical palette for projects / labels.
export const PALETTE = [
  '#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f472b6',
  '#a78bfa', '#fb923c', '#38bdf8', '#facc15', '#4ade80',
];

const chartInstances = new Map();

// Swaps the cursor to a pointer while hovering a clickable bar/slice.
function clickableHover(evt, elements) {
  evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
}

/** Sets Chart.js global defaults to match the app's dark theme. */
export function applyChartTheme() {
  Chart.defaults.color = TEXT_COLOR;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor = '#1e293b';
}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = chartInstances.get(canvasId);
  if (existing) existing.destroy();

  const chart = new Chart(canvas, config);
  chartInstances.set(canvasId, chart);
  return chart;
}

function tooltipStyle() {
  return {
    backgroundColor: '#1e293b',
    titleColor: '#f1f5f9',
    bodyColor: '#cbd5e1',
    borderColor: '#334155',
    borderWidth: 1,
    padding: 10,
    displayColors: false,
  };
}

function baseCartesianOptions(extraScales = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipStyle(),
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR }, ...extraScales.x },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true, ...extraScales.y },
    },
  };
}

export function renderCompletionsOverTime({ labels, data }) {
  return renderChart('chart-completions-over-time', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Completed',
        data,
        borderColor: ACCENT,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: baseCartesianOptions({ x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } }),
  });
}

export function renderCompletionsByWeekday({ labels, data }) {
  return renderChart('chart-completions-by-weekday', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Completed', data, backgroundColor: ACCENT, borderRadius: 4, maxBarThickness: 40 }],
    },
    options: baseCartesianOptions(),
  });
}

export function renderWeeklyCompletions({ labels, data }) {
  return renderChart('chart-weekly-completions', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Completed', data, backgroundColor: '#22d3ee', borderRadius: 4, maxBarThickness: 40 }],
    },
    options: baseCartesianOptions(),
  });
}

export function renderTasksByProject({ labels, data, ids }) {
  return renderChart('chart-tasks-by-project', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderColor: '#0f172a',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const id = ids?.[elements[0].index];
        if (id) openInTodoist(projectUrl(id));
      },
      plugins: {
        legend: { position: 'right', labels: { color: TEXT_COLOR, boxWidth: 12, padding: 10 } },
        tooltip: tooltipStyle(),
      },
    },
  });
}

export function renderTasksByLabel({ labels, data }) {
  const canvas = document.getElementById('chart-tasks-by-label');
  if (canvas) {
    const rowHeight = 28;
    const minHeight = 240;
    canvas.parentElement.style.height = `${Math.max(minHeight, labels.length * rowHeight)}px`;
  }

  return renderChart('chart-tasks-by-label', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: '#a78bfa', borderRadius: 4, maxBarThickness: 24 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const label = labels[elements[0].index];
        if (label) openInTodoist(labelUrl(label));
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: TEXT_COLOR } },
      },
    },
  });
}

export function renderUpcomingWorkload({ labels, data, dates }) {
  return renderChart('chart-upcoming', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: '#34d399', borderRadius: 4, maxBarThickness: 40 }],
    },
    options: {
      ...baseCartesianOptions(),
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const date = dates?.[elements[0].index];
        if (date) openInTodoist(dueDateUrl(date));
      },
    },
  });
}

export function renderTasksByAge({ labels, data, ranges }) {
  return renderChart('chart-tasks-by-age', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: '#fb923c', borderRadius: 4, maxBarThickness: 50 }],
    },
    options: {
      ...baseCartesianOptions(),
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const range = ranges?.[elements[0].index];
        if (range) openInTodoist(createdAgeUrl(range.minDays, range.maxDays));
      },
    },
  });
}

export function renderKarmaTrend({ labels, data }) {
  return renderChart('chart-karma-trend', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Karma',
        data,
        borderColor: '#facc15',
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: baseCartesianOptions(),
  });
}
