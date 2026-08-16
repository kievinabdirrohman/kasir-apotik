/**
 * Typing for the Electron preload bridge (see electron/preload.ts).
 * `window.electronAPI` is only present when the app runs inside Electron
 * (desktop). In plain-browser (web) mode it is `undefined` and the app keeps
 * its original behaviour.
 */

export interface PrinterInfo {
  name: string;
  displayName: string;
  description?: string;
  status: number;
  isDefault: boolean;
}

export interface PrintPayload {
  html: string;
  paperWidth?: string;
  printerName?: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  isDesktop: boolean;
  /** Base URL of the in-process API server (e.g. http://127.0.0.1:PORT). */
  getApiBase(): Promise<string>;
  getAppVersion(): Promise<string>;
  listPrinters(): Promise<PrinterInfo[]>;
  printReceipt(payload: PrintPayload): Promise<PrintResult>;
  printTest(payload: { paperWidth?: string; printerName?: string; pharmacyName?: string }): Promise<PrintResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
