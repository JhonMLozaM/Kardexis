import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, X, Send, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface StockAlert {
  id: string;
  name: string;
  barcode?: string;
  stock: number;
  min_stock_alert: number;
  status: 'out_of_stock' | 'critical' | 'low';
  urgency: 'high' | 'medium' | 'low';
}

interface StockAlertResponse {
  count: number;
  alerts: StockAlert[];
  out_of_stock_count: number;
  critical_count: number;
  low_count: number;
}

export default function StockAlertBadge() {
  const [alertData, setAlertData] = useState<StockAlertResponse | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [sending, setSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Cada minuto
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const resp = await api.get('/alerts/stock-alerts');
      setAlertData(resp.data);
      
      // Mostrar toast si hay productos criticos o agotados
      if (resp.data.out_of_stock_count > 0 || resp.data.critical_count > 0) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } catch {
      // Silenciar errores
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const resp = await api.post('/alerts/send-stock-alert');
      setToastMessage(resp.data.message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      setToastMessage(err.response?.data?.detail || 'Error al enviar email');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSending(false);
    }
  };

  if (!alertData || alertData.count === 0) return null;

  const bgColor = alertData.out_of_stock_count > 0 
    ? 'hsl(var(--danger))' 
    : alertData.critical_count > 0 
      ? 'hsl(var(--warning))' 
      : 'hsl(var(--warning))';

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast notification */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          background: toastMessage ? 'hsl(var(--success))' : bgColor,
          color: 'white', fontSize: '0.85rem', fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          maxWidth: '350px',
        }}>
          <AlertTriangle size={16} />
          {toastMessage || `${alertData.out_of_stock_count + alertData.critical_count} productos necesitan atención urgente`}
        </div>
      )}

      {/* Badge button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          padding: '0.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'hsl(var(--text-secondary))',
        }}
        title="Alertas de stock"
      >
        <Bell size={20} />
        <span style={{
          position: 'absolute', top: 0, right: 0,
          background: bgColor,
          color: 'white',
          fontSize: '0.65rem',
          fontWeight: 'bold',
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {alertData.count}
        </span>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: '320px',
          background: 'var(--bg-color)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: '400px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Alertas de Stock ({alertData.count})
            </div>
            <button onClick={() => setShowDropdown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Stats */}
          <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
            {alertData.out_of_stock_count > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--danger))', fontWeight: 600 }}>
                {alertData.out_of_stock_count} Agotados
              </span>
            )}
            {alertData.critical_count > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--warning))', fontWeight: 600 }}>
                {alertData.critical_count} Críticos
              </span>
            )}
            {alertData.low_count > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                {alertData.low_count} Bajos
              </span>
            )}
          </div>

          {/* Alert list */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {alertData.alerts.slice(0, 10).map(alert => (
              <div key={alert.id} style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{alert.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                    Mínimo: {alert.min_stock_alert}
                  </div>
                </div>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: alert.stock === 0 ? 'hsl(var(--danger) / 0.1)' : alert.stock <= 2 ? 'hsl(var(--warning) / 0.1)' : 'hsl(var(--primary) / 0.1)',
                  color: alert.stock === 0 ? 'hsl(var(--danger))' : alert.stock <= 2 ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                }}>
                  Stock: {alert.stock}
                </span>
              </div>
            ))}
          </div>

          {/* Send email button */}
          <div style={{ padding: '0.75rem 1rem' }}>
            <button
              onClick={handleSendEmail}
              disabled={sending}
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'hsl(var(--primary))',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar Alerta por Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
