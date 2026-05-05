import { LandingNav } from "@/components/LandingNav";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

const About = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <LandingNav />

      <main className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary mb-4">
              <span className="w-2 h-2 rounded-full bg-primary" />
              من نحن
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              مرحبًا بك في دَوْرَك 👋
            </h1>
          </div>

          <article className="space-y-6 text-lg leading-loose text-foreground/85">
            <p>
              نحن منصة رقمية تهدف إلى إنهاء فوضى الانتظار في المحلات الخدمية،
              من خلال نظام بسيط وذكي لإدارة الطوابير بدون ازدحام أو إهدار للوقت.
            </p>

            <p>
              نؤمن أن وقت العميل مهم، وأن تجربة الانتظار يجب أن تكون مريحة
              ومنظمة. لذلك قمنا بتصميم دَوْرَك ليمنح أصحاب المحلات أداة سهلة
              لإدارة العملاء، ويمنح الزبائن حرية الانتظار من أي مكان مع معرفة
              دورهم بدقة.
            </p>

            <div>
              <p className="mb-4">
                نساعد اليوم الحلاقين، العيادات، المطاعم، ومقدمي الخدمات على:
              </p>
              <ul className="space-y-3 pr-2">
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span>تقليل الزحام داخل المكان</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span>تحسين تجربة العملاء</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span>زيادة عدد الزبائن بدون ضغط أو فوضى</span>
                </li>
              </ul>
            </div>

            <p className="text-xl font-semibold text-foreground">
              هدفنا هو تحويل تجربة الانتظار من عبء يومي إلى تجربة ذكية وسلسة.
            </p>
          </article>

          <div className="mt-16 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-gradient-primary text-primary-foreground px-8 py-3 rounded-full font-semibold shadow-elegant hover:opacity-90 transition"
            >
              ابدأ مجاناً الآن
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-background border-t border-border py-8 px-6">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-foreground/50">
          <Logo size="sm" />
          <div>© 2026 دَوْرَك. جميع الحقوق محفوظة.</div>
        </div>
      </footer>
    </div>
  );
};

export default About;
