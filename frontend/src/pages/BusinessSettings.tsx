import { useState, useEffect, useMemo } from 'react';
import { Building2, Save, Loader2, Globe, Phone, Mail, Settings2, ShieldCheck, MapPin, UploadCloud, Eye } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import SubscriptionSection from '../components/SubscriptionSection';

export default function BusinessSettings() {
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
    logo_url: '',
    sri_enabled: false,
    sri_ambiente: '1',
    sri_tipo_emision: '1',
    sri_contribuyente_especial: '',
    sri_agente_retencion: '',
    sri_regimen: 'GENERAL',
    email_template: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const previewHtml = useMemo(() => {
    const logoUrl = formData.logo_url
      ? (formData.logo_url.startsWith('blob') || formData.logo_url.startsWith('http')
          ? formData.logo_url
          : `${api.defaults.baseURL?.replace('/api/v1', '')}${formData.logo_url}`)
      : '';

    const defaultTemplate = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
.header { background: linear-gradient(135deg, #0052cc, #0747a6); padding: 20px; border-radius: 8px; color: white; text-align: center; }
.header h1 { margin: 0; font-size: 24px; }
.header img { max-width: 150px; max-height: 80px; margin-bottom: 10px; border-radius: 4px; }
.content { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 20px; }
.total { font-size: 20px; font-weight: bold; color: #0052cc; text-align: center; padding: 15px; background: #eff6ff; border-radius: 8px; margin-top: 15px; }
</style></head>
<body>
<div class="header">{logoUrl ? '<img src="' + logoUrl + '" alt="Logo">' : ''}<h1>{{ business_name }}</h1><p>RUC: {{ business_ruc }}</p></div>
<div class="content">
<p><strong>Cliente:</strong> {{ client_name }}</p>
<p><strong>Cedula/RUC:</strong> {{ client_id }}</p>
<p><strong>Fecha:</strong> {{ sale_date }}</p>
<p><strong>Clave Acceso:</strong> {{ clave_acceso }}</p>
<div class="total">TOTAL: \${{ "%.2f"|format(total) }}</div>
</div></body></html>`;

    const template = formData.email_template || defaultTemplate;
    try {
      let rendered = template
        .replace(/\{\{\s*business_name\s*\}\}/g, formData.name || 'Mi Empresa')
        .replace(/\{\{\s*business_ruc\s*\}\}/g, formData.ruc || '0000000000000')
        .replace(/\{\{\s*client_name\s*\}\}/g, 'Juan Perez')
        .replace(/\{\{\s*client_id\s*\}\}/g, '1712345678')
        .replace(/\{\{\s*total\s*\}\}/g, '45.50')
        .replace(/\{\{\s*clave_acceso\s*\}\}/g, '2908202601179008585400110010010879852525099200311')
        .replace(/\{\{\s*sale_date\s*\}\}/g, '29/08/2026 12:30')
        .replace(/\{\{\s*business_address\s*\}\}/g, formData.address || 'Direccion')
        .replace(/\{\{\s*business_phone\s*\}\}/g, formData.phone || '0999999999')
        .replace(/\{\{\s*business_email\s*\}\}/g, formData.email || 'correo@empresa.com');

      // Reemplazar business_logo si existe en el template
      if (logoUrl) {
        rendered = rendered.replace(/\{\{\s*business_logo\s*\}\}/g, logoUrl);
        // Si el template tiene un bloque if business_logo, mostrarlo
        rendered = rendered.replace(/\{%\s*if\s+business_logo\s*%\}.*?\{%\s*endif\s*%\}/gs, `<img src="${logoUrl}" alt="Logo">`);
      } else {
        rendered = rendered.replace(/\{\{\s*business_logo\s*\}\}/g, '');
        rendered = rendered.replace(/\{%\s*if\s+business_logo\s*%\}.*?\{%\s*endif\s*%\}/gs, '');
      }

      return rendered;
    } catch {
      return '<p style="color:red">Error en la plantilla HTML</p>';
    }
  }, [formData.email_template, formData.name, formData.ruc, formData.address, formData.phone, formData.email, formData.logo_url]);

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>No tienes permisos para acceder a esta configuración.</p>
      </div>
    );
  }

  return (
    <div className="anim-fade-in">
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Configuración de Empresa</h1>

      <SubscriptionSection />

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
                     <Settings2 size={20} /> Parametros SRI
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                     <div className="form-group">
                         <label>Establecimiento</label>
                         <input className="glass-input" value={formData.establishment} onChange={e => setFormData({...formData, establishment: e.target.value})} maxLength={3} />
                     </div>
                     <div className="form-group">
                         <label>Punto de Emision</label>
                         <input className="glass-input" value={formData.emission_point} onChange={e => setFormData({...formData, emission_point: e.target.value})} maxLength={3} />
                     </div>
                     <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <input 
                           type="checkbox" 
                           checked={formData.is_required_to_keep_accounting} 
                           onChange={e => setFormData({...formData, is_required_to_keep_accounting: e.target.checked})}
                           id="chk-accounting"
                         />
                         <label htmlFor="chk-accounting" style={{ marginBottom: 0 }}>Obligado a llevar contabilidad?</label>
                     </div>
                  </div>
               </div>

               {/* SRI Electronico */}
               <div style={{ gridColumn: 'span 2', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dotted var(--glass-border)' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                     <ShieldCheck size={20} /> Facturacion Electronica SRI
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
                     Habilita la facturacion electronica ante el SRI. Si no lo habilitas, solo se generara un PDF local sin validez tributaria.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                     <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <input 
                           type="checkbox" 
                           checked={formData.sri_enabled} 
                           onChange={e => setFormData({...formData, sri_enabled: e.target.checked})}
                           id="chk-sri"
                         />
                         <label htmlFor="chk-sri" style={{ marginBottom: 0, fontWeight: 600 }}>Habilitar SRI Electronico</label>
                     </div>
                     {formData.sri_enabled && (
                         <>
                           <div className="form-group">
                               <label>Ambiente SRI</label>
                               <select 
                                 className="glass-input" 
                                 value={formData.sri_ambiente} 
                                 onChange={e => setFormData({...formData, sri_ambiente: e.target.value})}
                               >
                                   <option value="1">Pruebas (Desarrollo)</option>
                                   <option value="2">Produccion (Oficial)</option>
                               </select>
                           </div>
                           <div className="form-group">
                               <label>Tipo de Emision</label>
                               <select 
                                 className="glass-input" 
                                 value={formData.sri_tipo_emision} 
                                 onChange={e => setFormData({...formData, sri_tipo_emision: e.target.value})}
                               >
                                   <option value="1">Normal</option>
                                   <option value="2">Contingencia</option>
                               </select>
                           </div>
                           <div className="form-group">
                               <label>Regimen Tributario</label>
                               <select 
                                 className="glass-input" 
                                 value={formData.sri_regimen} 
                                 onChange={e => setFormData({...formData, sri_regimen: e.target.value})}
                               >
                                   <option value="GENERAL">General</option>
                                   <option value="RIMPE">RIMPE (Emprendedor)</option>
                                   <option value="ESPECIAL">Contribuyente Especial</option>
                               </select>
                           </div>
                           <div className="form-group">
                               <label>Codigo Contribuyente Especial</label>
                               <input 
                                 className="glass-input" 
                                 value={formData.sri_contribuyente_especial} 
                                 onChange={e => setFormData({...formData, sri_contribuyente_especial: e.target.value})}
                                 placeholder="Opcional"
                               />
                           </div>
                           <div className="form-group">
                               <label>Agente de Retencion</label>
                               <input 
                                 className="glass-input" 
                                 value={formData.sri_agente_retencion} 
                                 onChange={e => setFormData({...formData, sri_agente_retencion: e.target.value})}
                                 placeholder="Opcional"
                               />
                           </div>
                         </>
                     )}
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
      
      {/* Seccion de Plantilla de Correo - Completa */}
      <div className="glass" style={{ padding: '2rem', marginTop: '2rem', maxWidth: '1100px', margin: '2rem auto 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
           <Mail size={28} color="hsl(var(--primary))" />
           <div>
              <h2 style={{ margin: 0 }}>Plantilla de Correo Electronico</h2>
              <p style={{ margin: 0, color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
                 Personaliza el correo que se envia a tus clientes con sus facturas.
              </p>
           </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
           Variables disponibles: {'{{ business_name }}'}, {'{{ client_name }}'}, {'{{ total }}'}, {'{{ clave_acceso }}'}, {'{{ sale_date }}'}, {'{{ client_id }}'}, {'{{ items }}'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-responsive-preview">
           {/* Editor HTML */}
           <div className="form-group">
              <label>Plantilla HTML</label>
              <textarea
                value={formData.email_template}
                onChange={e => setFormData({...formData, email_template: e.target.value})}
                placeholder="Deja vacio para usar la plantilla por defecto..."
                rows={20}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '1rem',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'var(--bg-color)',
                  color: 'hsl(var(--text))',
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
              <button
                type="button"
                onClick={() => setFormData({...formData, email_template: ''})}
                className="btn glass"
                style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
              >
                Restaurar Plantilla por Defecto
              </button>
           </div>

           {/* Vista Previa */}
           <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                 <Eye size={16} /> Vista Previa
              </label>
              <div
                style={{
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  overflow: 'hidden',
                  minHeight: '400px',
                  background: '#fff',
                }}
              >
                 <iframe
                   srcDoc={previewHtml}
                   style={{ width: '100%', height: '450px', border: 'none' }}
                   title="Vista previa del correo"
                 />
              </div>
           </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .grid-responsive-business { grid-template-columns: 1fr !important; }
          .grid-responsive-preview { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
