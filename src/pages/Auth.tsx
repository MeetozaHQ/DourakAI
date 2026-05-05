import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const signupSchema = z.object({
  shop_name: z.string().trim().min(2, "اسم المحل يجب أن يكون حرفين على الأقل").max(80),
  email: z.string().trim().email("بريد إلكتروني غير صحيح").max(255),
  password: z.string().min(6, "كلمة المرور يجب أن تكون ٦ أحرف على الأقل").max(72),
});

const Auth = ({ mode }: { mode: "login" | "signup" }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const { user, loading: authLoading } = useAuth();

  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      console.log("[Auth] User already signed in, redirecting to /dashboard", { userId: user.id });
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ shop_name: shopName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { shop_name: shopName, ref: ref ?? null },
          },
        });
        if (error) throw error;
        
        if (data?.session) {
          toast.success("🎉 تم إنشاء حسابك! مرحباً بك في دَوْرَك");
          navigate("/dashboard");
        } else {
          toast.success("🎉 تم إنشاء حسابك! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.");
          navigate("/login");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log("[Auth] signInWithPassword success", { hasSession: !!data.session, userId: data.user?.id });
        toast.success("👋 أهلاً بعودتك");
        // Small delay to ensure session is persisted to storage on mobile browsers
        setTimeout(() => navigate("/dashboard", { replace: true }), 50);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already registered") || msg.includes("User already")) {
        toast.error("هذا البريد مسجل بالفعل، سجّل الدخول");
      } else if (msg.includes("Invalid login")) {
        toast.error("بيانات الدخول غير صحيحة");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        toast.error("يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول. راجع صندوق الوارد الخاص بك.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-bg min-h-screen flex flex-col items-center justify-center px-6 py-12" dir="rtl">
      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <Logo size="lg" className="block mb-3" />
            <p className="text-foreground/60 text-sm">
              {mode === "signup" ? "انضم لآلاف المحلات 🚀" : "أهلاً بعودتك 👋"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <Label className="text-foreground/80 mb-2 block text-sm">اسم المحل</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="مثال: صالون أحمد"
                  className="bg-background/40 border-border/50 h-12 rounded-xl text-foreground placeholder:text-foreground/30"
                  required
                />
              </div>
            )}
            <div>
              <Label className="text-foreground/80 mb-2 block text-sm">البريد الإلكتروني</Label>
              <Input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="bg-background/40 border-border/50 h-12 rounded-xl text-foreground placeholder:text-foreground/30 text-right"
                required
              />
            </div>
            <div>
              <Label className="text-foreground/80 mb-2 block text-sm">كلمة المرور</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="٦ أحرف على الأقل"
                className="bg-background/40 border-border/50 h-12 rounded-xl text-foreground placeholder:text-foreground/30"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground h-12 rounded-xl font-bold btn-glow gap-2"
            >
              {loading ? "..." : mode === "signup" ? "إنشاء حساب مجاني 🎉" : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="text-center mt-6 text-sm text-foreground/70">
            {mode === "signup" ? (
              <>عندك حساب؟ <Link to="/login" className="text-foreground font-bold hover:text-primary-glow">سجّل الدخول</Link></>
            ) : (
              <>مفيش حساب؟ <Link to="/signup" className="text-foreground font-bold hover:text-primary-glow">أنشئ حساب جديد</Link></>
            )}
          </div>
        </div>

        <Link to="/" className="flex items-center justify-center gap-2 mt-6 text-foreground/60 text-sm hover:text-foreground transition">
          العودة للصفحة الرئيسية
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default Auth;
