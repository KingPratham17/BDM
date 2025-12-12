
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const getJoditConfig = (options = {}) => {
  const {
    height = 600,
    enableAI = true,           
    enableCollaboration = false,
    readOnly = false,
    theme = 'dark', // 'default' | 'dark' | 'minimal'
  } = options;


  const baseConfig = {
    readonly: readOnly,
    height: height,
    minHeight: 400,
    maxHeight: 900,
    
    // Editor behavior
    allowResizeX: false,
    allowResizeY: true,
    showCharsCounter: true,
    showWordsCounter: true,
    showXPathInStatusbar: false,
    toolbarAdaptive: false,
    toolbarSticky: true,
    toolbarStickyOffset: 0,
    
    // Performance
    iframe: false,
    iframeStyle: '',
    
    // Autosave
    autosave: {
      enabled: false,
      interval: 30000,
    },
    
    // Image handling
    uploader: {
      insertImageAsBase64URI: true,
      imagesExtensions: ['jpg', 'png', 'jpeg', 'gif', 'svg', 'webp'],
    },
    
    // File handling
    filebrowser: {
      ajax: {
        url: '/api/filebrowser',
      },
    },
  };

  // Toolbar configuration based on theme
  const toolbarConfig = getToolbarConfig(theme, enableAI, enableCollaboration);

  // Buttons configuration
  const buttonsConfig = getButtonsConfig(enableAI, enableCollaboration);

  // Events configuration
  const eventsConfig = getEventsConfig();

  // Merge all configs
  return {
    ...baseConfig,
    ...toolbarConfig,
    ...buttonsConfig,
    ...eventsConfig,
  };
};

/**
 * Get toolbar configuration based on theme
 */
function getToolbarConfig(theme, enableAI, enableCollab) {
  // Default full toolbar
  const fullToolbar = [
    'source',
    '|',
    'bold',
    'italic',
    'underline',
    'strikethrough',
    '|',
    'superscript',
    'subscript',
    '|',
    'ul',
    'ol',
    'outdent',
    'indent',
    '|',
    'font',
    'fontsize',
    'brush',
    'paragraph',
    '|',
    'image',
    'table',
    'link',
    '|',
    'align',
    'undo',
    'redo',
    '|',
    'hr',
    'eraser',
    'copyformat',
    '|',
    'symbol',
    'fullsize',
    'preview',
    'print',
  ];

  // Add custom buttons
  const customButtons = [];
  
  if (enableAI) {
    customButtons.push('aiSummarize');

    // you can add more ai actions later, e.g. 'aiRewrite', 'aiExplain'
  }
  
  if (enableCollab) {
    customButtons.push('collabIndicator');
  }

  // Theme-specific modifications
  const themeButtons = {
    default: [...fullToolbar, ...customButtons],
    
    dark: [...fullToolbar, ...customButtons],
    
    minimal: [
      'bold',
      'italic',
      'underline',
      '|',
      'ul',
      'ol',
      '|',
      'link',
      'image',
      '|',
      'undo',
      'redo',
      ...customButtons,
    ],
  };

  return {
    buttons: themeButtons[theme] || themeButtons.default,
    buttonsMD: themeButtons[theme] || themeButtons.default,
    buttonsSM: [
      'bold',
      'italic',
      '|',
      'ul',
      'ol',
      '|',
      'image',
      'link',
      ...customButtons,
    ],
    buttonsXS: [
      'bold',
      'image',
      ...customButtons,
    ],
  };
}

/**
 * Custom buttons configuration
 */
function getButtonsConfig(enableAI, enableCollab) {
  const config = {
    removeButtons: ['video', 'about'], // Remove unwanted default buttons
    disablePlugins: ['video', 'iframe'],
  };

  // AI Summarize Button
  if (enableAI) {
    config.controls = {
      ...(config.controls || {}),
      aiSummarize: {
        name: 'AI Summarize',
        icon: `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M2 12h20"/>
          </svg>
        `,
        tooltip: 'Ask AI to summarize this content',
        exec: async (editor) => {
  const content = editor.value;
  // Try to get current selection text; fallback to empty string
  let selectionText = '';
  try {
    const sel = editor.s && editor.s.selection ? editor.s.selection.getRangeAt(0) : null;
    if (sel) selectionText = sel.toString();
  } catch (err) {
    selectionText = window.getSelection ? window.getSelection().toString() : '';
  }

  // Dispatch a generic AI request event that your app can listen for and handle.
  const event = new CustomEvent('jodit-ai-request', {
    detail: {
      action: 'summarize',
      content,
      selection: selectionText,
    },
  });
  window.dispatchEvent(event);

  // NEVER insert feedback into the document HTML.
  // Instead: show a toast if uiDialogs available, otherwise show a small toolbar badge.
  try {
    if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') {
      window.uiDialogs.showToast('🤖 AI summary requested…', { duration: 2500 });
    } else {
      // create a small transient badge in the editor toolbar (non-content UI)
      try {
        const toolbar = editor && editor.toolbar && editor.toolbar.container;
        if (toolbar) {
          // avoid duplicates
          let badge = toolbar.querySelector('#jodit-ai-request-badge');
          if (!badge) {
            badge = document.createElement('div');
            badge.id = 'jodit-ai-request-badge';
            badge.style.cssText = 'display:inline-flex;align-items:center;padding:4px 8px;margin-left:8px;border-radius:6px;background:#eef2ff;color:#0f172a;font-size:12px;';
            badge.innerText = '🤖 AI summary requested…';
            toolbar.appendChild(badge);
            // auto remove after 3s
            setTimeout(() => { badge && badge.remove(); }, 3000);
          }
        } else {
          // final fallback: console log
          console.log('AI summary requested...');
        }
      } catch (err) {
        console.warn('Toolbar badge creation failed', err);
      }
    }
  } catch (err) {
    console.warn('Feedback UI failed', err);
  }

        },
      },
    };
  }


  if (enableCollab) {
    config.controls = {
      ...config.controls,
      collabIndicator: {
        name: 'Collaborators',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>',
        tooltip: 'Active Collaborators',
        exec: (editor) => {
         
          const event = new CustomEvent('jodit-show-collaborators');
          window.dispatchEvent(event);
        },
      },
    };
  }

  return config;
}

/**
 * Events configuration for real-time features
 */
function getEventsConfig() {
  return {
    events: {
      // After editor initialization
      afterInit: (editor) => {
        console.log('✅ Jodit Editor initialized with enhanced config (AI-enabled)');
        
        // Add custom styling
        addCustomStyles(editor);
        
        // Setup real-time indicators
        setupCollaborationIndicators(editor);

        // Listen for AI results (so external code can send the summary back)
        window.addEventListener('jodit-ai-result', (e) => {
          const { action, result, insertAtSelection } = e.detail || {};

          try {
            if (action !== 'summarize' || !result) return;

            // Ensure modal DOM + CSS exist (idempotent)
            const modalId = 'jodit-ai-modal';
            let modal = document.getElementById(modalId);
            if (!modal) {
              modal = document.createElement('div');
              modal.id = modalId;
              modal.innerHTML = `
                <div class="jodit-ai-modal-backdrop" tabindex="-1">
                  <div class="jodit-ai-modal">
                    <header class="jodit-ai-modal-header">
                      <h3 style="margin:0;font-size:16px;">AI Summary</h3>
                      <button class="jodit-ai-close" aria-label="Close">&times;</button>
                    </header>
                    <main class="jodit-ai-modal-body" role="region" aria-live="polite"></main>
                    <footer class="jodit-ai-modal-footer">
                      <button class="jodit-ai-insert">Insert</button>
                      <button class="jodit-ai-copy">Copy</button>
                      <button class="jodit-ai-close-btn">Close</button>
                    </footer>
                  </div>
                </div>
              `;
              // lightweight CSS (scoped)
              const style = document.createElement('style');
              style.id = 'jodit-ai-modal-style';
              style.textContent = `
                .jodit-ai-modal-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);z-index:100000;padding:20px}
                .jodit-ai-modal{width:min(920px,96%);max-height:85vh;display:flex;flex-direction:column;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(2,6,23,0.3);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial}
                .jodit-ai-modal-header{padding:12px 16px;border-bottom:1px solid #eef2ff;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#eef2ff,#f8faff)}
                .jodit-ai-modal-body{padding:16px;overflow:auto}
                .jodit-ai-modal-footer{padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #f1f5f9;background:#fbfdff}
                .jodit-ai-modal-footer button,.jodit-ai-modal-header .jodit-ai-close{padding:8px 12px;border-radius:6px;border:none;cursor:pointer;background:#eef2ff}
                .jodit-ai-modal-footer .jodit-ai-insert{background:linear-gradient(90deg,#4f46e5,#7c3aed);color:white}
                .jodit-ai-modal-footer .jodit-ai-close-btn{background:#fff1f2;color:#9b1c1c}
              `;
              document.head.appendChild(style);
              document.body.appendChild(modal);
            }

            // find elements (may be newly created)
            const backdrop = modal.querySelector('.jodit-ai-modal-backdrop');
            const body = modal.querySelector('.jodit-ai-modal-body');
            const insertBtn = modal.querySelector('.jodit-ai-insert');
            const copyBtn = modal.querySelector('.jodit-ai-copy');
            const closeBtns = modal.querySelectorAll('.jodit-ai-close, .jodit-ai-close-btn');

            // Ensure modal visible
            if (backdrop) backdrop.style.display = 'flex';

            // Populate body safely: treat result as plain text (wiring already cleaned)
            const isHtml = typeof result === 'string' && /<[a-z][\s\S]*>/i.test(result);
            if (body) {
              body.innerHTML = isHtml ? `<div class="ai-summary">${result}</div>` : `<div class="ai-summary" style="white-space:pre-wrap">${escapeHtml(String(result))}</div>`;
            }

            // Robust insertion function (tries many safe APIs)
            function insertIntoEditor(htmlToInsert) {
              const wrapped = `<div class="ai-summary">${htmlToInsert}</div>`;
              let inserted = false;
              try {
                if (insertAtSelection && editor && editor.selection && typeof editor.selection.insertHTML === 'function') {
                  editor.selection.insertHTML(wrapped);
                  inserted = true;
                }
              } catch (err) { console.warn('editor.selection.insertHTML failed', err); }

              if (!inserted) {
                try {
                  if (editor && editor.s && typeof editor.s.insertHTML === 'function') {
                    editor.s.insertHTML(wrapped);
                    inserted = true;
                  }
                } catch (err) { console.warn('editor.s.insertHTML failed', err); }
              }

              if (!inserted) {
                try {
                  if (editor && editor.selection && typeof editor.selection.insertNode === 'function') {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'ai-summary';
                    wrapper.innerHTML = htmlToInsert;
                    editor.selection.insertNode(wrapper);
                    inserted = true;
                  }
                } catch (err) { console.warn('editor.selection.insertNode failed', err); }
              }

              if (!inserted) {
                try {
                  document.execCommand('insertHTML', false, wrapped);
                  inserted = true;
                } catch (err) { console.warn('document.execCommand failed', err); }
              }

              if (!inserted) {
                try {
                  const wysiwyg = editor && editor.container && editor.container.querySelector && editor.container.querySelector('.jodit-wysiwyg');
                  if (wysiwyg) {
                    wysiwyg.insertAdjacentHTML('beforeend', wrapped);
                    inserted = true;
                  } else if (editor && typeof editor.setEditorValue === 'function') {
                    const current = (typeof editor.value === 'string') ? editor.value : '';
                    editor.setEditorValue(`${current}${wrapped}`);
                    inserted = true;
                  } else if (editor && typeof editor.value === 'string') {
                    editor.value = `${editor.value}${wrapped}`;
                    inserted = true;
                  }
                } catch (err) { console.error('Final fallback insertion failed:', err); }
              }

              if (!inserted) {
                console.warn('AI result could not be programmatically inserted into editor.');
              } else {
                if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') {
                  window.uiDialogs.showToast('Summary inserted into editor', { duration: 2000, level: 'info' });
                }
              }
            }

            // Copy function (safe)
            function copySummary() {
              try {
                const text = (body && (body.innerText || body.textContent)) || String(result);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(text).then(() => {
                    if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') window.uiDialogs.showToast('Copied summary to clipboard', { duration: 2000 });
                  }).catch((err) => {
                    console.warn('clipboard write failed', err);
                    if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') window.uiDialogs.showToast('Copy failed', { level: 'error' });
                  });
                } else {
                  const ta = document.createElement('textarea');
                  ta.value = text;
                  document.body.appendChild(ta);
                  ta.select();
                  try { document.execCommand('copy'); if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') window.uiDialogs.showToast('Copied summary to clipboard', { duration: 2000 }); } catch (err) { if (window.uiDialogs && typeof window.uiDialogs.showToast === 'function') window.uiDialogs.showToast('Copy failed', { level: 'error' }); }
                  ta.remove();
                }
              } catch (err) {
                console.warn('copySummary failed', err);
              }
            }

            // Attach handlers (clear previous to avoid duplicate triggers)
            try {
              if (insertBtn) {
                insertBtn.onclick = () => {
                  insertIntoEditor(isHtml ? result : escapeHtml(String(result)));
                  if (backdrop) backdrop.style.display = 'none';
                };
              }
              if (copyBtn) {
                copyBtn.onclick = copySummary;
              }
              if (closeBtns && closeBtns.length) {
                closeBtns.forEach((btn) => {
                  btn.onclick = () => {
                    if (backdrop) backdrop.style.display = 'none';
                  };
                });
              }
              if (backdrop) {
                backdrop.onclick = (ev) => { if (ev.target === backdrop) backdrop.style.display = 'none'; };
              }
              // focus insert button when modal opens
              if (insertBtn) {
                setTimeout(() => {
                  try { insertBtn.focus(); } catch (err) { /* ignore */ }
                }, 50);
              }
            } catch (err) {
              console.warn('Failed to attach modal handlers', err);
            }
          } catch (err) {
            console.warn('Unhandled error inserting AI result into editor', err);
          }
        });
      },
      
      // On content change
      change: (newValue) => {
        // Dispatch custom event for auto-save or sync
        const event = new CustomEvent('jodit-content-changed', {
          detail: { content: newValue },
        });
        window.dispatchEvent(event);
      },
      
      // On selection change (for collaboration cursor tracking)
      selectionchange: (editor) => {
        const selection = editor.s && typeof editor.s.current === 'function' ? editor.s.current() : (editor.s && editor.s.current ? editor.s.current() : null);
        if (selection) {
          const event = new CustomEvent('jodit-selection-changed', {
            detail: { selection },
          });
          window.dispatchEvent(event);
        }
      },
      
      // On paste (clean up formatting)
      paste: (event) => {
        // Enhanced paste handling
        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('text/html') || clipboardData.getData('text/plain');
        
        // Clean unwanted styles
        if (pastedData) {
          event.preventDefault();
          const cleaned = cleanPastedContent(pastedData);
          try {
            document.execCommand('insertHTML', false, cleaned);
          } catch (err) {
            // last resort: insert via selection
            try {
              const sel = window.getSelection();
              if (sel && sel.rangeCount) {
                sel.getRangeAt(0).deleteContents();
                const el = document.createElement('div');
                el.innerHTML = cleaned;
                sel.getRangeAt(0).insertNode(el);
              }
            } catch (e) { console.warn('paste fallback failed', e); }
          }
        }
      },
    },
  };
}

/**
 * Add custom styles to editor
 */
function addCustomStyles(editor) {
  const editorElement = editor.container;
  
  // Add custom CSS classes
  editorElement.classList.add('jodit-enhanced');
  
  // Inject custom styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .jodit-enhanced .jodit-workplace {
      font-family: 'Times New Roman', Times, serif;
      font-size: 16px;
      line-height: 1.8;
    }
    
    .jodit-enhanced .jodit-wysiwyg {
      padding: 40px 60px;
      background: #ffffff;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.02);
    }
    
    /* Collaboration cursor indicators */
    .collab-cursor {
      position: absolute;
      width: 2px;
      height: 1.2em;
      background: #4CAF50;
      animation: blink 1s infinite;
      pointer-events: none;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    
    /* AI result styles */
    .ai-summary {
      background: linear-gradient(120deg, #f1f5f9 0%, #f8fafc 100%);
      border-left: 3px solid #4f46e5;
      padding: 12px;
      margin: 8px 0;
      border-radius: 6px;
      font-size: 0.95em;
    }

    .ai-request-feedback {
      margin-left: 6px;
    }
    
    /* Enhanced toolbar */
    .jodit-toolbar__box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px 8px 0 0;
      padding: 8px;
    }
    
    .jodit-toolbar-button {
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    
    .jodit-toolbar-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  `;
  
  document.head.appendChild(styleSheet);
}

/**
 * Setup collaboration indicators
 */
function setupCollaborationIndicators(editor) {
  // Listen for collaboration events
  window.addEventListener('collab-user-joined', (e) => {
    const { userId, userName, color } = e.detail;
    
    // Add indicator to toolbar
    const indicator = document.createElement('div');
    indicator.id = `collab-user-${userId}`;
    indicator.className = 'collab-user-indicator';
    indicator.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: ${color};
      border-radius: 12px;
      font-size: 11px;
      color: white;
      margin: 0 4px;
    `;
    indicator.innerHTML = `
      <span style="width: 6px; height: 6px; background: white; border-radius: 50%; animation: pulse 2s infinite;"></span>
      ${userName}
    `;
    
    const toolbar = editor.toolbar && editor.toolbar.container;
    if (toolbar) toolbar.appendChild(indicator);
  });
  
  window.addEventListener('collab-user-left', (e) => {
    const { userId } = e.detail;
    const indicator = document.getElementById(`collab-user-${userId}`);
    if (indicator) {
      indicator.remove();
    }
  });
}

/**
 * Clean pasted content
 */
function cleanPastedContent(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove unwanted tags
  const unwantedTags = ['script', 'style', 'iframe', 'object', 'embed'];
  unwantedTags.forEach(tag => {
    const elements = temp.getElementsByTagName(tag);
    while (elements[0]) {
      elements[0].parentNode.removeChild(elements[0]);
    }
  });
  
  // Clean inline styles (keep only basic formatting)
  const allElements = temp.getElementsByTagName('*');
  for (let el of allElements) {
    const style = el.style;
    const allowedStyles = ['font-weight', 'font-style', 'text-decoration', 'color'];
    
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      if (!allowedStyles.includes(prop)) {
        style.removeProperty(prop);
      }
    }
  }
  
  return temp.innerHTML;
}

/**
 * Preset configurations for common use cases
 */
export const joditPresets = {
  // Full-featured editor
  full: () => getJoditConfig({
    height: 700,
    enableAI: true,
    enableCollaboration: true,
    theme: 'default',
  }),
  
  // Minimal editor
  minimal: () => getJoditConfig({
    height: 400,
    enableAI: false,
    enableCollaboration: false,
    theme: 'minimal',
  }),
  
  // Translation-focused editor (AI focused)
  translation: () => getJoditConfig({
    height: 600,
    enableAI: true,
    enableCollaboration: false,
    theme: 'default',
  }),
  
  // Collaborative editor
  collaborative: () => getJoditConfig({
    height: 600,
    enableAI: true,
    enableCollaboration: true,
    theme: 'default',
  }),
};

export default getJoditConfig;
