import { useState, useEffect } from 'react';
import { FileText, Search, Plus, Loader2, X, Printer } from 'lucide-react';
import { api } from '../services/api';
import FeatureGate from '../components/FeatureGate';

interface CreditNote {
  id: string;
  sale_id: string;
  client_name: string;
  reason: string;
  total: number;
  date: string;
  sri_status: string;
  pdf_path?: string;
}

export default function CreditNotes() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleId, setSaleId] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchSaleLoading, setSearchSaleLoading] = useState(false);

  useEffect(() => { loadNotes(); }, []);

  const loadNotes = async () => {
    try {
      const resp = await api.get('/credit-notes/');
      setNotes(resp.data.credit_notes || []);
    } catch (err) {
      console.error('Error loading credit notes', err);
    } finally {
      setLoading(false);
    }
  };

  const searchSale = async () => {
    if (!saleId) return;
    setSearchSaleLoading(true);
    try {
      const resp = await api.get(`/sales/?skip=0&limit=100`);
      const sales = resp.data.sales || [];
      const found = sales.find((s: any) => s.id === saleId || s.external_id === saleId);
      if (found) {
        setSaleData(found);
        setSelectedItems([]);
      } else {
        alert('Venta no encontrada');
      }
    } catch (err) {
      alert('Error al buscar venta');
    } finally {
      setSearchSaleLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!saleData || !reason || selectedItems.length === 0) {
      alert('Completa todos los campos');
      return;
    }
    setSaving(true);
    try {
      const items = selectedItems.map(idx => saleData.items[idx]);
      await api.post('/credit-notes/', {
        sale_id: saleData.id,
        client_id: saleData.client_id,
        client_name: saleData.client_name,
        client_id_type: saleData.client_id_type,
        reason,
        items: items.map((i: any) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          iva_rate: i.iva_rate || 0,
        })),
      });
      setShowForm(false);
      setSaleData(null);
      setSaleId('');
      setReason('');
      setSelectedItems([]);
      loadNotes();
    } catch (err) {
      alert('Error al crear nota de credito');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (idx: number) => {
    setSelectedItems(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const creditTotal = saleData
    ? selectedItems.reduce((sum, idx) => {
        const item = saleData.items[idx];
        const base = item.unit_price * item.quantity;
        return sum + base + base * ((item.iva_rate || 0) / 100);
      }, 0)
    : 0;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <FeatureGate feature="credit_notes">
    <div className="anim-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={24} /> Notas de Credito
        </h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }}>
          <Plus size={18} /> Nueva Nota
        </button>
      </div>

      {showForm && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Nueva Nota de Credito</h3>
            <button onClick={() => { setShowForm(false); setSaleData(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="ID de la venta (UUID o externo)"
              value={saleId}
              onChange={e => setSaleId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchSale()}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <button onClick={searchSale} className="btn glass" style={{ padding: '0.5rem 1rem' }} disabled={searchSaleLoading}>
              {searchSaleLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            </button>
          </div>

          {saleData && (
            <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Venta: {saleData.client_name} - ${saleData.total?.toFixed(2)}</p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Fecha: {new Date(saleData.date).toLocaleDateString()}</p>

              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', margin: '1rem 0 0.5rem' }}>Selecciona productos a acreditar:</label>
              {saleData.items?.map((item: any, idx: number) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem', cursor: 'pointer', borderRadius: '4px', background: selectedItems.includes(idx) ? 'hsl(var(--primary) / 0.1)' : 'transparent' }}>
                  <input type="checkbox" checked={selectedItems.includes(idx)} onChange={() => toggleItem(idx)} />
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{item.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>x{item.quantity} ${item.unit_price.toFixed(2)}</span>
                </label>
              ))}

              {selectedItems.length > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'hsl(var(--warning) / 0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
                  Total a acreditar: <strong>${creditTotal.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Motivo de la nota de credito</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Devolucion de producto, descuento aplicado, etc."
              rows={3}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => { setShowForm(false); setSaleData(null); }} className="btn glass">Cancelar</button>
            <button onClick={handleCreate} className="btn btn-primary" disabled={saving || !saleData || !reason || selectedItems.length === 0}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
              Crear Nota de Credito
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
          <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p>No hay notas de credito registradas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notes.map(note => (
            <div key={note.id} className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{note.client_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>{note.reason}</div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                  {new Date(note.date).toLocaleDateString()} | Total: <strong>${note.total.toFixed(2)}</strong>
                </div>
              </div>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                background: note.sri_status === 'local' ? 'hsl(var(--warning) / 0.1)' : 'hsl(var(--success) / 0.1)',
                color: note.sri_status === 'local' ? 'hsl(var(--warning))' : 'hsl(var(--success))',
              }}>
                {note.sri_status === 'local' ? 'Local' : 'SRI'}
              </span>
              {note.pdf_path && (
                <a href={`${api.defaults.baseURL?.replace('/api/v1', '')}${note.pdf_path}`} target="_blank" rel="noopener noreferrer">
                  <Printer size={16} style={{ color: 'hsl(var(--primary))' }} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
