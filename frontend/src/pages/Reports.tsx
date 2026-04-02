import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, AlertTriangle, DollarSign, ArrowLeft, Loader2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumResp, chartResp] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/sales-chart')
      ]);
      setSummary(sumResp.data);
      setChartData(chartResp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="hsl(var(--primary))" />
      </div>
    );
  }

  return (
    <div className="app-container anim-fade-in" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} className="btn glass hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid hsl(var(--primary-light))', color: 'hsl(var(--primary))' }}>
            <ArrowLeft size={18} /> <span>Menú</span>
          </button>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Inteligencia de Negocio</h1>
        </div>
        <button onClick={() => window.print()} className="btn glass hover-lift" style={{ display: 'flex', gap: '0.5rem' }}>
          <Download size={18} /> Exportar Reporte
        </button>
      </header>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>Ventas de Hoy</span>
            <DollarSign size={20} color="hsl(var(--primary))" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>${summary?.today_revenue.toFixed(2)}</div>
          <div style={{ fontSize: '0.875rem', color: 'hsl(var(--success))', marginTop: '0.5rem' }}>
            {summary?.today_count} transacciones realizadas
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>Estado de Stock</span>
            <AlertTriangle size={20} color="hsl(var(--danger))" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary?.low_stock_count}</div>
          <div style={{ fontSize: '0.875rem', color: 'hsl(var(--danger))', marginTop: '0.5rem' }}>
            Productos con stock crítico
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>Total Productos</span>
            <Package size={20} color="hsl(var(--secondary))" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary?.total_products}</div>
          <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', marginTop: '0.5rem' }}>
            En catálogo activo
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        {/* Sales Chart */}
        <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} /> Tendencia de Ventas (Últimos 7 días)
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--glass-border))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--text-secondary))', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Top 5 Productos más Vendidos</h3>
          <div style={{ display: 'flex', height: '85%' }}>
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={summary?.top_products}
                  dataKey="quantity"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={60}
                  paddingAngle={5}
                >
                  {summary?.top_products.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
              {summary?.top_products.map((p: any, index: number) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></div>
                  <div style={{ flex: 1, fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600 }}>{p._id}</div>
                    <div style={{ color: 'hsl(var(--text-secondary))' }}>{p.quantity.toFixed(0)} unidades sold</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
