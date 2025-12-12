// bdm-frontend/src/utils/joditAiWiring.js
// Enhanced app-level wiring: robust endpoint handling, retries, toasts, and clearer error reporting.
// Import once in your app entry (e.g. main.js / index.js / App.jsx).

/**
 * How to configure:
 * - Option A (recommended): set window.__JODIT_AI_ENDPOINT__ = 'https://your.ai/endpoint' BEFORE importing this file.
 * - Option B: leave default and it will attempt a short list of common paths (tries localhost:5000 first).
 */

const configuredEndpoint = (typeof window !== 'undefined' && window.__JODIT_AI_ENDPOINT__) || null;
const candidateEndpoints = configuredEndpoint
  ? [configuredEndpoint]
  : ['http://localhost:5000/api/ai', '/api/ai', '/api/v1/ai', '/ai', '/openai']; // tries local backend first

const DEFAULT_TIMEOUT_MS = 20000;

/* Helper: escape HTML for safe display */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* Helper: simple toast for user-visible messages */
function showToast(message, opts = {}) {
  try {
    const { duration = 6000, level = 'info' } = opts;
    const id = `jodit-ai-toast-${Date.now()}`;
    const containerId = 'jodit-ai-toast-container';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = `
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      min-width: 260px;
      max-width: 480px;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
      background: ${level === 'error' ? '#fee2e2' : '#eef2ff'};
      color: ${level === 'error' ? '#9b1c1c' : '#0f172a'};
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
      font-size: 13px;
    `;
    toast.innerHTML = `<strong style="display:block;margin-bottom:4px">${level === 'error' ? 'Error' : 'Info'}</strong>
                       <div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(message)}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
      if (container && container.children.length === 0) container.remove();
    }, duration);
  } catch (err) {
    // ignore toast failures
    console.warn('Toast failed', err);
  }
}

/* Helper: fetch with timeout */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* --- New helpers: dedupe and trim summary --- */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupeAndTrimSummary(raw, opts = {}) {
  if (!raw) return '';

  const maxChars = opts.maxChars || 4000; // cap to prevent huge insertions

  // Convert to plain text if object
  let text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // If the exact whole text repeats multiple times (very common when AI echoes), collapse repeated blocks:
  // detect repeated block by checking if first 200 chars repeated 2+ times
  const chunkLen = Math.min(200, Math.floor(text.length / 2));
  if (chunkLen >= 40) {
    const chunk = text.slice(0, chunkLen);
    const repeatedPattern = new RegExp('(' + escapeRegExp(chunk) + ')(?:\\s*\\1){1,}', 'g');
    if (repeatedPattern.test(text)) {
      text = text.replace(repeatedPattern, chunk);
    }
  }

  // Break into sentences (simple, keeps punctuation)
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  // Remove consecutive duplicates and globally repeated sentences
  const deduped = [];
  const seen = new Set();
  for (let s of sentences) {
    const sTrim = s.trim();
    // skip empty
    if (!sTrim) continue;
    // remove consecutive duplicates
    if (deduped.length && deduped[deduped.length - 1] === sTrim) continue;
    // only keep a sentence once (avoid repeated paragraphs)
    if (!seen.has(sTrim)) {
      deduped.push(sTrim);
      seen.add(sTrim);
    } else {
      // If it has been seen before, skip to avoid repetition
      continue;
    }
  }

  let out = deduped.join(' ');

  // Final safety: ensure not longer than maxChars; cut at last space
  if (out.length > maxChars) {
    out = out.slice(0, maxChars);
    const lastSpace = out.lastIndexOf(' ');
    if (lastSpace > 0) out = out.slice(0, lastSpace) + '…';
  }

  return out;
}
/* --- end helpers --- */

/* Main event listener */
window.addEventListener('jodit-ai-request', async (e) => {
  const { action, content, selection } = e.detail || {};
  if (!action) return;

  // Only handling 'summarize' here; safe to extend.
  if (action !== 'summarize') return;

  const payload = {
    type: 'summarize',
    content,
    selection,
    options: {
      length: 'short',
      includeBullets: true,
    },
  };

  console.log('[joditAiWiring] AI request received', { action, selectionLength: selection ? selection.length : 0 });

  // Try candidate endpoints sequentially until one returns ok (200-299)
  let lastError = null;
  for (const endpoint of candidateEndpoints) {
    try {
      console.log(`[joditAiWiring] Attempting AI endpoint: ${endpoint}`);
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // If non-2xx, capture body (if available) to help debug
      if (!res.ok) {
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch (err) {
          bodyText = `<no body: ${err.message}>`;
        }
        const snippet = bodyText ? (bodyText.length > 300 ? bodyText.slice(0, 300) + '…' : bodyText) : '';
        lastError = { endpoint, status: res.status, statusText: res.statusText, bodySnippet: snippet };

        console.warn(`[joditAiWiring] Endpoint ${endpoint} returned ${res.status}`, { snippet });
        // If 404, continue to next candidate (server might be at a different path)
        if (res.status === 404) {
          continue;
        } else {
          // for other non-2xx statuses, break and report
          break;
        }
      }

      // parse JSON (most AI backends return JSON)
      let data;
      try {
        data = await res.json();
      } catch (err) {
        // fallback to text
        const text = await res.text();
        data = { summary: text };
      }

      const summary = data.summary || data.result || (data.data && data.data.summary) || null;
      if (!summary) {
        // No summary but 2xx — return helpful message
        const noSummaryMsg = 'AI endpoint returned success but no summary field was found in the response.';
        console.warn('[joditAiWiring] no summary in response', { endpoint, data });

        const cleanedNoSummary = dedupeAndTrimSummary(noSummaryMsg, { maxChars: 800 });

        window.dispatchEvent(new CustomEvent('jodit-ai-result', {
          detail: {
            action: 'summarize',
            result: `<em>${escapeHtml(cleanedNoSummary)}</em>`,
            insertAtSelection: !!(selection && selection.length),
          },
        }));
        showToast(noSummaryMsg, { level: 'error' });
        return;
      }

      // CLEAN and DEDUPE the summary before dispatching
      const cleanedSummary = dedupeAndTrimSummary(summary, { maxChars: 4000 });

      // If cleaning removed a lot, tell the user briefly
      if (cleanedSummary.length < String(summary).trim().length) {
        showToast('AI summary cleaned (duplicates/trimmed).', { duration: 2500, level: 'info' });
      }

      // Success: dispatch cleaned result back to editor
      window.dispatchEvent(new CustomEvent('jodit-ai-result', {
        detail: {
          action: 'summarize',
          result: cleanedSummary,
          insertAtSelection: !!(selection && selection.length),
        },
      }));
      showToast('AI summary received', { duration: 3500, level: 'info' });
      return; // done
    } catch (err) {
      // network error, timeout, or abort
      lastError = { endpoint, error: err };
      console.warn(`[joditAiWiring] request to ${endpoint} failed`, err);
      // try next candidate
    }
  } // end for

  // If we reach here, all endpoints failed or returned non-usable responses
  const friendlyMsgParts = [];
  if (lastError) {
    if (lastError.status) {
      friendlyMsgParts.push(`AI endpoint returned ${lastError.status} ${lastError.statusText || ''}.`);
      if (lastError.bodySnippet) {
        friendlyMsgParts.push(`Response body snippet: "${escapeHtml(lastError.bodySnippet)}"`);
      }
      friendlyMsgParts.push(`Tried endpoint: ${lastError.endpoint}`);
    } else if (lastError.error) {
      friendlyMsgParts.push(`Network error when contacting ${lastError.endpoint}: ${lastError.error.message || lastError.error}`);
    } else {
      friendlyMsgParts.push('Unknown error contacting AI endpoint.');
    }
  } else {
    friendlyMsgParts.push('AI request failed (no detailed error available).');
  }

  const friendlyMessage = friendlyMsgParts.join(' ');
  console.error('[joditAiWiring] AI request failed entirely:', friendlyMessage);
  showToast(`AI summary failed — ${friendlyMessage}`, { level: 'error', duration: 8000 });

  // Dispatch failure back to editor so it can show something to the user
  const cleanedErrorMsg = dedupeAndTrimSummary(friendlyMessage, { maxChars: 800 });
  window.dispatchEvent(new CustomEvent('jodit-ai-result', {
    detail: {
      action: 'summarize',
      result: `<em>AI summary failed — ${escapeHtml(cleanedErrorMsg)}</em>`,
      insertAtSelection: false,
    },
  }));
});

/* Export nothing — import for side-effects */
export default null;
