import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";

export const LandingNav = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="absolute top-0 right-0 left-0 z-20 px-6 py-5">
      <div className="container mx-auto flex items-center justify-between">
        <Logo size="md" />

        <div className="hidden md:flex items-center gap-2 glass-pill rounded-full px-2 py-1.5">
          <a href="#how" className="px-4 py-2 text-sm text-foreground/80 hover:text-foreground transition">
            إزاي بيشتغل
          </a>
          <a href="#features" className="px-4 py-2 text-sm text-foreground/80 hover:text-foreground transition">
            المميزات
          </a>
          <a href="#pricing" className="px-4 py-2 text-sm text-foreground/80 hover:text-foreground transition">
            الأسعار
          </a>
          <Link to="/affiliate" className="px-4 py-2 text-sm text-foreground/80 hover:text-foreground transition">
            برنامج الشركاء
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Button onClick={() => navigate("/dashboard")} className="bg-gradient-primary text-primary-foreground">
              لوحة التحكم
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")} className="text-foreground/80 hover:text-foreground hover:bg-white/5">
                تسجيل الدخول
              </Button>
              <Button onClick={() => navigate("/signup")} className="bg-gradient-primary text-primary-foreground gap-1.5 shadow-elegant">
                <Sparkles className="w-4 h-4" />
                ابدأ مجاناً
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
