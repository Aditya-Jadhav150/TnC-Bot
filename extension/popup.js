document.addEventListener('DOMContentLoaded', async () => {
  const backendInput = document.getElementById('backend-url');
  const saveBtn = document.getElementById('save-btn');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const workspaceLink = document.getElementById('workspace-link');
  const activateBtn = document.getElementById('activate-btn');

  // Activate / Show FAB trigger
  activateBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const tabId = tabs[0].id;
      
      // Ping content script to see if it is active
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== 'pong') {
          // Content script not loaded yet (e.g. page was not refreshed). Ingest programmatically.
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, () => {
            // Give script a moment to mount and run, then send show signal
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { action: 'show_fab' }).catch(() => {});
            }, 100);
          });
        } else {
          // Content script is active, tell it to show the FAB icon immediately
          chrome.tabs.sendMessage(tabId, { action: 'show_fab' }).catch(() => {});
        }
      });
    });
  });

  // 1. Load saved backend URL
  let savedUrl = 'http://localhost:8000';
  if (chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('backendUrl');
    if (data.backendUrl) {
      savedUrl = data.backendUrl;
    }
  }
  
  // Normalize trailing slash
  if (savedUrl.endsWith('/')) {
    savedUrl = savedUrl.slice(0, -1);
  }
  
  backendInput.value = savedUrl;
  workspaceLink.href = savedUrl;

  // 2. Perform connection health check
  const checkHealth = async (url) => {
    statusText.innerText = 'Checking...';
    statusText.style.color = '#94a3b8';
    statusDot.className = 'status-dot';

    try {
      const response = await fetch(`${url}/api/health`, { method: 'GET' });
      if (response.ok) {
        statusText.innerText = 'Online';
        statusText.style.color = '#10b981'; // emerald-500
        statusDot.className = 'status-dot online';
      } else {
        throw new Error('Not ok');
      }
    } catch (e) {
      statusText.innerText = 'Offline';
      statusText.style.color = '#ef4444'; // red-500
      statusDot.className = 'status-dot offline';
    }
  };

  // Run initial check
  checkHealth(savedUrl);

  // 3. Save handler
  saveBtn.addEventListener('click', async () => {
    let url = backendInput.value.trim();
    if (!url) return;
    
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ backendUrl: url });
    }

    workspaceLink.href = url;
    
    // Test connection with new URL
    await checkHealth(url);
    
    // Alert the active tabs to update their endpoint settings
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { action: 'update_settings', backendUrl: url }).catch(() => {
            // Silence errors on tabs without the content script loaded
          });
        });
      });
    } catch (err) {
      console.warn("Could not broadcast settings update: ", err);
    }
  });
});
