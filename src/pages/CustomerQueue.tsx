import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { Clock, Users, Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Shop = { id: string; name: string; slug: string };
type Queue = { id: string; current_serving: number; name?: string; slug?: string };
type Entry = { id: string; number: number; status: string; notify_token: string };
type QueueResponse = { shop: Shop; queue: Queue; entry: Entry | null; entries: Entry[]; error?: string };

const STORAGE_KEY = "dourak_entry";
const TEMPORARY_LOAD_ERROR = "الخدمة تستغرق وقتاً أطول من المعتاد. سنعيد المحاولة تلقائياً خلال ثوانٍ.";

const CustomerQueue = () => {
  const { slug, queueSlug } = useParams<{ slug: string; queueSlug?: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const notifiedRef = useRef(false);
  const aboutToBeNextRef = useRef(false);
  const loadAttemptRef = useRef(0);
  const entryRef = useRef<Entry | null>(null);
  const queueIdRef = useRef<string | null>(null);

  useEffect(() => { entryRef.current = entry; }, [entry]);
  useEffect(() => { queueIdRef.current = queue?.id ?? null; }, [queue?.id]);

  useEffect(() => {
    setName("");
    setEntry(null);
    void loadShop();
  }, [slug, queueSlug]);

  const [showCustIntro, setShowCustIntro] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem("dourak_cust_intro_seen");
    if (!seen && shop && !entry) {
      setShowCustIntro(true);
    }
  }, [shop, entry]);

  const finishCustIntro = () => {
    localStorage.setItem("dourak_cust_intro_seen", "true");
    setShowCustIntro(false);
  };

  useEffect(() => {
    if (entry?.id) setLastEntryId(entry.id);
  }, [entry?.id]);

  useEffect(() => {
    if (loadError !== TEMPORARY_LOAD_ERROR) return;
    const retry = setTimeout(() => void loadShop(), 5000);
    return () => clearTimeout(retry);
  }, [loadError, slug]);

  useEffect(() => {
    if (!queue) return;
    void refreshEntries();
    const ch = supabase
      .channel(`q-${queue.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `queue_id=eq.${queue.id}` }, () => refreshEntries())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "queues", filter: `id=eq.${queue.id}` }, (p: { new: { current_serving: number } }) => {
        setQueue(prev => prev ? { ...prev, current_serving: p.new.current_serving } : prev);
      })
      .subscribe();
    const poll = setInterval(() => { void refreshEntries(); }, 4000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [queue?.id]);

  // Notification & vibration logic
  useEffect(() => {
    if (!entry || !queue) return;
    if (entry.status === "serving" && !notifiedRef.current) {
      notifiedRef.current = true;
      try { navigator.vibrate?.([400, 120, 400, 120, 400, 120, 800]); } catch (e) { console.debug(e); }
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("🔔 جه دورك!", { body: `رقم ${entry.number} - ${shop?.name}`, requireInteraction: true });
        }
      } catch (e) { console.debug(e); }
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const playBeep = (delay: number) => setTimeout(() => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880; g.gain.value = 0.3;
            o.start(); setTimeout(() => o.stop(), 350);
          }, delay);
          playBeep(0); playBeep(500); playBeep(1000);
        }
      } catch (e) { console.debug(e); }
    }
    const aheadCount = entry.number - queue.current_serving;
    if (entry.status === "waiting" && aheadCount === 1 && !aboutToBeNextRef.current) {
      aboutToBeNextRef.current = true;
      try { navigator.vibrate?.(250); } catch (e) { console.debug(e); }
    }
  }, [entry?.status, entry?.number, queue?.current_serving, shop?.name]);

  const loadShop = async () => {
    if (!slug) { setInitialLoading(false); setLoadError("رابط غير صالح"); return; }
    const attemptId = loadAttemptRef.current + 1;
    loadAttemptRef.current = attemptId;
    setInitialLoading(true);
    setLoadError(null);
    try {
      // 1. Get Shop
      const { data: shopData, error: shopErr } = await supabase.from('shops').select('*').eq('slug', slug).maybeSingle();
      if (shopErr) throw shopErr;
      if (!shopData) { setLoadError("المحل غير موجود"); return; }
      setShop(shopData as Shop);

      // 2. Get Queue
      let queueQuery = supabase.from('queues').select('*').eq('shop_id', shopData.id).eq('active', true);
      if (queueSlug) {
        queueQuery = queueQuery.eq('slug', queueSlug);
      } else {
        queueQuery = queueQuery.order('created_at', { ascending: true }).limit(1);
      }
      const { data: qList, error: qErr } = await queueQuery;
      if (qErr) throw qErr;
      const queueData = qList?.[0];
      if (!queueData) { setLoadError("لا يوجد طابور نشط حالياً"); return; }
      setQueue(queueData as Queue);

      // 3. Get Entry from Storage
      const raw = localStorage.getItem(`${STORAGE_KEY}-${slug}-${queueSlug ?? "default"}`);
      const stored = raw ? JSON.parse(raw) : null;
      if (stored?.id && stored?.notifyToken) {
        const { data: e, error: eErr } = await supabase
          .from('queue_entries')
          .select('*')
          .eq('id', stored.id)
          .eq('notify_token', stored.notifyToken)
          .maybeSingle();
        if (!eErr && e && (e.status === 'waiting' || e.status === 'serving')) {
          setEntry(e as Entry);
        } else {
          localStorage.removeItem(`${STORAGE_KEY}-${slug}-${queueSlug ?? "default"}`);
        }
      }

      // 4. Get All Entries
      const { data: entries, error: entriesErr } = await supabase
        .from('queue_entries')
        .select('id, number, status')
        .eq('queue_id', queueData.id)
        .in('status', ['waiting', 'serving'])
        .order('number', { ascending: true });
      if (entriesErr) throw entriesErr;
      setAllEntries(entries as Entry[]);

    } catch (e: unknown) {
      if (attemptId === loadAttemptRef.current) {
        const anyE = e as { message?: string };
        setLoadError(anyE.message || "حدث خطأ غير متوقع");
      }
      console.error("[CustomerQueue] Load Error:", e);
    } finally {
      if (attemptId === loadAttemptRef.current) setInitialLoading(false);
    }
  };

  const refreshEntries = async () => {
    const qid = queueIdRef.current;
    if (!qid) return;
    
    // Refresh queue state
    const { data: q } = await supabase.from('queues').select('current_serving').eq('id', qid).maybeSingle();
    if (q) setQueue(prev => prev ? { ...prev, current_serving: q.current_serving } : null);

    // Refresh all waiting/serving entries
    const { data: entries } = await supabase
      .from('queue_entries')
      .select('id, number, status')
      .eq('queue_id', qid)
      .in('status', ['waiting', 'serving'])
      .order('number', { ascending: true });
    if (entries) setAllEntries(entries as Entry[]);

    // Refresh our own entry
    const currentEntry = entryRef.current;
    if (currentEntry) {
      const { data: e } = await supabase
        .from('queue_entries')
        .select('*')
        .eq('id', currentEntry.id)
        .maybeSingle();
      
      if (e) {
        if (e.status === 'waiting' || e.status === 'serving') {
          setEntry(e as Entry);
        } else {
          if (e.status === 'done') setShowThankYou(true);
          setEntry(null);
          localStorage.removeItem(`${STORAGE_KEY}-${slug}-${queueSlug ?? "default"}`);
        }
      }
    }
  };

  const join = async () => {
    if (!slug || !name.trim()) { toast.error("أدخل اسمك أولاً"); return; }
    setLoading(true);
    try {
      try { if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); } catch (e) { console.debug(e); }
      
      const { data, error } = await supabase.rpc('join_queue', {
        p_slug: slug,
        p_name: name.trim(),
        p_queue_slug: queueSlug || null
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setShop(data.shop);
      setQueue(data.queue);
      setEntry(data.entry as Entry);
      notifiedRef.current = false;
      aboutToBeNextRef.current = false;
      localStorage.setItem(`${STORAGE_KEY}-${slug}-${queueSlug ?? "default"}`, JSON.stringify({ id: data.entry.id, notifyToken: data.entry.notify_token }));
      toast.success(`تم تسجيلك! رقمك ${data.entry.number}`);
      
      void refreshEntries();
    } catch (e: unknown) {
      console.error("[CustomerQueue] Join error:", e);
      const anyE = e as { message?: string };
      toast.error(anyE.message || "تعذّر الحجز، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const leave = async () => {
    if (!entry) return;
    await supabase.from('queue_entries').update({ status: 'left', left_at: new Date().toISOString() }).eq('id', entry.id);
    setEntry(null);
    localStorage.removeItem(`${STORAGE_KEY}-${slug}-${queueSlug ?? "default"}`);
    toast.info("غادرت الطابور");
  };


  if (initialLoading) {
    return (
      <div className="hero-bg min-h-screen flex flex-col items-center justify-center text-foreground gap-4" dir="rtl">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div className="text-foreground/70">جارٍ التحميل...</div>
      </div>
    );
  }
  if (loadError || !shop || !queue) {
    return (
      <div className="hero-bg min-h-screen flex flex-col items-center justify-center text-foreground gap-4 px-6 text-center" dir="rtl">
        <Logo size="lg" />
        <div className="text-xl font-bold mt-4">تعذّر فتح صفحة الطابور</div>
        <div className="text-foreground/70 max-w-sm">{loadError ?? "المحل غير موجود"}</div>
        <Button onClick={() => loadShop()} className="bg-gradient-primary text-primary-foreground rounded-xl">إعادة المحاولة</Button>
      </div>
    );
  }

  const ahead = entry ? Math.max(0, entry.number - queue.current_serving - (entry.status === "serving" ? 0 : 1)) : 0;
  const waitingCount = allEntries.filter(e => e.status === "waiting").length;
  const estMin = ahead * 7;

  return (
    <div className="hero-bg min-h-screen flex flex-col items-center justify-center px-6 py-12" dir="rtl">
      {/* Customer Intro Overlay */}
      {showCustIntro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-full max-w-md bg-white border border-surface rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto flex items-center justify-center mb-6">
              <span className="text-4xl text-primary animate-bounce">📱</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">وفّر وقتك</h2>
            <p className="text-slate-600 mb-8 font-medium">اعرف دورك وسيب المكان براحتك</p>

            <div className="space-y-4 mb-8">
              {[
                { icon: "👥", text: "شوف كام واحد قبلك" },
                { icon: "⏱️", text: "اعرف وقت انتظارك" },
                { icon: "🔔", text: "هننبهك لما دورك يقرب" },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl text-right">
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-slate-700 font-bold">{b.text}</span>
                </div>
              ))}
            </div>

            <Button onClick={finishCustIntro} className="w-full h-14 bg-gradient-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-elegant">
              فهمت 👍
            </Button>
          </div>
        </div>
      )}

      {/* Thank You Overlay */}
      {showThankYou && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-full max-w-md bg-white border border-surface rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-center">
            <div className="w-24 h-24 bg-success/10 rounded-full mx-auto flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">شكرًا لاستخدام دَوْرَك 🙏</h2>
            <p className="text-slate-600 mb-4 font-medium">نتمنى لك تجربة مريحة وبدون انتظار دائمًا.</p>
            
            <div className="h-px bg-slate-100 my-6" />
            
            <p className="text-sm font-bold text-slate-500 mb-4">ساعدنا نوصل الفكرة لغيرك 👇</p>
            
            <div className="grid grid-cols-1 gap-3 mb-8">
              <Button 
                onClick={() => {
                  const text = `وفّر وقتك وما تستناش في الطابور 🚀\nدَوْرَك نظام ذكي يخليك تحجز دورك وتعرف وقتك بدون زحمة.\nجربه من هنا:\ndourak.online`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="h-12 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl gap-2 font-bold"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-5 h-5 invert" alt="" />
                مشاركة عبر واتساب
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText("https://dourak.online");
                  toast.success("تم نسخ الرابط");
                }}
                className="h-12 border-slate-200 text-slate-700 rounded-xl gap-2 font-bold"
              >
                نسخ رابط دَوْرَك
              </Button>
            </div>

            <Button 
              variant="link" 
              onClick={() => setShowThankYou(false)}
              className="text-primary font-bold"
            >
              استخدم دَوْرَك مرة أخرى
            </Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6 animate-fade-in">
          <Logo size="lg" />
          <h1 className="text-2xl font-black mt-3">{shop.name}</h1>
          {queue.name && <div className="text-sm text-foreground/60 mt-1">طابور: {queue.name}</div>}
        </div>

        {!entry ? (
          <div className="glass-card rounded-3xl p-8 animate-scale-in">
            <div className="text-center mb-6">
              <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-primary items-center justify-center mb-4 shadow-elegant">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1">انضم للطابور</h2>
              <p className="text-foreground/60 text-sm">{waitingCount} شخص ينتظر حالياً</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-foreground/80 mb-2">أدخل اسمك أو رقم الإيصال</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد أو 12345"
                  maxLength={50}
                  name="dourak-customer-name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="bg-background/40 border-border/50 h-12 rounded-xl text-foreground placeholder:text-foreground/30"
                />
              </div>
              <Button onClick={join} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground h-12 rounded-xl font-bold btn-glow">
                {loading ? "..." : "احجز دورك الآن 🎫"}
              </Button>
            </div>
          </div>
        ) : entry.status === "serving" ? (
          <div className="glass-card rounded-3xl p-8 text-center animate-scale-in border-2 border-primary/50">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <Bell className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-gradient mb-2">جه دورك! 🎉</h2>
            <p className="text-foreground/70 mb-6">رقمك: <span className="text-2xl font-black text-foreground">{entry.number}</span></p>
            <p className="text-sm text-foreground/60">توجه للمحل الآن</p>
          </div>
        ) : (
          <div className="glass-card rounded-3xl p-8 animate-scale-in">
            <div className="text-center mb-8">
              <div className="text-sm text-foreground/60 mb-2">رقمك</div>
              <div className="text-7xl font-black text-gradient mb-2">{entry.number}</div>
              <div className="text-sm text-foreground/60">يُخدم حالياً: رقم {queue.current_serving}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="glass-pill rounded-2xl p-4 text-center">
                <Users className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-black">{ahead}</div>
                <div className="text-xs text-foreground/60">شخص قبلك</div>
              </div>
              <div className="glass-pill rounded-2xl p-4 text-center">
                <Clock className="w-5 h-5 text-primary-glow mx-auto mb-2" />
                <div className="text-2xl font-black">~{estMin}</div>
                <div className="text-xs text-foreground/60">دقيقة متوقعة</div>
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mb-4 text-center text-sm text-foreground/80">
              <span className="block font-bold mb-1">📲 تقدر تسيب المكان وترجع لما دورك يقرب</span>
              <span className="text-xs opacity-70">هنبلّغك بإشعار واهتزاز لما يجي دورك.</span>
            </div>

            <Button onClick={leave} variant="ghost" className="w-full text-foreground/60 hover:bg-destructive/10 hover:text-destructive">
              مغادرة الطابور
            </Button>
          </div>
        )}

        {entry && entry.status === "waiting" && (
          <div className="text-center mt-6 text-sm text-foreground/50 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            ابقَ على هذه الصفحة لتلقي التنبيه
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerQueue;
