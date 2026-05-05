import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, Share2, ArrowLeft, Store } from "lucide-react";
import { toast } from "sonner";

type Shop = {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
  logo_url: string | null;
  description: string | null;
};

const ShopProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, slug, brand_color, logo_url, description")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setShop(data as Shop);
      setLoading(false);
    };
    void load();
  }, [slug]);

  const queueUrl = typeof window !== "undefined" && shop
    ? `${window.location.origin}/q/${shop.slug}`
    : "";

  const profileUrl = typeof window !== "undefined" && shop
    ? `${window.location.origin}/shop/${shop.slug}`
    : "";

  const share = async () => {
    if (!shop) return;
    const shareData = {
      title: shop.name,
      text: `انضم لطابور ${shop.name} عبر دَوْرَك`,
      url: profileUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(profileUrl);
        toast.success("تم نسخ رابط المحل");
      }
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <div className="hero-bg min-h-screen flex flex-col items-center justify-center text-foreground gap-4" dir="rtl">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div className="text-foreground/70">جارٍ التحميل...</div>
      </div>
    );
  }

  if (notFound || !shop) {
    return (
      <div className="hero-bg min-h-screen flex flex-col items-center justify-center text-foreground gap-4 px-6 text-center" dir="rtl">
        <Logo size="lg" />
        <div className="text-xl font-bold mt-4">المحل غير موجود</div>
        <Link to="/" className="text-primary-glow hover:underline">العودة للرئيسية</Link>
      </div>
    );
  }

  const brand = shop.brand_color || "#6366f1";

  return (
    <div className="hero-bg min-h-screen px-6 py-12" dir="rtl">
      <div className="max-w-md mx-auto relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-foreground/60 text-sm flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            دَوْرَك
          </Link>
          <button onClick={share} className="text-foreground/70 hover:text-foreground p-2 rounded-full hover:bg-white/5" title="مشاركة">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <div className="glass-card rounded-3xl p-8 text-center animate-scale-in">
          {/* Logo / Avatar */}
          <div
            className="w-28 h-28 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-elegant overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}
          >
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-12 h-12 text-white" />
            )}
          </div>

          <h1 className="text-3xl font-black mb-2" style={{ color: brand }}>{shop.name}</h1>

          {shop.description ? (
            <p className="text-foreground/70 text-sm leading-relaxed mb-6 whitespace-pre-line">
              {shop.description}
            </p>
          ) : (
            <p className="text-foreground/50 text-sm mb-6">مرحباً بك! انضم للطابور عند وصولك للمحل.</p>
          )}

          {/* Near-shop notice */}
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-3 mb-6 text-xs text-foreground/80 flex items-start gap-2 text-right">
            <MapPin className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>هذه ليست خدمة حجز مسبق — برجاء الانضمام للطابور فقط عندما تكون قريباً من المحل.</span>
          </div>

          {/* CTA */}
          <Button
            asChild
            className="w-full h-14 rounded-2xl font-bold text-lg shadow-elegant text-white hover:opacity-90 transition"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}
          >
            <Link to={`/q/${shop.slug}`}>انضم للطابور الآن 🎫</Link>
          </Button>

          {/* QR */}
          <div className="mt-8">
            <div className="text-xs text-foreground/60 mb-3">امسح الكود من الموبايل</div>
            <div className="bg-white rounded-2xl p-4 inline-block">
              <QRCodeSVG value={queueUrl} size={160} fgColor={brand} />
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-foreground/40">
          مدعوم من <Link to="/" className="text-foreground/70 hover:text-foreground font-bold">دَوْرَك</Link>
        </div>
      </div>
    </div>
  );
};

export default ShopProfile;
