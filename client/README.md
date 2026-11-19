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
  "version": "1.0.4",
  ...
}
```
*(Always use a higher number than the previous version, e.g. `1.0.3` ➔ `1.0.4` ➔ `1.1.0`).*

### Step 2: Commit & Push the Git Tag
Because `releaseType: "release"` is configured (which makes releases **Live immediately** without leaving them stuck in Draft mode), GitHub's security rules require the Git tag to exist on GitHub before publishing:

```powershell
# From project root:
git add .
git commit -m "release: v1.0.4"
git tag v1.0.4
git push origin main --tags
```

### Step 3: Run the Publish Command
Run this command in the `client/` directory:
```powershell
cd client
npm run dist:publish
```

---

## 3. How Automatic Updates Work Under the Hood

### What `npm run dist:publish` Does:
1. Reads `GH_TOKEN` securely from `client/.env`.
2. Compiles the new installer: `StockFlow Setup X.X.X.exe`.
3. Creates the update manifest file: **`latest.yml`** (containing version number, file paths, and sha512 security hashes).
4. Publishes a **Live Release** on GitHub (`Manthan29-code/StockFlow`) and uploads:
   * `StockFlow Setup X.X.X.exe`
   * `StockFlow Setup X.X.X.exe.blockmap`
   * `latest.yml`

### What the User Experiences:
1. **Silent Startup Check:** Whenever a user launches their installed StockFlow application, the app automatically checks `latest.yml` on GitHub after 3 seconds.
2. **Update Banner:** If a newer version is found, a blue banner slides down at the top:
   > **🚀 A new update is available (vX.X.X)! `[Download Now]` `[ ✕ ]`**
3. **Dismiss Option:** If the user clicks `✕` (Close), the banner disappears and does not bother them again until the next time they launch the app.
4. **1-Click Apply:** If they click **Download Now**, progress is shown (`Downloading... 45%`). Once complete, clicking **Restart & Install** swaps the application to the new version in seconds.

