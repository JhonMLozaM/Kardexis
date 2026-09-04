import { useEffect, useState } from 'react';
import { Package, BarChart3, Users, ShoppingCart, Plus, Loader2, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import AttendanceWidget from '../components/AttendanceWidget';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDateDetail, setSelectedDateDetail] = useState<any>(null);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchMetrics(), fetchHistory()]).finally(() => setLoading(false));
  }, []);

  const fetchMetrics = async () => {
    try { const r = await api.get('/reports/summary'); setMetrics(r.data); } catch {}
  };
  const fetchHistory = async () => {
    try { const r = await api.get('/reports/daily-history'); setHistory(r.data); } catch {}
  };
  const fetchProducts = async () => {
    try { const r = await api.get('/products/'); setProducts(r.data); } catch {}
  };
  const fetchDailyDetails = async (dateStr: string) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const r = await api.get(`/reports/daily-details/${dateStr}`);
      setSelectedDateDetail(r.data);
    } catch {} finally { setDetailLoading(false); }
  };

  const lowStockProducts = products.filter(p => p.stock <= (p.min_stock_alert || 0));

  return (
    <div className="anim-fade-in">
      <AttendanceWidget />

      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Resumen del Dia</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user?.role === 'ADMIN' && (
            <button onClick={() => navigate('/reportes')} className="btn glass hover-lift">
              <BarChart3 size={16} /> Reportes
            </button>
          )}
          <button onClick={() => navigate('/pos')} className="btn btn-primary hover-lift">
            <ShoppingCart size={16} /> Nueva Venta
          </button>
          <button onClick={() => navigate('/productos')} className="btn glass hover-lift" style={{ color: 'hsl(var(--primary))' }}>
            <Plus size={16} /> Producto
          </button>
        </div>
      </div>

      <div className="grid-dashboard anim-slide-up" style={{ marginBottom: '2rem' }}>
        <div className="glass hover-lift" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', margin: 0 }}>Productos</h3>
            <Package size={20} color="hsl(var(--primary))" />
          </div>
          {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>{products.length}</p>}
        </div>

        {user?.role === 'ADMIN' && (
          <div onClick={() => navigate('/staff')} className="glass hover-lift" style={{ padding: '1.5rem', cursor: 'pointer', border: '1px solid hsl(var(--secondary)/0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', margin: 0 }}>Empleados</h3>
              <Users size={20} color="hsl(var(--secondary))" />
            </div>
            {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>{metrics?.total_employees || 0}</p>}
          </div>
        )}

        <div onClick={() => navigate('/reportes')} className="glass hover-lift" style={{ padding: '1.5rem', cursor: 'pointer', border: '1px solid hsl(var(--success)/0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', margin: 0 }}>Ventas Hoy</h3>
            <BarChart3 size={20} color="hsl(var(--success))" />
          </div>
          {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>${metrics?.today_revenue?.toFixed(2) || '0.00'}</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass anim-slide-up" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Package size={18} color="hsl(var(--primary))" /> Alertas de Inventario
          </h3>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} /></div>
          ) : lowStockProducts.length === 0 ? (
            <p style={{ color: 'hsl(var(--success))', textAlign: 'center', padding: '2rem' }}>Inventario optimo!</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem', maxHeight: 350, overflowY: 'auto' }}>
              {lowStockProducts.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', background: 'var(--surface-color)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Package size={18} color={item.stock === 0 ? 'hsl(var(--danger))' : 'hsl(var(--warning))'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Min: {item.min_stock_alert}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{item.stock?.toFixed(1)}</div>
                    <div style={{ fontSize: '0.75rem', color: item.stock === 0 ? 'hsl(var(--danger))' : 'hsl(var(--warning))' }}>
                      {item.stock === 0 ? 'Agotado' : 'Critico'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass anim-slide-up" style={{ padding: '1.5rem', animationDelay: '0.1s' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <BarChart3 size={18} color="hsl(var(--success))" /> Historial Diario
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'hsl(var(--text-secondary))', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Ventas</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: 'hsl(var(--text-secondary))' }}>Sin registros</td></tr>
                ) : history.map((h, i) => (
                  <tr key={i} style={{ cursor: 'pointer', borderBottom: '1px solid var(--glass-border)' }} onClick={() => fetchDailyDetails(h.date)} className="hover-lift">
                    <td style={{ padding: '0.5rem', color: 'hsl(var(--primary))', fontWeight: 500 }}>{h.date}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: 'hsl(var(--success))' }}>${(h.ventas || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{h.tickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showDetailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} className="anim-fade-in">
          <div className="glass" style={{ width: '100%', maxWidth: 700, maxHeight: '85vh', padding: '1.5rem', position: 'relative', overflowY: 'auto' }}>
            <button onClick={() => setShowDetailModal(false)} className="btn" style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', padding: 4 }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '0.5rem' }}>Detalle - {selectedDateDetail?.date}</h3>
            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={32} /></div>
            ) : selectedDateDetail && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                    <Package size={16} color="hsl(var(--primary))" /> Compras
                  </h4>
                  {selectedDateDetail.purchases.length === 0 ? (
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Sin ingresos</p>
                  ) : selectedDateDetail.purchases.map((p: any, i: number) => (
                    <div key={i} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: 'hsl(var(--primary-light))', borderRadius: 6, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600 }}>{p.product_name}</div>
                      <div>+{p.quantity} - ${p.quantity * (p.cost_price || 0)}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                    <ShoppingCart size={16} color="hsl(var(--success))" /> Ventas
                  </h4>
                  {selectedDateDetail.sales.length === 0 ? (
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Sin ventas</p>
                  ) : selectedDateDetail.sales.map((s: any, i: number) => (
                    <div key={i} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>{s.client_name}</span>
                      <span style={{ fontWeight: 600 }}>${s.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
