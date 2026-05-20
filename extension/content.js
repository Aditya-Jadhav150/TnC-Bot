// TnC Bot Content Script
(function () {
  // Prevent duplicate execution
  if (document.getElementById('tnc-bot-shadow-host')) return;

  // 1. Core State
  let backendUrl = 'http://localhost:8000';
  let activeDoc = null;
  let chatMessages = [];
  let isLoadingChat = false;
  let currentTab = 'summary'; // 'summary' | 'ai' | 'chat'
  
  // Dragging state
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let position = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  let idleTimer = null;

  // 2. Load Configuration from Storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['backendUrl', 'floating-assistant-position-ext'], (data) => {
      if (data.backendUrl) {
        backendUrl = data.backendUrl;
      }
      if (data['floating-assistant-position-ext']) {
        try {
          const savedPos = JSON.parse(data['floating-assistant-position-ext']);
          // Make sure it's within bounds
          position.x = Math.max(16, Math.min(savedPos.x, window.innerWidth - 64));
          position.y = Math.max(16, Math.min(savedPos.y, window.innerHeight - 64));
          updateButtonPosition();
        } catch (e) {}
      }
    });
  }

  // Listen for config changes and actions from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    if (message.action === 'show_fab') {
      // Re-insert or make visible the shadow host and FAB
      let shadowHost = document.getElementById('tnc-bot-shadow-host');
      if (!shadowHost) {
        document.body.appendChild(host);
      }
      fab.style.display = 'flex';
      fab.classList.remove('idle');
      resetIdle();
      sendResponse({ status: 'shown' });
      return true;
    }
    if (message.action === 'update_settings' && message.backendUrl) {
      backendUrl = message.backendUrl;
      console.log('TnC Bot: Backend URL updated to ' + backendUrl);
      sendResponse({ status: 'settings_updated' });
      return true;
    }
  });

  // 3. Create Shadow DOM Container (Isolates styles completely from the parent webpage)
  const host = document.createElement('div');
  host.id = 'tnc-bot-shadow-host';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.zIndex = '2147483647'; // top-most
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // 4. Inject Styling Sheet
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    /* Utility FAB Style */
    .fab {
      position: fixed;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #0f172a; /* slate-900 */
      border: 1px solid #1e293b; /* slate-800 */
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      pointer-events: auto;
      user-select: none;
      transition: opacity 0.3s ease, border-color 0.2s ease, transform 0.2s ease;
      opacity: 1;
      z-index: 99999;
    }
    .fab:active {
      cursor: grabbing;
      transform: scale(0.95);
    }
    .fab.idle {
      opacity: 0.5;
    }
    .fab:hover {
      opacity: 1 !important;
      border-color: #6366f1; /* indigo-500 */
    }
    .fab-icon {
      color: #6366f1;
      transition: transform 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fab:hover .fab-icon {
      transform: scale(1.1);
      color: #818cf8;
    }
    
    /* Loading scanner spinner */
    .spinner {
      position: absolute;
      width: 40px;
      height: 40px;
      border: 2px solid rgba(99, 102, 241, 0.2);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Context Menu */
    .menu {
      position: fixed;
      background-color: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 6px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      width: 130px;
      display: none;
      flex-direction: column;
      gap: 4px;
      z-index: 100000;
      pointer-events: auto;
    }
    .menu-item {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: #cbd5e1;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .menu-item:hover {
      background-color: #1e293b;
      color: #818cf8;
    }
    .menu-item.exit {
      color: #f87171;
      border-top: 1px solid rgba(30, 41, 59, 0.5);
      margin-top: 4px;
      padding-top: 8px;
      border-radius: 0 0 4px 4px;
    }
    .menu-item.exit:hover {
      background-color: #271c1c;
      color: #fca5a5;
    }

    /* Compact Side Panel Overlay */
    .overlay {
      position: fixed;
      right: -400px; /* Hidden initially */
      bottom: 20px;
      top: 20px;
      width: 380px;
      background-color: rgba(9, 15, 30, 0.96);
      backdrop-filter: blur(16px);
      border: 1px solid #1e293b;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 99998;
      pointer-events: auto;
    }
    .overlay.open {
      right: 20px;
    }
    
    /* Panel Header */
    .header {
      padding: 14px 16px;
      border-b: 1px solid rgba(30, 41, 59, 0.8);
      background-color: rgba(15, 23, 42, 0.4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
    }
    .header-info {
      min-width: 0;
      flex: 1;
    }
    .header-subtitle {
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6366f1;
    }
    .header-title {
      font-size: 12px;
      font-weight: 700;
      color: #f1f5f9;
      margin: 2px 0 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-icon {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #94a3b8;
      transition: all 0.15s ease;
    }
    .btn-icon:hover {
      background-color: #1e293b;
      border-color: #475569;
      color: #f8fafc;
    }
    .btn-icon.close:hover {
      color: #f87171;
    }
    
    /* Navigation Tabs */
    .tabs {
      padding: 8px 16px;
      display: flex;
      gap: 6px;
      border-bottom: 1px solid rgba(30, 41, 59, 0.4);
      background-color: rgba(15, 23, 42, 0.1);
    }
    .tab-btn {
      flex: 1;
      padding: 6px 0;
      border-radius: 6px;
      background-color: rgba(15, 23, 42, 0.5);
      border: 1px solid #1e293b;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      color: #f1f5f9;
      background-color: #1e293b;
    }
    .tab-btn.active {
      background-color: #4f46e5;
      color: white;
      border-color: rgba(99, 102, 241, 0.5);
    }
    
    /* Scroll Content */
    .content-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }
    
    /* Cards */
    .card {
      background-color: rgba(15, 23, 42, 0.4);
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 12px 14px;
    }
    .card-title {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin: 0 0 6px 0;
    }
    .card-title.summary-title { color: #6366f1; }
    .card-title.ai-title { color: #818cf8; }
    .card-title.ownership-title { color: #34d399; }
    .card-title.cancel-title { color: #fbbf24; }
    .card-title.retention-title { color: #f87171; }
    
    .card-text {
      font-size: 11px;
      color: #cbd5e1;
      line-height: 1.5;
      margin: 0;
    }
    
    /* Clauses */
    .clause-item {
      background-color: rgba(15, 23, 42, 0.2);
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .clause-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .clause-name {
      font-size: 10px;
      font-weight: 700;
      color: #e2e8f0;
    }
    .clause-badge {
      font-size: 7px;
      text-transform: uppercase;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .clause-badge.clear {
      background-color: rgba(6, 78, 59, 0.3);
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.2);
    }
    .clause-badge.ambiguous {
      background-color: rgba(120, 53, 4, 0.3);
      color: #fbbf24;
      border-color: rgba(251, 191, 36, 0.2);
    }
    
    /* Chat Panel specific */
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 12px;
      min-height: 0;
    }
    .chat-log {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 4px;
      min-height: 180px;
    }
    .chat-bubble-container {
      display: flex;
      flex-direction: column;
      max-width: 90%;
    }
    .chat-bubble-container.user {
      align-self: flex-end;
      align-items: flex-end;
    }
    .chat-bubble-container.assistant {
      align-self: flex-start;
      align-items: flex-start;
    }
    .chat-sender {
      font-size: 7px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .chat-bubble {
      padding: 8px 12px;
      font-size: 11px;
      line-height: 1.45;
      border-radius: 12px;
    }
    .chat-bubble-container.user .chat-bubble {
      background-color: #4f46e5;
      color: white;
      border-bottom-right-radius: 0;
    }
    .chat-bubble-container.assistant .chat-bubble {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      color: #cbd5e1;
      border-bottom-left-radius: 0;
    }
    .grounded-badge {
      margin-top: 4px;
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* Suggestions */
    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .suggest-btn {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 8px;
      font-weight: 600;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .suggest-btn:hover {
      border-color: #4f46e5;
      color: #cbd5e1;
    }
    
    /* Chat Form */
    .chat-form {
      display: flex;
      gap: 6px;
    }
    .chat-input {
      flex: 1;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11px;
      color: #f8fafc;
      outline: none;
    }
    .chat-input:focus {
      border-color: #4f46e5;
    }
    .chat-submit {
      background-color: #4f46e5;
      border: none;
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: background 0.15s ease;
    }
    .chat-submit:hover {
      background-color: #4338ca;
    }
    .chat-submit:disabled {
      background-color: #1e293b;
      color: #64748b;
      cursor: not-allowed;
    }

    /* Panel Footer */
    .footer {
      padding: 10px 16px;
      border-top: 1px solid #1e293b;
      background-color: rgba(15, 23, 42, 0.3);
      text-align: center;
    }
    .workspace-btn {
      color: #6366f1;
      background: transparent;
      border: none;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .workspace-btn:hover {
      color: #818cf8;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 4px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #1e293b;
      border-radius: 2px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
  `;
  shadow.appendChild(style);

  // 5. Build HTML Structures
  // Floating Action Button
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = `
    <div class="spinner" style="display: none;"></div>
    <div class="fab-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
  `;
  shadow.appendChild(fab);

  // Context Menu
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = `
    <button class="menu-item scan-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
      Scan Page
    </button>
    <button class="menu-item exit exit-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
      </svg>
      Exit Bot
    </button>
  `;
  shadow.appendChild(menu);

  // Compact Side Panel Overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="header">
      <div class="header-info">
        <div class="header-subtitle">TnC Quick Scan</div>
        <h3 class="header-title" id="overlay-doc-title">Scanning page...</h3>
      </div>
      <div class="header-actions">
        <a id="ext-workspace-link-header" href="${backendUrl}" target="_blank" class="btn-icon" title="Open Full Workspace">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </a>
        <button class="btn-icon close close-overlay-btn" title="Close Panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" id="tab-summary-btn">Summary</button>
      <button class="tab-btn" id="tab-ai-btn">AI & Rights</button>
      <button class="tab-btn" id="tab-chat-btn">Ask Bot</button>
    </div>

    <div class="content-body" id="overlay-content">
      <!-- Content populated dynamically -->
    </div>

    <div class="footer">
      <a id="ext-workspace-link" href="${backendUrl}" target="_blank" class="workspace-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
        </svg>
        <span>Open Full Workspace</span>
      </a>
    </div>
  `;
  shadow.appendChild(overlay);

  // 6. Interaction & Drag Math
  function updateButtonPosition() {
    fab.style.left = `${position.x}px`;
    fab.style.top = `${position.y}px`;
  }
  updateButtonPosition();

  // Reset idle fade-out
  function resetIdle() {
    fab.classList.remove('idle');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // Only idle fade if menu/overlay are closed and not scanning
      if (menu.style.display !== 'flex' && !overlay.classList.contains('open') && !fab.querySelector('.spinner').style.display === 'block') {
        fab.classList.add('idle');
      }
    }, 3000);
  }
  resetIdle();

  // Hover listeners
  fab.addEventListener('mouseenter', () => {
    fab.classList.remove('idle');
    if (idleTimer) clearTimeout(idleTimer);
  });
  fab.addEventListener('mouseleave', () => {
    resetIdle();
  });

  // FAB Drag Math
  fab.addEventListener('mousedown', (e) => {
    // Left click only
    if (e.button !== 0) return;
    
    // Ignore drag if currently scanning
    if (fab.querySelector('.spinner').style.display === 'block') return;

    isDragging = false; // reset
    dragStart = { x: e.clientX - position.x, y: e.clientY - position.y };
    
    const onMouseMove = (moveEv) => {
      isDragging = true;
      const x = Math.max(16, Math.min(moveEv.clientX - dragStart.x, window.innerWidth - 64));
      const y = Math.max(16, Math.min(moveEv.clientY - dragStart.y, window.innerHeight - 64));
      position = { x, y };
      updateButtonPosition();
      
      // Close menu while dragging
      menu.style.display = 'none';
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDragging) {
        // Snap to nearest vertical edge (left or right)
        const halfWidth = window.innerWidth / 2;
        let finalX = 16;
        if (position.x + 28 > halfWidth) {
          finalX = window.innerWidth - 56 - 16; // right edge
        }
        
        position.x = finalX;
        updateButtonPosition();
        
        // Save position
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ 'floating-assistant-position-ext': JSON.stringify(position) });
        }
      }
      resetIdle();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // FAB Click Handler
  fab.addEventListener('click', (e) => {
    if (isDragging) return; // ignore click if dragged
    
    if (menu.style.display === 'flex') {
      menu.style.display = 'none';
    } else {
      // Position menu near the FAB
      const menuWidth = 130;
      const menuHeight = 70;
      let left = position.x;
      let top = position.y - menuHeight;

      if (position.x > window.innerWidth / 2) {
        left = position.x - menuWidth + 56;
      }
      if (top < 16) {
        top = position.y + 64;
      }

      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.display = 'flex';
      
      // Close overlay
      overlay.classList.remove('open');
    }
  });

  // Close menu on clicks outside
  document.addEventListener('click', (e) => {
    const shadowHost = document.getElementById('tnc-bot-shadow-host');
    if (!shadowHost) return;
    
    // Find active element within shadow DOM
    const path = e.composedPath();
    if (!path.includes(fab) && !path.includes(menu)) {
      menu.style.display = 'none';
    }
  });

  // Exit Action
  shadow.querySelector('.exit-btn').addEventListener('click', () => {
    host.remove();
  });

  // Close Overlay Button
  shadow.querySelector('.close-overlay-btn').addEventListener('click', () => {
    overlay.classList.remove('open');
    resetIdle();
  });

  // Tab Navigation Buttons
  const tabSummary = shadow.getElementById('tab-summary-btn');
  const tabAi = shadow.getElementById('tab-ai-btn');
  const tabChat = shadow.getElementById('tab-chat-btn');

  function updateTabs(activeTabName) {
    currentTab = activeTabName;
    [tabSummary, tabAi, tabChat].forEach(btn => btn.classList.remove('active'));
    
    if (currentTab === 'summary') tabSummary.classList.add('active');
    if (currentTab === 'ai') tabAi.classList.add('active');
    if (currentTab === 'chat') tabChat.classList.add('active');
    
    renderContent();
  }

  tabSummary.addEventListener('click', () => updateTabs('summary'));
  tabAi.addEventListener('click', () => updateTabs('ai'));
  tabChat.addEventListener('click', () => updateTabs('chat'));

  // 7. Perform Scan Call to Local Backend API
  shadow.querySelector('.scan-btn').addEventListener('click', async () => {
    menu.style.display = 'none';
    
    // Show spinner on FAB
    fab.querySelector('.spinner').style.display = 'block';
    
    // 1. Extract and clean webpage content
    const pageText = document.body.innerText || "";
    const cleanedText = pageText.replace(/\s+/g, ' ').trim();
    const pageTitle = document.title || "Scanned Agreement";
    
    try {
      const response = await fetch(`${backendUrl}/api/analyze/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pageTitle,
          text: cleanedText,
          category: 'Terms of Service'
        })
      });

      if (response.ok) {
        activeDoc = await response.json();
        chatMessages = []; // reset chat
        
        // Update title
        shadow.getElementById('overlay-doc-title').innerText = activeDoc.name;
        
        // Update header & footer links
        shadow.getElementById('ext-workspace-link').href = `${backendUrl}/?doc=${activeDoc.id}`;
        shadow.getElementById('ext-workspace-link-header').href = `${backendUrl}/?doc=${activeDoc.id}`;
        
        // Open panel
        overlay.classList.add('open');
        updateTabs('summary');
      } else {
        alert("Failed to analyze: " + response.statusText);
      }
    } catch (err) {
      alert("Could not connect to TnC Bot server at: " + backendUrl + "\nMake sure the local server is running.");
    } finally {
      fab.querySelector('.spinner').style.display = 'none';
    }
  });

  // 8. Dynamic Overlay Renderer
  function renderContent() {
    const container = shadow.getElementById('overlay-content');
    container.innerHTML = ''; // clear

    if (!activeDoc || !activeDoc.summary) {
      container.innerHTML = `<div class="card"><p class="card-text">No summary loaded. Please click Scan Page first.</p></div>`;
      return;
    }

    const summary = activeDoc.summary;

    if (currentTab === 'summary') {
      // Executive summary
      const sumCard = document.createElement('div');
      sumCard.className = 'card';
      sumCard.innerHTML = `
        <h4 class="card-title summary-title">Executive Summary</h4>
        <p class="card-text">${summary.summary}</p>
      `;
      container.appendChild(sumCard);

      // Key Clauses list
      const clausesTitle = document.createElement('h4');
      clausesTitle.className = 'card-title';
      clausesTitle.style.color = '#94a3b8';
      clausesTitle.style.margin = '10px 0 6px 0';
      clausesTitle.innerText = 'Key Scanned Clauses';
      container.appendChild(clausesTitle);

      const clausesWrapper = document.createElement('div');
      summary.key_clauses.slice(0, 4).forEach(cl => {
        const item = document.createElement('div');
        item.className = 'clause-item';
        item.innerHTML = `
          <div class="clause-header">
            <span class="clause-name">${cl.clause_title}</span>
            <span class="clause-badge ${cl.status}">${cl.status}</span>
          </div>
          <p class="card-text" style="font-size: 10px; color: #94a3b8;">${cl.plain_english}</p>
        `;
        clausesWrapper.appendChild(item);
      });
      container.appendChild(clausesWrapper);
    } 
    
    else if (currentTab === 'ai') {
      // AI model training
      const aiCard = document.createElement('div');
      aiCard.className = 'card';
      aiCard.style.marginBottom = '8px';
      aiCard.innerHTML = `
        <h4 class="card-title ai-title">AI Model Training</h4>
        <p class="card-text">${summary.ai_training}</p>
      `;
      container.appendChild(aiCard);

      // Content ownership
      const ownCard = document.createElement('div');
      ownCard.className = 'card';
      ownCard.style.marginBottom = '8px';
      ownCard.innerHTML = `
        <h4 class="card-title ownership-title">Content Ownership</h4>
        <p class="card-text">${summary.ownership}</p>
      `;
      container.appendChild(ownCard);

      // Account termination
      const cancelCard = document.createElement('div');
      cancelCard.className = 'card';
      cancelCard.style.marginBottom = '8px';
      cancelCard.innerHTML = `
        <h4 class="card-title cancel-title">Cancellation & Termination</h4>
        <p class="card-text">${summary.termination}</p>
      `;
      container.appendChild(cancelCard);

      // Data retention
      const retCard = document.createElement('div');
      retCard.className = 'card';
      retCard.innerHTML = `
        <h4 class="card-title retention-title">Data Retention</h4>
        <p class="card-text">${summary.retention}</p>
      `;
      container.appendChild(retCard);
    } 
    
    else if (currentTab === 'chat') {
      // Build Grounded Chat Panel
      const chatLayout = document.createElement('div');
      chatLayout.className = 'chat-container';
      
      const chatLog = document.createElement('div');
      chatLog.className = 'chat-log';
      chatLog.id = 'ext-chat-log';
      
      chatLayout.appendChild(chatLog);

      // Suggestion pills
      const pills = document.createElement('div');
      pills.className = 'suggestions';
      pills.innerHTML = `
        <button class="suggest-btn">Can they train AI?</button>
        <button class="suggest-btn">Can they close my account?</button>
        <button class="suggest-btn">Who owns content?</button>
      `;
      chatLayout.appendChild(pills);

      // Send form
      const form = document.createElement('form');
      form.className = 'chat-form';
      form.innerHTML = `
        <input type="text" class="chat-input" id="ext-chat-input" placeholder="Ask assistant...">
        <button type="submit" class="chat-submit" id="ext-chat-submit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      `;
      chatLayout.appendChild(form);
      container.appendChild(chatLayout);

      // Bind suggestions clicks
      pills.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          shadow.getElementById('ext-chat-input').value = btn.innerText;
          shadow.getElementById('ext-chat-input').focus();
        });
      });

      // Bind submit
      form.addEventListener('submit', handleChatSubmit);
      
      // Initial message log render
      renderChatLogs();
    }
  }

  // Render message history in Mini-Chat
  function renderChatLogs() {
    const log = shadow.getElementById('ext-chat-log');
    if (!log) return;
    log.innerHTML = '';

    if (chatMessages.length === 0) {
      log.innerHTML = `
        <div style="text-align: center; padding: 20px 10px; color: #64748b;">
          <p style="font-size: 10px; font-weight: 600; margin: 0 0 4px 0;">Grounded Quick Q&A</p>
          <p style="font-size: 9px; margin: 0;">Ask anything about model training, refunds, or liabilities.</p>
        </div>
      `;
      return;
    }

    chatMessages.forEach(msg => {
      const bContainer = document.createElement('div');
      bContainer.className = `chat-bubble-container ${msg.role}`;
      
      bContainer.innerHTML = `
        <span class="chat-sender">${msg.role === 'user' ? 'You' : 'TnC Bot'}</span>
        <div class="chat-bubble">${msg.content}</div>
      `;
      
      if (msg.role === 'assistant' && msg.citations && msg.citations.length > 0) {
        const badge = document.createElement('div');
        badge.className = 'grounded-badge';
        badge.innerHTML = `
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Grounded response</span>
        `;
        bContainer.appendChild(badge);
      }
      log.appendChild(bContainer);
    });

    log.scrollTop = log.scrollHeight;
  }

  // Submit mini-chat grounded question
  async function handleChatSubmit(e) {
    e.preventDefault();
    const input = shadow.getElementById('ext-chat-input');
    const submitBtn = shadow.getElementById('ext-chat-submit');
    const query = input.value.trim();

    if (!query || isLoadingChat || !activeDoc) return;
    
    // Add user message
    chatMessages.push({ role: 'user', content: query });
    input.value = '';
    renderChatLogs();
    
    isLoadingChat = true;
    input.disabled = true;
    submitBtn.disabled = true;

    // Create assistant message slot
    const assistantIndex = chatMessages.length;
    chatMessages.push({ role: 'assistant', content: '', citations: [] });
    renderChatLogs();

    const historyPayload = chatMessages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: activeDoc.id,
          query: query,
          history: [...historyPayload, { role: 'user', content: query }]
        })
      });

      if (!response.ok) throw new Error("Connection failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstLine = true;
      let citations = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');

        if (isFirstLine && lines.length > 1) {
          const firstLine = lines.shift() || '';
          buffer = lines.join('\n');
          isFirstLine = false;
          try {
            const meta = JSON.parse(firstLine);
            if (meta && meta.chunks) {
              citations = meta.chunks;
            }
          } catch (err) {
            buffer = firstLine + '\n' + buffer;
          }
        }

        chatMessages[assistantIndex] = {
          role: 'assistant',
          content: buffer,
          citations
        };
        renderChatLogs();
      }

    } catch (err) {
      chatMessages[assistantIndex] = {
        role: 'assistant',
        content: `Error connecting to Chat server: ${err.message}`,
        citations: []
      };
      renderChatLogs();
    } finally {
      isLoadingChat = false;
      input.disabled = false;
      submitBtn.disabled = false;
      input.focus();
    }
  }

})();
