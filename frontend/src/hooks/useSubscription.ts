import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface SubscriptionPlan {
  slug: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_products: number;
  max_invoices_monthly: number;
  features: Record<string, boolean>;
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
}

export interface UsageData {
  users: { current: number; max: number };
  products: { current: number; max: number };
  invoices_monthly: { current: number; max: number };
}

const PLAN_ORDER: Record<string, number> = {
  basic: 0,
  standard: 1,
  pro: 2,
  enterprise: 3,
};

const DEFAULT_PLAN: SubscriptionPlan = {
  slug: 'basic',
  name: 'Basico',
  price_monthly: 0,
  price_yearly: 0,
  max_users: 2,
  max_products: 100,
  max_invoices_monthly: 50,
  features: {},
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: DEFAULT_PLAN,
    status: 'trial',
    is_trial: false,
    trial_ends_at: null,
    subscription_started_at: null,
  });
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const [planResp, usageResp] = await Promise.all([
        api.get('/subscriptions/my-plan'),
        api.get('/subscriptions/usage'),
      ]);
      setSubscription(planResp.data);
      setUsage(usageResp.data);
    } catch {
      // Silenciar errores - mantener default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const hasFeature = useCallback(
    (feature: string): boolean => {
      return subscription.plan.features[feature] === true;
    },
    [subscription.plan.features]
  );

  const hasPlanLevel = useCallback(
    (minPlan: string): boolean => {
      const current = PLAN_ORDER[subscription.plan.slug] ?? 0;
      const required = PLAN_ORDER[minPlan] ?? 0;
      return current >= required;
    },
    [subscription.plan.slug]
  );

  const checkLimit = useCallback(
    (resource: 'users' | 'products' | 'invoices_monthly'): boolean => {
      if (!usage) return true;
      const data = usage[resource];
      if (data.max === -1) return true; // ilimitado
      return data.current < data.max;
    },
    [usage]
  );

  const getUsagePercent = useCallback(
    (resource: 'users' | 'products' | 'invoices_monthly'): number => {
      if (!usage) return 0;
      const data = usage[resource];
      if (data.max === -1) return 0;
      return Math.min(100, Math.round((data.current / data.max) * 100));
    },
    [usage]
  );

  const startTrial = useCallback(async () => {
    await api.post('/subscriptions/start-trial');
    await fetchSubscription();
  }, [fetchSubscription]);

  const changePlan = useCallback(async (planSlug: string) => {
    await api.post('/subscriptions/change-plan', null, { params: { new_plan_slug: planSlug } });
  }, []);

  return {
    plan: subscription.plan,
    status: subscription.status,
    is_trial: subscription.is_trial,
    trial_ends_at: subscription.trial_ends_at,
    usage,
    loading,
    hasFeature,
    hasPlanLevel,
    checkLimit,
    getUsagePercent,
    startTrial,
    changePlan,
    refresh: fetchSubscription,
  };
}
