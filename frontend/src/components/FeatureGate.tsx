import { ReactNode } from 'react';
import { Lock, ArrowUpRight } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface FeatureGateProps {
  feature?: string;
  minPlan?: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  standard: 'Estandar',
  pro: 'Profesional',
  enterprise: 'Empresarial',
};

export default function FeatureGate({
  feature,
  minPlan,
  children,
  fallback,
  showUpgrade = true,
}: FeatureGateProps) {
  const { hasFeature, hasPlanLevel, plan } = useSubscription();

  const isAllowed = feature ? hasFeature(feature) : minPlan ? hasPlanLevel(minPlan) : true;

  if (isAllowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (!showUpgrade) return null;

  const requiredPlan = minPlan ? PLAN_NAMES[minPlan] || minPlan : 'superior';

  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: '12px',
      background: 'hsl(var(--muted))',
      border: '1px dashed hsl(var(--border))',
      textAlign: 'center',
    }}>
      <Lock size={32} style={{ color: 'hsl(var(--text-secondary))', marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
        Funcionalidad bloqueada
      </div>
      <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
        Requiere plan <strong>{requiredPlan}</strong> o superior.
        <br />
        Tu plan actual: <strong>{plan.name}</strong>
      </div>
      <button
        onClick={() => window.location.href = '/empresa'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          background: 'hsl(var(--primary))',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
      >
        Mejorar Plan <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
