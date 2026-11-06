# StockFlow — Manufacturing Inventory & BOM Desktop System

StockFlow is a multi-user desktop application and central backend server designed for manufacturing businesses. It replaces manual, error-prone spreadsheets with a real-time, concurrency-safe inventory ledger, production Bill of Materials (BOM) calculator, automated local backups, and high-fidelity Excel export/import capabilities.

---

## 1. What is StockFlow?

StockFlow manages raw material inventory, component inventory, material dispatch, stock balances, product specifications, and production Bill of Materials (BOM).

In modern manufacturing, raw materials often arrive in bulk (such as batches of round bar in kilograms or die-cast parts in pieces) under specific incoming challan receipts. Each incoming entry must be tracked independently as material is progressively issued or dispatched across multiple manufacturing jobs. 

StockFlow preserves the familiar layout of traditional manufacturing dispatch reports while providing robust multi-user database consistency, real-time sync, and mathematical accuracy.

---

## 2. Key Features

- **Dual Ledger Tracking:**
  - **Counted Components (Direct Mode):** Stock measured in units like `nos` or `pcs` where outgoing transactions directly deduct piece counts from the specific incoming challan receipt. Piece weight and total weight remain optional extras.
  - **Measured Raw Stock Issued by Count (Weight Mode):** Stock measured in units like `kg` or `meters` issued as counted pieces of specific dimensions (e.g., cutting 235 pieces of length 225.5 mm at 0.590 kg/piece). The system calculates exact piece-to-weight deductions (`235 × 0.590 = 138.65 kg`) and deducts the total weight from the incoming batch.
- **Dynamic Balance Calculation (Never Stored):**
  - Storing static balance numbers causes synchronization anomalies and corrupt balances when rows are edited or audited. StockFlow **never stores balances** in the database. Balances are dynamically calculated using arbitrary-precision math (`decimal.js`).
  - Total material stock is always the sum of all its incoming entry balances.
- **Production Bill of Materials (BOM) & Live Calculator:**
  - Map finished products to customer parties.
  - Define multi-line BOM specifications with custom material consumption and specification values.
  - Run the **Production Calculator** to test planned production quantities (e.g., 500 units) against live available inventory, identifying exact shortfalls and readiness before issuing material.
- **Realtime Multi-User Desktop Experience:**
  - Powered by Electron, native WebSockets, and fallback polling.
  - When an operator on Machine A issues material, the ledger on Machine B updates within 1 second without clearing open forms.
  - **"Added By" User Badges:** Every incoming challan and outgoing dispatch row features the creator's avatar initials in their assigned color, with tooltips showing user name and exact timestamp.
- **Excel Import, Export & Offline Recovery:**
  - **Full Excel Export:** Exports materials and BOMs into `.xlsx` workbooks matching the original manufacturing dispatch report format.
  - **Offline Recovery Export:** If the server or database is completely offline, operators can export dispatch workbooks directly from local backup JSON snapshots.
  - **Import Wizard:** Parse legacy Excel stock sheets with column auto-detection, preview recalculated balances, detect over-issues, and commit all-or-nothing in a single transaction.
- **Automated Local Backups & One-Click Restore:**
  - Background scheduler automatically creates atomic snapshots (`inventory-latest.json` and daily files) to the administrator's chosen local directory whenever database revisions increment.
  - One-click atomic restore with `RESTORE` confirmation safety check.
- **Strict Concurrency & Security:**
  - Row-level write locking via transaction sequence increment prevents race conditions and over-issuing on parallel dispatch requests.
  - Renderer runs under context isolation with a strict Content Security Policy (CSP); auth tokens and network operations stay confined to the main process.

---

## 3. Why Use StockFlow?

1. **Eliminate Excel Formula Corruption:** Traditional spreadsheets suffer from broken formulas, negative balances, and missing links across files. StockFlow recalculates running balances with strict decimal math.
2. **True Receipt Batch Isolation:** Outgoing dispatch rows deduct stock strictly from their own incoming challan, preserving traceability for supplier quality control and batch tracking.
3. **Multi-User Collaboration Without File Locking:** Unlike shared Excel files that suffer from "file in use" locks or overwrites, multiple office and shop-floor terminals can record transactions simultaneously.
4. **Data Ownership & Disaster Resilience:** Your data is stored in PostgreSQL (or Neon serverless), backed up locally in transparent JSON format, and exportable to Excel at any time without server dependencies.

---

## 4. Setup & Running Instructions

Follow these step-by-step commands to install dependencies, configure the database, and launch the application.

### Step 1: Install Dependencies

Run the following commands in order:

```bash
# 1. Install shared module dependencies
cd shared
npm install decimal.js
npm install -D vitest
cd ..

# 2. Install server dependencies
cd server
npm install express ws dotenv bcryptjs jsonwebtoken zod helmet express-rate-limit decimal.js @prisma/client ../shared
npm install -D prisma nodemon vitest supertest
cd ..

# 3. Install client dependencies
cd client
npm install dotenv decimal.js exceljs ws ../shared
npm install -D electron electron-builder vitest
cd ..
```

---

### Step 2: Configure Environment Files

1. **Server Configuration:**
   Copy `server/.env.example` to `server/.env`:
   ```bash
   cd server
   cp .env.example .env
   ```
   Edit `server/.env` and supply your database connection URLs:
   - `DATABASE_URL`: PostgreSQL connection string (or Neon pooled connection string).
   - `DIRECT_URL`: Non-pooled direct connection string (used by Prisma migrations).
   - `TEST_DATABASE_URL`: Separate test database connection string.
   - `JWT_SECRET`: Random 32+ character secret string.
   - `SEED_ADMIN_PASSWORD`: Initial password for the default `admin` user.
   ```bash
   cd ..
   ```

2. **Client Configuration:**
   Copy `client/.env.example` to `client/.env`:
   ```bash
   cd client
   cp .env.example .env
   cd ..
   ```

---

### Step 3: Run Database Migrations & Seed

Initialize the database schema and default records:

```bash
cd server

# Generate Prisma client
npm run generate

# Run database migrations
npm run migrate

# Seed default admin user and units (kg, nos)
npm run seed

cd ..
```

---

### Step 4: Run Server & Client

1. **Start the Backend Server (Terminal 1):**
   ```bash
   cd server
   npm run dev
   ```
   *The server will start on `http://localhost:3000` with WebSockets on `ws://localhost:3000/ws`.*

2. **Start the Electron Desktop Client (Terminal 2):**
   ```bash
   cd client
   npm start
   ```

3. **Log In:**
   - **Server URL:** `http://localhost:3000`
   - **Username:** `admin`
   - **Password:** The password set in `SEED_ADMIN_PASSWORD` (defaults to `change-me-now`).

---

### Step 5: Run Automated Tests

To verify that all calculations, business rules, and acceptance data pass:

```bash
# 1. Run Shared math tests
cd shared
npm test
cd ..

# 2. Run Server tests (auth, stock rules, concurrency, ledgers, BOM)
cd server
npm test
cd ..

# 3. Run Client tests (workbook building, backup rotation, import parser)
cd client
npm test
cd ..
```

---

### Step 6: Build Windows Desktop Installer

To package the desktop client into a Windows standalone installer:

```bash
cd client
npm run dist
```
The generated `.exe` installer will be located in `client/dist/`.

---

## 5. Project Directory Structure

```
StockFlow/
├── shared/                         # Pure calculation code shared between server and client
│   ├── calc.js                     # Deductions, running balance ledger, BOM requirement math
│   ├── constants.js                # Roles, deduct_by modes, entry statuses, export headers
│   └── test/calc.test.js           # Unit tests with exact acceptance data
│
├── server/                         # Express API & Realtime WebSocket Backend
│   ├── prisma/
│   │   ├── schema.prisma           # Relational schema (PostgreSQL)
│   │   └── seed.js                 # Initial admin & units seeder
│   ├── src/
│   │   ├── app.js                  # Express setup (helmet, 20MB limit, routes)
│   │   ├── config.js               # Zod env validation
│   │   ├── db/                     # PrismaClient instance, mappers, transactions
│   │   ├── repositories/           # Pure Prisma model repositories (no raw SQL)
│   │   ├── services/               # Stock service, ledger service, BOM service, backup restore
│   │   ├── routes/                 # 42 REST endpoints under /api
│   │   ├── schemas/                # Request validation schemas (Zod)
│   │   ├── middleware/             # JWT auth, requireAdmin, rate limiter, error handler
│   │   └── realtime/               # WebSocket server (/ws) and event broadcaster
│   └── test/                       # Vitest integration tests & concurrency verification
│
├── client/                         # Electron Desktop Application
│   ├── main/                       # Electron Main Process (Node.js)
│   │   ├── main.js                 # App lifecycle, single-instance lock, window & CSP
│   │   ├── preload.js              # Secure contextBridge (window.api)
│   │   ├── httpClient.js           # Fetch wrapper with Bearer token & 401 handling
│   │   ├── wsClient.js             # WebSocket client with backoff reconnection
│   │   ├── syncManager.js          # Synchronizes WebSockets with fallback polling
│   │   ├── backup/                 # Atomic backup writer & scheduler
│   │   ├── excel/                  # Workbook builders & parsers (ExcelJS)
│   │   └── ipc/                    # Whitelisted IPC handlers
│   ├── renderer/                   # UI Renderer (HTML/CSS/JS, zero Node access)
│   │   ├── index.html              # App shell
│   │   ├── css/                    # Prismatic Pay theme (base.css, layout.css, components.css)
│   │   └── js/                     # Router, formatters, components, and pages
│   └── test/                       # Client unit tests and backup fixtures
│
├── plan/                           # Specifications & Architecture Decisions
│   ├── implementation.md           # Implementation blueprint
│   ├── explanation.md              # Domain business rules
│   └── DECISIONS.md                # Decision log and progress record
└── README.md                       # Project documentation
```

