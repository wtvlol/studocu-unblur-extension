'use strict';
const api = globalThis.browser || chrome;
const status = document.querySelector('#status');
(async () => {
  try {
    const [tab] = await api.tabs.query({active: true, currentWindow: true});
    const result = await api.tabs.sendMessage(tab.id, {type: 'status'});
    status.textContent = result.pages ? `Active · ${result.pages} loaded preview page(s)` : 'Automatic unblur is active. No supported preview found in this frame.';
  } catch {
    status.textContent = 'Open a Studocu preview, or reload the tab.';
  }
})();
