# TnC-Bot Chrome Extension: Cross-Device Installation & Deployment Guide

This guide explains how to install and use the **TnC-Bot Floating Assistant** Chrome extension on a different device (another computer, laptop, or testing environment).

---

## Step 1: Transfer the Extension Folder
To use the extension on another device, you need to copy the extension folder to that machine:
1. Locate the `extension/` directory in this project workspace.
2. Compress (ZIP) the `extension/` folder or copy it to a USB flash drive.
3. Transfer the ZIP/folder to the target device and extract it (if zipped) to a permanent location.

---

## Step 2: Install in Google Chrome
On the new device, load the extension into the browser:
1. Open Google Chrome (or any Chromium-based browser like Microsoft Edge, Brave, or Opera).
2. Navigate to `chrome://extensions/` in the URL search bar.
3. Toggle on **Developer mode** using the slider in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Browse and select the extracted `extension/` folder.
6. The **TnC Bot Floating Assistant** icon will now appear in your browser's toolbar.

---

## Step 3: Network Configuration (Connecting to the Backend)
The extension needs to connect to the FastAPI backend API server to analyze agreements. Depending on where your backend is running, configure it as follows:

### Scenario A: Backend and Extension are on the SAME Local Network (LAN)
If the backend is running on Computer A, and you are running the browser extension on Device B:
1. **Find the Local IP of Computer A**:
   - On Computer A, open Terminal/Command Prompt and run `ipconfig` (Windows) or `ifconfig` (macOS/Linux).
   - Find the IPv4 Address (e.g., `192.168.1.45`).
2. **Bind the Backend Server to the Local Network**:
   - On Computer A, launch the FastAPI backend server listening on all network interfaces (`0.0.0.0`) instead of just localhost:
     ```powershell
     uvicorn app.main:app --host 0.0.0.0 --port 8000
     ```
3. **Update the Extension API URL**:
   - In the `extension/` folder on Device B, open [popup.js](file:///a:/MP-ML/extension/popup.js) and [content.js](file:///a:/MP-ML/extension/content.js).
   - Change the API URL from `http://localhost:8000` to `http://192.168.1.45:8000` (replacing with Computer A's actual IP).
4. **Update Manifest Permissions**:
   - In the `extension/` folder on Device B, open [manifest.json](file:///a:/MP-ML/extension/manifest.json).
   - Update `host_permissions` to include Computer A's IP:
     ```json
     "host_permissions": [
       "http://192.168.1.45:8000/*"
     ]
     ```
5. Reload the extension in `chrome://extensions/` by clicking the small circular reload icon on the card.

---

### Scenario B: Connecting to a Publicly Hosted Backend (Cloud)
If your FastAPI backend is deployed on a cloud provider (e.g., Vercel, Render, AWS, Heroku) or exposed via a public tunnel (like `ngrok`):
1. **Update the Extension API URL**:
   - In the `extension/` folder on the new device, open [popup.js](file:///a:/MP-ML/extension/popup.js) and [content.js](file:///a:/MP-ML/extension/content.js).
   - Change the API URL from `http://localhost:8000` to your public HTTPS endpoint:
     ```javascript
     const API_URL = "https://your-tnc-bot-backend.vercel.app";
     ```
2. **Update Manifest Permissions**:
   - In `extension/manifest.json`, add your hosted API URL to the permission lists:
     ```json
     "host_permissions": [
       "https://your-tnc-bot-backend.vercel.app/*"
     ]
     ```
3. Reload the extension in the browser.
