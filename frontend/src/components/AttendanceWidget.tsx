import { useState, useEffect, useRef } from 'react';
import { Clock, LogIn, LogOut, CheckCircle, Loader2, Camera, MapPin } from 'lucide-react';
import { api } from '../services/api';

export default function AttendanceWidget() {
  const [status, setStatus] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      stopCamera();
    };
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

  const getGps = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.6);
    }
    return null;
  };

  const handleStartCameraAndAction = async (action: 'check-in' | 'check-out') => {
    // Primero intentar obtener GPS
    const gps = await getGps();
    setGpsLocation(gps);

    // Intentar abrir camara
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch {
      // Si no hay camara, solo registrar con GPS
      setActionLoading(true);
      try {
        const payload = { lat: gps?.lat || null, lng: gps?.lng || null, photo_url: null };
        if (action === 'check-in') {
          await api.post('/attendance/check-in', payload);
        } else {
          await api.patch('/attendance/check-out', payload);
        }
        fetchStatus();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Error al registrar');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const confirmWithPhoto = async (action: 'check-in' | 'check-out') => {
    setActionLoading(true);
    try {
      const photoUrl = capturePhoto();
      const payload = {
        lat: gpsLocation?.lat || null,
        lng: gpsLocation?.lng || null,
        photo_url: photoUrl || null,
      };
      if (action === 'check-in') {
        await api.post('/attendance/check-in', payload);
      } else {
        await api.patch('/attendance/check-out', payload);
      }
      stopCamera();
      fetchStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al registrar');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !status) {
    return <div className="glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="glass anim-slide-up" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', background: 'hsl(var(--primary-light))', borderRadius: 'var(--border-radius-sm)', color: 'hsl(var(--primary))' }}>
            <Clock size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sincronizacion de Tiempo</h3>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
              {currentTime.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {gpsLocation && (
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <MapPin size={12} /> GPS OK
            </span>
          )}

          {status?.status === 'not_started' && (
            <button onClick={() => handleStartCameraAndAction('check-in')} className="btn btn-primary hover-lift" style={{ display: 'flex', gap: '0.5rem' }} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />} Iniciar Jornada
            </button>
          )}

          {status?.status === 'active' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Entrada: <span style={{ color: 'hsl(var(--primary))' }}>{status.check_in}</span></div>
              <button onClick={() => handleStartCameraAndAction('check-out')} className="btn hover-lift" style={{ background: 'hsl(var(--danger)/0.1)', color: 'hsl(var(--danger))', display: 'flex', gap: '0.5rem' }} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <LogOut size={18} />} Finalizar
              </button>
            </div>
          )}

          {status?.status === 'completed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--success))', fontWeight: 600 }}>
              <CheckCircle size={18} /> Jornada Completada
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Camera size={14} /> Foto de verificacion</span>
            <button onClick={stopCamera} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--danger))' }}>Cancelar</button>
          </div>
          <div style={{ position: 'relative', maxWidth: '320px', borderRadius: '8px', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '8px' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <button
            onClick={() => confirmWithPhoto(status?.status === 'not_started' ? 'check-in' : 'check-out')}
            className="btn btn-primary"
            style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
            Tomar foto y registrar
          </button>
        </div>
      )}
    </div>
  );
}
