// ==UserScript==
// @name         Todoist Analyst Launcher
// @namespace    todoist-analyst
// @version      1.0
// @description  Small purple dot in the corner that opens Todoist Analyst in a new tab
// @match        https://app.todoist.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ANALYST_URL = 'http://localhost:8000';

  const dot = document.createElement('div');
  dot.title = 'Open Todoist Analyst';
  Object.assign(dot.style, {
    position: 'fixed',
    top: '50px',
    right: '20px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#a855f7',
    cursor: 'pointer',
    zIndex: '999999',
  });

  dot.addEventListener('click', () => {
    fetch(ANALYST_URL, { mode: 'no-cors', cache: 'no-store' })
      .then(() => window.open(ANALYST_URL, '_blank'))
      .catch(() => {
        alert("Todoist Analyst isn't running.\n\nRun ./start.sh in the todoist-analyst folder, then click the dot again.");
      });
  });

  document.body.appendChild(dot);
  console.log('[Todoist Analyst Launcher] dot injected');
})();
