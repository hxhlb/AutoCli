/**
 * AutoCLI Selector Tool — Side Panel Logic
 * Runs inside Chrome Side Panel. Communicates with content script via chrome.tabs.sendMessage.
 */

let activeTabId = null;
let injected = false;

const $ = id => document.getElementById(id);
const toast = $('toast');

function showToast(text) {
  toast.textContent = text || 'Copied!';
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 1200);
}

function copyText(text) {
  navigator.clipboard.writeText(text);
  showToast();
}

// ─── Inject content scripts into active tab ─────────────────────
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function ensureInjected() {
  const tab = await getActiveTab();
  if (!tab?.id) { setStatus('No active tab', 'warning'); return false; }

  // Re-inject if tab changed
  if (activeTabId !== tab.id) {
    injected = false;
    activeTabId = tab.id;
  }

  if (injected) return true;

  try {
    await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['selector/engine.js'] });
    await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['selector/content.js'] });
    injected = true;
    return true;
  } catch (e) {
    setStatus(`Cannot inject: ${e.message}`, 'warning');
    return false;
  }
}

// ─── Send message to content script ─────────────────────────────
function sendToContent(msg) {
  return new Promise((resolve) => {
    if (!activeTabId) { resolve(null); return; }
    chrome.tabs.sendMessage(activeTabId, { ...msg, target: 'autocli-selector-content' }, (resp) => {
      if (chrome.runtime.lastError) { resolve(null); } else { resolve(resp); }
    });
  });
}

// ─── UI helpers ─────────────────────────────────────────────────
function setStatus(html, type) {
  $('status').innerHTML = html;
  $('status').className = 'status' + (type ? ` ${type}` : '');
}

function setActiveBtn(id) {
  ['btn-blocks', 'btn-pick', 'btn-fields'].forEach(bid => $(bid)?.classList.remove('active'));
  if (id) $(id)?.classList.add('active');
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Button handlers ────────────────────────────────────────────
$('btn-blocks').addEventListener('click', async () => {
  if (!await ensureInjected()) return;
  setActiveBtn('btn-blocks');
  setStatus('Highlighting page sections...', '');
  const resp = await sendToContent({ action: 'start-blocks' });
  if (resp?.blocks) {
    setStatus(`Found <b>${resp.blocks.length}</b> sections. Click <b>🎯 Pick</b> to select items.`, 'success');
  }
});

$('btn-pick').addEventListener('click', async () => {
  if (!await ensureInjected()) return;
  setActiveBtn('btn-pick');
  $('sec-list').style.display = 'none';
  $('sec-fields').style.display = 'none';
  $('sec-export').style.display = 'none';
  $('btn-fields').disabled = true;
  await sendToContent({ action: 'start-picking' });
  setStatus('Click list items (2+ similar elements) to detect the pattern.', '');
});

$('btn-fields').addEventListener('click', async () => {
  if (!injected) return;
  setActiveBtn('btn-fields');
  const resp = await sendToContent({ action: 'start-fields' });
  if (resp?.ok) {
    $('sec-fields').style.display = 'block';
    setStatus('Click elements <b>inside a list item</b> to define fields.', '');
  } else {
    setStatus(resp?.error || 'Pick 2+ items first.', 'warning');
  }
});

$('btn-stop').addEventListener('click', async () => {
  if (!injected) return;
  setActiveBtn(null);
  await sendToContent({ action: 'stop' });
  $('sec-list').style.display = 'none';
  $('sec-fields').style.display = 'none';
  $('sec-export').style.display = 'none';
  $('btn-fields').disabled = true;
  setStatus('Stopped. Click a button to start again.', '');
});

// Copy list selector on click
$('box-css').addEventListener('click', () => {
  copyText($('list-css').textContent);
});

// Export buttons
let currentExport = null;

$('btn-copy-json').addEventListener('click', () => {
  if (currentExport) {
    copyText(JSON.stringify(currentExport, null, 2));
    $('btn-copy-json').textContent = '✓'; setTimeout(() => $('btn-copy-json').textContent = '📋 JSON', 1000);
  }
});

$('btn-copy-yaml').addEventListener('click', () => {
  if (!currentExport) return;
  const d = currentExport;
  let yaml = `# AutoCLI Selector Tool\n# URL: ${d.url}\n\ncontainer: "${d.container}"\nmatch_count: ${d.matchCount}\n`;
  if (Object.keys(d.fields).length) {
    yaml += `fields:\n`;
    for (const [n, f] of Object.entries(d.fields)) {
      yaml += `  ${n}:\n    selector: "${f.selector}"\n    type: ${f.type}\n`;
      if (f.attr) yaml += `    attr: ${f.attr}\n`;
    }
  }
  copyText(yaml);
  $('btn-copy-yaml').textContent = '✓'; setTimeout(() => $('btn-copy-yaml').textContent = '📋 YAML', 1000);
});

// ─── Listen for messages from content script ────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.source !== 'autocli-selector-content') return;

  switch (msg.type) {
    case 'selection-update':
      if (msg.list) {
        $('sec-list').style.display = 'block';
        $('list-css').textContent = msg.list.full;
        $('list-count').textContent = `${msg.list.matchCount} items matched`;
        $('btn-fields').disabled = false;
        setStatus(`List detected! <b>${msg.list.matchCount}</b> items. Click <b>📋 Fields</b> to define fields.`, 'success');
        updateExport();
      } else if (msg.selected.length >= 2) {
        setStatus('No common pattern. Try selecting direct siblings.', 'warning');
      }
      break;

    case 'field-added':
      $('sec-fields').style.display = 'block';
      $('fields-list').innerHTML = '';
      for (const [name, info] of Object.entries(msg.allFields)) {
        const item = document.createElement('div');
        item.className = 'field-item';
        item.innerHTML = `
          <span class="field-name">${escHtml(name)}</span>
          <span class="field-selector">${escHtml(info.selector)}</span>
          <span class="field-type">${info.type}</span>
        `;
        item.title = 'Click to copy selector';
        item.addEventListener('click', () => copyText(info.selector));
        $('fields-list').appendChild(item);
      }
      setStatus(`Field <b>${escHtml(msg.fieldName)}</b> added (${msg.matchCount}/${msg.totalItems}).`, 'success');
      updateExport();
      break;

    case 'stopped':
      setActiveBtn(null);
      setStatus('Stopped.', '');
      break;
  }
});

async function updateExport() {
  const resp = await sendToContent({ action: 'export' });
  if (resp && !resp.error) {
    currentExport = resp;
    $('sec-export').style.display = 'block';
    $('export-content').textContent = JSON.stringify(resp, null, 2);
  }
}

// Re-detect tab when side panel gains focus
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    getActiveTab().then(tab => {
      if (tab?.id && tab.id !== activeTabId) {
        activeTabId = tab.id;
        injected = false;
      }
    });
  }
});
