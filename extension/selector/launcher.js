// Inject Selector Tool into the active tab
document.getElementById('selectorBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector/engine.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector/content.js'] });
  } catch (e) {
    console.error('Inject failed:', e);
  }
  window.close();
});
