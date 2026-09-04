import { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';
import { TrendingUp, Package, AlertTriangle, DollarSign, Loader2, Download, Users, CreditCard, Search, FileText } from 'lucide-react';
import { api } from '../services/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [salesByMethod, setSalesByMethod] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any>(null);
  const [customerDni, setCustomerDni] = useState('');
  const [customerHistory, setCustomerHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumResp, chartResp, topResp, methodResp, creditResp] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/sales-chart'),
        api.get('/reports/top-products?days=30&limit=10'),
        api.get('/reports/sales-by-method?days=30'),
        api.get('/reports/credit-notes-summary?days=30'),
      ]);
      setSummary(sumResp.data);
      setChartData(chartResp.data);
      setTopProducts(topResp.data.products || []);
      setSalesByMethod(methodResp.data.methods || []);
      setCreditNotes(creditResp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchCustomer = async () => {
    if (!customerDni) return;
    setLoadingCustomer(true);
    try {
      const resp = await api.get(`/reports/customer-history/${customerDni}`);
      setCustomerHistory(resp.data);
    } catch {
      setCustomerHistory(null);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const methodLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR/Digital', credit: 'Credito' };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="hsl(var(--primary))" />
      </div>
    );
  }

  return (
    <div className="anim-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Inteligencia de Negocio</h1>
        <button onClick={() => window.print()} className="btn glass hover-lift" style={{ display: 'flex', gap: '0.5rem' }}>
          <Download size={18} /> Exportar
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>Ventas Hoy</span>
            <DollarSign size={18} color="hsl(var(--primary))" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${summary?.today_revenue?.toFixed(2)}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--success))' }}>{summary?.today_count} transacciones</div>
        </div>

        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>Stock Bajo</span>
            <AlertTriangle size={18} color="hsl(var(--danger))" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{summary?.low_stock_count}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--danger))' }}>productos criticos</div>
        </div>

        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>Productos</span>
            <Package size={18} color="hsl(var(--secondary))" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{summary?.total_products}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>en catalogo</div>
        </div>

        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>Notas Credito (30d)</span>
            <FileText size={18} color="hsl(var(--warning))" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${creditNotes?.total_amount?.toFixed(2)}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>{creditNotes?.note_count} notas emitidas</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Sales Chart */}
        <div className="glass" style={{ padding: '1.5rem', height: '350px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <TrendingUp size={18} /> Ventas (7 dias)
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--glass-border))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 11}} />
              <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Method */}
        <div className="glass" style={{ padding: '1.5rem', height: '350px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <CreditCard size={18} /> Metodos de Pago (30 dias)
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={salesByMethod.map(m => ({ ...m, label: methodLabels[m.method] || m.method }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--glass-border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 11}} />
              <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products + Customer Search */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Top Products */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Package size={18} /> Top Productos (30 dias)
          </h3>
          {topProducts.length === 0 ? (
            <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', padding: '2rem' }}>Sin datos</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topProducts.map((p: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '6px', background: idx < 3 ? 'hsl(var(--primary) / 0.05)' : 'transparent' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: COLORS[idx % COLORS.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>{p.quantity} unidades</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>${p.revenue?.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer History Search */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Users size={18} /> Historial de Cliente
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Cedula / RUC del cliente"
              value={customerDni}
              onChange={e => setCustomerDni(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchCustomer()}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <button onClick={searchCustomer} className="btn glass" style={{ padding: '0.5rem 0.75rem' }} disabled={loadingCustomer}>
              {loadingCustomer ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            </button>
          </div>

          {customerHistory ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'hsl(var(--primary) / 0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>${customerHistory.total_spent?.toFixed(2)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))' }}>Total Gastado</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'hsl(var(--success) / 0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{customerHistory.purchase_count}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))' }}>Compras</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'hsl(var(--warning) / 0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    {customerHistory.purchase_count > 0 ? `$${(customerHistory.total_spent / customerHistory.purchase_count).toFixed(2)}` : '$0'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))' }}>Ticket Promedio</div>
                </div>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {customerHistory.sales?.map((sale: any) => (
                  <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
                    <span>{new Date(sale.date).toLocaleDateString()}</span>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>{methodLabels[sale.payment_method] || sale.payment_method}</span>
                    <strong>${sale.total.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>
              Busca un cliente por su cedula o RUC
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
