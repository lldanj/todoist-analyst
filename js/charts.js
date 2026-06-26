// Chart.js setup: shared dark theme + one render function per chart.
// `Chart` is loaded globally via the Chart.js UMD CDN bundle in index.html.

import { projectUrl, labelUrl, dueDateUrl, createdAgeUrl, projectOverdueUrl, openInTodoist } from './links.js';

const GRID_COLOR = 'rgba(148, 163, 184, 0.08)';
const TEXT_COLOR = '#94a3b8';
const ACCENT = '#6366f1';

// Fixed width of the category (label) axis, shared by the scrollable bars
// chart and the frozen axis chart below it, so their plot areas line up.
const LABEL_AXIS_WIDTH = 130;

// Extra right padding so the rightmost x-axis tick label (which sits at the
// chart area's right edge) isn't clipped by the card. Applied to both the
// bars chart and the frozen axis chart so their plot areas stay aligned.
const LABEL_AXIS_RIGHT_PADDING = 20;

function lockLabelAxisWidth(scale) {
  scale.width = LABEL_AXIS_WIDTH;
}

// Picks a "nice" rounded max and step for a 0-based axis so the bars chart
// and its separate frozen axis chart generate identical, evenly-spaced
// gridlines/ticks (Chart.js's auto tick generator can otherwise pick
// different step sizes for the two canvases since one has hidden ticks).
function niceAxisBounds(maxValue, targetTicks = 6) {
  const rawStep = maxValue / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  const step = Math.max(1, Math.round(niceResidual * magnitude));
  const max = Math.ceil(maxValue / step) * step;
  return { max, step };
}

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
  Chart.defaults.font.size = 13; // minimum readable size for ticks/legend/tooltips
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
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Completed', data, backgroundColor: ACCENT, borderRadius: 2, maxBarThickness: 12 }],
    },
    options: baseCartesianOptions({ x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } } }),
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
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const id = ids?.[elements[0].index];
        if (id) openInTodoist(projectUrl(id));
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: TEXT_COLOR } },
      },
    },
  });
}

export function renderTasksByLabel({ labels, data }) {
  const wrap = document.getElementById('chart-tasks-by-label-wrap');
  if (wrap) {
    const rowHeight = 28;
    const minHeight = 276;
    wrap.style.height = `${Math.max(minHeight, labels.length * rowHeight)}px`;
  }

  const maxValue = Math.max(1, ...data);
  const { max: axisMax, step: axisStep } = niceAxisBounds(maxValue);

  // Frozen axis chart: renders just the x-axis scale, pinned below the
  // scrollable bars chart so it stays visible while labels scroll.
  renderChart('chart-tasks-by-label-axis', {
    type: 'bar',
    data: { labels: [''], datasets: [{ data: [0], backgroundColor: 'transparent' }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { right: LABEL_AXIS_RIGHT_PADDING } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { min: 0, max: axisMax, ticks: { color: TEXT_COLOR, precision: 0, stepSize: axisStep }, grid: { color: GRID_COLOR } },
        y: { display: false, afterFit: lockLabelAxisWidth },
      },
    },
  });

  return renderChart('chart-tasks-by-label', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: '#4169e1', borderRadius: 4, maxBarThickness: 24 }],
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
      layout: { padding: { right: LABEL_AXIS_RIGHT_PADDING } },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { min: 0, max: axisMax, ticks: { display: false, stepSize: axisStep }, border: { display: false }, grid: { color: GRID_COLOR } },
        y: { grid: { display: false }, ticks: { color: TEXT_COLOR }, afterFit: lockLabelAxisWidth },
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

export function renderOverdueByProject({ labels, data, projectNames }) {
  return renderChart('chart-overdue-by-project', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: '#f43f5e', borderRadius: 4, maxBarThickness: 28 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const name = projectNames?.[elements[0].index];
        if (name) openInTodoist(projectOverdueUrl(name));
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: TEXT_COLOR } },
      },
    },
  });
}

export function renderCompletedByProject({ labels, data, ids }) {
  return renderChart('chart-completed-by-project', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onHover: clickableHover,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const id = ids?.[elements[0].index];
        if (id) openInTodoist(projectUrl(id));
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: TEXT_COLOR } },
      },
    },
  });
}

export function renderLeadTime({ labels, data }) {
  return renderChart('chart-lead-time', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks',
        data,
        backgroundColor: '#22d3ee',
        borderRadius: 4,
        maxBarThickness: 50,
      }],
    },
    options: baseCartesianOptions(),
  });
}

export function renderCompletionTrends({ labels, data, compData }) {
  const datasets = [
    {
      label: 'This period',
      data,
      borderColor: ACCENT,
      backgroundColor: 'rgba(99,102,241,0.12)',
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
      fill: true,
    },
  ];
  if (compData) {
    datasets.push({
      label: 'Prior period',
      data: compData,
      borderColor: '#64748b',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [4, 4],
    });
  }
  return renderChart('chart-completion-trends', {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !!compData,
          position: 'top',
          align: 'end',
          labels: { color: TEXT_COLOR, boxWidth: 12 },
        },
        tooltip: tooltipStyle(),
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
      },
    },
  });
}

export function renderNetTaskFlow({ labels, created, completed }) {
  return renderChart('chart-net-task-flow', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Created',
          data: created,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Completed',
          data: completed,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.08)',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', align: 'end', labels: { color: TEXT_COLOR, boxWidth: 12 } },
        tooltip: tooltipStyle(),
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, precision: 0 }, beginAtZero: true },
      },
    },
  });
}
