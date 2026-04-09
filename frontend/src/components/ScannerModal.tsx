import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, SwitchCamera, Loader2 } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
}

export default function ScannerModal({ isOpen, onClose, onScan, title = 'Escanear Código' }: ScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [starting, setStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const containerId = 'kardexis-scanner-container';

  useEffect(() => {
    if (isOpen) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode]);

  const startScanner = async () => {
    setCameraError('');
    setStarting(true);

    // Esperar a que el DOM renderice el contenedor
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Vibrar el dispositivo si el navegador lo soporta
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // Ignorar errores de escaneo continuo (no se encontró código en el frame)
        }
      );
    } catch (err: any) {
      console.error('Error al iniciar la cámara:', err);
      setCameraError(
        typeof err === 'string'
          ? err
          : 'No se pudo acceder a la cámara. Verifica los permisos del navegador.'
      );
    } finally {
      setStarting(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // Solo detener si está escaneando (estado 2 = SCANNING)
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        // Ignorar errores al detener
      }
      scannerRef.current = null;
    }
  };

  const toggleCamera = async () => {
    await stopScanner();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      className="anim-fade-in"
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '1.5rem',
          position: 'relative',
          borderRadius: 'var(--border-radius-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={22} color="hsl(var(--primary))" />
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="btn"
            style={{ background: 'transparent', padding: '0.4rem' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: 'var(--border-radius-md)',
            overflow: 'hidden',
            position: 'relative',
            background: '#000',
            marginBottom: '1rem',
          }}
        >
          <div id={containerId} style={{ width: '100%', height: '100%' }} />

          {starting && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                gap: '1rem',
              }}
            >
              <Loader2 className="animate-spin" size={40} />
              <span style={{ fontSize: '0.9rem' }}>Activando cámara...</span>
            </div>
          )}
        </div>

        {/* Error */}
        {cameraError && (
          <div
            style={{
              background: 'hsl(var(--danger) / 0.1)',
              color: 'hsl(var(--danger))',
              padding: '0.75rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.8rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {cameraError}
          </div>
        )}

        {/* Controles */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={toggleCamera}
            className="btn glass hover-lift"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              color: 'hsl(var(--primary))',
            }}
          >
            <SwitchCamera size={18} />
            {facingMode === 'environment' ? 'Cámara Frontal' : 'Cámara Trasera'}
          </button>

          <button
            onClick={handleClose}
            className="btn glass hover-lift"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              color: 'hsl(var(--danger))',
            }}
          >
            <X size={18} />
            Cancelar
          </button>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'hsl(var(--text-secondary))',
            marginTop: '0.75rem',
            marginBottom: 0,
          }}
        >
          Apunta la cámara al código de barras o QR del producto
        </p>
      </div>
    </div>
  );
}
