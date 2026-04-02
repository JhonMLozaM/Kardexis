import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function AttendanceWidget() {
  const [status, setStatus] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    try {
      const resp = await api.get('/attendance/my-status');
      setStatus(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'check-in' | 'check-out') => {
    try {
      setLoading(true);
      if (action === 'check-in') {
        const resp = await api.post('/attendance/check-in');
        setStatus({ ...status, status: 'active', check_in: resp.data.time });
      } else {
        await api.patch('/attendance/check-out');
        setStatus({ ...status, status: 'completed' });
      }
      fetchStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return <div className="glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="glass anim-slide-up" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.75rem', background: 'hsl(var(--primary-light))', borderRadius: 'var(--border-radius-sm)', color: 'hsl(var(--primary))' }}>
          <Clock size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sincronización de Tiempo</h3>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
            {currentTime.toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {status?.status === 'not_started' && (
          <button onClick={() => handleAction('check-in')} className="btn btn-primary hover-lift" style={{ display: 'flex', gap: '0.5rem' }}>
            <LogIn size={20} /> Iniciar Jornada
          </button>
        )}

        {status?.status === 'active' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Entrada: <span style={{ color: 'hsl(var(--primary))' }}>{status.check_in}</span></div>
            <button onClick={() => handleAction('check-out')} className="btn hover-lift" style={{ background: 'hsl(var(--danger)/0.1)', color: 'hsl(var(--danger))', display: 'flex', gap: '0.5rem' }}>
              <LogOut size={20} /> Finalizar Jornada
            </button>
          </div>
        )}

        {status?.status === 'completed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--success))', fontWeight: 600 }}>
            <CheckCircle size={20} /> Jornada Completada
          </div>
        )}
      </div>
    </div>
  );
}
