/**
 * Preload — securely exposes a minimal, typed API to the renderer.
 * The renderer detects the desktop runtime via `window.electronAPI`.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getApiBase: () => ipcRenderer.invoke('app:get-api-base'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  printReceipt: (payload: unknown) => ipcRenderer.invoke('printer:print', payload),
  printTest: (payload: unknown) => ipcRenderer.invoke('printer:test', payload),
});
