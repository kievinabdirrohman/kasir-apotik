import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  copyAndVerifyDatabase,
  createStorageTestDirectory,
  describeStorageLocation,
  getBackupPath,
  getDefaultDatabasePath,
  resolveDatabasePath,
  validateStorageTarget,
  writeStorageLocation,
} from '../electron/storage.ts';

const root = createStorageTestDirectory();
const userData = path.join(root, 'user-data');
const sourceFolder = path.join(root, 'source');
const targetFolder = path.join(root, 'target');
fs.mkdirSync(sourceFolder, { recursive: true });
fs.mkdirSync(targetFolder, { recursive: true });

const sourcePath = getDefaultDatabasePath(sourceFolder);
const source = new Database(sourcePath);
for (const table of ['settings', 'users', 'medicines', 'customers', 'doctors', 'transactions', 'transaction_items', 'stock_history', 'cash_flows']) {
  source.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`);
}
source.prepare('INSERT INTO transactions (id) VALUES (?)').run('tx-1');
source.close();

assert.equal(resolveDatabasePath(userData), getDefaultDatabasePath(userData));
writeStorageLocation(userData, sourcePath);
assert.equal(resolveDatabasePath(userData), path.resolve(sourcePath));
assert.equal(describeStorageLocation(userData, sourcePath).isDefault, false);

const targetPath = validateStorageTarget(targetFolder, sourcePath);
const backupPath = getBackupPath(sourcePath);
fs.copyFileSync(sourcePath, backupPath);
assert.equal(fs.existsSync(backupPath), true);
const verification = copyAndVerifyDatabase(sourcePath, targetPath);
assert.equal(verification.integrity, 'ok');
assert.equal(verification.counts.transactions, 1);
assert.equal(fs.existsSync(targetPath), true);

fs.rmSync(root, { recursive: true, force: true });
console.log('storage migration self-test passed');
