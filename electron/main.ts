/**
 * Electron main process — desktop wrapper for the Apotek POS app.
 *
 * Responsibilities:
 *  - Runs the Express + SQLite backend **in-process** (see src/server/app.ts).
 *    The database lives in the OS userData directory, so it survives app
 *    upgrades (schema migrations are additive — see applyMigrations).
 *  - Hosts the Vite build (dist/index.html) in production, or the Vite dev
 *    server in development.
 *  - Provides printer IPC: list printers, silent auto-print of a thermal
 *    receipt (58mm / 80mm), and a test print.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from '../src/server/app.js';
import {
  copyAndVerifyDatabase,
  describeStorageLocation,
  getBackupPath,
  resolveDatabasePath,
  validateStorageTarget,
  writeStorageLocation,
} from './storage.js';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow: BrowserWindow | null = null;
let printWindow: BrowserWindow | null = null;
let apiServer: Server | null = null;
let apiDb: ReturnType<typeof createServerApp>['db'] | null = null;
let apiPort = 0;
let storageUserDataPath = '';
let activeDatabasePath = '';
let storageMigrationRunning = false;

function getApiBase(): string {
  return `http://127.0.0.1:${apiPort}`;
}

/** 58mm/80mm paper width → Chromium page size in microns (1 mm = 1000 µm). */
function paperSizeMicrons(paperWidth?: string): { width: number; height: number } {
  const mm = paperWidth === '80mm' ? 80 : 58;
  // Height is a tall roll; the real cut is driven by the printer driver / @page CSS.
  return { width: mm * 1000, height: 500000 };
}

// ---------------------------------------------------------------------------
// In-process API server (Express + SQLite)
// ---------------------------------------------------------------------------
function startApiServer(databasePath: string): Promise<void> {
  return new Promise((resolve) => {
    const created = createServerApp({
      dbPath: databasePath,
      corsOrigin: '*',
    });
    const serverApp = created.app;
    apiDb = created.db;
    const server = serverApp.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        apiPort = addr.port;
      }
      apiServer = server;
      activeDatabasePath = databasePath;
      console.log(`[electron] API server ready at ${getApiBase()}`);
      resolve();
    });
  });
}

async function stopApiServer(): Promise<void> {
  const server = apiServer;
  apiServer = null;
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (apiDb) {
    apiDb.close();
    apiDb = null;
  }
  apiPort = 0;
}

function storageLocation() {
  return describeStorageLocation(storageUserDataPath, activeDatabasePath);
}

async function migrateStorage(targetFolder: string): Promise<{ success: boolean; databasePath?: string; backupPath?: string; error?: string }> {
  if (storageMigrationRunning) return { success: false, error: 'Migrasi penyimpanan sedang berjalan.' };
  if (!apiDb || !activeDatabasePath) return { success: false, error: 'Database aktif belum siap.' };

  storageMigrationRunning = true;
  const sourcePath = activeDatabasePath;
  let targetPath = '';
  try {
    targetPath = validateStorageTarget(targetFolder, sourcePath);
    apiDb.pragma('wal_checkpoint(TRUNCATE)');
    await stopApiServer();

    const backupPath = getBackupPath(sourcePath);
    fs.copyFileSync(sourcePath, backupPath);
    copyAndVerifyDatabase(sourcePath, targetPath);

    await startApiServer(targetPath);
    writeStorageLocation(storageUserDataPath, targetPath);
    activeDatabasePath = targetPath;

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    }, 50);
    return { success: true, databasePath: targetPath, backupPath };
  } catch (err: unknown) {
    try {
      if (apiServer || apiDb) await stopApiServer();
      await startApiServer(sourcePath);
      activeDatabasePath = sourcePath;
    } catch (restoreErr) {
      console.error('[storage] gagal mengembalikan server ke database lama', restoreErr);
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    storageMigrationRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------
function createPrintWindow(): BrowserWindow {
  if (printWindow && !printWindow.isDestroyed()) return printWindow;
  printWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  printWindow.on('closed', () => {
    printWindow = null;
  });
  return printWindow;
}

interface PrintPayload {
  html: string;
  paperWidth?: string;
  printerName?: string;
  printerSettings?: {
    marginTopMm: number; marginRightMm: number; marginBottomMm: number; marginLeftMm: number;
    fontSize: number; lineHeight: number; labelWidthPct: number; columnGapMm: number;
    amountAlignment: 'left' | 'right';
  };
}

async function printHtml(payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const win = createPrintWindow();
    const wc = win.webContents;
    await wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(payload.html));
    const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
      wc.print(
        {
          silent: true, // no dialog — "auto print"
          printBackground: true,
          deviceName: payload.printerName || '',
          pageSize: paperSizeMicrons(payload.paperWidth),
          margins: { marginType: 'none' },
        },
        (success, failureReason) => resolve({ success, failureReason }),
      );
    });
    return {
      success: result.success,
      error: result.success ? undefined : result.failureReason || 'Printer gagal mencetak',
    };
  } catch (err: unknown) {
    return { success: false, error: String((err as Error)?.message ?? err) };
  }
}

/** Small sample receipt used by the "Test Printer" button. */
function buildTestHtml(paperWidth: string, pharmacyName: string, printerSettings?: PrintPayload['printerSettings']): string {
  const width = paperWidth === '80mm' ? 80 : 58;
  const fontSize = printerSettings?.fontSize ?? 7;
  const lineHeight = printerSettings?.lineHeight ?? 1.2;
  const padding = printerSettings
    ? `${printerSettings.marginTopMm}mm ${printerSettings.marginRightMm}mm ${printerSettings.marginBottomMm}mm ${printerSettings.marginLeftMm}mm`
    : '0mm';
  const hardwareInsetLeft = 0;
  const hardwareInsetRight = 0;
  const contentWidth = width - hardwareInsetLeft - hardwareInsetRight - (printerSettings?.marginLeftMm ?? 0) - (printerSettings?.marginRightMm ?? 0);
  const dashed = '-'.repeat(paperWidth === '80mm' ? 44 : 32);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0 ${hardwareInsetRight}mm 0 ${hardwareInsetLeft}mm; padding: ${padding}; width: ${contentWidth}mm; max-width: ${contentWidth}mm; font-family: 'Courier New', monospace; font-size: ${fontSize}pt; line-height: ${lineHeight}; color: #000; }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; }
  .dashed { border-top: 1px dashed #000; margin: 6px 0; }
</style>
</head>
<body>
  <div class="center"><b>TEST CETAK PRINTER</b></div>
  <div class="center">${pharmacyName}</div>
  <div class="center">Lebar kertas: ${paperWidth}</div>
  <div class="dashed"></div>
  <div class="row"><span>Tanggal</span><span>${new Date().toLocaleString('id-ID')}</span></div>
  <div class="row"><span>Mode</span><span>Silent / Auto</span></div>
  <div class="dashed"></div>
  <div class="center">Jika struk ini tercetak dengan rapi,</div>
  <div class="center">pengaturan printer sudah benar.</div>
  <div class="dashed"></div>
  <div class="center"><b>~ Terima Kasih ~</b></div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// IPC (renderer ⇄ main)
// ---------------------------------------------------------------------------
function registerIpc(): void {
  ipcMain.handle('app:get-api-base', () => getApiBase());
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-storage-location', () => storageLocation());
  ipcMain.handle('app:choose-storage-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Pilih Folder Penyimpanan Data Apotek',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle('app:migrate-storage', (_event, targetFolder: unknown) => {
    if (typeof targetFolder !== 'string') return { success: false, error: 'Folder tujuan tidak valid.' };
    return migrateStorage(targetFolder);
  });
  ipcMain.handle('app:reload', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    }, 50);
    return true;
  });

  ipcMain.handle('printer:list', async () => {
    try {
      const win = createPrintWindow();
      return await win.webContents.getPrintersAsync();
    } catch {
      return [];
    }
  });

  ipcMain.handle('printer:print', (_event, payload: PrintPayload) => printHtml(payload));

  ipcMain.handle(
    'printer:test',
    (_event, payload: { paperWidth?: string; printerName?: string; pharmacyName?: string; printerSettings?: PrintPayload['printerSettings'] }) =>
      printHtml({
        html: buildTestHtml(payload?.paperWidth ?? '58mm', payload?.pharmacyName ?? 'Apotek', payload?.printerSettings),
        paperWidth: payload?.paperWidth,
        printerName: payload?.printerName,
        printerSettings: payload?.printerSettings,
      }),
  );
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Apotek Az Zainiyah — Kasir & Operasional',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload uses contextBridge only
      backgroundThrottling: false,
    },
  });

  // Open external links in the default browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // When the UI window is closed, also destroy the hidden thermal-print window.
  // Otherwise window-all-closed never fires (the hidden window is still "open")
  // and the app keeps running invisibly — reopening it then crashes on the
  // destroyed main window ("Object has been destroyed").
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.destroy();
    }
    printWindow = null;
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    await mainWindow.loadURL(DEV_SERVER_URL);
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Never touch a window that has already been destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpc();
    storageUserDataPath = app.getPath('userData');
    activeDatabasePath = resolveDatabasePath(storageUserDataPath);
    await startApiServer(activeDatabasePath);
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
