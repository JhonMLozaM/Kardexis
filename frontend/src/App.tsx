import React from 'react';
import { Package, BarChart3, Users, Settings, Plus, ScanLine, ShoppingCart } from 'lucide-react';

function App() {
  return (
    <div className="app-container anim-fade-in">
      <header className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'hsl(var(--primary))', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', color: 'white' }}>
            <ScanLine size={28} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'hsl(var(--primary))' }}>Kardexis</h1>
        </div>
        
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn glass hover-lift" style={{ color: 'hsl(var(--text-secondary))' }}>
            <Users size={18} /> Clientes
          </button>
          <button className="btn glass hover-lift" style={{ color: 'hsl(var(--text-secondary))' }}>
            <Settings size={18} /> Ajustes
          </button>
          <div style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.5rem' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'hsl(var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>
              A
            </div>
            <span style={{ fontWeight: 500 }}>Admin</span>
          </div>
        </nav>
      </header>

      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Resumen del Día</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary hover-lift">
              <ShoppingCart size={18} /> Nueva Venta (POS)
            </button>
            <button className="btn glass hover-lift" style={{ color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary))' }}>
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
        </div>

        <div className="grid-dashboard anim-slide-up" style={{ marginBottom: '2rem' }}>
          {/* Card 1 */}
          <div className="glass hover-lift" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Ventas Totales</h3>
              <BarChart3 size={20} color="hsl(var(--primary))" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>$1,240.50</p>
            <p style={{ color: 'hsl(var(--success))', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
              +15% respecto a ayer
            </p>
          </div>
          
          {/* Card 2 */}
          <div className="glass hover-lift" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Inventario Bajo</h3>
              <Package size={20} color="hsl(var(--warning))" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>4</p>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Productos requieren reabastecimiento
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass hover-lift" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', margin: 0 }}>Movimientos Kardex</h3>
              <Settings size={20} color="hsl(var(--text-secondary))" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>142</p>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Transacciones hoy
            </p>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="glass anim-slide-up" style={{ padding: '1.5rem', animationDelay: '0.1s' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Últimas Alertas de Inventario</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { id: 1, name: 'Harina (Quintal)', status: 'Agotado', qty: 0, alert: 5, color: 'var(--danger)' },
              { id: 2, name: 'Azúcar (Libra)', status: 'Bajo stock', qty: 12, alert: 20, color: 'var(--warning)' },
              { id: 3, name: 'Arroz (Quintal)', status: 'Bajo stock', qty: 3, alert: 5, color: 'var(--warning)' },
            ].map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: 'var(--border-radius-sm)', background: 'var(--surface-color)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--border-radius-sm)', background: 'hsl(var(--bg-color))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} color={`hsl(${item.color})`} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>{item.name}</h4>
                    <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>Alerta al llegar a {item.alert}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '1.125rem' }}>Stock: {item.qty}</p>
                  <span style={{ color: `hsl(${item.color})`, fontSize: '0.875rem', fontWeight: 500 }}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
