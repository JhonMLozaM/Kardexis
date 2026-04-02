import { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const DAYS = [
  { id: 'monday', name: 'Lunes' },
  { id: 'tuesday', name: 'Martes' },
  { id: 'wednesday', name: 'Miércoles' },
  { id: 'thursday', name: 'Jueves' },
  { id: 'friday', name: 'Viernes' },
  { id: 'saturday', name: 'Sábado' },
  { id: 'sunday', name: 'Domingo' }
];

const PRESETS = [
  { name: 'Turno Mañana (Lun-Vie 8am-2pm + Sáb Full)', shift: 'A' },
  { name: 'Turno Tarde (Lun-Vie 2pm-10pm + Dom Full)', shift: 'B' }
];

export default function Staff() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'manage' | 'attendance'>('manage');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    dni: '',
    phone: '',
    email: '',
    role: 'EMPLOYEE',
    schedule: {
      monday: { enabled: true, start: '08:00', end: '14:00' },
      tuesday: { enabled: true, start: '08:00', end: '14:00' },
      wednesday: { enabled: true, start: '08:00', end: '14:00' },
      thursday: { enabled: true, start: '08:00', end: '14:00' },
      friday: { enabled: true, start: '08:00', end: '14:00' },
      saturday: { enabled: true, start: '08:00', end: '22:00' },
      sunday: { enabled: false, start: '00:00', end: '00:00' }
    }
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'manage') {
        const resp = await api.get('/users/employees');
        setEmployees(resp.data);
      } else {
        const resp = await api.get('/attendance/admin/logs');
        setLogs(resp.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (type: 'A' | 'B') => {
    if (type === 'A') {
      setFormData({
        ...formData,
        schedule: {
          monday: { enabled: true, start: '08:00', end: '14:00' },
          tuesday: { enabled: true, start: '08:00', end: '14:00' },
          wednesday: { enabled: true, start: '08:00', end: '14:00' },
          thursday: { enabled: true, start: '08:00', end: '14:00' },
          friday: { enabled: true, start: '08:00', end: '14:00' },
          saturday: { enabled: true, start: '08:00', end: '22:00' },
          sunday: { enabled: false, start: '00:00', end: '00:00' }
        }
      });
    } else {
      setFormData({
        ...formData,
        schedule: {
          monday: { enabled: true, start: '14:00', end: '22:00' },
          tuesday: { enabled: true, start: '14:00', end: '22:00' },
          wednesday: { enabled: true, start: '14:00', end: '22:00' },
          thursday: { enabled: true, start: '14:00', end: '22:00' },
          friday: { enabled: true, start: '14:00', end: '22:00' },
          saturday: { enabled: false, start: '00:00', end: '00:00' },
          sunday: { enabled: true, start: '08:00', end: '22:00' }
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.put(`/users/${editingEmployee._id}`, formData);
      } else {
        await api.post('/users/registro', formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert("Error al guardar empleado");
    }
  };

  return (
    <div className="app-container anim-fade-in" style={{ padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} className="btn glass hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid hsl(var(--primary-light))', color: 'hsl(var(--primary))' }}>
            <ArrowLeft size={18} /> <span>Menú</span>
          </button>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Gestión de Personal</h1>
        </div>
        <div className="glass" style={{ display: 'flex', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)' }}>
          <button 
            className={`btn ${activeTab === 'manage' ? 'btn-primary' : ''}`} 
            style={{ borderRadius: 'var(--border-radius-sm)', background: activeTab === 'manage' ? '' : 'transparent' }}
            onClick={() => setActiveTab('manage')}
          >
            Empleados
          </button>
          <button 
            className={`btn ${activeTab === 'attendance' ? 'btn-primary' : ''}`} 
            style={{ borderRadius: 'var(--border-radius-sm)', background: activeTab === 'attendance' ? '' : 'transparent' }}
            onClick={() => setActiveTab('attendance')}
          >
            Asistencia
          </button>
        </div>
      </header>

      {activeTab === 'manage' ? (
        <main>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <button onClick={() => { setEditingEmployee(null); setShowModal(true); }} className="btn btn-primary hover-lift" style={{ display: 'flex', gap: '0.5rem' }}>
              <Plus size={18} /> Registrar Nuevo Empleado
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {employees.map(emp => (
              <div key={emp._id} className="glass hover-lift" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'hsl(var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))', fontWeight: 800, fontSize: '1.2rem' }}>
                      {emp.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0 }}>{emp.full_name}</h3>
                      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>@{emp.username} | DNI: {emp.dni}</p>
                    </div>
                  </div>
                  <button onClick={() => { 
                    setEditingEmployee(emp); 
                    setFormData({...emp, password: ''}); 
                    setShowModal(true); 
                  }} className="btn glass" style={{ padding: '0.5rem' }}>
                    <Edit2 size={16} />
                  </button>
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                  <small style={{ color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>HORARIO DE TRABAJO</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                     {DAYS.map(day => (
                       <span key={day.id} style={{ 
                         fontSize: '0.7rem', 
                         padding: '2px 8px', 
                         borderRadius: '12px', 
                         background: emp.schedule[day.id]?.enabled ? 'hsl(var(--primary-light))' : 'hsl(var(--text-secondary)/0.1)',
                         color: emp.schedule[day.id]?.enabled ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))'
                       }}>
                         {day.name.substring(0, 3)}: {emp.schedule[day.id]?.enabled ? `${emp.schedule[day.id].start}-${emp.schedule[day.id].end}` : 'OFF'}
                       </span>
                     ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <div className="glass" style={{ padding: '2rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Historial de Asistencia Reciente</h3>
           <div className="responsive-table">
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ color: 'hsl(var(--text-secondary))', borderBottom: '1px solid var(--glass-border)' }}>
                   <th style={{ textAlign: 'left', padding: '1rem' }}>Empleado</th>
                   <th style={{ textAlign: 'left', padding: '1rem' }}>Fecha</th>
                   <th style={{ textAlign: 'left', padding: '1rem' }}>Entrada</th>
                   <th style={{ textAlign: 'left', padding: '1rem' }}>Salida</th>
                   <th style={{ textAlign: 'left', padding: '1rem' }}>Estado</th>
                 </tr>
               </thead>
               <tbody>
                 {logs.map(log => (
                   <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                     <td style={{ padding: '1rem', fontWeight: 600 }}>{log.user_name}</td>
                     <td style={{ padding: '1rem' }}>{log.date}</td>
                     <td style={{ padding: '1rem' }}>{log.check_in}</td>
                     <td style={{ padding: '1rem' }}>{log.check_out || '---'}</td>
                     <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '8px', 
                          fontSize: '0.8rem',
                          background: log.status === 'active' ? 'hsl(var(--warning)/0.2)' : 'hsl(var(--success)/0.2)',
                          color: log.status === 'active' ? 'hsl(var(--warning))' : 'hsl(var(--success))'
                        }}>
                          {log.status === 'active' ? 'En Turno' : 'Completado'}
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Modal de Registro/Edición */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <h2 style={{ marginBottom: '2rem' }}>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input className="glass-input" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Cédula/DNI</label>
                  <input className="glass-input" value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Usuario</label>
                  <input className="glass-input" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contraseña {editingEmployee && '(Dejar vacío para no cambiar)'}</label>
                  <input className="glass-input" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required={!editingEmployee} />
                </div>
                <div className="form-group">
                  <label>Teléfono (WhatsApp)</label>
                  <input className="glass-input" placeholder="+593 ..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input className="glass-input" type="email" placeholder="empleado@ejemplo.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Configuración de Horario</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <button key={p.shift} type="button" onClick={() => applyPreset(p.shift as any)} className="btn glass hover-lift" style={{ fontSize: '0.8rem', border: '1px solid hsl(var(--primary-light))' }}>
                      <Clock size={14} style={{ marginRight: '5px' }} /> {p.name}
                    </button>
                  ))}
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: '1rem' 
                }}>
                  {DAYS.map(day => (
                    <div key={day.id} style={{ 
                      padding: '1.25rem', 
                      borderRadius: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      border: `1px solid ${formData.schedule[day.id as keyof typeof formData.schedule].enabled ? 'hsl(var(--primary-light))' : 'var(--glass-border)'}`,
                      transition: 'all 0.3s ease'
                    }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        fontWeight: 700, 
                        marginBottom: '1rem',
                        cursor: 'pointer',
                        color: formData.schedule[day.id as keyof typeof formData.schedule].enabled ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))'
                      }}>
                        <input 
                          type="checkbox" 
                          style={{ width: '18px', height: '18px' }}
                          checked={formData.schedule[day.id as keyof typeof formData.schedule].enabled} 
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule, [day.id]: { ...formData.schedule[day.id as keyof typeof formData.schedule], enabled: e.target.checked } }
                          })} 
                        />
                        {day.name}
                      </label>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'row', 
                        gap: '0.75rem', 
                        opacity: formData.schedule[day.id as keyof typeof formData.schedule].enabled ? 1 : 0.5,
                        pointerEvents: formData.schedule[day.id as keyof typeof formData.schedule].enabled ? 'auto' : 'none'
                      }} className="time-inputs-container">
                        <div style={{ flex: 1 }}>
                          <small style={{ display: 'block', marginBottom: '4px', opacity: 0.6 }}>Entrada</small>
                          <input 
                            type="time" 
                            className="glass-input" 
                            style={{ padding: '0.5rem', width: '100%', fontSize: '0.9rem' }} 
                            value={formData.schedule[day.id as keyof typeof formData.schedule].start} 
                            onChange={(e) => setFormData({
                              ...formData,
                              schedule: { ...formData.schedule, [day.id]: { ...formData.schedule[day.id as keyof typeof formData.schedule], start: e.target.value } }
                            })} 
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <small style={{ display: 'block', marginBottom: '4px', opacity: 0.6 }}>Salida</small>
                          <input 
                            type="time" 
                            className="glass-input" 
                            style={{ padding: '0.5rem', width: '100%', fontSize: '0.9rem' }} 
                            value={formData.schedule[day.id as keyof typeof formData.schedule].end} 
                            onChange={(e) => setFormData({
                              ...formData,
                              schedule: { ...formData.schedule, [day.id]: { ...formData.schedule[day.id as keyof typeof formData.schedule], end: e.target.value } }
                            })} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn glass">Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Empleado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .time-inputs-container {
            flex-direction: column !important;
            gap: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
