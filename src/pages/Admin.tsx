import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Shield, Store, Users, DollarSign, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PLANS, PlanId } from "@/lib/plans";

const Admin = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  type ShopRow = { id: string; name: string; slug: string; plan: string; created_at: string };
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);
  const [refs, setRefs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate("/login");
      else if (!isAdmin) { toast.error("ليس لديك صلاحية"); navigate("/dashboard"); }
      else void load();
    }
  }, [loading, user, isAdmin, navigate]);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("shops").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("referrals").select("*"),
    ]);
    setShops((s ?? []) as ShopRow[]); setProfiles(p ?? []); setRefs(r ?? []);
  };

  const setPlan = async (shopId: string, plan: PlanId) => {
    await supabase.from("shops").update({ plan, daily_limit: plan === "free" ? 20 : 999999 }).eq("id", shopId);
    toast.success("تم التحديث");
    void load();
  };

  if (loading || !isAdmin) return <div className="bg-surface min-h-screen" />;

  return (
    <div className="bg-surface min-h-screen" dir="rtl">
      <header className="bg-surface-card border-b border-surface px-6 py-4">
        <div className="container mx-auto flex items-center justify-between max-w-7xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-surface-fg/70 hover:bg-surface-muted gap-2">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            رجوع
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <Logo size="md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-3xl font-black text-surface-fg mb-2">لوحة المشرف</h1>
        <p className="text-surface-muted mb-8">إدارة المحلات والاشتراكات والإحالات</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Store, label: "إجمالي المحلات", value: shops.length, color: "text-primary bg-primary/10" },
            { icon: Users, label: "المستخدمون", value: profiles.length, color: "text-accent bg-accent/10" },
            { icon: DollarSign, label: "اشتراكات نشطة", value: shops.filter(s => s.plan !== "free").length, color: "text-success bg-success/10" },
            { icon: Shield, label: "إحالات", value: refs.length, color: "text-warning bg-warning/10" },
          ].map((s, i) => (
            <div key={i} className="bg-surface-card rounded-2xl p-5 shadow-soft border border-surface">
              <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black text-surface-fg">{s.value}</div>
              <div className="text-xs text-surface-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface">
          <h2 className="text-xl font-black text-surface-fg mb-4">المحلات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface text-surface-muted">
                  <th className="text-right py-3 px-2">الاسم</th>
                  <th className="text-right py-3 px-2">المعرف</th>
                  <th className="text-right py-3 px-2">الباقة</th>
                  <th className="text-right py-3 px-2">تغيير الباقة</th>
                  <th className="text-right py-3 px-2">تاريخ</th>
                </tr>
              </thead>
              <tbody>
                {shops.map(s => (
                  <tr key={s.id} className="border-b border-surface text-surface-fg">
                    <td className="py-3 px-2 font-bold">{s.name}</td>
                    <td className="py-3 px-2 font-mono text-xs text-surface-muted">{s.slug}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        s.plan === "pro" ? "bg-primary/10 text-primary" : s.plan === "business" ? "bg-warning/10 text-warning" : "bg-surface-muted text-surface-muted"
                      }`}>{PLANS[s.plan as PlanId]?.name}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {Object.keys(PLANS).map(p => (
                          <Button key={p} size="sm" variant="outline" onClick={() => setPlan(s.id, p as PlanId)} className="h-7 px-2 text-xs border-surface text-surface-fg">
                            {PLANS[p as PlanId].name}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-surface-muted text-xs">{new Date(s.created_at).toLocaleDateString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
