// Builds deep links into the Todoist web app for clickable chart elements.

const APP_BASE = 'https://app.todoist.com/app';

export function projectUrl(projectId) {
  return `${APP_BASE}/project/${encodeURIComponent(projectId)}`;
}

export function labelUrl(labelName) {
  return `${APP_BASE}/label/${encodeURIComponent(labelName)}`;
}

export function searchUrl(query) {
  return `${APP_BASE}/search/${encodeURIComponent(query)}`;
}

/** date: 'today', or a Date for a specific upcoming day. */
export function dueDateUrl(date) {
  if (date === 'today') return searchUrl('today');
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return searchUrl(`due: ${label}`);
}

/**
 * Filter for active tasks created within an age range, in days
 * (minDays = older bound, maxDays = more-recent bound; either may be
 * omitted for an open-ended range). Uses Todoist's relative "created"
 * date filters, e.g. `created before: -30 days`.
 */
export function createdAgeUrl(minDays, maxDays) {
  const parts = [];
  if (minDays !== undefined) parts.push(`created before: -${minDays} days`);
  if (maxDays !== undefined) parts.push(`created after: -${maxDays} days`);
  return searchUrl(parts.join(' & '));
}

export function openInTodoist(url) {
  window.open(url, '_blank', 'noopener');
}
