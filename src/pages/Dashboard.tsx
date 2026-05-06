import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { QRCodeSVG } from "qrcode.react";
import { Clock, Users, CheckCircle2, Activity, LogOut, RefreshCw, Copy, Download, ExternalLink, Sparkles, ChevronLeft, Crown, Lock, Palette, FileText, FileImage, FileCode, Plus, Trash2, Pencil, Building2, UserPlus, X, Check, BarChart3, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";
import { hasFeature, PlanId, planForFeature, PLANS } from "@/lib/plans";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import html2canvas from "html2canvas";

type Shop = { id: string; name: string; slug: string; plan: string; brand_color: string | null; logo_url: string | null; description: string | null; daily_limit: number | null };
type Queue = { id: string; name: string; current_serving: number; slug: string; branch_id: string | null };
type Entry = { id: string; number: number; customer_name: string | null; status: string; joined_at: string; served_at: string | null };

const Dashboard = () => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section"); // null | "branding" | "branches" | "staff" | "reports"
  const [shop, setShop] = useState<Shop | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState({ 
    avgWait: 0, 
    waiting: 0, 
    served: 0, 
    total: 0,
    peakHours: [] as { hour: number; count: number }[] 
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const currentLimit = shop?.daily_limit ?? (shop?.plan === "free" ? 10 : Infinity);
  const isLimitReached = shop?.plan === "free" && stats.total >= currentLimit;

  useEffect(() => {
    console.log("[Dashboard] auth state", { loading, hasUser: !!user, userId: user?.id });
    if (!loading && !user) {
      console.log("[Dashboard] No user after loading complete, redirecting to /login");
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user]);

  useEffect(() => {
    if (!shop || !queue) return;
    const ch = supabase
      .channel(`shop-${shop.id}-${queue.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `queue_id=eq.${queue.id}` }, () => loadEntries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shop, queue]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-slate-800">جاري تحميل لوحة التحكم...</h2>
        <p className="text-slate-500 mt-2">يرجى الانتظار بينما نجهز بياناتك</p>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-8 opacity-50">
          إذا طال الانتظار، اضغط هنا للتحديث
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-slate-800">جاري التحقق من بياناتك...</h2>
        <p className="text-slate-500 mt-2">يرجى الانتظار ثواني</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="mt-8">
          العودة لتسجيل الدخول
        </Button>
      </div>
    );
  }

  const loadData = async () => {
    try {
      // 1. Try to fetch existing shop
      const { data: shopsList, error: shopsErr } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1);
      
      if (shopsErr) throw shopsErr;
      
      let s = (shopsList ?? [])[0] ?? null;
      
      // 2. If no shop exists, create one
      if (!s) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("shop_name")
          .eq("id", user!.id)
          .maybeSingle();

        const slug = profile?.shop_name 
          ? profile.shop_name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)
          : `shop-${Math.random().toString(36).substring(2, 10)}`;

        const { data: created, error: createErr } = await supabase
          .from("shops")
          .insert({ 
            owner_id: user!.id, 
            name: profile?.shop_name || "محلي",
            slug: slug,
            active: true
          })
          .select()
          .maybeSingle();

        // If insert fails due to unique constraint, try fetching one more time
        if (createErr) {
          if (createErr.code === '23505') { // Unique constraint violation
            const { data: retryList } = await supabase
              .from("shops")
              .select("*")
              .eq("owner_id", user!.id)
              .limit(1);
            s = (retryList ?? [])[0] ?? null;
          } else {
            throw createErr;
          }
        } else {
          s = created;
        }
      }

      if (!s) throw new Error("تعذّر تحميل بيانات المحل");
      setShop(s as Shop);
      await loadQueues((s as Shop).id);
    } catch (err) {
      console.error("[Dashboard] loadData error", err);
      const msg = err instanceof Error ? err.message : "تعذّر تحميل لوحة التحكم";
      toast.error(msg);
    }
  };

  const loadQueues = async (shopId?: string, preferQueueId?: string) => {
    const sid = shopId ?? shop?.id;
    if (!sid) return;
    const { data } = await supabase.from("queues").select("*").eq("shop_id", sid).order("created_at", { ascending: true });
    let list = (data ?? []) as Queue[];
    if (list.length === 0) {
      const { data: createdQ } = await supabase.from("queues").insert({ shop_id: sid }).select().single();
      if (createdQ) list = [createdQ as Queue];
    }
    setQueues(list);
    const next = list.find(q => q.id === preferQueueId) ?? list.find(q => q.id === queue?.id) ?? list[0];
    setQueue(next ?? null);
    if (next) void loadEntries(sid, next.id);
  };

  const loadEntries = async (shopId?: string, queueId?: string) => {
    const sid = shopId ?? shop?.id;
    const qid = queueId ?? queue?.id;
    if (!sid || !qid) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("queue_entries")
      .select("id, number, customer_name, status, joined_at, served_at")
      .eq("shop_id", sid)
      .eq("queue_id", qid)
      .gte("joined_at", today.toISOString())
      .order("number", { ascending: true });
    const list = (data ?? []) as Entry[];
    setEntries(list);
    
    // Stats calculation
    const served = list.filter(e => e.status === "done" && e.served_at);
    const waiting = list.filter(e => e.status === "waiting");
    
    // Actual average wait: time between joining and being served
    const avg = served.length
      ? Math.round(served.reduce((a, e) => {
          const joined = new Date(e.joined_at).getTime();
          const served = new Date(e.served_at!).getTime();
          return a + (served - joined) / 60000;
        }, 0) / served.length)
      : (stats.avgWait || 0);

    // Peak times: grouping by hour
    const hourCounts: Record<number, number> = {};
    list.forEach(e => {
      const hour = new Date(e.joined_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peak = Object.entries(hourCounts)
      .map(([h, c]) => ({ hour: parseInt(h), count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    setStats({ 
      avgWait: avg || 0, 
      waiting: waiting.length, 
      served: served.length, 
      total: list.length,
      peakHours: peak
    });
  };

  const callNext = async () => {
    if (!queue || !shop) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: fresh } = await supabase
      .from("queue_entries")
      .select("id, number, customer_name, status, joined_at, served_at")
      .eq("queue_id", queue.id)
      .gte("joined_at", today.toISOString())
      .in("status", ["waiting", "serving"])
      .order("number", { ascending: true });
    const list = (fresh ?? []) as Entry[];
    const serving = list.find(e => e.status === "serving");
    const next = list.find(e => e.status === "waiting");

    if (serving) {
      const { error } = await supabase
        .from("queue_entries")
        .update({ status: "done", done_at: new Date().toISOString() })
        .eq("id", serving.id);
      if (error) { toast.error("تعذّر تحديث الحالة"); return; }
    }

    if (next) {
      const { error: e2 } = await supabase
        .from("queue_entries")
        .update({ status: "serving", served_at: new Date().toISOString() })
        .eq("id", next.id);
      if (e2) { toast.error("تعذّر نداء التالي"); return; }
      await supabase.from("queues").update({ current_serving: next.number }).eq("id", queue.id);
      toast.success(`🔔 تم نداء رقم ${next.number}`);
    } else if (serving) {
      await supabase.from("queues").update({ current_serving: serving.number }).eq("id", queue.id);
      toast.success(`✅ تم إنهاء خدمة رقم ${serving.number}`);
    } else {
      toast.info("الطابور فاضي حالياً");
    }
    await loadEntries();
  };

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  useEffect(() => {
    const seen = localStorage.getItem("dourak_onboarding_seen");
    if (!seen && shop) {
      setShowOnboarding(true);
    }
  }, [shop]);

  const finishOnboarding = () => {
    localStorage.setItem("dourak_onboarding_seen", "true");
    setShowOnboarding(false);
  };

  if (loading || (!shop && user)) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-slate-800">جاري تحميل بياناتك...</h2>
        <p className="text-slate-500 mt-2">يرجى الانتظار ثواني بينما نجهز لوحة التحكم</p>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-8">
          تحديث الصفحة
        </Button>
      </div>
    );
  }
  if (!shop) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="bg-surface-card rounded-2xl p-6 border border-surface text-center max-w-md">
          <div className="text-surface-fg font-bold mb-2">تعذّر تحميل لوحة التحكم</div>
          <div className="text-surface-muted text-sm mb-4">حاول إعادة تحميل الصفحة أو سجّل الخروج ثم الدخول مرة أخرى.</div>
          <Button onClick={() => loadData()} className="bg-gradient-primary text-primary-foreground">إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  const customerUrl = queue?.slug
    ? `${window.location.origin}/q/${shop.slug}/${queue.slug}`
    : `${window.location.origin}/q/${shop.slug}`;
  const planLabel = shop.plan === "free" ? "مجاني" : shop.plan === "pro" ? "إحترافي" : "الأعمال";

  const getQRSvgString = () => {
    const svg = document.getElementById("shop-qr") as unknown as SVGElement | null;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadQRSvg = () => {
    const data = getQRSvgString();
    if (!data) return;
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${shop.slug}-qr.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadQRPng = (scale = 4) => {
    const data = getQRSvgString();
    if (!data) return;
    const baseSize = 240;
    const size = baseSize * scale;
    const padding = 32 * scale;
    const total = size + padding * 2;
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = total;
      canvas.height = total;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, total, total);
      ctx.drawImage(img, padding, padding, size, size);
      canvas.toBlob((blob) => {
        if (!blob) { toast.error("تعذّر إنشاء صورة QR"); return; }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${shop.slug}-qr.png`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    };
    img.onerror = () => toast.error("تعذّر إنشاء صورة QR");
    img.src = svgUrl;
  };

  return (
    <div className="bg-surface min-h-screen" dir="rtl">
      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-surface rounded-[2.5rem] p-8 shadow-2xl border border-surface overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <Logo size="md" />
              <Button variant="ghost" size="icon" onClick={() => setShowUpgradeModal(false)} className="rounded-full">
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-surface-fg animate-in slide-in-from-top duration-500">اختر الباقة المثالية لنمو عملك</h2>
              <p className="text-surface-muted mt-2">كل المميزات اللي محتاجها في مكان واحد</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {Object.values(PLANS).map((p) => (
                <div key={p.id} className={`p-6 rounded-3xl border transition-all ${p.id === "pro" ? "bg-gradient-primary text-white border-transparent scale-105 shadow-elegant" : "bg-surface-card border-surface shadow-soft"}`}>
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-black">{p.name}</h3>
                    <div className="flex items-baseline justify-center gap-1 mt-2">
                       <span className="text-4xl font-black">{p.price}</span>
                       <span className="text-xs opacity-70">ج/شهر</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8 min-h-[200px]">
                    {p.features.map(f => (
                      <li key={f.key} className="flex items-start gap-2 text-sm text-right">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${p.id === "pro" ? "text-white" : "text-success"}`} />
                        <span className={p.id === "pro" ? "text-white/90" : "text-surface-fg/90"}>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => { setShowUpgradeModal(false); navigate("/pricing"); }}
                    className={`w-full rounded-2xl h-12 font-black ${p.id === "pro" ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white hover:bg-primary/90"}`}
                  >
                    {shop?.plan === p.id ? "باقتك الحالية" : p.cta}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-full max-w-md bg-surface-card border border-surface rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            {/* Steps indicator */}
            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    onboardingStep === s ? "w-8 bg-primary" : "w-2 bg-surface-muted"
                  }`}
                />
              ))}
            </div>

            {onboardingStep === 1 && (
              <div className="text-center space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-gradient-primary rounded-3xl mx-auto flex items-center justify-center shadow-elegant">
                  <Logo size="lg" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-surface-fg">أهلاً بك في دَوْرَك 👋</h2>
                  <p className="text-surface-muted">خلّي الزباين تاخد دورها بدون زحمة</p>
                </div>
                <Button onClick={() => setOnboardingStep(2)} className="w-full h-14 bg-gradient-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-elegant">
                  ابدأ الآن
                </Button>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                <h2 className="text-2xl font-black text-surface-fg text-center mb-8">إزاي دورك بيشتغل؟</h2>
                <div className="space-y-4">
                  {[
                    { icon: "📱", text: "الزبون يمسح QR" },
                    { icon: "🔢", text: "يدخل اسمه أو رقم الايصال" },
                    { icon: "⏳", text: "يعرف دوره ويستنى برا" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-surface-muted rounded-2xl border border-surface">
                      <span className="text-2xl">{step.icon}</span>
                      <span className="font-bold text-surface-fg">{step.text}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setOnboardingStep(3)} className="w-full h-14 bg-gradient-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-elegant mt-4">
                  تمام 👍 خلّيني أبدأ
                </Button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="text-center space-y-6 animate-in slide-in-from-left-4 duration-500">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-surface-fg">أنت جاهز! 🚀</h2>
                  <p className="text-surface-muted">اطبع الكود وحطه عند الكاشير</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-surface inline-block mx-auto">
                  <QRCodeSVG value={customerUrl} size={150} fgColor="#6366f1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(customerUrl); toast.success("تم نسخ الرابط"); }} className="rounded-xl border-surface h-12 gap-2">
                    <Copy className="w-4 h-4" /> نسخ الرابط
                  </Button>
                  <Button variant="outline" onClick={() => downloadQRPng(4)} className="rounded-xl border-surface h-12 gap-2">
                    <Download className="w-4 h-4" /> تحميل QR
                  </Button>
                </div>

                <Button onClick={finishOnboarding} className="w-full h-14 bg-success text-success-foreground rounded-2xl font-bold text-lg shadow-elegant">
                  افتح لوحة التحكم
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-surface-card border-b border-surface px-6 py-4 sticky top-0 z-30">
        {/* Upsell Banner */}
        {shop.plan === "free" && (
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 -mx-6 -mt-4 mb-4 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-surface-fg">استخدم كل المميزات مع الباقة الاحترافية</span>
            </div>
            <Button variant="link" size="sm" onClick={() => setShowUpgradeModal(true)} className="text-xs font-black text-primary p-0 h-auto">
              ترقية الآن 👋
            </Button>
          </div>
        )}

        <div className="container mx-auto flex items-center justify-between max-w-7xl gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/admin")} 
                className="gap-1 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Shield className="w-4 h-4" /> المشرف
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/pricing")} className="gap-1">
              <Crown className="w-4 h-4" /> الباقات
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/affiliate")} className="gap-1">
              <Sparkles className="w-4 h-4" /> الشركاء
            </Button>
            <Button variant="outline" size="icon" onClick={() => loadData()} title="تحديث">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => signOut().then(() => navigate("/"))} title="تسجيل خروج">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-left">
            <Logo size="md" />
            <div className="text-xs text-surface-muted mt-0.5">{shop.name} · {planLabel}</div>
          </div>
        </div>
        {/* Section nav */}
        <div className="container mx-auto max-w-7xl mt-3 flex items-center gap-2 flex-wrap">
          <DashNavLink active={!section} onClick={() => setSearchParams({})} icon={<Activity className="w-3.5 h-3.5" />} label="الداشبورد" />
          <DashNavLink
            active={section === "branding"}
            disabled={!hasFeature(shop.plan as PlanId, "branding")}
            onClick={() => setSearchParams({ section: "branding" })}
            icon={<Palette className="w-3.5 h-3.5" />}
            label="تخصيص المحل"
            requiredPlan={!hasFeature(shop.plan as PlanId, "branding") ? "إحترافي" : undefined}
          />
          <DashNavLink
            active={section === "branches"}
            disabled={!hasFeature(shop.plan as PlanId, "multi_branch")}
            onClick={() => setSearchParams({ section: "branches" })}
            icon={<Building2 className="w-3.5 h-3.5" />}
            label="إضافة فرع"
            requiredPlan={!hasFeature(shop.plan as PlanId, "multi_branch") ? "الأعمال" : undefined}
          />
          <DashNavLink
            active={section === "staff"}
            disabled={!hasFeature(shop.plan as PlanId, "staff_accounts")}
            onClick={() => setSearchParams({ section: "staff" })}
            icon={<UserPlus className="w-3.5 h-3.5" />}
            label="إضافة موظف"
            requiredPlan={!hasFeature(shop.plan as PlanId, "staff_accounts") ? "الأعمال" : undefined}
          />
          <DashNavLink
            active={section === "reports"}
            disabled={!hasFeature(shop.plan as PlanId, "exports")}
            onClick={() => setSearchParams({ section: "reports" })}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="التقارير"
            requiredPlan={!hasFeature(shop.plan as PlanId, "exports") ? "الأعمال" : undefined}
          />
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {section === "branding" ? (
          <BrandingSection shop={shop} onUpdate={loadData} />
        ) : section === "branches" ? (
          <BranchesSection shop={shop} />
        ) : section === "staff" ? (
          <StaffSection shop={shop} />
        ) : section === "reports" ? (
          <ReportsSection shop={shop} />
        ) : (
          <>
            {/* Stats */}
            {isLimitReached && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 mb-8 flex items-center justify-between gap-4 animate-in zoom-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-destructive/20 rounded-full flex items-center justify-center text-destructive">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-destructive text-sm">وصلت للحد اليومي (10 زبائن)</div>
                    <div className="text-xs text-destructive/80 font-medium">اشترك في الباقة الاحترافية لعدد غير محدود</div>
                  </div>
                </div>
                <Button onClick={() => setShowUpgradeModal(true)} size="sm" className="bg-destructive text-white hover:bg-destructive/90 rounded-full font-bold px-5">
                  ترقية الآن
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { icon: Clock, value: `${stats.avgWait} دقيقة`, label: "متوسط الانتظار", color: "text-primary bg-primary/10" },
                { icon: Activity, value: stats.waiting, label: "ينتظرون الآن", color: "text-warning bg-warning/10" },
                { icon: CheckCircle2, value: stats.served, label: "تم خدمتهم", color: "text-success bg-success/10" },
                { icon: Users, value: stats.total, label: "إجمالي اليوم", color: "text-accent bg-accent/10" },
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

            {/* Peak Times & Deep Analysis */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-warning" />
                  <h3 className="font-black text-surface-fg">أوقات الذروة (اليوم)</h3>
                </div>
                {stats.peakHours.length > 0 ? (
                  <div className="space-y-3">
                    {stats.peakHours.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-surface-muted rounded-2xl">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center font-bold text-xs">
                            {i + 1}
                          </span>
                          <span className="font-bold text-surface-fg">الساعة {p.hour}:00</span>
                        </div>
                        <span className="text-sm font-black text-surface-muted">{p.count} زبون</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-surface-muted text-sm italic">لا توجد بيانات كافية حالياً</div>
                )}
              </div>
              <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface flex flex-col justify-center">
                 <div className="text-center">
                   <div className="text-surface-muted text-xs font-bold mb-2 uppercase tracking-widest">نبض المحل</div>
                   <div className="text-5xl font-black text-primary mb-2">{stats.waiting > 0 ? "نشط 🔥" : "هادئ 🌿"}</div>
                   <p className="text-sm text-surface-muted font-medium">بناءً على طلبات الانضمام الحالية</p>
                 </div>
              </div>
            </div>

            {/* Queues management (طوابيرك) */}
            <QueueTabs
              shop={shop}
              queues={queues}
              activeQueueId={queue?.id ?? null}
              onSelect={(q) => { setQueue(q); void loadEntries(shop.id, q.id); }}
              onChange={() => loadQueues(shop.id, queue?.id)}
            />

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Waiting list */}
              <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-surface-fg">قائمة الانتظار</h2>
                    <p className="text-sm text-surface-muted">{stats.waiting} شخص ينتظر · {queue?.name ?? ""}</p>
                  </div>
                  <Button onClick={callNext} className="bg-gradient-primary text-primary-foreground rounded-full gap-1 shadow-elegant">
                    <ChevronLeft className="w-4 h-4" />
                    نادي التالي
                  </Button>
                </div>

                {entries.filter(e => e.status === "waiting" || e.status === "serving").length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">✨</div>
                    <div className="text-surface-fg font-bold">الطابور فاضي حالياً</div>
                    <div className="text-surface-muted text-sm mt-1">شارك رمز QR عشان الزبائن يدخلوا</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {entries.filter(e => e.status === "waiting" || e.status === "serving").map((e) => (
                      <div key={e.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition ${
                        e.status === "serving" ? "bg-primary/5 border-primary/30" : "bg-surface-muted border-surface"
                      }`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                          e.status === "serving" ? "bg-gradient-primary text-white" : "bg-surface-card text-surface-fg border border-surface"
                        }`}>
                          {e.number}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-surface-fg">{e.customer_name || "زبون"}</div>
                          <div className="text-xs text-surface-muted">
                            {e.status === "serving" ? "🔔 يُخدم الآن" : `انضم ${new Date(e.joined_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* QR — per active queue */}
              <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-black text-surface-fg">رمز QR الخاص بمحلك</h2>
                  <p className="text-sm text-surface-muted">
                    رمز خاص بطابور <span className="font-bold text-surface-fg">{queue?.name ?? ""}</span> — اطبعه وضعه عند الكاشير
                  </p>
                </div>

                <div className="bg-white border border-surface rounded-2xl p-6 max-w-xs mx-auto mb-5">
                  <QRCodeSVG id="shop-qr" value={customerUrl} size={240} fgColor="#6366f1" className="w-full h-auto" />
                </div>

                <div className="bg-surface-muted rounded-xl p-3 text-xs text-surface-muted text-center font-mono mb-4 break-all" dir="ltr">
                  {customerUrl}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => window.open(customerUrl, "_blank")} className="border-surface text-surface-fg hover:bg-surface-muted">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" title="تحميل QR" className="border-surface text-surface-fg hover:bg-surface-muted">
                        <Download className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => downloadQRPng(4)} className="gap-2 cursor-pointer">
                        <FileImage className="w-4 h-4" />
                        تحميل PNG (مُوصى به للطباعة)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={downloadQRSvg} className="gap-2 cursor-pointer">
                        <FileCode className="w-4 h-4" />
                        تحميل SVG (جودة لانهائية)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(customerUrl); toast.success("تم نسخ الرابط"); }}
                    className="flex-1 border-surface text-surface-fg hover:bg-surface-muted gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    نسخ الرابط
                  </Button>
                </div>
              </div>
            </div>

            {/* Customer history */}
            <CustomerHistorySection shop={shop} entries={entries} />
          </>
        )}
      </main>
    </div>
  );
};

// ============== Dashboard nav link ==============
const DashNavLink = ({
  active,
  disabled,
  onClick,
  icon,
  label,
  requiredPlan,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  requiredPlan?: string;
}) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (disabled) {
      toast.info(`متاح في باقة ${requiredPlan}`);
      navigate("/pricing");
      return;
    }
    onClick();
  };
  return (
    <button
      onClick={handleClick}
      title={disabled ? `متاح في باقة ${requiredPlan}` : label}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border",
        active
          ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft"
          : disabled
            ? "bg-surface-muted text-surface-muted border-surface opacity-50"
            : "bg-surface-card text-surface-fg border-surface hover:bg-surface-muted",
      ].join(" ")}
    >
      {icon}
      {label}
      {disabled && <Lock className="w-3 h-3 mr-1" />}
    </button>
  );
};

// ============== Branding (Pro+) ==============
const PRESET_COLORS = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#EC4899", "#8B5CF6", "#6366F1", "#0D9488"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const BrandingSection = ({ shop, onUpdate }: { shop: Shop; onUpdate: () => void }) => {
  const navigate = useNavigate();
  const unlocked = hasFeature(shop.plan as PlanId, "branding");
  const [name, setName] = useState(shop.name || "");
  const [color, setColor] = useState(shop.brand_color || "#0D9488");
  const [logoUrl, setLogoUrl] = useState(shop.logo_url || "");
  const [description, setDescription] = useState(shop.description || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const initial = (name || "a").trim().charAt(0).toUpperCase();

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast.error("الصيغة المسموح بها: PNG / JPG / SVG");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("الحجم الأقصى للشعار 2MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      setUploading(false);
    };
    reader.onerror = () => {
      toast.error("تعذّر قراءة الملف");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({ name: name.trim() || shop.name, brand_color: color, logo_url: logoUrl || null, description: description.trim() || null })
      .eq("id", shop.id);
    setSaving(false);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم حفظ التخصيصات");
    onUpdate();
  };

  const reset = () => {
    setName(shop.name || "");
    setColor(shop.brand_color || "#0D9488");
    setLogoUrl(shop.logo_url || "");
    setDescription(shop.description || "");
  };

  return (
    <div className={`bg-surface-card rounded-3xl p-6 md:p-8 shadow-soft border border-surface relative overflow-hidden ${!unlocked ? "select-none" : ""}`}>
      {!unlocked && (
        <div className="absolute inset-0 bg-surface-card/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => navigate("/pricing")}>
          <div className="bg-primary/10 text-primary rounded-full p-3"><Lock className="w-6 h-6" /></div>
          <div className="text-surface-fg font-bold">تخصيص الشعار واللون</div>
          <div className="text-xs text-surface-muted">متاح في باقة <span className="text-primary font-bold">{PLANS[planForFeature("branding") || "pro"].name}</span></div>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground rounded-full mt-1">رقّ الباقة</Button>
        </div>
      )}

      <div className={`flex items-center gap-2 mb-6 ${!unlocked ? "opacity-40" : ""}`}>
        <Palette className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-black text-surface-fg">تخصيص المحل</h2>
      </div>

      <div className={`max-w-xl mx-auto space-y-6 ${!unlocked ? "opacity-40" : ""}`}>
        {/* Shop name */}
        <div>
          <label className="block text-sm font-bold text-surface-fg mb-2 text-right">اسم المحل</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!unlocked}
            className="bg-surface-muted border-surface text-surface-fg text-right h-12 rounded-2xl"
            style={{ borderColor: color, borderWidth: 2 }}
          />
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-bold text-surface-fg mb-2 text-right">شعار المحل</label>
          <div className="flex items-center gap-3">
            <label
              className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl border border-dashed border-surface bg-surface-muted/40 ${unlocked ? "cursor-pointer hover:bg-surface-muted" : "cursor-not-allowed"}`}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                disabled={!unlocked || uploading}
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
              <span className="text-sm text-surface-fg">{uploading ? "جارٍ الرفع..." : "رفع شعار"}</span>
              <Download className="w-4 h-4 rotate-180 text-surface-muted" />
            </label>
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black overflow-hidden flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="شعار المحل" className="w-full h-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-surface-muted mt-2 text-right">PNG / JPG / SVG — الحد الأقصى 2MB</p>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-bold text-surface-fg mb-2 text-right">اللون الرئيسي</label>
          <div className="flex items-center gap-3">
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={!unlocked}
              className="flex-1 bg-surface-muted border-surface text-surface-fg h-12 rounded-2xl font-mono"
              dir="ltr"
            />
            <div
              className="w-12 h-12 rounded-xl border border-surface flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!unlocked}
                onClick={() => setColor(c)}
                aria-label={`اللون ${c}`}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-surface-fg/40" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Description (public profile) */}
        <div>
          <label className="block text-sm font-bold text-surface-fg mb-2 text-right">وصف مختصر للمحل</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!unlocked}
            rows={3}
            maxLength={280}
            placeholder="مثال: صالون حلاقة رجالي · مفتوح من 10ص حتى 12م"
            className="bg-surface-muted border-surface text-surface-fg text-right rounded-2xl"
          />
          <p className="text-xs text-surface-muted mt-2 text-right">
            يظهر في صفحة محلّك العامة · {description.length}/280
          </p>
        </div>

        {/* Public profile link */}
        <div className="bg-surface-muted/50 border border-surface rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-right min-w-0 flex-1">
            <div className="text-sm font-bold text-surface-fg">صفحة محلّك العامة</div>
            <div className="text-xs text-surface-muted font-mono break-all" dir="ltr">
              {window.location.origin}/shop/{shop.slug}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!unlocked}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/shop/${shop.slug}`);
                toast.success("تم نسخ الرابط");
              }}
              className="rounded-full gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> نسخ
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!unlocked}
              onClick={() => window.open(`/shop/${shop.slug}`, "_blank")}
              className="bg-gradient-primary text-primary-foreground rounded-full gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> فتح
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={save}
            disabled={!unlocked || saving}
            className="bg-gradient-primary text-primary-foreground rounded-full px-8 h-11"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            disabled={!unlocked || saving}
            className="text-surface-fg rounded-full"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============== Customer history ==============
const CustomerHistorySection = ({ shop, entries }: { shop: Shop; entries: Entry[] }) => {
  const navigate = useNavigate();
  const fullAccess = hasFeature(shop.plan as PlanId, "customer_history");
  const done = entries.filter(e => e.status === "done");
  if (done.length === 0) return null;
  const visible = fullAccess ? done.slice().reverse() : done.slice(-12).reverse();

  return (
    <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-surface-fg">سجل العملاء</h2>
          <p className="text-xs text-surface-muted">
            {fullAccess ? `${done.length} زبون اليوم — سجل كامل` : `أحدث 12 زبون فقط · رقّ لباقة إحترافي للسجل الكامل`}
          </p>
        </div>
        {!fullAccess && (
          <Button size="sm" variant="outline" onClick={() => navigate("/pricing")} className="border-primary/30 text-primary gap-1">
            <Lock className="w-3 h-3" /> فتح السجل الكامل
          </Button>
        )}
      </div>
      {fullAccess ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-muted border-b border-surface">
                <th className="text-right py-2 px-2">رقم</th>
                <th className="text-right py-2 px-2">الاسم</th>
                <th className="text-right py-2 px-2">انضم</th>
                <th className="text-right py-2 px-2">خُدم</th>
                <th className="text-right py-2 px-2">دقائق انتظار</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(e => {
                const wait = e.served_at ? Math.round((new Date(e.served_at).getTime() - new Date(e.joined_at).getTime()) / 60000) : 0;
                return (
                  <tr key={e.id} className="border-b border-surface text-surface-fg">
                    <td className="py-2 px-2 font-bold">#{e.number}</td>
                    <td className="py-2 px-2">{e.customer_name || "زبون"}</td>
                    <td className="py-2 px-2 text-surface-muted text-xs">{new Date(e.joined_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-2 px-2 text-surface-muted text-xs">{e.served_at ? new Date(e.served_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td className="py-2 px-2"><span className="bg-success/10 text-success font-bold px-2 py-0.5 rounded-md text-xs">{wait}د</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {visible.map(e => (
            <div key={e.id} className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
              <div className="font-black text-surface-fg">#{e.number}</div>
              <div className="text-xs text-surface-muted truncate">{e.customer_name || "زبون"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== Multi-queue tabs (Pro+) ==============
const QueueTabs = ({
  shop,
  queues,
  activeQueueId,
  onSelect,
  onChange,
}: {
  shop: Shop;
  queues: Queue[];
  activeQueueId: string | null;
  onSelect: (q: Queue) => void;
  onChange: () => void;
}) => {
  const navigate = useNavigate();
  const unlocked = hasFeature(shop.plan as PlanId, "unlimited_queues");
  const branchesUnlocked = hasFeature(shop.plan as PlanId, "multi_branch");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  useEffect(() => {
    if (!branchesUnlocked) return;
    void supabase.from("branches").select("*").eq("shop_id", shop.id).order("created_at")
      .then(({ data }) => setBranches((data ?? []) as Branch[]));
  }, [shop.id, branchesUnlocked]);

  const addQueue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload: { shop_id: string; name: string; branch_id?: string } = { shop_id: shop.id, name: trimmed };
    if (branchesUnlocked && newBranchId) payload.branch_id = newBranchId;
    const { error } = await supabase.from("queues").insert(payload);
    if (error) { toast.error("تعذّر إضافة الطابور"); return; }
    setName(""); setNewBranchId(""); setAdding(false);
    toast.success("تم إضافة الطابور");
    onChange();
  };

  const renameQueue = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("queues").update({ name: trimmed }).eq("id", id);
    if (error) { toast.error("تعذّر التعديل"); return; }
    setEditId(null);
    toast.success("تم التعديل");
    onChange();
  };

  const reassignBranch = async (id: string, branchId: string) => {
    const { error } = await supabase.from("queues").update({ branch_id: branchId || null }).eq("id", id);
    if (error) { toast.error("تعذّر التعديل"); return; }
    toast.success("تم تحديث الفرع");
    onChange();
  };

  const deleteQueue = async (id: string) => {
    if (queues.length <= 1) { toast.error("يجب أن يكون لديك طابور واحد على الأقل"); return; }
    if (!confirm("حذف هذا الطابور وكل بياناته؟")) return;
    const { error } = await supabase.from("queues").delete().eq("id", id);
    if (error) { toast.error("تعذّر الحذف"); return; }
    toast.success("تم الحذف");
    onChange();
  };

  const visibleQueues = filterBranchId
    ? queues.filter(q => q.branch_id === filterBranchId)
    : queues;

  return (
    <div className="bg-surface-card rounded-3xl p-5 shadow-soft border border-surface mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-base font-black text-surface-fg">طوابيرك</h2>
          <span className="text-xs text-surface-muted">({visibleQueues.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {branchesUnlocked && branches.length > 0 && (
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="bg-surface-muted text-surface-fg text-right rounded-full border border-surface h-9 px-3 text-xs"
            >
              <option value="">كل الفروع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {unlocked ? (
            adding ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addQueue()}
                  placeholder="اسم الطابور"
                  className="h-9 w-40 text-right bg-surface-muted text-surface-fg placeholder:text-surface-muted"
                />
                {branchesUnlocked && branches.length > 0 && (
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="bg-surface-muted text-surface-fg text-right rounded-md border border-input h-9 px-2 text-xs"
                  >
                    <option value="">— الفرع —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                <Button size="icon" onClick={addQueue} className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground"><Check className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setAdding(false); setName(""); setNewBranchId(""); }} className="h-9 w-9"><X className="w-4 h-4" /></Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAdding(true)} className="bg-gradient-primary text-primary-foreground rounded-full gap-1">
                <Plus className="w-4 h-4" /> طابور جديد
              </Button>
            )
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate("/pricing")} className="gap-1 border-primary/30 text-primary">
              <Lock className="w-3 h-3" /> طوابير متعددة — رقّ لإحترافي
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {visibleQueues.map((q) => {
          const isActive = q.id === activeQueueId;
          const branch = branches.find(b => b.id === q.branch_id);
          if (editId === q.id) {
            return (
              <div key={q.id} className="flex items-center gap-1 bg-surface-muted rounded-full px-2 py-1">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && renameQueue(q.id)}
                  className="h-7 w-32 text-right text-sm border-0 bg-transparent text-surface-fg"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => renameQueue(q.id)}><Check className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
              </div>
            );
          }
          const url = `${window.location.origin}/q/${shop.slug}/${q.slug}`;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-1 rounded-full transition ${
                isActive ? "bg-gradient-primary text-primary-foreground shadow-elegant" : "bg-surface-muted text-surface-fg hover:bg-surface-muted/70"
              }`}
            >
              <button onClick={() => onSelect(q)} className="px-4 py-1.5 text-sm font-bold flex items-center gap-1.5">
                {q.name}
                {branch && <span className={`text-[10px] font-normal ${isActive ? "opacity-80" : "text-surface-muted"}`}>· {branch.name}</span>}
              </button>
              {unlocked && (
                <>
                  <button
                    onClick={() => { navigator.clipboard.writeText(url); toast.success("تم نسخ رابط الطابور"); }}
                    title="نسخ رابط الطابور"
                    className={`p-1 rounded-full ${isActive ? "hover:bg-white/20" : "hover:bg-surface-card"}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setEditId(q.id); setEditName(q.name); }}
                    title="تعديل"
                    className={`p-1 rounded-full ${isActive ? "hover:bg-white/20" : "hover:bg-surface-card"}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {branchesUnlocked && branches.length > 0 && (
                    <select
                      value={q.branch_id || ""}
                      onChange={(e) => reassignBranch(q.id, e.target.value)}
                      title="تغيير الفرع"
                      className={`text-[10px] rounded-full bg-transparent border-0 px-1 ${isActive ? "text-primary-foreground" : "text-surface-fg"}`}
                    >
                      <option value="">— بدون فرع —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                  {queues.length > 1 && (
                    <button
                      onClick={() => deleteQueue(q.id)}
                      title="حذف"
                      className={`p-1 ml-1 rounded-full ${isActive ? "hover:bg-white/20" : "hover:bg-destructive/10 hover:text-destructive"}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============== Branches (Business) ==============
type Branch = { id: string; name: string; address: string | null; phone: string | null; active: boolean };

const BranchesSection = ({ shop }: { shop: Shop }) => {
  const navigate = useNavigate();
  const unlocked = hasFeature(shop.plan as PlanId, "multi_branch");
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    if (!unlocked) return;
    setLoading(true);
    const { data } = await supabase.from("branches").select("*").eq("shop_id", shop.id).order("created_at");
    setItems((data ?? []) as Branch[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [shop.id, unlocked]);

  const reset = () => { setName(""); setAddress(""); setPhone(""); setEditId(null); };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("اكتب اسم الفرع"); return; }
    const payload = { name: trimmed, address: address.trim() || null, phone: phone.trim() || null };
    if (editId) {
      const { error } = await supabase.from("branches").update(payload).eq("id", editId);
      if (error) { toast.error("تعذّر الحفظ"); return; }
      toast.success("تم تحديث الفرع");
    } else {
      const { error } = await supabase.from("branches").insert({ ...payload, shop_id: shop.id });
      if (error) { toast.error("تعذّر الإضافة"); return; }
      toast.success("تم إضافة الفرع");
    }
    reset();
    void load();
  };

  const startEdit = (b: Branch) => {
    setEditId(b.id); setName(b.name); setAddress(b.address || ""); setPhone(b.phone || "");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الفرع؟")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) { toast.error("تعذّر الحذف"); return; }
    toast.success("تم الحذف");
    void load();
  };

  return (
    <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface relative overflow-hidden">
      {!unlocked && (
        <div className="absolute inset-0 bg-surface-card/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => navigate("/pricing")}>
          <div className="bg-warning/10 text-warning rounded-full p-3"><Lock className="w-6 h-6" /></div>
          <div className="text-surface-fg font-bold">الفروع المتعددة</div>
          <div className="text-xs text-surface-muted">متاح في باقة <span className="text-primary font-bold">الأعمال</span></div>
          <Button size="sm" className="bg-gradient-gold text-foreground rounded-full mt-1 font-bold">رقّ لباقة الأعمال</Button>
        </div>
      )}
      <div className={!unlocked ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-black text-surface-fg">الفروع</h2>
          <span className="text-xs text-surface-muted">({items.length})</span>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الفرع" className="bg-surface-muted text-surface-fg text-right rounded-xl placeholder:text-surface-muted" />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان (اختياري)" className="bg-surface-muted text-surface-fg text-right rounded-xl placeholder:text-surface-muted" />
          <div className="flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف (اختياري)" className="bg-surface-muted text-surface-fg text-right rounded-xl placeholder:text-surface-muted flex-1" />
            <Button onClick={save} className="bg-gradient-primary text-primary-foreground rounded-xl gap-1">
              {editId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editId ? "حفظ" : "إضافة"}
            </Button>
            {editId && <Button variant="ghost" size="icon" onClick={reset}><X className="w-4 h-4" /></Button>}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-surface-muted text-sm py-4">جارٍ التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-surface-muted text-sm py-6">لم تضف أي فرع بعد</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((b) => (
              <div key={b.id} className="bg-surface-muted/50 border border-surface rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-bold text-surface-fg truncate">{b.name}</div>
                  {b.address && <div className="text-xs text-surface-muted truncate mt-0.5">{b.address}</div>}
                  {b.phone && <div className="text-xs text-surface-muted font-mono mt-0.5" dir="ltr">{b.phone}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============== Staff (Business) ==============
type StaffMember = { id: string; name: string; email: string; role: "manager" | "cashier"; branch_id: string | null; queue_id: string | null; active: boolean };

const StaffSection = ({ shop }: { shop: Shop }) => {
  const navigate = useNavigate();
  const unlocked = hasFeature(shop.plan as PlanId, "staff_accounts");
  const [items, setItems] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");
  const [branchId, setBranchId] = useState<string>("");
  const [queueId, setQueueId] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    if (!unlocked) return;
    setLoading(true);
    const [{ data: s }, { data: b }, { data: q }] = await Promise.all([
      supabase.from("staff").select("*").eq("shop_id", shop.id).order("created_at"),
      supabase.from("branches").select("*").eq("shop_id", shop.id).order("created_at"),
      supabase.from("queues").select("*").eq("shop_id", shop.id).order("created_at"),
    ]);
    setItems((s ?? []) as StaffMember[]);
    setBranches((b ?? []) as Branch[]);
    setAllQueues((q ?? []) as Queue[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [shop.id, unlocked]);

  const reset = () => { setName(""); setEmail(""); setRole("cashier"); setBranchId(""); setQueueId(""); setEditId(null); };

  // Queues for selected branch (or all if no branch)
  const branchQueues = branchId
    ? allQueues.filter(q => q.branch_id === branchId)
    : allQueues.filter(q => !q.branch_id);

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) { toast.error("الاسم والإيميل مطلوبان"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { toast.error("إيميل غير صالح"); return; }
    if (role === "cashier" && !queueId) { toast.error("اختر طابور للكاشير"); return; }
    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      role,
      branch_id: branchId || null,
      queue_id: role === "cashier" ? (queueId || null) : null,
    };
    if (editId) {
      const { error } = await supabase.from("staff").update(payload).eq("id", editId);
      if (error) { toast.error(error.message.includes("unique") ? "هذا الإيميل مستخدم" : "تعذّر الحفظ"); return; }
      toast.success("تم التعديل");
    } else {
      const { error } = await supabase.from("staff").insert({ ...payload, shop_id: shop.id });
      if (error) { toast.error(error.message.includes("unique") ? "هذا الإيميل مستخدم" : "تعذّر الإضافة"); return; }
      toast.success("تم إضافة الموظف");
    }
    reset();
    void load();
  };

  const startEdit = (s: StaffMember) => {
    setEditId(s.id); setName(s.name); setEmail(s.email); setRole(s.role); setBranchId(s.branch_id || ""); setQueueId(s.queue_id || "");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الموظف؟")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) { toast.error("تعذّر الحذف"); return; }
    toast.success("تم الحذف");
    void load();
  };

  return (
    <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface relative overflow-hidden">
      {!unlocked && (
        <div className="absolute inset-0 bg-surface-card/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => navigate("/pricing")}>
          <div className="bg-warning/10 text-warning rounded-full p-3"><Lock className="w-6 h-6" /></div>
          <div className="text-surface-fg font-bold">حسابات الموظفين</div>
          <div className="text-xs text-surface-muted">متاح في باقة <span className="text-primary font-bold">الأعمال</span></div>
          <Button size="sm" className="bg-gradient-gold text-foreground rounded-full mt-1 font-bold">رقّ لباقة الأعمال</Button>
        </div>
      )}
      <div className={!unlocked ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-black text-surface-fg">الموظفون</h2>
          <span className="text-xs text-surface-muted">({items.length})</span>
        </div>
        <p className="text-xs text-surface-muted mb-5">
          المدير: يضيف فروع/طوابير/موظفين ويرى السجل · الكاشير: ينادي التالي ويرى السجل لطابوره فقط
        </p>

        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الموظف" className="bg-surface-muted text-surface-fg text-right rounded-xl placeholder:text-surface-muted" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="bg-surface-muted text-surface-fg placeholder:text-surface-muted rounded-xl" dir="ltr" />
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value as "manager" | "cashier"); if (e.target.value === "manager") setQueueId(""); }}
            className="bg-surface-muted text-surface-fg text-right rounded-xl border border-input h-10 px-3 text-sm"
          >
            <option value="cashier">كاشير</option>
            <option value="manager">مدير</option>
          </select>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <select
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setQueueId(""); }}
            className="bg-surface-muted text-surface-fg text-right rounded-xl border border-input h-10 px-3 text-sm"
          >
            <option value="">— الفرع —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            value={queueId}
            onChange={(e) => setQueueId(e.target.value)}
            disabled={role !== "cashier"}
            className="bg-surface-muted text-surface-fg text-right rounded-xl border border-input h-10 px-3 text-sm disabled:opacity-50"
          >
            <option value="">{role === "cashier" ? "— الطابور —" : "— غير مطلوب للمدير —"}</option>
            {branchQueues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <div className="flex gap-2">
            <Button onClick={save} className="bg-gradient-primary text-primary-foreground rounded-xl gap-1 flex-1">
              {editId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editId ? "حفظ" : "إضافة"}
            </Button>
            {editId && <Button variant="ghost" size="icon" onClick={reset}><X className="w-4 h-4" /></Button>}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-surface-muted text-sm py-4">جارٍ التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-surface-muted text-sm py-6">لم تضف أي موظف بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-muted border-b border-surface">
                  <th className="text-right py-2 px-2">الاسم</th>
                  <th className="text-right py-2 px-2">الإيميل</th>
                  <th className="text-right py-2 px-2">الصلاحية</th>
                  <th className="text-right py-2 px-2">الفرع</th>
                  <th className="text-right py-2 px-2">الطابور</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const branch = branches.find(b => b.id === s.branch_id);
                  const q = allQueues.find(x => x.id === s.queue_id);
                  return (
                    <tr key={s.id} className="border-b border-surface text-surface-fg">
                      <td className="py-2 px-2 font-bold">{s.name}</td>
                      <td className="py-2 px-2 text-xs font-mono" dir="ltr">{s.email}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${s.role === "manager" ? "bg-primary/10 text-primary" : "bg-surface-muted text-surface-fg"}`}>
                          {s.role === "manager" ? "مدير" : "كاشير"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-surface-muted">{branch?.name || "—"}</td>
                      <td className="py-2 px-2 text-xs text-surface-muted">{s.role === "manager" ? "—" : (q?.name || "—")}</td>
                      <td className="py-2 px-2 text-left">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============== Reports (Business) ==============
const ReportsSection = ({ shop }: { shop: Shop }) => {
  const navigate = useNavigate();
  const unlocked = hasFeature(shop.plan as PlanId, "exports");
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0]
  });

  const loadMetaData = async () => {
    if (!unlocked) return;
    const [{ data: q }, { data: b }] = await Promise.all([
      supabase.from("queues").select("*").eq("shop_id", shop.id),
      supabase.from("branches").select("*").eq("shop_id", shop.id),
    ]);
    setQueues((q ?? []) as Queue[]);
    setBranches((b ?? []) as Branch[]);
  };

  useEffect(() => { 
    void loadMetaData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id, unlocked]);

  const fetchEntries = async () => {
    let query = supabase
      .from("queue_entries")
      .select(`
        id, number, customer_name, status, joined_at, served_at, done_at,
        queues (name)
      `)
      .eq("shop_id", shop.id)
      .gte("joined_at", `${dateRange.start}T00:00:00`)
      .lte("joined_at", `${dateRange.end}T23:59:59`);

    if (selectedQueue !== "all") query = query.eq("queue_id", selectedQueue);

    const { data, error } = await query.order("joined_at", { ascending: false });

    if (error) throw error;
    // Cast to help TS understand the join structure
    return (data || []) as unknown as Array<Entry & { done_at: string | null; queues: { name: string } | null }>;
  };

  const exportCSV = async () => {
    setLoading(true);
    try {
      const data = await fetchEntries();
      if (data.length === 0) { toast.info("لا توجد بيانات للفترة المحددة"); return; }

      const rows = data.map(e => ({
        "الرقم": e.number,
        "الاسم": e.customer_name || "زبون",
        "الحالة": e.status === "done" ? "منتهي" : e.status === "serving" ? "يُخدم" : "ينتظر",
        "تاريخ الانضمام": new Date(e.joined_at).toLocaleString("ar-EG"),
        "وقت الخدمة": e.served_at ? new Date(e.served_at).toLocaleTimeString("ar-EG") : "—",
        "وقت الانتهاء": e.done_at ? new Date(e.done_at).toLocaleTimeString("ar-EG") : "—",
        "الطابور": e.queues?.name || "—"
      }));

      const csv = Papa.unparse(rows);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `report-${shop.slug}-${dateRange.start}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error("فشل تصدير CSV");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    setLoading(true);
    try {
      const data = await fetchEntries();
      if (data.length === 0) { toast.info("لا توجد بيانات للفترة المحددة"); return; }

      // Create a temporary element for capturing to support Arabic/RTL correctly via html2canvas
      const element = document.createElement("div");
      element.style.position = "fixed";
      element.style.left = "-9999px";
      element.style.top = "0";
      element.style.width = "800px";
      element.style.padding = "40px";
      element.style.backgroundColor = "white";
      element.style.color = "black";
      element.style.direction = "rtl";
      
      // Inject font import directly into the element to ensure connectivity
      element.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          * { font-family: 'Cairo', sans-serif !important; letter-spacing: 0 !important; }
        </style>
        <div style="padding: 20px; direction: rtl; text-align: center;">
          <h1 style="font-size: 32px; font-weight: 900; margin-bottom: 5px; color: #1e1b4b; display: inline-block; direction: rtl;">تقرير الطابور: ${shop.name}</h1>
          <p style="font-size: 16px; color: #64748b; margin-bottom: 30px; direction: rtl;">الفترة من ${dateRange.start} إلى ${dateRange.end}</p>
          
          <div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 30px;">
            <div style="background: #f8fafc; padding: 15px 40px; border-radius: 16px; border: 1px solid #e2e8f0; min-width: 200px;">
              <div style="font-size: 14px; color: #64748b;">إجمالي الزبائن</div>
              <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${data.length}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; direction: rtl;">
            <thead>
              <tr style="background-color: #6366f1; color: white;">
                <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">#</th>
                <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">الاسم</th>
                <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">الحالة</th>
                <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">تاريخ الدخول</th>
                <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">الطابور</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((e, i) => `
                <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${e.number}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${e.customer_name || "زبون"}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${e.status === 'done' ? 'مكتمل' : e.status === 'serving' ? 'يُخدم' : 'ينتظر'}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${new Date(e.joined_at).toLocaleString('ar-EG')}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${e.queues?.name || "—"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; direction: rtl;">
            تم استخراج هذا التقرير عبر منصة دَوْرَك Dourak
          </div>
        </div>
      `;
      document.body.appendChild(element);

      // Give a small delay for fonts to ensure they are ready
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "white",
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`report-${shop.slug}-${dateRange.start}.pdf`);

      document.body.removeChild(element);
    } catch (err) {
      console.error(err);
      toast.error("فشل تصدير PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-card rounded-3xl p-6 shadow-soft border border-surface relative overflow-hidden">
      {!unlocked && (
        <div className="absolute inset-0 bg-surface-card/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => navigate("/pricing")}>
          <div className="bg-warning/10 text-warning rounded-full p-3"><Lock className="w-6 h-6" /></div>
          <div className="text-surface-fg font-bold">التقارير المتقدمة</div>
          <div className="text-xs text-surface-muted">متاح في باقة <span className="text-primary font-bold">الأعمال</span></div>
          <Button size="sm" className="bg-gradient-gold text-foreground rounded-full mt-1 font-bold">رقّ لباقة الأعمال</Button>
        </div>
      )}
      <div className={!unlocked ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-black text-surface-fg">تصدير التقارير</h2>
        </div>
        <p className="text-xs text-surface-muted mb-6">
          صدّر سجل الطابور بالكامل للفترة المحددة لتحليل أداء وفروع محلّك
        </p>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-fg flex items-center gap-1">
              <Calendar className="w-3 h-3" /> من تاريخ
            </label>
            <Input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))}
              className="bg-surface-card border-2 border-surface text-surface-fg rounded-xl text-sm font-bold h-11 [color-scheme:light]" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-fg flex items-center gap-1">
              <Calendar className="w-3 h-3" /> إلى تاريخ
            </label>
            <Input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))}
              className="bg-surface-card border-2 border-surface text-surface-fg rounded-xl text-sm font-bold h-11 [color-scheme:light]" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-fg">المكان / الفرع</label>
            <select 
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full bg-surface-muted text-surface-fg text-sm rounded-xl border border-surface h-10 px-3"
            >
              <option value="all">كل الفروع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-fg">الطابور</label>
            <select 
              value={selectedQueue}
              onChange={e => setSelectedQueue(e.target.value)}
              className="w-full bg-surface-muted text-surface-fg text-sm rounded-xl border border-surface h-10 px-3"
            >
              <option value="all">كل الطوابير</option>
              {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Button 
            disabled={loading}
            onClick={exportCSV} 
            variant="outline" 
            className="h-24 rounded-3xl border-2 border-dashed border-surface hover:border-primary hover:bg-primary/5 transition-all flex-col gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="font-black">تصدير CSV (Excel)</div>
            <div className="text-[10px] text-surface-muted italic">مناسب للتحليل الرقمي</div>
          </Button>

          <Button 
            disabled={loading}
            onClick={exportPDF} 
            variant="outline" 
            className="h-24 rounded-3xl border-2 border-dashed border-surface hover:border-success hover:bg-success/5 transition-all flex-col gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center group-hover:bg-success group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div className="font-black">تصدير PDF (بي دي إف)</div>
            <div className="text-[10px] text-surface-muted italic">مناسب للطباعة والمشاركة</div>
          </Button>
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-primary font-bold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>جارٍ استخراج البيانات...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
