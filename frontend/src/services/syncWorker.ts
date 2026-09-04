import { api } from './api';
import {
  getPendingSales,
  markSaleSynced,
  markSaleFailed,
  saveProducts,
  saveCustomers,
  getPendingCashCloses,
  markCashCloseSynced,
  markCashCloseFailed,
  getPendingSyncCount,
  getSyncMeta,
  setSyncMeta,
  type OfflineProduct,
  type OfflineCustomer,
  type OfflineCashClose,
} from './offlineDb';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let listeners: Set<(status: SyncStatus, pending: number) => void> = new Set();
let currentStatus: SyncStatus = 'idle';

function notify(status: SyncStatus, pending: number) {
  currentStatus = status;
  listeners.forEach(fn => fn(status, pending));
}

export function onSyncStatusChange(fn: (status: SyncStatus, pending: number) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSyncStatus() {
  return currentStatus;
}

async function isOnline(): Promise<boolean> {
  try {
    const resp = await api.get('/health', { timeout: 5000 });
    return resp.status === 200;
  } catch {
    return navigator.onLine;
  }
}

export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  notify('syncing', pending.length);
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const payload = {
        external_id: sale.externalId,
        client_id: sale.client_id,
        client_name: sale.client_name,
        client_id_type: sale.client_id_type,
        items: sale.items,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        payment_method: sale.payment_method,
        payment_details: sale.payment_details,
        discount: sale.discount,
        discount_type: sale.discount_type,
        user_id: sale.user_id,
        date: sale.date,
      };

      const resp = await api.post('/sync/sale', payload);
      await markSaleSynced(sale.externalId, resp.data.id);
      synced++;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Sync failed';
      await markSaleFailed(sale.externalId, errorMsg);
      failed++;
    }
  }

  const remaining = await getPendingSyncCount();
  notify(remaining > 0 ? 'error' : 'idle', remaining);
  return { synced, failed };
}

export async function syncPendingCashCloses(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingCashCloses();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const cc of pending) {
    try {
      const payload = {
        external_id: cc.externalId,
        date: cc.date,
        opening_amount: cc.opening_amount,
        closing_amount: cc.closing_amount,
        expected_amount: cc.expected_amount,
        difference: cc.difference,
        sales_count: cc.sales_count,
        sales_total: cc.sales_total,
        payment_breakdown: cc.payment_breakdown,
        status: cc.status,
      };

      const resp = await api.post('/cash-close/', payload);
      await markCashCloseSynced(cc.externalId, resp.data.id);
      synced++;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Cash close sync failed';
      await markCashCloseFailed(cc.externalId, errorMsg);
      failed++;
    }
  }

  return { synced, failed };
}

export async function syncProducts(): Promise<number> {
  try {
    const lastSync = await getSyncMeta('products_sync');
    const params = lastSync ? { since: lastSync } : {};
    const resp = await api.get('/sync/products', { params });
    const products: OfflineProduct[] = resp.data.products;
    if (products.length > 0) {
      await saveProducts(products);
    }
    await setSyncMeta('products_sync', new Date().toISOString());
    return products.length;
  } catch {
    return 0;
  }
}

export async function syncCustomers(): Promise<number> {
  try {
    const lastSync = await getSyncMeta('customers_sync');
    const params = lastSync ? { since: lastSync } : {};
    const resp = await api.get('/sync/customers', { params });
    const customers: OfflineCustomer[] = resp.data.customers;
    if (customers.length > 0) {
      await saveCustomers(customers);
    }
    await setSyncMeta('customers_sync', new Date().toISOString());
    return customers.length;
  } catch {
    return 0;
  }
}

export async function fullSync(): Promise<{
  products: number;
  customers: number;
  sales_synced: number;
  sales_failed: number;
  cash_closes_synced: number;
  cash_closes_failed: number;
}> {
  const online = await isOnline();
  if (!online) return { products: 0, customers: 0, sales_synced: 0, sales_failed: 0, cash_closes_synced: 0, cash_closes_failed: 0 };

  const [products, customers, salesResult, cashClosesResult] = await Promise.all([
    syncProducts(),
    syncCustomers(),
    syncPendingSales(),
    syncPendingCashCloses(),
  ]);

  return {
    products,
    customers,
    sales_synced: salesResult.synced,
    sales_failed: salesResult.failed,
    cash_closes_synced: cashClosesResult.synced,
    cash_closes_failed: cashClosesResult.failed,
  };
}

export function startAutoSync(intervalMs: number = 30000) {
  stopAutoSync();
  syncInterval = setInterval(async () => {
    const online = await isOnline();
    if (online) {
      const pending = await getPendingSyncCount();
      if (pending > 0) {
        await syncPendingSales();
      }
    }
  }, intervalMs);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
