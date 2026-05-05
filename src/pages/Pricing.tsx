import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Check, ArrowLeft, Crown, Lock } from "lucide-react";
import { PLANS, PlanId, planRank } from "@/lib/plans";
import { toast } from "sonner";

const Pricing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<PlanId>("free");
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("shops").select("id,plan").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setCurrent(data.plan as PlanId); setShopId(data.id); }
    });
  }, [user]);

  const choose = async (planId: PlanId) => {
    if (!shopId) return;
    if (planId === "free") {
      await supabase.from("shops").update({ plan: "free", daily_limit: 20 }).eq("id", shopId);
      setCurrent("free");
      toast.success("تم التفعيل");
      return;
    }
    await supabase.from("subscriptions").insert({
      shop_id: shopId,
      plan: planId,
      amount: PLANS[planId].price,
      status: "pending",
    });
    toast.info("📞 تواصل معنا على واتساب لتفعيل الباقة (الدفع سيتوفر قريباً عبر Paymob)");
  };

  return (
    <div className="bg-surface min-h-screen" dir="rtl">
      <header className="bg-surface-card border-b border-surface px-6 py-4">
        <div className="container mx-auto flex items-center justify-between max-w-6xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-surface-fg/70 hover:bg-surface-muted gap-2">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            لوحة التحكم
          </Button>
          <Logo size="md" />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-primary items-center justify-center mb-4 shadow-elegant">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-surface-fg mb-3">اختار الباقة المناسبة</h1>
          <p className="text-surface-muted text-lg">رقّ محلك بمميزات أكثر</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {Object.values(PLANS).map((plan) => {
            const featured = plan.id === "pro";
            const active = current === plan.id;
            const isLocked = planRank(plan.id as PlanId) > planRank(current);
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 transition-all ${
                  featured
                    ? "bg-gradient-to-br from-primary to-primary-glow text-white shadow-elegant scale-105"
                    : "bg-surface-card border border-surface shadow-soft"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-gradient-gold text-foreground text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    ⭐ {plan.badge}
                  </div>
                )}
                {active && (
                  <div className="absolute top-4 left-4 bg-success text-success-foreground text-xs font-bold px-3 py-1 rounded-full">
                    باقتك الحالية
                  </div>
                )}
                <div className={`text-center mb-6 ${featured ? "text-white" : "text-surface-fg"}`}>
                  <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                  <p className={`text-sm ${featured ? "text-white/80" : "text-surface-muted"}`}>{plan.description}</p>
                </div>
                <div className={`text-center mb-8 pb-8 border-b ${featured ? "border-white/20" : "border-surface"}`}>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-5xl font-black ${featured ? "text-white" : "text-surface-fg"}`}>
                      {plan.price === 0 ? "صفر" : plan.price}
                    </span>
                    <span className={`text-base ${featured ? "text-white/80" : "text-surface-muted"}`}>ج/شهر</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f.key} className={`flex items-center gap-2 text-sm ${isLocked ? "opacity-50" : ""}`}>
                      {isLocked ? (
                        <Lock className={`w-4 h-4 flex-shrink-0 ${featured ? "text-white/70" : "text-surface-muted"}`} />
                      ) : (
                        <Check className={`w-4 h-4 flex-shrink-0 ${featured ? "text-white" : "text-success"}`} />
                      )}
                      <span className={featured ? "text-white/90" : "text-surface-fg"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => choose(plan.id as PlanId)}
                  disabled={active}
                  className={`w-full rounded-full h-12 font-bold ${
                    featured
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-surface-fg/5 text-surface-fg hover:bg-surface-fg/10"
                  }`}
                  variant="ghost"
                >
                  {active ? "مفعلة ✓" : plan.cta}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10 text-sm text-surface-muted">
          الدفع الآلي قيد الإعداد عبر Paymob — تواصل معنا الآن لتفعيل أي باقة يدوياً
        </div>
      </main>
    </div>
  );
};

export default Pricing;
