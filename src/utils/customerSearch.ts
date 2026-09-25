import type { Customer } from '../types';

export type CustomerSearchIndex = {
  customers: Customer[];
  byId: Map<string, Customer>;
  searchTextById: Map<string, string>;
};

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export const customerDisplayLabel = (customer?: Customer): string =>
  customer ? `${customer.name} (${customer.memberNo || '-'})` : 'Customer Umum (Non-Member)';

export function buildCustomerSearchIndex(customers: readonly Customer[]): CustomerSearchIndex {
  const activeCustomers = customers.filter(customer => customer.status === 'Aktif');
  return {
    customers: activeCustomers,
    byId: new Map(activeCustomers.map(customer => [customer.id, customer])),
    searchTextById: new Map(activeCustomers.map(customer => [
      customer.id,
      [customer.name, customer.memberNo, customer.phone].map(normalize).filter(Boolean).join(' '),
    ])),
  };
}

export function searchCustomerIndex(index: CustomerSearchIndex, query: string): Customer[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return index.customers;
  return index.customers.filter(customer => index.searchTextById.get(customer.id)?.includes(normalizedQuery));
}
