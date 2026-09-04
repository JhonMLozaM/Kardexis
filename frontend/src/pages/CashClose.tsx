import { useState, useEffect } from 'react';
import { Calculator, CreditCard, ArrowRightLeft, QrCode, Banknote, Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getTodaySalesStats, saveCashClose, getOpenCashClose, type OfflineCashClose } from '../services/offlineDb';

export default function CashClose() {
  const user = useAuthStore(s => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<string>('');
  const [closingAmount, setClosingAmount] = useState<string>('');
  const [salesStats, setSalesStats] = useState<{ total: number; count: number; byMethod: Record<string, number>; sales: any[] }>({ total: 0, count: 0, byMethod: {}, sales: [] });
  const [openCashClose, setOpenCashClose] = useState<OfflineCashClose | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const stats = await getTodaySalesStats(user?.id || '');
      setSalesStats(stats);
      const open = await getOpenCashClose(user?.id || '');
      if (open) {
        setOpenCashClose(open);
        setOpeningAmount(String(open.opening_amount));
      }
    } finally { setLoading(false); }
  };

  const totalPayments = Object.entries(salesStats.byMethod).reduce((sum, [, v]) => sum + v, 0);
  const expectedAmount = (parseFloat(openingAmount) || 0) + totalPayments;
  const actualAmount = parseFloat(closingAmount) || 0;
  const difference = actualAmount - expectedAmount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const externalId = `cc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const cashClose: OfflineCashClose = {
        id: openCashClose?.id || externalId,
        externalId,
        date: new Date().toISOString().split('T')[0],
        user_id: user?.id || '',
        user_name: user?.full_name || '',
        opening_amount: parseFloat(openingAmount) || 0,
        closing_amount: actualAmount,
        expected_amount: expectedAmount,
        difference,
        sales_count: salesStats.count,
        sales_total: salesStats.total,
        payment_breakdown: salesStats.byMethod,
        status: 'closed',
        sync_status: 'pending',
      };
      await saveCashClose(cashClose);
      setSaved(true);
    } finally { setSaving(false); }
  };

  const methodLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR/Digital' };
  const methodIcons: Record<string, React.ReactNode> = { cash: <Banknote size={16} />, card: <CreditCard size={16} />, transfer: <ArrowRightLeft size={16} />, qr: <QrCode size={16} /> };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={32} /></div>;

  if (saved) return (
    <div className="anim-fade-in" style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
      <div className="glass" style={{ padding: '3rem' }}>
        <CheckCircle size={64} color="hsl(var(--success))" style={{ marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Cierre de Caja Registrado</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
          Diferencia: <strong style={{ color: difference >= 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>${difference.toFixed(2)}</strong>
        </p>
        <button onClick={() => setSaved(false)} className="btn btn-primary">Volver</button>
      </div>
    </div>
  );

  return (
    <div className="anim-fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calculator size={24} /> Cierre de Caja
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Opening */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Apertura</h3>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Monto Inicial</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>$</span>
            <input type="number" step="0.01" min="0" value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
              placeholder="0.00"
              style={{ padding: '0.75rem 0.75rem 0.75rem 2rem', fontSize: '1.2rem', fontWeight: 'bold', width: '100%' }} />
          </div>
        </div>

        {/* Closing */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Cierre</h3>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Monto Final (Contado)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>$</span>
            <input type="number" step="0.01" min="0" value={closingAmount}
              onChange={e => setClosingAmount(e.target.value)}
              placeholder="0.00"
              style={{ padding: '0.75rem 0.75rem 0.75rem 2rem', fontSize: '1.2rem', fontWeight: 'bold', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Resumen del Dia</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Ventas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{salesStats.count}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--success))' }}>${salesStats.total.toFixed(2)}</div>
          </div>
        </div>

        {Object.keys(salesStats.byMethod).length > 0 && (
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Por Metodo de Pago:</div>
            {Object.entries(salesStats.byMethod).map(([method, amount]) => (
              <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'hsl(var(--text-secondary))' }}>
                  {methodIcons[method]} {methodLabels[method] || method}
                </span>
                <span style={{ fontWeight: 600 }}>${(amount as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculation */}
      <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem', backgroundColor: difference !== 0 ? (difference > 0 ? 'hsl(var(--success) / 0.05)' : 'hsl(var(--danger) / 0.05)') : undefined }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Calculo</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Apertura</span>
          <span>${(parseFloat(openingAmount) || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'hsl(var(--text-secondary))' }}>+ Ventas (total)</span>
          <span>${totalPayments.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>Esperado en caja</span>
          <span style={{ fontWeight: 'bold' }}>${expectedAmount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>Contado real</span>
          <span style={{ fontWeight: 'bold' }}>${actualAmount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--glass-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Diferencia</span>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: difference === 0 ? 'hsl(var(--success))' : difference > 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
            {difference > 0 ? '+' : ''}{difference.toFixed(2)}
          </span>
        </div>
        {difference !== 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.8rem', color: difference > 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
            <AlertTriangle size={14} />
            {difference > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving || !closingAmount} className="btn btn-primary hover-lift"
        style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem' }}>
        {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Registrar Cierre</>}
      </button>
    </div>
  );
}
