// DOM helpers: view switching, KPI rendering, error/loading states.

const els = {
  connectScreen: document.getElementById('connect-screen'),
  loadingState: document.getElementById('loading-state'),
  dashboard: document.getElementById('dashboard'),
  errorBanner: document.getElementById('error-banner'),
  errorBannerText: document.getElementById('error-banner-text'),
  errorBannerClose: document.getElementById('error-banner-close'),
  lastUpdated: document.getElementById('last-updated'),
  karmaCard: document.getElementById('karma-trend-card'),
  kpi: {
    active: document.getElementById('kpi-active'),
    overdue: document.getElementById('kpi-overdue'),
    completedToday: document.getElementById('kpi-completed-today'),
    completedWeek: document.getElementById('kpi-completed-week'),
    streak: document.getElementById('kpi-streak'),
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

export function renderKpis({ active, overdue, completedToday, completedWeek, streak }) {
  els.kpi.active.textContent = active;
  els.kpi.overdue.textContent = overdue;
  els.kpi.completedToday.textContent = completedToday;
  els.kpi.completedWeek.textContent = completedWeek;
  els.kpi.streak.textContent = streak === 1 ? '1 day' : `${streak} days`;
}

export function setKarmaCardVisible(visible) {
  els.karmaCard.classList.toggle('hidden', !visible);
}

export function setLastUpdated(date) {
  els.lastUpdated.textContent = `Updated ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
