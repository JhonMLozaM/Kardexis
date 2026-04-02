import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Setup payload as form-data explicitly for FastAPI OAuth2PasswordRequestForm
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const resp = await api.post('/users/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = resp.data.access_token;
      
      // Get user details
      const userResp = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAuth(token, userResp.data);
      navigate('/'); // Go to Dashboard
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} className="anim-fade-in">
      <div className="glass" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', background: 'hsl(var(--primary))', padding: '1rem', borderRadius: 'var(--border-radius-md)', color: 'white', marginBottom: '1rem' }}>
            <ScanLine size={40} />
          </div>
          <h1 style={{ fontSize: '2rem' }}>Bienvenido</h1>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>Inicia sesión en Kardexis POS</p>
        </div>

        {error && (
          <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Usuario</label>
            <input 
              type="text" 
              placeholder="Ej. admin" 
              value={username} onChange={(e) => setUsername(e.target.value)} 
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.875rem' }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
          </button>
        </form>
        
      </div>
    </div>
  );
}
