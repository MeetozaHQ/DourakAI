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
  const [stats, setStats] = useState({ count: 0, earnings: 0, pending: 0, withdrawn: 0 });
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ phone: "", name: "" });
  const [withdrawals, setWithdrawals] = useState<{
    id: string;
    amount: number;
    phone_number: string;
    account_name: string;
    status: string;
    created_at: string;
  }[]>([]);
  type Commission = {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    referred?: { name: string };
  };
  const [commissions, setCommissions] = useState<Commission[]>([]);

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

    // Fetch referrals count
    const { data: refs } = await supabase.from("referrals").select("id").eq("referrer_id", user!.id);
    const refCount = refs?.length || 0;

    // Fetch commissions
    const { data: comms } = await supabase
      .from("commissions")
      .select(`
        *,
        referred:referred_shop_id (name)
      `)
      .order("created_at", { ascending: false });
    
    const list = comms ?? [];
    setCommissions(list);

    // Fetch withdrawals
    const { data: withds } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
    const withList = withds ?? [];
    setWithdrawals(withList);

    setStats({
      count: refCount,
      earnings: list.filter(c => c.status === "paid").reduce((a, c) => a + (c.amount || 0), 0),
      pending: list.filter(c => c.status === "pending").reduce((a, c) => a + (c.amount || 0), 0),
      withdrawn: withList.filter(w => w.status === "paid" || w.status === "pending").reduce((a, w) => a + (w.amount || 0), 0),
    });
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = stats.earnings - stats.withdrawn;
    if (balance < 50) {
      toast.error("الحد الأدنى للسحب هو 50 ج");
      return;
    }

    const { error } = await supabase.from("withdrawals").insert({
      shop_id: shopId,
      amount: balance,
      phone_number: withdrawForm.phone,
      account_name: withdrawForm.name,
      status: "pending"
    });

    if (error) {
      toast.error("حدث خطأ أثناء إرسال الطلب");
    } else {
      toast.success("تم إرسال طلب السحب بنجاح");
      setShowWithdrawModal(false);
      void load();
    }
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { icon: Gift, label: "نسبة العمولة", value: "١٥%", color: "text-warning bg-warning/10" },
            { icon: TrendingUp, label: "أرباح مؤكدة", value: `${stats.earnings} ج`, color: "text-success bg-success/10" },
            { icon: DollarSign, label: "أرباح معلقة", value: `${stats.pending} ج`, color: "text-primary bg-primary/10" },
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

        <div className="flex justify-end mb-8">
           <Button 
            onClick={() => {
              if (stats.earnings - stats.withdrawn < 50) {
                toast.info("يجب أن يكون رصيدك 50 ج على الأقل للسحب");
              } else {
                setShowWithdrawModal(true);
              }
            }}
            className="bg-success text-white hover:bg-success/90 rounded-2xl h-12 px-8 font-bold gap-2 shadow-elegant"
           >
             <DollarSign className="w-4 h-4" />
             طلب سحب الأرباح (المتوفر: {stats.earnings - stats.withdrawn} ج)
           </Button>
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
              <ArrowLeft className="w-4 h-4" />
              نسخ الرابط
            </Button>
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-black text-surface-fg mb-6 text-right">الأرباح من الإحالات</h2>
            <div className="bg-surface-card rounded-3xl border border-surface shadow-soft overflow-hidden">
              <div className="p-6 border-b border-surface bg-slate-50/50">
                 <div className="grid grid-cols-3 gap-4 text-center">
                   <div>
                     <div className="text-xs text-surface-muted mb-1">عدد الإحالات</div>
                     <div className="text-xl font-black text-surface-fg">{stats.count}</div>
                   </div>
                   <div>
                     <div className="text-xs text-surface-muted mb-1">إجمالي الأرباح</div>
                     <div className="text-xl font-black text-primary">{stats.earnings + stats.pending} ج</div>
                   </div>
                   <div>
                     <div className="text-xs text-surface-muted mb-1">الحالة</div>
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold">
                       <TrendingUp className="w-3 h-3" /> نشط
                     </div>
                   </div>
                 </div>
              </div>
              <div className="divide-y divide-surface">
                {commissions.length > 0 ? (
                  commissions.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-surface-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-surface-fg text-sm">{c.referred?.name || "محل مشترك"}</span>
                        <span className="text-[10px] text-surface-muted">{new Date(c.created_at).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-primary text-sm">+{c.amount} ج</div>
                        <div className={`text-[10px] font-bold ${c.status === "paid" ? "text-success" : "text-amber-500"}`}>
                          {c.status === "paid" ? "تم التحويل" : "انتظار الدفع"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-surface-muted text-sm italic">
                    {stats.count === 0 ? "لا يوجد إحالات بعد. ابدأ بمشاركة رابطك!" : "محل رشحته اشترك، في انتظار اشتراكه في باقة مدفوعة..."}
                  </div>
                )}
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
                  "تقدر تسحب أرباحك لما توصل لـ ٥٠ ج عن طريق فودافون كاش",
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

          {withdrawals.length > 0 && (
            <section>
              <h2 className="text-2xl font-black text-surface-fg mb-6 text-right">طلبات السحب</h2>
              <div className="bg-surface-card rounded-3xl border border-surface shadow-soft overflow-hidden">
                <div className="divide-y divide-surface">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-surface-fg text-sm">{w.account_name}</div>
                        <div className="text-[10px] text-surface-muted">{w.phone_number} • {new Date(w.created_at).toLocaleDateString("ar-EG")}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-surface-fg text-sm">{w.amount} ج</div>
                        <div className={`text-[10px] font-bold ${
                          w.status === "paid" ? "text-success" : 
                          w.status === "pending" ? "text-amber-500" : "text-destructive"
                        }`}>
                          {w.status === "paid" ? "تم التحويل" : w.status === "pending" ? "قيد الانتظار" : "مرفوض"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-surface-card rounded-[2.5rem] p-8 shadow-2xl border border-surface">
            <h2 className="text-2xl font-black text-surface-fg mb-2">سحب الأرباح</h2>
            <p className="text-surface-muted text-sm mb-6">سيتم تحويل المبلغ عبر فودافون كاش خلال ٤٨ ساعة</p>
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-surface-fg mb-1.5">رقم فودافون كاش</label>
                <input 
                  required
                  type="tel"
                  value={withdrawForm.phone}
                  onChange={e => setWithdrawForm({...withdrawForm, phone: e.target.value})}
                  placeholder="010XXXXXXXX"
                  className="w-full h-12 bg-surface-muted border-none rounded-xl px-4 text-surface-fg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-surface-fg mb-1.5">اسم صاحب الحساب</label>
                <input 
                  required
                  type="text"
                  value={withdrawForm.name}
                  onChange={e => setWithdrawForm({...withdrawForm, name: e.target.value})}
                  placeholder="الاسم الثلاثي"
                  className="w-full h-12 bg-surface-muted border-none rounded-xl px-4 text-surface-fg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-muted">المبلغ المتاح للسحب:</span>
                  <span className="font-black text-primary">{stats.earnings - stats.withdrawn} ج</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowWithdrawModal(false)} className="flex-1 rounded-xl h-12">
                  إلغاء
                </Button>
                <Button type="submit" className="flex-1 bg-success text-white hover:bg-success/90 rounded-xl h-12 font-bold shadow-elegant">
                  تأكيد الطلب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Affiliate;
