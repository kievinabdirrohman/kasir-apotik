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
  printerSettings?: {
    marginTopMm: number;
    marginRightMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    fontSize: number;
    lineHeight: number;
    labelWidthPct: number;
    columnGapMm: number;
    amountAlignment: 'left' | 'right';
  };
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface StorageLocationInfo {
  databasePath: string;
  folderPath: string;
  isDefault: boolean;
}

export interface StorageMigrationResult {
  success: boolean;
  databasePath?: string;
  backupPath?: string;
  error?: string;
}

export interface ElectronAPI {
  isDesktop: boolean;
  /** Base URL of the in-process API server (e.g. http://127.0.0.1:PORT). */
  getApiBase(): Promise<string>;
  getAppVersion(): Promise<string>;
  getStorageLocation(): Promise<StorageLocationInfo>;
  chooseStorageFolder(): Promise<string | null>;
  migrateStorage(targetFolder: string): Promise<StorageMigrationResult>;
  reloadApp(): Promise<boolean>;
  listPrinters(): Promise<PrinterInfo[]>;
  printReceipt(payload: PrintPayload): Promise<PrintResult>;
  printTest(payload: { paperWidth?: string; printerName?: string; pharmacyName?: string; printerSettings?: PrintPayload['printerSettings'] }): Promise<PrintResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
