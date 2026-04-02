import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, User, Mail, Phone, ArrowLeft, Loader2, Save, ShoppingBag, FileText, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    dni_ruc: '',
    name: '',
    id_type: '05',
    email: '',
    phone: '',
    address: '',
    city: ''
  });
  const [searching, setSearching] = useState(false);
  
  // History State
  const [historyModal, setHistoryModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchHistory = async (customer: any) => {
    try {
      setSelectedCustomer(customer);
      setHistoryModal(true);
      setHistoryLoading(true);
      const resp = await api.get(`/sales/?client_id=${customer.dni_ruc}`);
      setSalesHistory(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearchDNI = async () => {
    if (!formData.dni_ruc || formData.dni_ruc.length < 10) return;
    try {
      setSearching(true);
      const resp = await api.get(`/customers/search/${formData.dni_ruc}`);
      setFormData({
        ...formData,
        name: resp.data.name,
        id_type: resp.data.id_type || '05',
        address: resp.data.address || formData.address,
        city: resp.data.city || resp.data.address || '', // Fallback si city viene en address
      });
    } catch (err) {
      console.log("No encontrado en catastro");
    } finally {
      setSearching(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = searchTerm ? `/customers/?query=${searchTerm}` : '/customers/';
      const resp = await api.get(url);
      setCustomers(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer._id}`, formData);
      } else {
        await api.post('/customers/', formData);
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al guardar el cliente");
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      dni_ruc: customer.dni_ruc,
      name: customer.name,
      id_type: customer.id_type || '05',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este cliente?")) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      alert("Error al eliminar");
    }
  };

  return (
    <div className="app-container anim-fade-in" style={{ padding: '2rem' }}>
      <header className="glass header-responsive" style={{ padding: '0.75rem 1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <User size={24} color="hsl(var(--primary))" />
          <h1 style={{ margin: 0, fontSize: '1.25rem', whiteSpace: 'nowrap' }}>Gestión de Clientes (CRM)</h1>
        </div>

        <button onClick={() => navigate('/')} className="btn glass hover-lift" style={{ color: 'hsl(var(--primary))', padding: '0.4rem 0.8rem', fontSize: '0.9rem', border: '1px solid hsl(var(--primary) / 0.1)' }}>
           <ArrowLeft size={16} /> <span>Menú</span>
        </button>
        
        <div style={{ flexGrow: 1 }} className="hide-mobile"></div>

        <button onClick={() => { setEditingCustomer(null); setFormData({ dni_ruc: '', name: '', id_type: '05', email: '', phone: '', address: '', city: '' }); setShowModal(true); }} className="btn btn-primary hover-lift" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </header>

      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '100%' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} size={20} />
          <input 
            className="glass-input" 
            placeholder="Buscar por DNI o Nombre..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '3rem' }}
          />
        </div>
      </section>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={40} /></div>
      ) : (
        <div className="glass" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="kardex-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--glass-border)' }}>
                <th style={{ padding: '1.25rem' }}>Identificación</th>
                <th style={{ padding: '1.25rem' }}>Cliente / Razón Social</th>
                <th style={{ padding: '1.25rem' }}>Ciudad</th>
                <th style={{ padding: '1.25rem' }}>Contacto</th>
                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c._id} className="hover-row" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{c.dni_ruc}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{c.id_type === '05' ? 'Cédula' : 'RUC'}</div>
                  </td>
                  <td style={{ padding: '1.25rem', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '1.25rem' }}>{c.city || '-'}</td>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {c.email && <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={14} opacity={0.6}/>{c.email}</div>}
                      {c.phone && <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14} opacity={0.6}/>{c.phone}</div>}
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => fetchHistory(c)} className="btn glass hover-lift" title="Historial compras" style={{ padding: '0.5rem', color: 'hsl(var(--success))' }}><ShoppingBag size={18}/></button>
                      <button onClick={() => handleEdit(c)} className="btn glass hover-lift" style={{ padding: '0.5rem', color: 'hsl(var(--primary))' }}><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete(c._id)} className="btn glass hover-lift" style={{ padding: '0.5rem', color: 'hsl(var(--danger))' }}><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron clientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cliente */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass anim-scale-up" style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '2rem' }}>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="grid-responsive-inputs">
                <div className="form-group">
                  <label>Tipo Identificación</label>
                  <select className="glass-input" value={formData.id_type} onChange={e => setFormData({...formData, id_type: e.target.value})}>
                    <option value="05">Cédula</option>
                    <option value="04">RUC</option>
                    <option value="06">Pasaporte</option>
                  </select>
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>DNI / RUC</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      className="glass-input" 
                      value={formData.dni_ruc} 
                      onChange={e => setFormData({...formData, dni_ruc: e.target.value})} 
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchDNI())}
                      required 
                      placeholder="Ej: 17xxxxxxx001" 
                    />
                    <button 
                      type="button" 
                      onClick={handleSearchDNI}
                      disabled={searching}
                      className="btn hover-lift" 
                      style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', padding: '0.4rem', border: 'none', background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Nombre / Razón Social</label>
                  <input className="glass-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Ciudad</label>
                  <input className="glass-input" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Ej: Quito" />
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <input className="glass-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input className="glass-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Dirección Específica</label>
                  <input className="glass-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn glass">Cancelar</button>
                <button type="submit" className="btn btn-primary"><Save size={18} /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {historyModal && (
        <div className="modal-overlay">
          <div className="modal-content glass anim-scale-up" style={{ maxWidth: '800px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Historial de Compras</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: 0 }}>{selectedCustomer?.name} ({selectedCustomer?.dni_ruc})</p>
              </div>
              <button onClick={() => setHistoryModal(false)} className="btn glass"><X size={20}/></button>
            </div>

            {historyLoading ? (
               <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={32}/></div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                 {salesHistory.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>No se registran compras previas.</div>
                 ) : (
                   salesHistory.map(sale => (
                     <div key={sale._id} className="glass" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--primary) / 0.03)' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                           <div style={{ background: 'hsl(var(--primary) / 0.1)', padding: '0.75rem', borderRadius: 'var(--border-radius-md)', color: 'hsl(var(--primary))' }}>
                              <Calendar size={24} />
                           </div>
                           <div>
                              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{new Date(sale.date).toLocaleDateString()}</div>
                              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{new Date(sale.date).toLocaleTimeString()}</div>
                           </div>
                        </div>
                        
                        <div style={{ textAlign: 'center' }}>
                           <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Total Pagado</div>
                           <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'hsl(var(--primary))' }}>${sale.total.toFixed(2)}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                           {sale.pdf_path && (
                             <a href={`http://${window.location.hostname}:8000/${sale.pdf_path}`} target="_blank" rel="noreferrer" className="btn glass" style={{ color: 'hsl(var(--danger))' }}>
                               <FileText size={18}/> PDF
                             </a>
                           )}
                           <button className="btn glass" style={{ fontSize: '0.8rem' }} onClick={() => alert("Función de ver detalles próximamente")}>Ver Recibo</button>
                        </div>
                     </div>
                   ))
                 )}
               </div>
            )}
            
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button onClick={() => setHistoryModal(false)} className="btn btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
