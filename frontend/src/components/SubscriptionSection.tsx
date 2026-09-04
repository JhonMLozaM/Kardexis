import { useState, useEffect } from 'react';
import { CreditCard, Loader2, Check, ArrowUpRight, Clock, ExternalLink } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { api } from '../services/api';

interface Plan {
  slug: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_products: number;
  max_invoices_monthly: number;
  features: Record<string, boolean>;
}

const FEATURE_LABELS: Record<string, string> = {
  sri_fe: 'Facturacion Electronica SRI',
  credit_notes: 'Notas de Credito',
  retentions: 'Retenciones',
  debit_notes: 'Nota de Debito',
  guides: 'Guias de Remision',
  crm_basic: 'CRM Basico',
  kardex: 'Kardex de Inventario',
  suppliers: 'Gestion de Proveedores',
  accounting: 'Contabilidad NIIF',
  multi_company: 'Multi-Empresa',
  api_access: 'Acceso API',
  reports: 'Reportes Basicos',
  reports_excel: 'Exportacion Excel',
  cash_close: 'Cierre de Caja',
  cloud_sync: 'Sincronizacion Cloud',
  email_delivery: 'Envio por Email',
  whatsapp: 'WhatsApp',
  lot_tracking: 'Control de Lotes',
  purchase_orders: 'Ordenes de Compra',
};

const PLAN_COLORS: Record<string, string> = {
  basic: 'hsl(var(--text-secondary))',
  standard: 'hsl(var(--primary))',
  pro: 'hsl(142 71% 45%)',
  enterprise: 'hsl(270 70% 60%)',
};

export default function SubscriptionSection() {
  const { plan, status, is_trial, trial_ends_at, usage, loading, changePlan, refresh } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const resp = await api.get('/subscriptions/plans');
      setPlans(resp.data);
    } catch {
      // Silenciar
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleChangePlan = async (slug: string) => {
    if (slug === plan.slug) return;
    
    // Free plan - direct change
    const targetPlan = plans.find(p => p.slug === slug);
    if (targetPlan?.price_monthly === 0) {
      setChanging(true);
      try {
        await changePlan(slug);
        await refresh();
      } catch {
        // Silenciar
      } finally {
        setChanging(false);
      }
      return;
    }

    // Paid plan - redirect to Stripe checkout
    setChanging(true);
    try {
      const resp = await api.post('/payments/checkout', {
        plan_slug: slug,
        billing_period: 'monthly',
      });
      if (resp.data.checkout_url) {
        window.location.href = resp.data.checkout_url;
      }
    } catch {
      // Silenciar
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <CreditCard size={20} style={{ color: PLAN_COLORS[plan.slug] || 'hsl(var(--primary))' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Suscripcion</h2>
        <span style={{
          marginLeft: 'auto',
          padding: '0.25rem 0.75rem',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: status === 'active' ? 'hsl(var(--success) / 0.1)' : status === 'trial' ? 'hsl(var(--warning) / 0.1)' : 'hsl(var(--danger) / 0.1)',
          color: status === 'active' ? 'hsl(var(--success))' : status === 'trial' ? 'hsl(var(--warning))' : 'hsl(var(--danger))',
        }}>
          {status === 'active' ? 'Activo' : status === 'trial' ? 'Prueba' : 'Inactivo'}
        </span>
      </div>

      {/* Current plan */}
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        background: 'hsl(var(--muted))',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{plan.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
              {plan.price_monthly === 0 ? 'Gratis' : `$${plan.price_monthly}/mes o $${plan.price_yearly}/ano`}
            </div>
          </div>
          {is_trial && trial_ends_at && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'hsl(var(--warning))' }}>
                <Clock size={14} />
                Prueba hasta {new Date(trial_ends_at).toLocaleDateString('es-EC')}
              </div>
            </div>
          )}
        </div>

        {/* Usage bars */}
        {usage && (
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {(['users', 'products', 'invoices_monthly'] as const).map(key => {
              const data = usage[key];
              const percent = data.max === -1 ? 0 : Math.min(100, (data.current / data.max) * 100);
              const labels = { users: 'Usuarios', products: 'Productos', invoices_monthly: 'Facturas/mes' };
              return (
                <div key={key}>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>
                    {labels[key]}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {data.current} / {data.max === -1 ? '∞' : data.max}
                  </div>
                  {data.max !== -1 && (
                    <div style={{ height: '4px', background: 'hsl(var(--border))', borderRadius: '2px', marginTop: '0.25rem' }}>
                      <div style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: percent > 80 ? 'hsl(var(--danger))' : 'hsl(var(--primary))',
                        borderRadius: '2px',
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available plans */}
      {!loadingPlans && plans.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Planes Disponibles</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {plans.map(p => {
              const isCurrent = p.slug === plan.slug;
              return (
                <div key={p.slug} style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  border: `2px solid ${isCurrent ? PLAN_COLORS[p.slug] : 'hsl(var(--border))'}`,
                  opacity: changing ? 0.6 : 1,
                }}>
                  <div style={{ fontWeight: 700, color: PLAN_COLORS[p.slug] }}>{p.name}</div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    {p.price_monthly === 0 ? 'Gratis' : `$${p.price_monthly}/mes`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.75rem' }}>
                    {p.max_users === -1 ? '∞' : p.max_users} usuarios · {p.max_products === -1 ? '∞' : p.max_products} productos
                  </div>
                  <button
                    onClick={() => handleChangePlan(p.slug)}
                    disabled={isCurrent || changing}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: isCurrent ? 'default' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      background: isCurrent ? 'hsl(var(--muted))' : PLAN_COLORS[p.slug],
                      color: isCurrent ? 'hsl(var(--text-secondary))' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {isCurrent ? (
                      <>
                        <Check size={14} /> Actual
                      </>
                    ) : p.price_monthly === 0 ? (
                      'Cambiar'
                    ) : (
                      <>
                        <ExternalLink size={12} /> Pagar
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
