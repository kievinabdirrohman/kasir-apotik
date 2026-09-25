import assert from 'node:assert/strict';
import { buildCustomerSearchIndex, searchCustomerIndex } from '../src/utils/customerSearch.js';
import type { Customer } from '../src/types.js';

const customers: Customer[] = [
  { id: 'c-1', memberNo: 'MBR-001', name: 'Budi Santoso', phone: '081234567890', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-01-01' },
  { id: 'c-2', memberNo: 'MBR-002', name: 'Sari Dewi', phone: '082200000000', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-01-01' },
  { id: 'c-3', memberNo: 'MBR-003', name: 'Customer Nonaktif', phone: '083300000000', status: 'Nonaktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-01-01' },
];

const index = buildCustomerSearchIndex(customers);
assert.deepEqual(index.customers.map(customer => customer.id), ['c-1', 'c-2']);
assert.equal(index.byId.get('c-1')?.id, 'c-1');
assert.deepEqual(searchCustomerIndex(index, '').map(customer => customer.id), ['c-1', 'c-2']);
assert.deepEqual(searchCustomerIndex(index, 'budi').map(customer => customer.id), ['c-1']);
assert.deepEqual(searchCustomerIndex(index, 'mBr-002').map(customer => customer.id), ['c-2']);
assert.deepEqual(searchCustomerIndex(index, '081234').map(customer => customer.id), ['c-1']);
assert.deepEqual(searchCustomerIndex(index, 'NONAKTIF'), []);
assert.deepEqual(searchCustomerIndex(index, 'sari').map(customer => customer.id), ['c-2']);

// A medicine/customer-price refresh must not change the customer search source
// or return a stale customer id after the refreshed data is applied.
const refreshedIndex = buildCustomerSearchIndex(customers.map(customer => ({ ...customer })));
assert.deepEqual(searchCustomerIndex(refreshedIndex, 'sari').map(customer => customer.id), ['c-2']);
assert.equal(refreshedIndex.byId.get('c-2')?.id, 'c-2');

console.log('POS customer autocomplete search test passed.');
