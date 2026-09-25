import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATABASE_FILE = 'apotek.db';
const STORAGE_CONFIG_FILE = 'storage-location.json';
const REQUIRED_TABLES = [
  'settings',
  'users',
  'medicines',
  'customers',
  'doctors',
  'transactions',
  'transaction_items',
  'stock_history',
  'cash_flows',
];

export interface StorageLocationInfo {
  databasePath: string;
  folderPath: string;
  isDefault: boolean;
}

export interface StorageCopyVerification {
  counts: Record<string, number>;
  integrity: string;
}

export function getDefaultDatabasePath(userDataPath: string): string {
  return path.join(userDataPath, DATABASE_FILE);
}

export function getStorageConfigPath(userDataPath: string): string {
  return path.join(userDataPath, STORAGE_CONFIG_FILE);
}

export function resolveDatabasePath(userDataPath: string): string {
  const defaultPath = getDefaultDatabasePath(userDataPath);
  const configPath = getStorageConfigPath(userDataPath);
  if (!fs.existsSync(configPath)) return defaultPath;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { databasePath?: unknown };
    if (typeof config.databasePath !== 'string' || !path.isAbsolute(config.databasePath)) return defaultPath;
    const configuredPath = path.resolve(config.databasePath);
    return fs.existsSync(configuredPath) ? configuredPath : defaultPath;
  } catch {
    return defaultPath;
  }
}

export function describeStorageLocation(userDataPath: string, databasePath: string): StorageLocationInfo {
  const resolvedDefault = path.resolve(getDefaultDatabasePath(userDataPath));
  const resolvedDatabase = path.resolve(databasePath);
  return {
    databasePath: resolvedDatabase,
    folderPath: path.dirname(resolvedDatabase),
    isDefault: resolvedDatabase === resolvedDefault,
  };
}

export function validateStorageTarget(targetFolder: string, currentDatabasePath: string): string {
  if (!path.isAbsolute(targetFolder)) throw new Error('Folder penyimpanan harus berupa path absolut.');
  const folderPath = path.resolve(targetFolder);
  const currentFolderPath = path.dirname(path.resolve(currentDatabasePath));
  if (folderPath === currentFolderPath) throw new Error('Folder tujuan sama dengan lokasi database saat ini.');

  fs.mkdirSync(folderPath, { recursive: true });
  fs.accessSync(folderPath, fs.constants.R_OK | fs.constants.W_OK);
  const probePath = path.join(folderPath, `.apotek-write-test-${process.pid}-${Date.now()}`);
  fs.writeFileSync(probePath, 'ok', { flag: 'wx' });
  fs.unlinkSync(probePath);

  const targetDatabasePath = path.join(folderPath, DATABASE_FILE);
  if (fs.existsSync(targetDatabasePath)) {
    throw new Error('Folder tujuan sudah berisi apotek.db. Pilih folder kosong.');
  }
  return targetDatabasePath;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

export function getBackupPath(databasePath: string): string {
  const basePath = `${databasePath}.backup-${timestamp()}`;
  let backupPath = basePath;
  let suffix = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = `${basePath}-${suffix++}`;
  }
  return backupPath;
}

function databaseCounts(database: Database.Database): Record<string, number> {
  return Object.fromEntries(REQUIRED_TABLES.map(table => {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return [table, row.count];
  }));
}

export function copyAndVerifyDatabase(sourcePath: string, targetPath: string): StorageCopyVerification {
  fs.copyFileSync(sourcePath, targetPath);
  const source = new Database(sourcePath, { readonly: true });
  const target = new Database(targetPath, { readonly: true });
  try {
    const sourceCounts = databaseCounts(source);
    const targetCounts = databaseCounts(target);
    const integrity = String(target.pragma('integrity_check', { simple: true }));
    if (integrity !== 'ok') throw new Error(`Verifikasi SQLite gagal: ${integrity}`);
    if (JSON.stringify(sourceCounts) !== JSON.stringify(targetCounts)) {
      throw new Error('Verifikasi jumlah data database hasil copy tidak sesuai.');
    }
    return { counts: targetCounts, integrity };
  } finally {
    target.close();
    source.close();
  }
}

export function writeStorageLocation(userDataPath: string, databasePath: string): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  const configPath = getStorageConfigPath(userDataPath);
  const temporaryPath = path.join(userDataPath, `${STORAGE_CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`);
  const payload = JSON.stringify({ databasePath: path.resolve(databasePath) }, null, 2);
  const handle = fs.openSync(temporaryPath, 'wx');
  try {
    fs.writeFileSync(handle, payload, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  if (fs.existsSync(configPath)) fs.rmSync(configPath, { force: true });
  fs.renameSync(temporaryPath, configPath);
}

export function createStorageTestDirectory(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'apotek-storage-'));
}
