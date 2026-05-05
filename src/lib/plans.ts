export type PlanFeatureKey =
  | "queue_basic"
  | "daily_limit_20"
  | "qr_code"
  | "basic_stats"
  | "unlimited_queues"
  | "unlimited_customers"
  | "smart_alerts"
  | "customer_history"
  | "branding"
  | "support_24h"
  | "all_pro_features"
  | "multi_branch"
  | "staff_accounts"
  | "exports"
  | "priority_support";

export type PlanFeature = {
  key: PlanFeatureKey;
  label: string;
};

export const PLANS = {
  free: {
    id: "free",
    name: "مجاني",
    price: 0,
    description: "ابدأ بدون أي تكلفة",
    features: [
      { key: "queue_basic", label: "طابور واحد" },
      { key: "daily_limit_20", label: "حتى 20 زبون في اليوم" },
      { key: "qr_code", label: "رمز QR جاهز للطباعة" },
      { key: "basic_stats", label: "إحصائيات أساسية" },
    ] as PlanFeature[],
    cta: "ابدأ مجاناً",
    badge: null,
  },
  pro: {
    id: "pro",
    name: "إحترافي",
    price: 100,
    description: "للمحلات النشطة",
    features: [
      { key: "unlimited_queues", label: "طوابير غير محدودة" },
      { key: "unlimited_customers", label: "زبائن غير محدودون" },
      { key: "smart_alerts", label: "تنبيهات ذكية للزبائن" },
      { key: "customer_history", label: "سجل تفصيلي للعملاء" },
      { key: "branding", label: "صفحة خاصة لمحلّك" },
      { key: "support_24h", label: "دعم فني خلال 24 ساعة" },
    ] as PlanFeature[],
    cta: "اشترك الآن",
    badge: "الأكثر شهرة",
  },
  business: {
    id: "business",
    name: "الأعمال",
    price: 300,
    description: "لسلاسل المحلات",
    features: [
      { key: "all_pro_features", label: "كل مميزات إحترافي" },
      { key: "multi_branch", label: "فروع متعددة" },
      { key: "staff_accounts", label: "حسابات موظفين" },
      { key: "exports", label: "تقارير مصدّرة (PDF, CSV)" },
      { key: "priority_support", label: "دعم فني متخصص" },
    ] as PlanFeature[],
    cta: "اشترك الآن",
    badge: null,
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Plan hierarchy — higher index = more features
export const PLAN_ORDER: PlanId[] = ["free", "pro", "business"];

export const planRank = (plan: PlanId): number => PLAN_ORDER.indexOf(plan);

// Returns true if user's plan has access to a feature
export function hasFeature(userPlan: PlanId, featureKey: PlanFeatureKey): boolean {
  // Find which plan owns this feature
  for (const planId of PLAN_ORDER) {
    const found = PLANS[planId].features.find((f) => f.key === featureKey);
    if (found) {
      // user must have this plan or higher
      return planRank(userPlan) >= planRank(planId);
    }
  }
  return false;
}

// Returns the minimum plan required for a feature
export function planForFeature(featureKey: PlanFeatureKey): PlanId | null {
  for (const planId of PLAN_ORDER) {
    if (PLANS[planId].features.find((f) => f.key === featureKey)) return planId;
  }
  return null;
}
