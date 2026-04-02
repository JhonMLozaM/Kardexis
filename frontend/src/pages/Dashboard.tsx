import { useEffect, useState } from 'react';
import { Package, BarChart3, Users, Settings, Plus, ScanLine, ShoppingCart, LogOut, Loader2, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import AttendanceWidget from '../components/AttendanceWidget';

const COLOR_MAP: Record<string, string> = {
  "Azul": "215, 80%, 50%",
  "Blanco": "0, 0%, 95%",
  "Gris": "210, 10%, 60%",
  "Amarillo": "45, 90%, 50%",
  "Verde": "145, 60%, 45%",
  "Rosa": "330, 80%, 65%",
  "Rojo": "0, 70%, 55%",
  "Morado": "270, 60%, 55%"
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDateDetail, setSelectedDateDetail] = useState<any>(null);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchMetrics(), fetchHistory()]).finally(() => setLoading(false));
  }, []);

  const fetchMetrics = async () => {
    try {
      const resp = await api.get('/reports/summary');
      setMetrics(resp.data);
    } catch (err) {
      console.error("Error cargando métricas", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const resp = await api.get('/reports/daily-history');
      setHistory(resp.data);
    } catch (err) {
      console.error("Error cargando historial", err);
    }
  };

  const fetchDailyDetails = async (dateStr: string) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const resp = await api.get(`/reports/daily-details/${dateStr}`);
      setSelectedDateDetail(resp.data);
    } catch (err) {
      console.error("Error cargando detalles del día", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const resp = await api.get('/products/');
      setProducts(resp.data);
    } catch (err) {
      console.error("Error cargando productos", err);
    } finally {
      setLoading(false);
    }
  };

  const lowStockProducts = products.filter(p => p.stock <= (p.min_stock_alert || 0));

  return (
    <div className="app-container anim-fade-in">
      <header className="glass header-responsive" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'hsl(var(--primary))', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', color: 'white' }}>
            <ScanLine size={28} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'hsl(var(--primary))' }}>Kardexis</h1>
        </div>
        
        <nav className="nav-menu" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/clientes')} className="btn hover-lift btn-nav" style={{ color: 'hsl(var(--text-secondary))', background: 'transparent' }}>
            <Users size={18} /> <span className="hide-mobile">Clientes</span>
          </button>
          <button onClick={() => navigate('/perfil')} className="btn hover-lift btn-nav" style={{ color: 'hsl(var(--text-secondary))', background: 'transparent' }}>
            <Settings size={18} /> <span className="hide-mobile">Ajustes</span>
          </button>
          <div className="divider-mobile" style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 0.5rem' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '32px', 
              minWidth: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: `hsl(${COLOR_MAP[user?.theme_color || 'Azul'] || COLOR_MAP['Azul']})`, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: ['Blanco', 'Amarillo', 'Rosa', 'Gris'].includes(user?.theme_color || 'Azul') ? 'black' : 'white', 
              fontWeight: '900',
              fontSize: '1rem',
              border: `2px solid white`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {user?.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span className="hide-mobile" style={{ fontWeight: 500 }}>{user?.full_name || 'Admin'}</span>
          </div>
          <button onClick={logout} className="btn" style={{ padding: '0.5rem', color: 'hsl(var(--danger))', background: 'hsl(var(--danger)/0.1)', marginLeft: '0.5rem' }} title="Cerrar Sesión">
            <LogOut size={18} />
          </button>
        </nav>
      </header>

      <main>
        <AttendanceWidget />
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>Resumen del Día</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {user?.role === 'ADMIN' && (
              <button onClick={() => navigate('/reportes')} className="btn glass hover-lift" style={{ color: 'hsl(var(--secondary))', border: '1px solid hsl(var(--secondary)/0.2)', flex: '1 1 auto' }}>
                <BarChart3 size={18} /> Ver Reportes
              </button>
            )}
            <button onClick={() => navigate('/pos')} className="btn btn-primary hover-lift" style={{ flex: '1 1 auto' }}>
              <ShoppingCart size={18} /> Nueva Venta (POS)
            </button>
            <button onClick={() => navigate('/productos')} className="btn glass hover-lift" style={{ color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary-light))', flex: '1 1 auto' }}>
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
        </div>

        <div className="grid-dashboard anim-slide-up" style={{ marginBottom: '2rem' }}>
          {/* Card 1 */}
          <div className="glass hover-lift" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Productos Registrados</h3>
              <Package size={20} color="hsl(var(--primary))" />
            </div>
            {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>{products.length}</p>}
            <p style={{ color: 'hsl(var(--success))', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
              Base de datos activa
            </p>
          </div>
          
          {/* Card 2 - ADMIN ONLY */}
          {user?.role === 'ADMIN' && (
            <div onClick={() => navigate('/staff')} className="glass hover-lift" style={{ padding: '1.5rem', cursor: 'pointer', border: '1px solid hsl(var(--secondary)/0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Gestión Empleados</h3>
                <Users size={20} color="hsl(var(--secondary))" />
              </div>
              {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>{metrics?.total_employees || 0}</p>}
              <p style={{ color: 'hsl(var(--secondary))', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
                Administrar personal y turnos
              </p>
            </div>
          )}

          {/* Card 3 */}
          <div onClick={() => navigate('/reportes')} className="glass hover-lift" style={{ padding: '1.5rem', cursor: 'pointer', border: '1px solid hsl(var(--success)/0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Ventas de Hoy</h3>
              <BarChart3 size={20} color="hsl(var(--success))" />
            </div>
            {loading ? <Loader2 className="animate-spin" /> : <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>${metrics?.today_revenue.toFixed(2) || '0.00'}</p>}
            <p style={{ color: 'hsl(var(--success))', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
              Ingreso real reportado
            </p>
          </div>
        </div>

        {/* Listas de Detalle y alertas */}
        <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1000 ? '1fr' : '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
          
          <div className="glass anim-slide-up" style={{ padding: '1.5rem', animationDelay: '0.1s' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} color="hsl(var(--primary))" /> Alertas de Inventario
            </h3>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" color="hsl(var(--primary))" size={32}/></div>
            ) : lowStockProducts.length === 0 ? (
              <p style={{ color: 'hsl(var(--success))', textAlign: 'center', padding: '2rem' }}>¡Todo el inventario está óptimo!</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {lowStockProducts.map(item => (
                  <div key={item._id} className="responsive-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: 'var(--border-radius-sm)', background: 'var(--surface-color)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: 'var(--border-radius-sm)', background: 'hsl(var(--bg-color))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color={item.stock === 0 ? 'hsl(var(--danger))' : 'hsl(var(--warning))'} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{item.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Stock Min: {item.min_stock_alert}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>{item.stock?.toFixed(1)}</p>
                      <span style={{ color: item.stock === 0 ? 'hsl(var(--danger))' : 'hsl(var(--warning))', fontSize: '0.75rem' }}>{item.stock === 0 ? 'Agotado' : 'Crítico'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass anim-slide-up" style={{ padding: '1.5rem', animationDelay: '0.2s' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={20} color="hsl(var(--success))" /> Historial de Cierres Diarios
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: 'hsl(var(--text-secondary))', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Fecha</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Ventas ($)</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Compras ($)</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-secondary))' }}>No hay cierres registrados aún</td>
                    </tr>
                  ) : (
                    history.map((h, i) => (
                      <tr 
                        key={i} 
                        style={{ borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--glass-border)', cursor: 'pointer' }} 
                        className="hover-lift"
                        onClick={() => fetchDailyDetails(h.date)}
                      >
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: 'hsl(var(--primary))' }}>{h.date}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'hsl(var(--success))', fontWeight: 'bold' }}>${(h.ventas || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>${(h.compras || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{h.tickets} tickets</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>
              ℹ️ El cierre se procesa automáticamente a las 23:59:59 (GMT-5). <br/> Haz clic en una fecha para ver el detalle.
            </p>
          </div>

        </div>

        {/* Modal Desglose Diario */}
        {showDetailModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} className="anim-fade-in">
            <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', padding: '2rem', position: 'relative', overflowY: 'auto' }}>
              <button onClick={() => setShowDetailModal(false)} className="btn" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', padding: '0.5rem' }}>
                <X size={24} />
              </button>
              
              <h2 style={{ marginBottom: '0.5rem' }}>Detalle de Operaciones</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Fecha: <span style={{ fontWeight: 'bold', color: 'hsl(var(--primary))' }}>{selectedDateDetail?.date}</span></p>

              {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={40} color="hsl(var(--primary))"/></div>
              ) : selectedDateDetail && (
                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 700 ? '1fr' : '1fr 1fr', gap: '2rem' }}>
                  
                  {/* Lado Compras (Abastecimiento) */}
                  <div className="side-purchases">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid hsl(var(--primary) / 0.1)', paddingBottom: '0.5rem' }}>
                      <Package size={20} color="hsl(var(--primary))" /> Compras / Abastecimiento
                    </h3>
                    {selectedDateDetail.purchases.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>No se registraron ingresos este día.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                         {/* Card de Inversión Total */}
                         <div style={{ padding: '0.75rem', background: 'hsl(var(--primary-light))', borderRadius: 'var(--border-radius-sm)', marginBottom: '0.5rem', textAlign: 'center', border: '1px dashed hsl(var(--primary) / 0.3)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>INVERSIÓN TOTAL EN STOCK</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
                              ${selectedDateDetail.purchases.reduce((acc: number, p: any) => acc + (p.quantity * (p.cost_price || 0)), 0).toFixed(2)}
                            </div>
                         </div>
                         
                        {selectedDateDetail.purchases.map((p: any) => (
                          <div key={p._id} style={{ padding: '0.75rem', background: 'hsl(var(--primary-light))', border: '1px solid hsl(var(--primary) / 0.2)', borderRadius: 'var(--border-radius-sm)' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.product_name}</div>
                            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                              <span>Agregado: <span style={{ color: 'hsl(var(--primary))', fontWeight: '600' }}>+{p.quantity}</span></span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{new Date(p.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            {p.notes && <div style={{ fontSize: '0.7rem', marginTop: '0.4rem', borderTop: '1px dashed hsl(var(--primary) / 0.3)', paddingTop: '0.3rem', fontStyle: 'italic' }}>📌 {p.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lado Ventas */}
                  <div className="side-sales">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid hsl(var(--success) / 0.1)', paddingBottom: '0.5rem' }}>
                      <ShoppingCart size={20} color="hsl(var(--success))" /> Ventas del Día
                    </h3>
                    {selectedDateDetail.sales.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Sin ventas registradas.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                         {/* Card de Ingresos Totales */}
                         <div style={{ padding: '0.75rem', background: 'hsl(var(--success) / 0.05)', borderRadius: 'var(--border-radius-sm)', marginBottom: '0.5rem', textAlign: 'center', border: '1px dashed hsl(var(--success) / 0.3)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>INGRESOS TOTALES POR VENTAS</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'hsl(var(--success))' }}>
                              ${selectedDateDetail.sales.reduce((acc: number, s: any) => acc + s.total, 0).toFixed(2)}
                            </div>
                         </div>
                         
                        {selectedDateDetail.sales.map((s: any) => (
                          <div key={s._id} style={{ padding: '0.75rem', background: 'white', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.client_name}</div>
                              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div style={{ fontWeight: 'bold' }}>${s.total.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
