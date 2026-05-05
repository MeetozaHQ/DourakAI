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
    const { data: refs } = await supabase.from("referrals").select("*").eq("referrer_id", user!.id);
    const list = refs ?? [];
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    setStats({
      count: list.length,
      earnings: list.reduce((a, r) => a + (r.commission_amount || 0), 0),
      monthly: list.filter(r => new Date(r.created_at) >= month).reduce((a, r) => a + (r.commission_amount || 0), 0),
    });
  };

  const url = `${AFFILIATE_BASE_URL}/signup?ref=${code}`;

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
            رشّح محلات لدَوْرَك واكسب <span className="font-bold text-primary">٢٠% عمولة</span> على كل اشتراك — كل شهر، مدى الحياة.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Gift, label: "نسبة العمولة", value: "٢٠%", color: "text-warning bg-warning/10" },
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

        <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface mb-6">
          <div className="text-center mb-5">
            <h2 className="text-xl font-black text-surface-fg mb-1">رابطك الخاص</h2>
            <p className="text-sm text-surface-muted">شارك هذا الرابط مع أصحاب المحلات وابدأ تكسب</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => { navigator.clipboard.writeText(url); toast.success("تم النسخ ✓"); }}
              className="bg-gradient-primary text-primary-foreground rounded-full gap-2"
            >
              <Copy className="w-4 h-4" />
              نسخ
            </Button>
            <div dir="ltr" className="flex-1 bg-surface-muted rounded-full px-5 py-3 text-sm font-mono text-surface-muted text-center truncate">
              {url}
            </div>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6">
          <h3 className="text-xl font-black text-surface-fg mb-5 text-right">كيف يعمل البرنامج؟</h3>
          <ol className="space-y-4">
            {[
              "شارك رابطك الخاص مع أصحاب المحلات في منطقتك",
              "لما حد يشترك من خلال رابطك، تتسجل عمولة باسمك",
              "تحصل على ٢٠% من قيمة اشتراكهم كل شهر تلقائياً",
              "يتم تحويل الأرباح لحسابك في آخر كل شهر",
            ].map((t, i) => (
              <li key={i} className="flex items-center gap-3 text-surface-fg">
                <div className="w-7 h-7 rounded-full bg-gradient-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </div>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-primary/20 mt-6 pt-5 text-center text-sm text-surface-muted flex items-center justify-center gap-2">
            <Phone className="w-4 h-4 text-destructive" />
            للاستفسار عن البرنامج، تواصل معنا على واتساب
          </div>
        </div>
      </main>
    </div>
  );
};

export default Affiliate;
