import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Gift, TrendingUp, DollarSign, Users, Copy, ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";

const AFFILIATE_BASE_URL = "https://wait-free.lovable.app";

const Affiliate = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [shopId, setShopId] = useState("");
  const [stats, setStats] = useState({ count: 0, earnings: 0, monthly: 0 });

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const load = async () => {
    const { data: profile } = await supabase.from("profiles").select("referral_code").eq("id", user!.id).maybeSingle();
    if (profile) setCode(profile.referral_code);

    const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user!.id).limit(1).maybeSingle();
    if (shop) setShopId(shop.id);

    const { data: refs } = await supabase.from("referrals").select("*").eq("referrer_id", user!.id);
    const list = refs ?? [];
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    setStats({
      count: list.length,
      earnings: list.reduce((a, r) => a + (r.commission_amount || 0), 0),
      monthly: list.filter(r => new Date(r.created_at) >= month).reduce((a, r) => a + (r.commission_amount || 0), 0),
    });
  };

  const url = `${window.location.origin}/signup?ref=${shopId || code}`;

  return (
    <div className="bg-surface min-h-screen" dir="rtl">
      <header className="bg-surface-card border-b border-surface px-6 py-4">
        <div className="container mx-auto flex items-center justify-between max-w-4xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-surface-fg/70 hover:bg-surface-muted gap-2">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            لوحة التحكم
          </Button>
          <Logo size="md" />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-12">
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-gold items-center justify-center text-4xl mb-5 shadow-elegant">
            💰
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-surface-fg mb-3">برنامج الشركاء</h1>
          <p className="text-surface-muted text-lg max-w-xl mx-auto">
            رشّح محلات لدَوْرَك واكسب <span className="font-bold text-primary">١٥% عمولة</span> على كل اشتراك — شهرياً لمدة سنة كاملة.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Gift, label: "نسبة العمولة", value: "١٥%", color: "text-warning bg-warning/10" },
            { icon: TrendingUp, label: "إجمالي الأرباح", value: `${stats.earnings} ج`, color: "text-primary bg-primary/10" },
            { icon: DollarSign, label: "أرباح هذا الشهر", value: `${stats.monthly} ج`, color: "text-success bg-success/10" },
            { icon: Users, label: "محلات رشحتها", value: stats.count, color: "text-accent bg-accent/10" },
          ].map((s, i) => (
            <div key={i} className="bg-surface-card rounded-2xl p-5 shadow-soft border border-surface text-center">
              <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-surface-fg">{s.value}</div>
              <div className="text-xs text-surface-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface mb-10">
          <div className="text-center mb-5">
            <h2 className="text-xl font-black text-surface-fg mb-1">رابطك الخاص</h2>
            <p className="text-sm text-surface-muted">شارك هذا الرابط مع أصحاب المحلات وابدأ تكسب</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div dir="ltr" className="flex-1 bg-surface-muted rounded-2xl px-5 py-4 text-sm font-mono text-surface-fg border border-surface truncate flex items-center justify-center">
              {url}
            </div>
            <Button
              onClick={() => { navigator.clipboard.writeText(url); toast.success("تم النسخ ✓"); }}
              className="bg-gradient-primary text-primary-foreground rounded-2xl h-14 px-8 font-bold gap-2 shadow-elegant"
            >
              <Copy className="w-4 h-4" />
              نسخ الرابط
            </Button>
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-black text-surface-fg mb-6 text-right">الأرباح من الإحالات</h2>
            <div className="bg-surface-card rounded-3xl border border-surface shadow-soft overflow-hidden">
              <div className="p-6 border-b border-surface">
                 <div className="grid grid-cols-3 gap-4 text-center">
                   <div>
                     <div className="text-xs text-surface-muted mb-1">عدد الإحالات</div>
                     <div className="text-xl font-black text-surface-fg">{stats.count}</div>
                   </div>
                   <div>
                     <div className="text-xs text-surface-muted mb-1">إجمالي الأرباح</div>
                     <div className="text-xl font-black text-primary">{stats.earnings} ج</div>
                   </div>
                   <div>
                     <div className="text-xs text-surface-muted mb-1">الحالة</div>
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold">
                       <TrendingUp className="w-3 h-3" /> نشط
                     </div>
                   </div>
                 </div>
              </div>
              <div className="p-12 text-center text-surface-muted text-sm">
                {stats.count === 0 ? "لا يوجد إحالات بعد. ابدأ بمشاركة رابطك!" : "سيظهر تفصيل كل إحالة هنا قريباً..."}
              </div>
            </div>
          </section>

          <section className="bg-primary/5 border border-primary/20 rounded-3xl p-8">
            <h3 className="text-2xl font-black text-surface-fg mb-6 text-right">كيف يعمل البرنامج؟</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <ol className="space-y-6">
                {[
                  "شارك رابطك الخاص مع أصحاب المحلات في منطقتك",
                  "لما حد يشترك من خلال رابطك، تتسجل إحالة باسمك",
                  "لما المشترك يفعل باقة مدفوعة، هتحصل على عمولة ١٥%",
                  "العمولة بتستمر لمدة ١٢ شهر من تاريخ اشتراك صاحب المحل",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-4 text-surface-fg">
                    <div className="w-8 h-8 rounded-full bg-gradient-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <span className="font-medium text-lg leading-snug">{t}</span>
                  </li>
                ))}
              </ol>
              <div className="bg-surface-card rounded-2xl p-6 border border-primary/10 flex flex-col items-center justify-center text-center space-y-4">
                 <Logo size="md" />
                 <p className="text-sm text-surface-muted">هدفنا نكبر سوا، ونوصل دَوْرَك لكل مكان في مصر والوطن العربي. 🚀</p>
                 <Button variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/10" onClick={() => window.open("https://wa.me/201035851931", "_blank")}>
                   <Phone className="w-4 h-4" /> تواصل معنا
                 </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Affiliate;
