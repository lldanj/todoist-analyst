// Settings: API token storage (localStorage) + settings modal wiring.

const TOKEN_KEY = 'todoist_api_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const RESULT_BASE_CLASS = 'text-sm rounded-lg px-3 py-2 border';
const RESULT_VARIANTS = {
  info: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  error: 'bg-rose-950 text-rose-300 border-rose-800',
};

/**
 * Wires up the settings modal and connect screen.
 * @param {Object} opts
 * @param {(token: string) => void} opts.onSave - called after a token is saved.
 * @param {(token: string) => Promise<{ok: boolean, message?: string}>} opts.testConnection
 * @returns {{ openModal: () => void, closeModal: () => void }}
 */
export function initSettings({ onSave, testConnection }) {
  const overlay = document.getElementById('settings-overlay');
  const input = document.getElementById('api-token-input');
  const toggleBtn = document.getElementById('toggle-token-visibility');
  const testBtn = document.getElementById('test-connection-btn');
  const resultEl = document.getElementById('test-connection-result');
  const saveBtn = document.getElementById('settings-save-btn');
  const cancelBtn = document.getElementById('settings-cancel-btn');
  const closeBtn = document.getElementById('settings-close-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const connectBtn = document.getElementById('connect-btn');

  function showResult(variant, message) {
    resultEl.textContent = message;
    resultEl.className = `${RESULT_BASE_CLASS} ${RESULT_VARIANTS[variant]}`;
    resultEl.classList.remove('hidden');
  }

  function openModal() {
    input.value = getToken();
    input.type = 'password';
    resultEl.classList.add('hidden');
    overlay.classList.remove('hidden');
    input.focus();
  }

  function closeModal() {
    overlay.classList.add('hidden');
  }

  toggleBtn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  testBtn.addEventListener('click', async () => {
    const token = input.value.trim();
    if (!token) {
      showResult('error', 'Please enter a token first.');
      return;
    }
    showResult('info', 'Testing connection…');
    testBtn.disabled = true;
    try {
      const result = await testConnection(token);
      if (result.ok) {
        showResult('success', result.message || 'Connection successful!');
      } else {
        showResult('error', result.message || 'Connection failed. Check your token.');
      }
    } finally {
      testBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', () => {
    const token = input.value.trim();
    setToken(token);
    closeModal();
    onSave(token);
  });

  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  settingsBtn.addEventListener('click', openModal);
  connectBtn.addEventListener('click', openModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  return { openModal, closeModal };
}
