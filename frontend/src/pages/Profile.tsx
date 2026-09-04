import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Smile, Save, Lock, Calendar, ShieldCheck, Camera, Loader2, Palette, Building2, Link, Upload, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';

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

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoMode, setPhotoMode] = useState<'url' | 'upload'>('url');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    email: authUser?.email || '',
    phone: authUser?.phone || '',
    address: authUser?.address || '',
    gender: authUser?.gender || '',
    profile_picture_url: authUser?.profile_picture_url || '',
    date_of_birth: authUser?.date_of_birth || '',
    password: '',
    theme_color: authUser?.theme_color || 'Azul'
  });

  useEffect(() => {
    if (authUser) {
      setFormData({
        email: authUser.email || '',
        phone: authUser.phone || '',
        address: authUser.address || '',
        gender: authUser.gender || '',
        profile_picture_url: authUser.profile_picture_url || '',
        date_of_birth: authUser.date_of_birth || '',
        password: '',
        theme_color: authUser.theme_color || 'Azul'
      });
    }
  }, [authUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setSuccess(false);
      const resp = await api.put('/users/me', formData);
      setUser(resp.data);
      setSuccess(true);
      setFormData(prev => ({ ...prev, password: '' }));
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no debe superar 5MB");
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert("Solo se permiten imagenes JPG, PNG y WEBP");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleAvatarUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append('file', file);
      const resp = await api.post('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(resp.data);
      setFormData(prev => ({ ...prev, profile_picture_url: resp.data.profile_picture_url }));
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert("Error al subir la imagen");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUrlSave = async () => {
    try {
      setLoading(true);
      const resp = await api.put('/users/me', { profile_picture_url: formData.profile_picture_url });
      setUser(resp.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error al actualizar la foto");
    } finally {
      setLoading(false);
    }
  };

  const currentPhoto = previewUrl || formData.profile_picture_url || '';

  const currentHsl = COLOR_MAP[formData.theme_color] || COLOR_MAP["Azul"];

  return (
    <div className="anim-fade-in" style={{ 
      backgroundImage: `linear-gradient(135deg, hsl(${currentHsl} / 0.05) 0%, transparent 100%)`, 
      minHeight: '100vh' 
    }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Preferencias de Usuario</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }} className="grid-responsive-profile">
        {/* Lado Izquierdo: Resumen y Foto */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass" style={{ padding: '2rem', textAlign: 'center', position: 'relative', borderTop: `4px solid hsl(${currentHsl})` }}>
             <div style={{ 
               width: '120px', 
               height: '120px', 
               borderRadius: '50%', 
                backgroundColor: currentPhoto ? 'transparent' : `hsl(${currentHsl})`, 
               margin: '0 auto 1.5rem',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               fontSize: '3rem',
               fontWeight: 900,
               color: ['Blanco', 'Amarillo', 'Rosa', 'Gris'].includes(formData.theme_color) ? 'black' : 'white', 
               border: `4px solid white`,
               boxShadow: 'var(--shadow-lg)',
               overflow: 'hidden'
             }}>
               {currentPhoto ? (
                 <img src={currentPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               ) : (
                 authUser?.full_name.charAt(0)
               )}
             </div>
             <h2 style={{ margin: 0 }}>{authUser?.full_name}</h2>
             <span style={{ 
               padding: '4px 12px', 
                backgroundColor: `hsl(${currentHsl} / 0.1)`, 
               color: `hsl(${currentHsl})`, 
               borderRadius: '12px', 
               fontSize: '0.8rem',
               fontWeight: 600,
               display: 'inline-block',
               marginTop: '0.5rem'
             }}>
               {authUser?.role}
             </span>
             
             <div style={{ marginTop: '2rem', textAlign: 'left', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'hsl(var(--text-secondary))' }}>
                   <ShieldCheck size={18} />
                   <span>DNI: {authUser?.dni || 'Sin info'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                   <User size={18} />
                   <span>Usuario: @{authUser?.username}</span>
                </div>
             </div>
          </div>
          <div className="glass" style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>
            ID Sistema: {authUser?.id}
          </div>

          {authUser?.role === 'ADMIN' && (
            <div className="glass anim-fade-in" style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed hsl(var(--primary) / 0.5)', backgroundColor: 'hsl(var(--primary) / 0.02)' }}>
               <Building2 size={32} style={{ marginBottom: '1rem', color: 'hsl(var(--primary))' }} />
               <h4 style={{ margin: '0 0 0.5rem' }}>Gestión de Empresa</h4>
               <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
                  Configura los datos legales, RUC y parámetros de facturación para tu negocio.
               </p>
               <button 
                  onClick={() => navigate('/empresa')}
                  className="btn glass hover-lift" 
                  style={{ width: '100%', color: 'hsl(var(--primary))', fontWeight: 'bold' }}
               >
                  Configurar Negocio
               </button>
            </div>
          )}
        </aside>

        {/* Lado Derecho: Formulario de Edición */}
        <div className="glass" style={{ padding: '2rem' }}>
          <form onSubmit={handleSave}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Edit2Icon size={20} /> Información Personal
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="grid-responsive-inputs">
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><Palette size={16} /> Color Temático</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {Object.entries(COLOR_MAP).map(([name, hsl]) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setFormData({ ...formData, theme_color: name })}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: `hsl(${hsl})`,
                        border: formData.theme_color === name ? '2px solid white' : '2px solid transparent',
                        boxShadow: formData.theme_color === name ? '0 0 0 2px hsl(var(--primary))' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={16} /> Correo Electrónico</label>
                <input 
                  className="glass-input" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="ejemplo@kardexis.com"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={16} /> Teléfono (WhatsApp)</label>
                <input 
                  className="glass-input" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+593 ..."
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Smile size={16} /> Género</label>
                <select 
                  className="glass-input" 
                  value={formData.gender} 
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><Camera size={16} /> Foto de Perfil</label>
                
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('url')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.8rem', borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid', borderColor: photoMode === 'url' ? 'hsl(var(--primary))' : 'var(--glass-border)',
                      backgroundColor: photoMode === 'url' ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                      color: photoMode === 'url' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
                    }}
                  >
                    <Link size={14} /> Desde URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('upload')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.8rem', borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid', borderColor: photoMode === 'upload' ? 'hsl(var(--primary))' : 'var(--glass-border)',
                      backgroundColor: photoMode === 'upload' ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                      color: photoMode === 'upload' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
                    }}
                  >
                    <Upload size={14} /> Subir Archivo
                  </button>
                </div>

                {photoMode === 'url' ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      className="glass-input" 
                      style={{ flex: 1 }}
                      value={formData.profile_picture_url} 
                      onChange={(e) => setFormData({...formData, profile_picture_url: e.target.value})}
                      placeholder="https://ejemplo.com/foto.jpg"
                    />
                    <button type="button" onClick={handleUrlSave} disabled={loading} className="btn btn-primary" style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap' }}>
                      {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn glass"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'hsl(var(--primary))' }}
                      >
                        <Upload size={16} /> Seleccionar imagen
                      </button>
                      {previewUrl && (
                        <button type="button" onClick={handleAvatarUpload} disabled={uploadingAvatar} className="btn btn-primary" style={{ display: 'flex', gap: '0.4rem' }}>
                          {uploadingAvatar ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar
                        </button>
                      )}
                    </div>
                    {previewUrl && (
                      <div style={{ marginTop: '0.75rem', position: 'relative', display: 'inline-block' }}>
                        <img src={previewUrl} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--glass-border)' }} />
                        <button
                          type="button"
                          onClick={() => { setPreviewUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'hsl(var(--danger))', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} /> Fecha de Nacimiento</label>
                <input 
                  type="date"
                  className="glass-input" 
                  value={formData.date_of_birth} 
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={16} /> Dirección Domiciliaria</label>
                <input 
                  className="glass-input" 
                  value={formData.address} 
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px dotted var(--glass-border)' }}>
               <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={20} /> Seguridad
               </h3>
               <div className="form-group" style={{ maxWidth: '400px' }}>
                  <label>Nueva Contraseña</label>
                  <input 
                    type="password"
                    className="glass-input" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Dejar vacío para no cambiar"
                  />
               </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem' }}>
              {success && <span style={{ color: 'hsl(var(--success))', fontWeight: 600 }} className="anim-fade-in">¡Perfil actualizado correctamente!</span>}
              <button disabled={loading} type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '1rem 2.5rem' }}>
                {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .grid-responsive-profile { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .grid-responsive-inputs { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// Icono auxiliar no importado
function Edit2Icon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
  );
}
