# Implementation Plan: LocalStorage to SQLite Migration

## Overview

Implement a local Express HTTP API backed by `better-sqlite3`, migrate `AppContext.tsx` from synchronous localStorage reads/writes to async API calls, and provide a one-time migration script. Work proceeds in four logical layers: backend (server + mapper), frontend API client, AppContext migration, and the migration script.

---

## Tasks

- [x] 1. Install dependencies and add dev scripts
  - Add `better-sqlite3` as a production dependency
  - Add `@types/better-sqlite3` and `concurrently` as dev dependencies
  - Add the following scripts to `package.json`:
    - `"dev:server": "tsx server.ts"`
    - `"dev:all": "concurrently \"npm run dev\" \"npm run dev:server\""`
  - _Requirements: 9.1, 9.7_

- [x] 2. Build the camelCase ↔ snake_case mapper
  - [x] 2.1 Create `src/mapper.ts` with `toSQL` and `toTS` functions
    - Implement generic camelCase→snake_case key conversion via regex
    - Apply `FIELD_OVERRIDES_TO_SQL = { user: 'user_name' }` after the generic pass in `toSQL`
    - Implement `BOOLEAN_COLUMNS` set: `is_active`, `is_prescription`, `is_ppn_included`, `is_super_admin`, `is_ppn`, `auto_print_receipt`
    - `toSQL`: convert `boolean` → `0|1` for boolean columns
    - `toTS`: convert `0|1` → `boolean` for boolean columns; strip `id` field from `transaction_items` rows
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 2.2 Write property test for mapper round-trip (P1)
    - **Property 1: `toTS(toSQL(obj))` produces the same value for all non-optional fields in `src/types.ts`**
    - **Validates: Requirements 3.6**
    - Test with representative samples: `Medicine`, `Transaction` (without `items`), `User`, `StockHistory`
    - File: `src/mapper.test.ts`

  - [x] 2.3 Write property test for boolean column semantics (P2)
    - **Property 2: Every boolean field in a TS object round-trips through `toSQL`/`toTS` as `boolean`, and the SQL row contains `0` or `1` (never `true`/`false`)**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 2.4 Write property test for asymmetric field mapping (P3)
    - **Property 3: `toSQL({ user: 'Rina', medicineId: 'x' })` produces `{ user_name: 'Rina', medicine_id: 'x' }` — no `user` key present**
    - **Validates: Requirements 3.7**

- [x] 3. Build the Express API server
  - [x] 3.1 Create `server.ts` — startup, middleware, and DB initialization
    - Load `.env` via `dotenv`; read `PORT` (default `3001`) and `DB_PATH` (default `./apotek.db`)
    - Validate `DB_PATH` directory exists; if not, print to stderr and `process.exit(1)`
    - Open `better-sqlite3` connection; execute `PRAGMA foreign_keys = ON`
    - Run `sqlite/schema.sql` DDL (idempotent `CREATE TABLE IF NOT EXISTS`) using `fs.readFileSync`
    - Bind to `127.0.0.1:PORT`; on successful start print port, DB path, and tables-ready message
    - Add `express.json()` and CORS middleware allowing `http://localhost:3000`
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.9, 8.5, 9.1, 9.2, 9.3, 9.5, 9.6, 9.8_

  - [x] 3.2 Implement settings, users, and medicines routes in `server.ts`
    - `GET/PUT /api/settings` — upsert via `INSERT OR REPLACE`; use mapper
    - `GET/POST/PUT/:id/DELETE/:id /api/users` — with validation (name/username/password/role not empty, role is `'admin'`|`'kasir'`) and super-admin delete guard; hard delete
    - `GET/POST/PUT/:id/DELETE/:id /api/medicines` — with validation (name/code/category/unit not empty, `expired_date` is valid `YYYY-MM-DD`, `price >= 0`); soft-delete if referenced in `transaction_items` or `stock_history`, hard-delete otherwise
    - Return uniform `{ success, data? , error? }` envelope; `400` for validation/business-rule violations, `500` for DB errors
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1–2.5, 8.1, 8.2, 8.3, 8.4_

  - [x] 3.3 Implement customers, doctors, cash_flows, and stock_history routes in `server.ts`
    - Standard CRUD for customers, doctors, cash_flows (hard delete)
    - `GET /api/stock_history` — read-only, no DELETE endpoint
    - _Requirements: 1.1, 2.5_

  - [x] 3.4 Implement transactions routes in `server.ts` (atomic)
    - `GET /api/transactions` — single LEFT JOIN query, group `transaction_items` rows by `transaction_id` in JS, call `toTS` per group; strip `transaction_items.id`
    - `POST /api/transactions` — wrap in `db.transaction()`:
      - INSERT header → INSERT items → UPDATE medicine stocks → INSERT stock_history (`type='keluar'`) per item → UPDATE customer metrics → UPDATE doctor metrics (if prescription)
      - ROLLBACK on any failure; return `500` with error message
    - `PUT /api/transactions/:id/cancel` — guard: if `status === 'Dibatalkan'` return `400` immediately; else wrap in `db.transaction()`: UPDATE status + restore stock per item; ROLLBACK on DB/runtime error → `500`
    - `GET /api/transactions/:id/items` — simple SELECT by `transaction_id`
    - _Requirements: 1.1, 2.6, 2.7, 2.8, 2.9, 6.1–6.6_

  - [x] 3.5 Implement `POST /api/reset` route in `server.ts`
    - Accept full seed payload: `{ settings, users, medicines, customers, doctors, transactions, stockHistory, cashFlows }`
    - Wrap in `db.transaction()`: DELETE all rows in reverse FK order, then INSERT all seed data; extract `transaction_items` from embedded `items[]` arrays on each transaction
    - _Requirements: 5.9_

  - [x] 3.6 Write property test for transaction atomicity — no partial writes (P4)
    - **Property 4: Simulating a DB error mid-transaction leaves `transactions`, `transaction_items`, and `medicines.stock` counts exactly as before the call**
    - **Validates: Requirements 6.1, 6.2**
    - File: `server.test.ts` — use an in-memory `better-sqlite3` DB; call the transaction handler directly and inject a failure

  - [x] 3.7 Write property test for stock conservation on createTransaction (P5)
    - **Property 5: `sum(medicines.stock)` after `POST /api/transactions` equals `sum(medicines.stock)` before minus `sum(item.qty * item.unitMultiplier)` for all items**
    - **Validates: Requirements 6.1**

  - [x] 3.8 Write property test for stock conservation on cancelTransaction (P6)
    - **Property 6: After `PUT /api/transactions/:id/cancel`, each medicine's `stock` is restored to its value before the original transaction was created**
    - **Validates: Requirements 6.3**

  - [x] 3.9 Write property test for cancel idempotency guard (P7)
    - **Property 7: Cancelling a transaction whose `status` is already `'Dibatalkan'` returns HTTP `400` and does not modify any DB row**
    - **Validates: Requirements 2.9, 6.5**

  - [x] 3.10 Write property test for TransactionItem excludes AUTOINCREMENT id (P10)
    - **Property 10: No object in the `items[]` array returned by `GET /api/transactions` has an `id` field**
    - **Validates: Requirements 3.5**

- [x] 4. Checkpoint — API server baseline
  - Ensure all tests in `src/mapper.test.ts` and `server.test.ts` pass, ask the user if questions arise.

- [x] 5. Build the frontend API client
  - [x] 5.1 Create `src/services/api.ts` with `apiFetch` helper and all exported functions
    - Set `BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'`
    - Implement `apiFetch<T>` catching network errors (throw with server URL in message) and HTTP >= 400 (throw `error` field or `"HTTP {status}"`)
    - Implement all 27 exported functions listed in Requirement 4.1 with explicit TypeScript signatures matching `src/types.ts`
    - Implement `initializeApp()` using `Promise.all` over 8 parallel fetches; reject with first error, never return partial data
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.2 Write property test for initializeApp partial-failure rejection (P8)
    - **Property 8: If any one of the 8 fetches inside `initializeApp()` rejects, the returned Promise rejects; it never resolves with 7 datasets and one `undefined`**
    - **Validates: Requirements 4.5**
    - Use `jest` or `vitest` with `fetch` mocked to reject for each of the 8 positions in turn

- [x] 6. Migrate AppContext from localStorage to API
  - [x] 6.1 Replace AppContext initialization — async load + loading state
    - Remove all `useState` lazy initializers that read `localStorage`
    - Add `isLoading: boolean` and `apiError: string | null` state
    - On mount, call `initializeApp()` and set all 8 collections atomically on success
    - On failure, set `apiError` to the caught error message (do not populate any collection)
    - If `medicines.length === 0 && users.length === 0` (empty DB) and `localStorage.getItem('apotek_migrated_to_sqlite') !== 'true'`, call `POST /api/reset` with `initialData` seed payload; on failure set `apiError`
    - Render `<div>Loading...</div>` while `isLoading === true`; render `<ErrorScreen>` with server instructions when `apiError` is set
    - _Requirements: 5.1, 5.2, 10.1, 10.2, 10.3, 10.5_

  - [x] 6.2 Replace all localStorage `useEffect` syncs and write actions
    - Delete all `useEffect` blocks that call `localStorage.setItem` for the 8 collections
    - Replace `addMedicine` / `updateMedicine` / `deleteMedicine` / `restoreMedicine` to call the corresponding API functions; update state from server response only (no optimistic updates)
    - Replace `addCustomer` / `updateCustomer` / `deleteCustomer` similarly
    - Replace `addDoctor` / `updateDoctor` / `deleteDoctor` similarly
    - Replace `addUser` / `updateUser` / `deleteUser` similarly
    - Replace `updateSettings` similarly
    - Replace `addCashFlow` / `updateCashFlow` (`deleteCashFlow` is not present in current AppContext — skip) similarly
    - Replace `addStock` / `adjustStock` / `bulkAdjustStock` / `bulkAddStock` to call `POST /api/stock_history` equivalent endpoints (or use `updateMedicine` + a new stock route if appropriate — follow the design)
    - Catch all API errors and show toast via existing `NotificationCenter`; do not mutate state on failure
    - _Requirements: 5.3, 5.4, 5.7, 10.4_

  - [x] 6.3 Replace createTransaction and cancelTransaction
    - `createTransaction`: call `POST /api/transactions`; update `transactions`, `medicines`, and `stockHistory` state from server response only
    - `cancelTransaction`: call `PUT /api/transactions/:id/cancel`; update `transactions` and `medicines` state from server response only
    - `resetToDefaultData`: call `POST /api/reset` with full seed payload from `initialData.ts`
    - Keep `currentUser` in `sessionStorage` (change the existing `localStorage.setItem('apotek_active_user', ...)` calls to `sessionStorage`)
    - _Requirements: 5.5, 5.6, 5.8, 5.9_

- [x] 7. Checkpoint — full stack integration
  - Ensure all tests pass and the app boots, loads data from SQLite, and can complete a POS transaction end-to-end. Ask the user if questions arise.

- [x] 8. Build the one-time migration script
  - [x] 8.1 Create `scripts/migrate-from-localstorage.ts` as a browser page served at `GET /migrate`
    - Add a route in `server.ts` that serves a minimal standalone HTML page at `GET /migrate`
    - The page's inline script implements `safeParseLS(key, fallback)` to read all 8 `apotek_*` localStorage keys (treating missing/null/invalid JSON as empty)
    - Check if DB already has data via `GET /api/medicines`; if yes, show a confirmation dialog before proceeding; abort with message `"Migration aborted"` if user cancels
    - Extract `transaction_items` from embedded `items[]` on each transaction; filter out items whose `medicineId` is not in the medicines set; log each skip to `console.warn` in format `WARN: skipped transaction_item — referenced medicine {medicineId} not found`
    - Call `POST /api/reset` with the validated full payload (single atomic operation)
    - On success: `localStorage.setItem('apotek_migrated_to_sqlite', 'true')`; display a report table with columns `table | migrated | skipped`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 8.2 Write property test for migration skips orphaned items (P9)
    - **Property 9: Given a `transaction_item` referencing a `medicine_id` not present in the medicines array, the migration report shows `skipped >= 1` for `transaction_items` and no row with that unknown `medicine_id` is inserted into the DB**
    - **Validates: Requirements 7.5**

- [x] 9. Final checkpoint — Ensure all tests pass
  - Run full test suite; verify migration script works on a browser page; ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `better-sqlite3` is synchronous — no `async/await` needed in route handlers; atomicity is free via `db.transaction()`
- `ponytail:` no repository layer, no service classes — `server.ts` is one flat file; upgrade path is extract-to-router if routes exceed ~500 lines
- `ponytail:` `GET /api/transactions` groups items in JS after a single JOIN query — O(n) scan; upgrade path is a cursor-based pagination if transaction count grows large
- The mapper's generic camelCase→snake_case regex covers ~95% of fields; only `StockHistory.user → user_name` needs an explicit override
- All state updates in AppContext happen after a successful API response — never optimistic
- `currentUser` stays in `sessionStorage`, not SQLite; no schema change needed for auth

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7", "3.8", "3.9", "3.10", "5.1"] },
    { "id": 5, "tasks": ["5.2", "6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["6.3"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2"] }
  ]
}
```
