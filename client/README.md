# FineTech Desktop Application (StockFlow)

## About the Application

**FineTech (StockFlow)** is a high-precision desktop inventory management and Bill of Materials (BOM) application tailored for manufacturing, dispatch, and material tracking. 

### Key Features:
* **Real-time Inventory Tracking:** Track material inward, outward dispatches, and piece-weight calculations with financial-grade precision (`decimal.js`).
* **Bill of Materials (BOM) Planning:** Automated shortfall calculations and material requirement planning.
* **Hybrid Cloud & Edge Architecture:** Seamlessly connects to a serverless Cloudflare Workers API with Cloudflare D1 database storage.
* **Real-time WebSocket Sync:** Instant synchronization across multiple desktop clients with automatic fallback polling.
* **Data Resilience & Privacy:** Automated local JSON snapshots and disaster recovery restore tools.
* **In-App Auto-Updates:** Users receive a notification banner at the top of the app to download and install new versions with one click.

---

## 1. First-Time Setup & Generating the First `.exe`

Before compiling your desktop application, make sure your dependencies and environment variables are configured.

### Step 1: Install Dependencies
Open your PowerShell terminal and run:
```powershell
cd client
npm install
```

### Step 2: Configure `.env`
In the `client/` folder, ensure your `.env` file contains your server URL and GitHub Token:
```env
API_BASE_URL=<your backend url>
GH_TOKEN=ghp_your_github_personal_access_token_here
```
*(Your GitHub token must have the **`repo`** permission selected).*

### Step 3: Run the First Build Command
To generate your first standalone Windows installer (`.exe`) without publishing:
```powershell
npm run dist
```
* **Output:** Your ready-to-use Windows installer (`StockFlow Setup 1.0.0.exe`) will be generated inside the `client/dist/` folder.
* You can install and run this `.exe` on any Windows PC.

---

## 2. Releasing an Update (After Making Changes to the App)

Whenever you make any changes to the UI, features, or bug fixes, follow these steps to release an update so all installed applications automatically show the update banner:

### Step 1: Bump the Version Number
Open `client/package.json` and increase the version number:
```json
{
  "name": "@stockflow/client",
  "version": "1.0.1",
  ...
}
```
*(Always use a higher number than the previous version, e.g. `1.0.1` ➔ `1.0.2` ➔ `1.1.0`).*

### Step 2: Run the Publish Command
Run this command in the `client/` directory:
```powershell
npm run dist:publish
```

### What Happens Automatically:
1. `electron-builder` reads `GH_TOKEN` from your `.env` file.
2. It compiles the new `.exe` installer.
3. It generates the update manifest file (`latest.yml`).
4. It publishes a new official Release directly to your GitHub repository (`Manthan29-code/StockFlow`).
5. **For Users:** The next time any user launches their installed application, the app detects `latest.yml` on GitHub and automatically shows the **"🚀 A new update is available! [Download Now]"** button at the top of their screen. Once downloaded, clicking **"Restart & Install"** applies the update instantly.

