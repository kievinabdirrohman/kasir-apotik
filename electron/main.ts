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

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { createServerApp } from '../src/server/app.js';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow: BrowserWindow | null = null;
let printWindow: BrowserWindow | null = null;
let apiPort = 0;

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
function startApiServer(): Promise<void> {
  return new Promise((resolve) => {
    const { app: serverApp } = createServerApp({
      dbPath: path.join(app.getPath('userData'), 'apotek.db'),
      corsOrigin: '*',
    });
    const server = serverApp.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        apiPort = addr.port;
      }
      console.log(`[electron] API server ready at ${getApiBase()}`);
      resolve();
    });
  });
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
function buildTestHtml(paperWidth: string, pharmacyName: string): string {
  const width = paperWidth === '80mm' ? 80 : 58;
  const fontSize = paperWidth === '80mm' ? 13 : 11;
  const dashed = '-'.repeat(paperWidth === '80mm' ? 44 : 32);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 3mm; width: ${width}mm; font-family: 'Courier New', monospace; font-size: ${fontSize}px; color: #000; }
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
    (_event, payload: { paperWidth?: string; printerName?: string; pharmacyName?: string }) =>
      printHtml({
        html: buildTestHtml(payload?.paperWidth ?? '58mm', payload?.pharmacyName ?? 'Apotek'),
        paperWidth: payload?.paperWidth,
        printerName: payload?.printerName,
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
    await startApiServer();
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
