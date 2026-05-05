import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Gift, TrendingUp, DollarSign, Users, Copy, ArrowLeft, Phone, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 1500;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(start + (end - start) * easeOutExpo);
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        prevValue.current = end;
      }
    };

    requestAnimationFrame(update);
  }, [value]);

  return <span>{displayValue.toLocaleString("ar-EG")}</span>;
};

const Affiliate = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [shopId, setShopId] = useState("");
  const [stats, setStats] = useState({ 
    count: 0, 
    earnings: 0, 
    pending: 0, 
    withdrawn: 0,
    today: 0,
    month: 0
  });

  const LEVELS = [
    { name: "مبتدئ", min: 0, icon: "🌱", color: "bg-slate-100 text-slate-600", next: 3 },
    { name: "مسوّق", min: 3, icon: "🔥", color: "bg-orange-100 text-orange-600", next: 10 },
    { name: "محترف", min: 10, icon: "🚀", color: "bg-primary/10 text-primary", next: 25 },
    { name: "خبير", min: 25, icon: "👑", color: "bg-amber-100 text-amber-600", next: null },
  ];

  const currentLevel = [...LEVELS].reverse().find(l => stats.count >= l.min) || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.min > stats.count);
  const progress = nextLevel 
    ? ((stats.count - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100
    : 100;
  const remaining = nextLevel ? nextLevel.min - stats.count : 0;
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

  const load = useCallback(async () => {
    if (!user) return;
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    setStats({
      count: refCount,
      earnings: list.filter(c => c.status === "paid").reduce((a, c) => a + (c.amount || 0), 0),
      pending: list.filter(c => c.status === "pending").reduce((a, c) => a + (c.amount || 0), 0),
      withdrawn: withList.filter(w => w.status === "paid" || w.status === "pending").reduce((a, w) => a + (w.amount || 0), 0),
      today: list.filter(c => new Date(c.created_at).getTime() >= today).reduce((a, c) => a + (c.amount || 0), 0),
      month: list.filter(c => new Date(c.created_at).getTime() >= month).reduce((a, c) => a + (c.amount || 0), 0),
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  useEffect(() => {
    if (!user || !shopId) return;

    const refSub = supabase
      .channel('new-referrals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'referrals', filter: `referrer_id=eq.${user.id}` },
        () => {
          toast.success("🎉 إحالة جديدة انضمت باسمك!", {
            description: "سيظهر تأثيرها في رصيدك بمجرد اشتراكهم في باقة مدفوعة.",
          });
          void load();
        }
      )
      .subscribe();

    const commSub = supabase
      .channel('new-commissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'commissions', filter: `referrer_shop_id=eq.${shopId}` },
        (payload) => {
          const amount = payload.new.amount;
          toast.success(`💰 مبروك! كسبت ${amount} ج عمولة!`, {
            description: "تمت إضافة عمولة جديدة إلى رصيدك المعلق.",
          });
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(refSub);
      void supabase.removeChannel(commSub);
    };
  }, [user, shopId, load]);

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
    <div className="bg-surface min-h-screen font-sans" dir="rtl">
      <header className="bg-surface-card border-b border-surface px-6 py-4 sticky top-0 z-50 backdrop-blur-md bg-surface-card/80">
        <div className="container mx-auto flex items-center justify-between max-w-4xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-surface-fg/70 hover:bg-surface-muted gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            لوحة التحكم
          </Button>
          <Logo size="md" />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex w-24 h-24 rounded-[2rem] bg-gradient-gold items-center justify-center text-5xl mb-6 shadow-2xl relative">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              💰
            </motion.div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-success rounded-full border-2 border-white animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-surface-fg mb-4 tracking-tight">برنامج الشركاء</h1>
          <p className="text-surface-muted text-xl max-w-2xl mx-auto leading-relaxed">
            رشّح محلات لدَوْرَك واكسب <span className="font-bold text-primary underline underline-offset-4">١٥% عمولة</span> على كل اشتراك.
          </p>
        </motion.div>

        {/* Live Earnings Header */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-[3rem] p-1 shadow-2xl overflow-hidden">
            <div className="bg-white/5 backdrop-blur-xl p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-32 -mb-32" />
              
              <div className="relative z-10">
                <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-widest mb-4">إجمالي أرباحك</span>
                <div className="text-7xl md:text-8xl font-black text-white mb-6 flex items-center justify-center gap-1">
                  <AnimatedNumber value={stats.earnings + stats.pending} />
                  <span className="text-3xl md:text-4xl opacity-70">ج</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                   <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                     <div className="text-white/60 text-[10px] font-bold uppercase mb-1">أرباح اليوم</div>
                     <div className="text-2xl font-black text-white">
                       <AnimatedNumber value={stats.today} />
                       <span className="text-sm ml-1 opacity-60 font-medium">ج</span>
                     </div>
                   </div>
                   <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10 text-right">
                     <div className="text-white/60 text-[10px] font-bold uppercase mb-1">أرباح هذا الشهر</div>
                     <div className="text-2xl font-black text-white">
                       <AnimatedNumber value={stats.month} />
                       <span className="text-sm ml-1 opacity-60 font-medium">ج</span>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Affiliate Level Tracker */}
        <section className="mb-8">
          <div className="bg-surface-card rounded-[2.5rem] p-8 shadow-soft border border-surface overflow-hidden relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-16 -mt-16" />
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${currentLevel.color}`}>
                    {currentLevel.icon}
                  </div>
                  <div>
                    <div className="text-sm text-surface-muted font-bold mb-1">المستوى الحالي</div>
                    <div className="text-2xl font-black text-surface-fg flex items-center gap-2">
                       {currentLevel.name}
                       {nextLevel && <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">نشط</span>}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  {nextLevel ? (
                    <div className="text-sm">
                      <span className="text-surface-muted">باقي </span>
                      <span className="font-black text-primary">{remaining} إحالة</span>
                      <span className="text-surface-muted"> للوصول إلى </span>
                      <span className="font-black text-surface-fg">{nextLevel.name}</span>
                    </div>
                  ) : (
                    <div className="text-sm font-black text-success">لقد وصلت لآخر مستوى! 👑</div>
                  )}
                </div>
              </div>

              <div className="relative h-4 bg-surface-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-y-0 right-0 bg-gradient-to-l from-primary to-primary/60 rounded-full"
                />
              </div>
              
              <div className="flex justify-between mt-2 text-[10px] font-black text-surface-muted uppercase tracking-widest px-1">
                <span>{currentLevel.min} إحالة</span>
                {nextLevel && <span>{nextLevel.min} إحالة</span>}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Gift, label: "نسبة العمولة", value: "١٥%", color: "text-warning bg-warning/10" },
            { icon: TrendingUp, label: "أرباح مؤكدة", value: `${stats.earnings} ج`, color: "text-success bg-success/10" },
            { icon: DollarSign, label: "أرباح معلقة", value: `${stats.pending} ج`, color: "text-primary bg-primary/10" },
            { icon: Users, label: "محلات رشحتها", value: stats.count, color: "text-accent bg-accent/10" },
          ].map((s, i) => (
            <div key={i} className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface text-center hover:scale-[1.02] transition-transform">
              <div className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-4 ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div className="text-2xl font-black text-surface-fg">{s.value}</div>
              <div className="text-xs text-surface-muted mt-1 font-bold">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mb-12">
           <Button 
            onClick={() => {
              const balance = stats.earnings - stats.withdrawn;
              if (balance < 50) {
                toast.info("يجب أن يكون رصيدك 50 ج على الأقل للسحب");
              } else {
                setShowWithdrawModal(true);
              }
            }}
            className="bg-white text-primary border-2 border-primary/20 hover:bg-primary/5 rounded-[2rem] h-16 px-12 font-black text-lg gap-3 shadow-elegant transition-all active:scale-95"
           >
             <DollarSign className="w-6 h-6" />
             سحب الأرباح المتوفرة ({stats.earnings - stats.withdrawn} ج)
           </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Referral Link Box */}
          <div className="md:col-span-2 bg-surface-card rounded-[2.5rem] p-8 shadow-soft border border-surface flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-black text-surface-fg mb-2">رابطك الخاص</h2>
              <p className="text-sm text-surface-muted mb-8 italic">شارك هذا الرابط مع أصحاب المحلات وابدأ في بناء دخلك السلبي</p>
            </div>
            <div className="flex flex-col gap-3">
              <div dir="ltr" className="bg-surface-muted rounded-2xl px-6 py-5 text-sm font-mono text-surface-fg border border-surface truncate text-center font-bold tracking-tight">
                {url}
              </div>
              <Button
                onClick={() => { navigator.clipboard.writeText(url); toast.success("تم النسخ ✓"); }}
                className="bg-gradient-primary text-primary-foreground rounded-2xl h-14 px-8 font-black gap-3 shadow-elegant hover:shadow-2xl transition-all"
              >
                <Copy className="w-5 h-5" />
                نسخ الرابط ونشره
              </Button>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
               <TrendingUp className="w-8 h-8 text-primary" />
             </div>
             <h3 className="font-black text-lg text-primary mb-2">إزاي تكسب أكتر؟</h3>
             <p className="text-xs text-surface-muted leading-relaxed">
               وزع فلاير "دَوْرَك" في المولات أو المحلات المزدحمة في منطقتك، وسجلهم برابطك عشان تضمن عمولتك.
             </p>
          </div>
        </div>

        <div className="space-y-12">
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                 <Clock className="w-5 h-5 text-primary" />
                 <h2 className="text-2xl font-black text-surface-fg">آخر ٥ عمولات</h2>
              </div>
              {commissions.length > 5 && (
                <span className="text-xs font-bold text-primary cursor-pointer hover:underline">عرض الكل</span>
              )}
            </div>
            <div className="bg-surface-card rounded-[2.5rem] border border-surface shadow-soft overflow-hidden">
              <div className="divide-y divide-surface">
                {commissions.length > 0 ? (
                  commissions.slice(0, 5).map((c) => (
                    <div key={c.id} className="p-6 flex items-center justify-between hover:bg-surface-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                          🏪
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-surface-fg text-base">{c.referred?.name || "محل مشترك جديد"}</span>
                          <span className="text-xs text-surface-muted flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(c.created_at).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-primary text-lg">+{c.amount} ج</div>
                        <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${c.status === "paid" ? "text-success bg-success/10" : "text-amber-500 bg-amber-500/10"}`}>
                          {c.status === "paid" ? "تم التحويل" : "انتظار الدفع"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-16 text-center">
                    <div className="text-4xl mb-4">💨</div>
                    <p className="text-surface-muted text-sm italic font-medium">
                      {stats.count === 0 ? "لا يوجد إحالات بعد. ابدأ بمشاركة رابطك!" : "محل رشحته اشترك، في انتظار باقته المدفوعة..."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {withdrawals.length > 0 && (
            <section>
               <div className="flex items-center gap-2 mb-6">
                 <DollarSign className="w-5 h-5 text-success" />
                 <h2 className="text-2xl font-black text-surface-fg">سجل السحوبات</h2>
              </div>
              <div className="bg-surface-card rounded-[2.5rem] border border-surface shadow-soft overflow-hidden">
                <div className="divide-y divide-surface">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
                          <ArrowLeft className="w-6 h-6 rotate-45" />
                        </div>
                        <div>
                          <div className="font-black text-surface-fg text-base">{w.account_name}</div>
                          <div className="text-xs text-surface-muted font-mono">{w.phone_number} • {new Date(w.created_at).toLocaleDateString("ar-EG")}</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-surface-fg text-lg">{w.amount} ج</div>
                        <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          w.status === "paid" ? "text-success bg-success/10" : 
                          w.status === "pending" ? "text-amber-500 bg-amber-500/10" : "text-destructive bg-destructive/10"
                        }`}>
                          {w.status === "paid" ? "تم" : w.status === "pending" ? "انتظار" : "مرفوض"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="bg-surface-card border border-surface rounded-[3rem] p-10 shadow-soft relative overflow-hidden text-right">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
               <Logo size="xl" />
            </div>
            <h3 className="text-3xl font-black text-surface-fg mb-8">إزاي البرنامج بيشتغل؟</h3>
            <div className="grid md:grid-cols-2 gap-10">
              <ol className="space-y-8">
                {[
                  { t: "شارك رابطك الخاص مع أصحاب المحلات في منطقتك", i: "🔗" },
                  { t: "لما حد يشترك من خلال رابطك، تتسجل إحالة باسمك", i: "📝" },
                  { t: "لما المشترك يفعل باقة مدفوعة، هتحصل على عمولة ١٥%", i: "💎" },
                  { t: "العمولة بتستمر لمدة ١٢ شهر من تاريخ اشتراك صاحب المحل", i: "📅" },
                  { t: "تقدر تسحب أرباحك لما توصل لـ ٥٠ ج عن طريق فودافون كاش", i: "📱" },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-5 text-surface-fg">
                    <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-2xl flex-shrink-0 mt-0.5 shadow-sm">
                      {step.i}
                    </div>
                    <span className="font-bold text-xl leading-snug">{step.t}</span>
                  </li>
                ))}
              </ol>
              <div className="bg-primary/5 rounded-3xl p-8 border-2 border-primary/10 flex flex-col items-center justify-center text-center space-y-6">
                 <div className="w-20 h-20 bg-white rounded-[2rem] shadow-elegant flex items-center justify-center">
                   <Logo size="lg" />
                 </div>
                 <p className="text-base text-surface-muted leading-relaxed font-medium">هدفنا نكبر سوا، ونوصل دَوْرَك لكل مكان في مصر والوطن العربي. 🚀</p>
                 <Button 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl gap-3 border-primary/20 text-primary font-black text-lg hover:bg-primary/10" 
                    onClick={() => window.open("https://wa.me/201035851931", "_blank")}
                 >
                   <Phone className="w-5 h-5 text-success" /> تواصل معنا (واتساب)
                 </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-surface/80 backdrop-blur-xl">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="w-full max-w-md bg-surface-card rounded-[3rem] p-10 shadow-2xl border border-surface relative"
            >
              <h2 className="text-3xl font-black text-surface-fg mb-3">سحب الأرباح</h2>
              <p className="text-surface-muted text-base mb-8 leading-relaxed">سيتم تحويل المبلغ عبر <span className="font-bold text-destructive underline underline-offset-4">فودافون كاش</span> خلال ٤٨ ساعة عمل.</p>
              
              <form onSubmit={handleWithdraw} className="space-y-6">
                <div>
                  <label className="block text-sm font-black text-surface-fg mb-2 uppercase tracking-wide">رقم فودافون كاش</label>
                  <input 
                    required
                    type="tel"
                    value={withdrawForm.phone}
                    onChange={e => setWithdrawForm({...withdrawForm, phone: e.target.value})}
                    placeholder="010XXXXXXXX"
                    className="w-full h-14 bg-surface-muted border-2 border-transparent focus:border-primary rounded-2xl px-6 text-surface-fg font-mono font-bold text-lg outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-surface-fg mb-2 uppercase tracking-wide">اسم صاحب الحساب</label>
                  <input 
                    required
                    type="text"
                    value={withdrawForm.name}
                    onChange={e => setWithdrawForm({...withdrawForm, name: e.target.value})}
                    placeholder="الاسم الثلاثي بالكامل"
                    className="w-full h-14 bg-surface-muted border-2 border-transparent focus:border-primary rounded-2xl px-6 text-surface-fg font-bold text-lg outline-none transition-all"
                  />
                </div>

                <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-surface-muted font-bold">المبلغ المطلوب:</span>
                    <span className="text-3xl font-black text-primary">{stats.earnings - stats.withdrawn} ج</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="ghost" onClick={() => setShowWithdrawModal(false)} className="flex-1 rounded-2xl h-14 font-bold text-surface-muted">
                    إلغاء
                  </Button>
                  <Button type="submit" className="flex-2 bg-success text-white hover:bg-success/90 rounded-2xl h-14 font-black shadow-elegant text-lg">
                    تأكيد وتحويل
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Affiliate;
