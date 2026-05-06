import { LandingNav } from "@/components/LandingNav";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Hash, QrCode, Bell, BarChart3, Palette, Users, Clock, Shield, Sparkles, Check, Wallet, TrendingUp, UserPlus } from "lucide-react";
import { PLANS } from "@/lib/plans";

const Index = () => {
  const navigate = useNavigate();

  const steps = [
    { icon: QrCode, title: "امسح الـ QR", desc: "امسح رمز QR عند المحل واحجز دورك في ثوانٍ بدون تطبيق", num: "١" },
    { icon: Hash, title: "احصل على رقمك", desc: "اطلع على ترتيبك ووقت الانتظار المتوقع، اخرج تتمشى أو ارجع لسيارتك", num: "٢" },
    { icon: Bell, title: "تنبيه فوري", desc: "هنبعتلك إشعار واهتزاز بالموبايل لما يقرب دورك، مفيش انتظار", num: "٣" },
  ];

  const features = [
    { icon: Bell, title: "تنبيهات فورية", desc: "إشعار واهتزاز للموبايل لما يقرب دور الزبون" },
    { icon: BarChart3, title: "إحصائيات تفصيلية", desc: "أوقات الذروة، متوسط الانتظار، وعدد الزبائن" },
    { icon: Clock, title: "توقيت دقيق", desc: "حساب فعلي لوقت الانتظار بناء على بيانات حقيقية" },
    { icon: Users, title: "إدارة سهلة", desc: "نادي على التالي بضغطة زرار، إدارة كاملة من الموبايل" },
    { icon: QrCode, title: "QR جاهز للطباعة", desc: "ضعه عند الكاشير أو باب المحل وابدأ فوراً" },
    { icon: Shield, title: "موثوق وآمن", desc: "بياناتك محمية على سيرفرات آمنة بمعايير عالمية" },
    { icon: Palette, title: "تخصيص كامل", desc: "أضف شعارك وألوان محلك ليطابق هويتك" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden" dir="rtl">
      {/* HERO */}
      <section className="hero-bg relative min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
        <LandingNav />

        {/* Floating arabic letters */}
        <div className="floating-letters">
          {["ا","ل","م","ن","ر","ك","د","و","ط","ب"].map((c, i) => (
            <span key={i} style={{
              right: `${(i * 11) % 95}%`,
              top: `${(i * 17) % 100}%`,
              animationDelay: `${i * 2}s`,
              animationDuration: `${20 + i * 2}s`,
            }}>{c}</span>
          ))}
        </div>

        <div className="container mx-auto relative z-10 text-center max-w-5xl animate-fade-up">
          <div className="inline-flex items-center gap-2 glass-pill rounded-full px-5 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-foreground/90">
              أول نظام لإدارة الطوابير في مصر والوطن العربي
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.1] mb-6">
            خلّص الطابور
            <br />
            <span className="text-gradient">وعيش حياتك</span>
          </h1>

          <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            امسح الـ QR عند المحل ← احصل على رقمك ← اخرج تتمشى أو اجلس في سيارتك.
            <br />
            هنبلّغك فوراً لما يجي دورك ✨
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              onClick={() => navigate(`/signup${window.location.search}`)}
              className="bg-white text-background hover:bg-white/90 btn-glow text-base h-14 px-8 rounded-full font-bold gap-2"
            >
              ابدأ مجاناً الآن
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              className="text-foreground hover:bg-white/10 text-base h-14 px-8 rounded-full"
            >
              شاهد كيف يعمل ↓
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6 md:gap-12 max-w-2xl mx-auto">
            {[
              { value: "98%", label: "رضا العملاء" },
              { value: "+50,000", label: "زبون شهرياً" },
              { value: "+2,000", label: "محل مشترك" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-4xl font-black text-gradient mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-foreground/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6 bg-surface">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-surface-fg mb-4">
              إزاي بيشتغل؟
            </h2>
            <p className="text-surface-muted text-lg">
              ٣ خطوات بسيطة وخلصت من هموم الانتظار للأبد
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-32 right-[16%] left-[16%] h-px bg-gradient-to-l from-transparent via-primary/30 to-transparent" />

            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-surface-card rounded-3xl p-8 shadow-soft border border-surface text-center hover:shadow-elegant transition-all duration-500 hover:-translate-y-2 animate-fade-up" style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className="relative inline-flex">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-5 shadow-elegant">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  <div className="text-7xl font-black text-surface-fg/5 absolute top-4 left-6 leading-none">{step.num}</div>
                  <h3 className="text-xl font-bold text-surface-fg mb-3 relative">{step.title}</h3>
                  <p className="text-surface-muted text-sm leading-relaxed relative">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-surface-muted">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-surface-fg mb-4">
              مميزات تخليك تتميّز
            </h2>
            <p className="text-surface-muted text-lg">
              كل اللي محلك محتاجه عشان يشتغل بكفاءة ويكسب رضا زباينه
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feat, i) => {
              const colors = ["bg-primary/10 text-primary", "bg-accent/10 text-accent", "bg-success/10 text-success", "bg-warning/10 text-warning"];
              return (
                <div key={i} className="bg-surface-card rounded-2xl p-6 shadow-soft border border-surface hover:shadow-elegant hover:-translate-y-1 transition-all duration-300 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${colors[i % 4]}`}>
                    <feat.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-surface-fg mb-2">{feat.title}</h3>
                  <p className="text-sm text-surface-muted leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 bg-surface">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-surface-fg mb-4">
              اختار الباقة المناسبة
            </h2>
            <p className="text-surface-muted text-lg">
              ابدأ مجاناً وترقّ لما محلك يكبر
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {Object.values(PLANS).map((plan, i) => {
              const featured = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 ${
                    featured
                      ? "bg-gradient-to-br from-primary to-primary-glow text-white shadow-elegant scale-105"
                      : "bg-surface-card border border-surface shadow-soft"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-gradient-gold text-foreground text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                      ⭐ {plan.badge}
                    </div>
                  )}

                  <div className={`text-center mb-6 ${featured ? "text-white" : "text-surface-fg"}`}>
                    <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                    <p className={`text-sm ${featured ? "text-white/80" : "text-surface-muted"}`}>{plan.description}</p>
                  </div>

                  <div className={`text-center mb-8 pb-8 border-b ${featured ? "border-white/20" : "border-surface"}`}>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className={`text-5xl font-black ${featured ? "text-white" : "text-surface-fg"}`}>
                        {plan.price === 0 ? "صفر" : plan.price}
                      </span>
                      <span className={`text-base ${featured ? "text-white/80" : "text-surface-muted"}`}>
                        ج/شهر
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f.key} className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 flex-shrink-0 ${featured ? "text-white" : "text-success"}`} />
                        <span className={featured ? "text-white/90" : "text-surface-fg"}>{f.label}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => navigate(`/signup${window.location.search}`)}
                    className={`w-full rounded-full h-12 font-bold ${
                      featured
                        ? "bg-white text-primary hover:bg-white/90"
                        : "bg-surface-fg/5 text-surface-fg hover:bg-surface-fg/10"
                    }`}
                    variant="ghost"
                  >
                    {plan.cta}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AFFILIATE */}
      <section className="py-24 px-6 hero-bg relative">
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-gold items-center justify-center text-4xl mb-6 shadow-elegant">
            💰
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4">اكسب معنا!</h2>
          <p className="text-foreground/70 text-lg max-w-2xl mx-auto mb-12">
            رشّح دَوْرَك لأصحاب المحلات واكسب عمولة ١٥% على كل اشتراك.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
            {[
              { icon: TrendingUp, label: "١٢ شهر", value: "دخل مستمر" },
              { icon: Wallet, label: "١٥% عمولة", value: "على كل اشتراك" },
              { icon: UserPlus, label: "ابعت لينك", value: "وابدأ تكسب" },
            ].map((s, i) => (
              <div key={i} className="glass-card rounded-2xl p-5">
                <s.icon className="w-6 h-6 text-accent mx-auto mb-3" />
                <div className="text-base font-bold mb-1">{s.label}</div>
                <div className="text-xs text-foreground/60">{s.value}</div>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            onClick={() => navigate("/affiliate")}
            className="bg-gradient-gold text-foreground hover:opacity-90 h-14 px-8 rounded-full font-bold gap-2 shadow-elegant"
          >
            انضم لبرنامج الشركاء
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-background border-t border-border py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo size="md" />
              <p className="text-foreground/60 text-sm mt-4 leading-relaxed">
                نظام إدارة الطوابير الذكي. خلي زباينك يستنوا براحة وأنت بتركز على شغلك.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">المنتج</h4>
              <ul className="space-y-2 text-sm text-foreground/60">
                <li><Link to="/about" className="hover:text-foreground transition">من نحن</Link></li>
                <li><a href="#how" className="hover:text-foreground transition">كيف يعمل</a></li>
                <li><a href="#features" className="hover:text-foreground transition">المميزات</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition">الأسعار</a></li>
                <li><Link to="/affiliate" className="hover:text-foreground transition">برنامج الشركاء</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">الحساب</h4>
              <ul className="space-y-2 text-sm text-foreground/60">
                <li><Link to="/login" className="hover:text-foreground transition">تسجيل الدخول</Link></li>
                <li><Link to="/signup" className="hover:text-foreground transition">إنشاء حساب</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground transition">لوحة التحكم</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">تواصل معنا</h4>
              <ul className="space-y-2 text-sm text-foreground/60">
                <li>
                  <a href="mailto:info@dourak.online" className="hover:text-foreground transition" dir="ltr">
                    info@dourak.online
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/201035851931"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-foreground transition"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.057 0C5.495 0 .163 5.334.163 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.751 1.466h.005c6.554 0 11.886-5.335 11.886-11.893 0-3.18-1.235-6.169-3.482-8.413A11.821 11.821 0 0012.057 0z"/>
                    </svg>
                    <span dir="ltr">+20 103 585 1931</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-foreground/50">
            <div>© 2026 دَوْرَك. جميع الحقوق محفوظة.</div>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-foreground transition">الشروط والأحكام</Link>
              <Link to="/privacy" className="hover:text-foreground transition">سياسة الخصوصية</Link>
            </div>
            <div>صُنع بـ ❤️ في مصر</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
