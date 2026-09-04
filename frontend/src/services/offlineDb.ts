import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  name: string;
  barcode?: string;
  unit_of_measure: string;
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock_alert: number;
  parent_product_id?: string;
  conversion_factor?: number;
  iva_rate: number;
  synced_at: number;
}

export interface OfflineSale {
  id: string;
  externalId: string;
  client_id?: string;
  client_name: string;
  client_id_type?: string;
  items: OfflineSaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_details?: Record<string, number>;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  user_id: string;
  user_name: string;
  date: string;
  status: 'pending' | 'synced' | 'failed';
  sync_attempts: number;
  last_sync_attempt?: string;
  error_message?: string;
  created_at: string;
}

export interface OfflineSaleItem {
  product_id: string;
  name: string;
  barcode?: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface OfflineCustomer {
  id: string;
  dni_ruc: string;
  name: string;
  id_type?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  synced_at: number;
}

export interface OfflineCashClose {
  id: string;
  externalId: string;
  date: string;
  user_id: string;
  user_name: string;
  opening_amount: number;
  closing_amount: number;
  expected_amount: number;
  difference: number;
  sales_count: number;
  sales_total: number;
  payment_breakdown: Record<string, number>;
  status: 'open' | 'closed';
  sync_status?: 'pending' | 'synced' | 'failed';
  error_message?: string;
  synced_at?: number;
}

export interface SyncMeta {
  key: string;
  value: string;
  updated_at: number;
}

class KardexisDB extends Dexie {
  products!: Table<OfflineProduct>;
  sales!: Table<OfflineSale>;
  customers!: Table<OfflineCustomer>;
  cash_closes!: Table<OfflineCashClose>;
  sync_meta!: Table<SyncMeta>;

  constructor() {
    super('KardexisOffline');
    this.version(1).stores({
      products: 'id, barcode, name, synced_at',
      sales: 'id, externalId, status, date, created_at, [status+date]',
      customers: 'id, dni_ruc, name, synced_at',
      cash_closes: 'id, date, status, user_id, synced_at',
      sync_meta: 'key',
    });
  }
}

export const db = new KardexisDB();

// ===== Products =====

export async function saveProducts(products: OfflineProduct[]) {
  const now = Date.now();
  const items = products.map(p => ({ ...p, synced_at: now }));
  await db.products.bulkPut(items);
}

export async function getProduct(id: string): Promise<OfflineProduct | undefined> {
  return db.products.get(id);
}

export async function getProductByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
  return db.products.where('barcode').equals(barcode).first();
}

export async function searchProducts(query: string): Promise<OfflineProduct[]> {
  const lower = query.toLowerCase();
  const all = await db.products.toArray();
  return all.filter(p =>
    p.name.toLowerCase().includes(lower) ||
    p.barcode?.toLowerCase().includes(lower)
  ).slice(0, 50);
}

export async function getAllProducts(): Promise<OfflineProduct[]> {
  return db.products.toArray();
}

export async function updateProductStock(id: string, quantityChange: number) {
  const product = await db.products.get(id);
  if (product) {
    await db.products.update(id, { stock: product.stock + quantityChange });
  }
}

// ===== Sales (Outbox) =====

export async function saveSaleOffline(sale: Omit<OfflineSale, 'status' | 'sync_attempts' | 'created_at'>): Promise<OfflineSale> {
  const fullSale: OfflineSale = {
    ...sale,
    status: 'pending',
    sync_attempts: 0,
    created_at: new Date().toISOString(),
  };
  await db.sales.put(fullSale);
  return fullSale;
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  return db.sales.where('status').equals('pending').toArray();
}

export async function getSaleByExternalId(externalId: string): Promise<OfflineSale | undefined> {
  return db.sales.where('externalId').equals(externalId).first();
}

export async function markSaleSynced(externalId: string, serverId: string) {
  await db.sales.where('externalId').equals(externalId).modify({
    status: 'synced',
    id: serverId,
  });
}

export async function markSaleFailed(externalId: string, error: string) {
  await db.sales.where('externalId').equals(externalId).modify(s => {
    s.status = 'failed';
    s.sync_attempts += 1;
    s.last_sync_attempt = new Date().toISOString();
    s.error_message = error;
  });
}

export async function getTodaySales(userId: string): Promise<OfflineSale[]> {
  const today = new Date().toISOString().split('T')[0];
  return db.sales
    .where('[status+date]')
    .equals(['pending', today])
    .or('date').equals(today)
    .and(s => s.user_id === userId)
    .toArray();
}

export async function getTodaySalesStats(userId: string) {
  const sales = await getTodaySales(userId);
  const total = sales.reduce((sum, s) => sum + s.total, 0);
  const count = sales.length;
  const byMethod: Record<string, number> = {};
  sales.forEach(s => {
    byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + s.total;
  });
  return { total, count, byMethod, sales };
}

// ===== Customers =====

export async function saveCustomers(customers: OfflineCustomer[]) {
  const now = Date.now();
  const items = customers.map(c => ({ ...c, synced_at: now }));
  await db.customers.bulkPut(items);
}

export async function getCustomerByDni(dni: string): Promise<OfflineCustomer | undefined> {
  return db.customers.where('dni_ruc').equals(dni).first();
}

export async function searchCustomers(query: string): Promise<OfflineCustomer[]> {
  const lower = query.toLowerCase();
  const all = await db.customers.toArray();
  return all.filter(c =>
    c.name.toLowerCase().includes(lower) ||
    c.dni_ruc.includes(query)
  ).slice(0, 20);
}

// ===== Cash Close =====

export async function saveCashClose(cashClose: OfflineCashClose) {
  await db.cash_closes.put(cashClose);
}

export async function getOpenCashClose(userId: string): Promise<OfflineCashClose | undefined> {
  const today = new Date().toISOString().split('T')[0];
  return db.cash_closes
    .where('date').equals(today)
    .and(cc => cc.user_id === userId && cc.status === 'open')
    .first();
}

export async function getClosedCashCloses(limit: number = 30): Promise<OfflineCashClose[]> {
  return db.cash_closes
    .orderBy('date')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getPendingCashCloses(): Promise<OfflineCashClose[]> {
  return db.cash_closes
    .where('sync_status')
    .equals('pending')
    .toArray();
}

export async function markCashCloseSynced(externalId: string, serverId: string) {
  await db.cash_closes.where('externalId').equals(externalId).modify({
    sync_status: 'synced',
    id: serverId,
    synced_at: Date.now(),
  });
}

export async function markCashCloseFailed(externalId: string, error: string) {
  await db.cash_closes.where('externalId').equals(externalId).modify(cc => {
    cc.sync_status = 'failed';
    cc.error_message = error;
  });
}

export async function getPendingCashCloseCount(): Promise<number> {
  return db.cash_closes.where('sync_status').equals('pending').count();
}

// ===== Sync Meta =====

export async function getSyncMeta(key: string): Promise<string | null> {
  const meta = await db.sync_meta.get(key);
  return meta?.value || null;
}

export async function setSyncMeta(key: string, value: string) {
  await db.sync_meta.put({ key, value, updated_at: Date.now() });
}

// ===== Utility =====

export async function getPendingSyncCount(): Promise<number> {
  return db.sales.where('status').equals('pending').count();
}

export async function clearAllData() {
  await db.transaction('rw', [db.products, db.sales, db.customers, db.cash_closes, db.sync_meta], async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.cash_closes.clear();
    await db.sync_meta.clear();
  });
}
