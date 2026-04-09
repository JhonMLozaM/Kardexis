import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Save, ArrowLeft, Loader2, Globe, Phone, Mail, FileText, Settings2, ShieldCheck, MapPin, Camera, UploadCloud, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function BusinessSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    establishment: '001',
    emission_point: '001',
    is_required_to_keep_accounting: false,
    special_taxpayer_code: '',
    logo_url: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const fetchBusinessData = async () => {
    try {
      setFetching(true);
      const resp = await api.get('/business/me');
      if (resp.data) {
        setFormData(resp.data);
        if (resp.data.logo_url) {
          setLogoPreview(resp.data.logo_url);
        }
      }
    } catch (err) {
      console.error("Error al cargar datos de empresa", err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put('/business/me', formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert("Solo se permiten imágenes JPG y PNG");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    try {
      setUploadingLogo(true);
      const fd = new FormData();
      fd.append('file', logoFile);
      const resp = await api.post('/business/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, logo_url: resp.data.logo_url }));
      alert("¡Logo actualizado correctamente! 🎨✅");
      setLogoFile(null);
    } catch (err) {
      alert("Error al subir el logo. Asegúrate de haber guardado los datos de la empresa primero.");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>No tienes permisos para acceder a esta configuración.</p>
      </div>
    );
  }

  return (
    <div className="app-container anim-fade-in" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/')} className="btn glass hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--primary))' }}>
          <ArrowLeft size={18} /> Menú
        </button>
        <h1 style={{ margin: 0 }}>Configuración de Empresa</h1>
      </header>

      {fetching ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={48} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '2rem', maxWidth: '1100px', margin: '0 auto' }} className="grid-responsive-business">
          
          {/* Lado Izquierdo: Logotipo */}
          <aside className="glass" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <h3 style={{ margin: 0, fontSize: '1rem' }}>Logotipo Comercial</h3>
             <div style={{ 
               width: '100%', 
               aspectRatio: '1', 
               background: 'var(--glass-bg)', 
               borderRadius: 'var(--border-radius-md)',
               border: '2px dashed var(--glass-border)',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               position: 'relative',
               overflow: 'hidden'
             }}>
                {logoPreview ? (
                   <img src={logoPreview.startsWith('blob') ? logoPreview : `${api.defaults.baseURL?.replace('/api/v1', '')}${logoPreview}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '1rem' }} />
                ) : (
                   <div style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>
                      <UploadCloud size={48} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                      <p style={{ fontSize: '0.75rem', margin: 0 }}>PNG o JPG</p>
                   </div>
                )}
                <input 
                  type="file" 
                  accept="image/jpeg,image/png" 
                  onChange={handleLogoChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
             </div>
             {logoFile && (
               <button 
                  type="button" 
                  onClick={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="btn btn-primary" 
                  style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                >
                  {uploadingLogo ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 
                  Confirmar Logo
               </button>
             )}
             <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))' }}>
               El logo se usará en facturas PDF y reportes.
             </p>
          </aside>

          <div className="glass" style={{ padding: '2.5rem' }}>
            <form onSubmit={handleSave}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                <Building2 size={32} color="hsl(var(--primary))" />
                <div>
                   <h2 style={{ margin: 0 }}>Datos Legales y Facturación</h2>
                   <p style={{ margin: 0, color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Esta información aparecerá en tus facturas y comprobantes legales.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-responsive-inputs">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label><Building2 size={16} /> Razón Social (Nombre Legal)</label>
                <input 
                  className="glass-input" 
                  value={formData.legal_name} 
                  onChange={e => setFormData({...formData, legal_name: e.target.value})}
                  placeholder="Ej: KARDEXIS SOLUCIONES TECNOLOGICAS S.A."
                  required
                />
              </div>

              <div className="form-group">
                <label><Globe size={16} /> Nombre Comercial</label>
                <input 
                  className="glass-input" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Kardexis"
                  required
                />
              </div>

              <div className="form-group">
                <label><ShieldCheck size={16} /> RUC / Identificación</label>
                <input 
                  className="glass-input" 
                  value={formData.ruc} 
                  onChange={e => setFormData({...formData, ruc: e.target.value})}
                  placeholder="17xxxxxxxx001"
                  required
                />
              </div>

              <div className="form-group">
                <label><Phone size={16} /> Teléfono de Contacto</label>
                <input 
                  className="glass-input" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label><Mail size={16} /> Correo Electrónico Facturación</label>
                <input 
                  type="email"
                  className="glass-input" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label><MapPin size={16} /> Dirección de la Matriz/Establecimiento</label>
                <input 
                  className="glass-input" 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Calle ... y Ave. ..."
                  required
                />
              </div>

              <div style={{ gridColumn: 'span 2', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dotted var(--glass-border)' }}>
                 <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Settings2 size={20} /> Parámetros SRI
                 </h3>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Establecimiento</label>
                        <input className="glass-input" value={formData.establishment} onChange={e => setFormData({...formData, establishment: e.target.value})} maxLength={3} />
                    </div>
                    <div className="form-group">
                        <label>Punto de Emisión</label>
                        <input className="glass-input" value={formData.emission_point} onChange={e => setFormData({...formData, emission_point: e.target.value})} maxLength={3} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.is_required_to_keep_accounting} 
                          onChange={e => setFormData({...formData, is_required_to_keep_accounting: e.target.checked})}
                          id="chk-accounting"
                        />
                        <label htmlFor="chk-accounting" style={{ marginBottom: 0 }}>¿Obligado a llevar contabilidad?</label>
                    </div>
                 </div>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem' }}>
               {success && <span style={{ color: 'hsl(var(--success))', fontWeight: 600 }}>Configuración guardada 🏢✅</span>}
               <button disabled={loading} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '1rem 2rem' }}>
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Guardar Datos de Empresa
               </button>
            </div>
          </form>
        </div>
      </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .grid-responsive-business { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
