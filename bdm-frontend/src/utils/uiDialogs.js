// bdm-frontend/src/utils/uiDialogs.js
// Global UI dialog replacement: prettier alert(), async confirm/prompt helpers, and toasts.
// Import this once at app startup (e.g. src/main.js) BEFORE other code so global alert is replaced.

(function () {
  // Avoid double-initialization
  if (window.__UI_DIALOGS_INITIALIZED__) return;
  window.__UI_DIALOGS_INITIALIZED__ = true;

  // Basic stylesheet (scoped)
  const style = document.createElement('style');
  style.textContent = `
    /* Toast container */
    #ui-toast-container {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 120000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }
    .ui-toast {
      min-width: 240px;
      max-width: 520px;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(2,6,23,0.16);
      background: #eef2ff;
      color: #0f172a;
      font-size: 13px;
    }
    .ui-toast.error { background:#fff1f2; color:#7f1d1d; }

    /* Modal backdrop */
    #ui-modal-backdrop {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(2,6,23,0.5);
      z-index: 120001;
    }
    .ui-modal {
      width: min(820px, 96%);
      max-height: 86vh;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(2,6,23,0.32);
      display: flex;
      flex-direction: column;
    }
    .ui-modal-header {
      padding: 12px 16px;
      border-bottom: 1px solid #eef2ff;
      display:flex;
      justify-content:space-between;
      align-items:center;
      background: linear-gradient(90deg,#f8fbff,#f1f5ff);
    }
    .ui-modal-body {
      padding: 16px;
      overflow: auto;
    }
    .ui-modal-footer {
      padding: 12px 16px;
      display:flex;
      gap:8px;
      justify-content:flex-end;
      border-top: 1px solid #f3f7ff;
      background: #fbfdff;
    }
    .ui-btn {
      padding: 8px 12px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      background: #eef2ff;
    }
    .ui-btn.primary { background: linear-gradient(90deg,#4f46e5,#7c3aed); color: white; }
  `;
  document.head.appendChild(style);

  // Toast helpers
  function getToastContainer() {
    let c = document.getElementById('ui-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'ui-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, opts = {}) {
    const { duration = 4500, level = 'info' } = opts;
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'ui-toast' + (level === 'error' ? ' error' : '');
    toast.innerHTML = `<div style="white-space:pre-wrap">${escapeHtml(message)}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, duration);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Modal creation (singleton)
  function ensureModal() {
    let backdrop = document.getElementById('ui-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'ui-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ui-modal" role="dialog" aria-modal="true" aria-label="Dialog">
        <div class="ui-modal-header">
          <strong id="ui-modal-title">Dialog</strong>
          <button id="ui-modal-close" class="ui-btn" aria-label="Close">&times;</button>
        </div>
        <div class="ui-modal-body" id="ui-modal-body"></div>
        <div class="ui-modal-footer" id="ui-modal-footer"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Basic handlers
    const closeButtons = backdrop.querySelectorAll('#ui-modal-close');
    closeButtons.forEach(btn => btn.addEventListener('click', () => closeModal(backdrop)));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(backdrop); });

    return backdrop;
  }

  function openModal({ title = 'Message', html = '', footerButtons = [] } = {}) {
    const backdrop = ensureModal();
    const titleEl = backdrop.querySelector('#ui-modal-title');
    const bodyEl = backdrop.querySelector('#ui-modal-body');
    const footerEl = backdrop.querySelector('#ui-modal-footer');

    titleEl.innerText = title;
    bodyEl.innerHTML = html;
    footerEl.innerHTML = ''; // reset

    // Add footer buttons (each: { text, className, onClick })
    footerButtons.forEach(btnCfg => {
      const btn = document.createElement('button');
      btn.className = 'ui-btn' + (btnCfg.className ? ' ' + btnCfg.className : '');
      btn.innerText = btnCfg.text || 'OK';
      btn.addEventListener('click', () => {
        try { btnCfg.onClick && btnCfg.onClick(); } catch (err) { console.warn('footer onClick error', err); }
      });
      footerEl.appendChild(btn);
    });

    backdrop.style.display = 'flex';
    // focus the first primary button if present
    const primary = footerEl.querySelector('.primary');
    if (primary) primary.focus();
  }

  function closeModal(backdrop = null) {
    const b = backdrop || document.getElementById('ui-modal-backdrop');
    if (b) b.style.display = 'none';
    // cleanup listeners if needed — modals recreated each time so minimal memory use
  }

  // Replace window.alert with a nicer modal (non-blocking)
  const originalAlert = window.alert;
  window.alert = function (msg) {
    try {
      openModal({
        title: 'Notice',
        html: `<div style="white-space:pre-wrap">${escapeHtml(String(msg))}</div>`,
        footerButtons: [
          { text: 'OK', className: 'primary', onClick: () => closeModal() }
        ]
      });
    } catch (err) {
      // fallback to native alert if anything goes wrong
      console.warn('Custom alert failed, falling back to native alert', err);
      try { originalAlert(msg); } catch (e) { /* last resort ignore */ }
    }
  };

  // Keep native confirm/prompt available and provide async variants
  const originalConfirm = window.confirm;
  const originalPrompt = window.prompt;

  // Async confirm (returns Promise<boolean>)
  window.confirmAsync = function (message, opts = {}) {
    return new Promise((resolve) => {
      openModal({
        title: opts.title || 'Confirm',
        html: `<div style="white-space:pre-wrap">${escapeHtml(String(message))}</div>`,
        footerButtons: [
          { text: opts.cancelText || 'Cancel', onClick: () => { closeModal(); resolve(false); } },
          { text: opts.okText || 'OK', className: 'primary', onClick: () => { closeModal(); resolve(true); } }
        ]
      });
    });
  };

  // Async prompt (returns Promise<string|null>)
  window.promptAsync = function (message, defaultValue = '', opts = {}) {
    return new Promise((resolve) => {
      const inputId = 'ui-prompt-input-' + Date.now();
      openModal({
        title: opts.title || 'Input',
        html: `<div style="margin-bottom:8px;white-space:pre-wrap">${escapeHtml(String(message))}</div>
               <input id="${inputId}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e6eefc" value="${escapeHtml(String(defaultValue || ''))}" />`,
        footerButtons: [
          { text: opts.cancelText || 'Cancel', onClick: () => { closeModal(); resolve(null); } },
          { text: opts.okText || 'OK', className: 'primary', onClick: () => {
              const val = document.getElementById(inputId).value;
              closeModal();
              resolve(val);
            } }
        ]
      });

      // focus input
      setTimeout(() => {
        const el = document.getElementById(inputId);
        if (el) el.focus();
      }, 50);
    });
  };

  // Optional: If you explicitly want to replace window.confirm and window.prompt (dangerous),
  // you can call uiDialogs.replaceSyncConfirmPrompt() after importing this file.
  function replaceSyncConfirmPrompt() {
    // WARNING: Replacing native confirm/prompt can break synchronous code that expects immediate return values.
    window.confirm = function (msg) {
      // best-effort fallback: show native confirm to preserve sync behavior
      try {
        return originalConfirm(msg);
      } catch (err) {
        return false;
      }
    };
    window.prompt = function (msg, defaultVal = '') {
      try {
        return originalPrompt(msg, defaultVal);
      } catch (err) {
        return null;
      }
    };
  }

  // Expose a small API for other modules
  window.uiDialogs = {
    showToast,
    openModal,
    closeModal,
    confirmAsync: window.confirmAsync,
    promptAsync: window.promptAsync,
    replaceSyncConfirmPrompt, // call explicitly if you understand the tradeoffs
    restoreNative: function () {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
    }
  };

  // Optional: global error handler to show friendly toast instead of raw alerts
  window.addEventListener('error', (ev) => {
    try {
      const msg = ev && ev.message ? ev.message : 'An error occurred';
      showToast(`Error: ${msg}`, { level: 'error', duration: 7000 });
    } catch (err) { /* ignore */ }
  });

  // done
})();
