import { LandingNav } from "@/components/LandingNav";
import { Link } from "react-router-dom";

const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <LandingNav />
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">سياسة الاسترجاع والإلغاء</h1>
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <p>
              نحن في دَوْرَك نسعى لتقديم أفضل خدمة لعملائنا. توضح هذه السياسة شروط وإجراءات إلغاء الاشتراكات واسترداد الأموال لضمان الشفافية والعدالة.
            </p>

            <div>
              <h2 className="text-2xl font-bold mb-3">1. إلغاء الاشتراك</h2>
              <p>
                يمكنك إلغاء اشتراكك في أي وقت من خلال لوحة التحكم الخاصة بك. عند إلغاء الاشتراك، سيظل حسابك نشطاً في الباقة الحالية حتى نهاية فترة الفوترة الحالية (نهاية الشهر)، ولن يتم تجديد الاشتراك للفترة التالية.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">2. سياسة استرداد الأموال</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>يتم رد المبلغ كاملاً في حالة طلب الاسترداد خلال أول ٧ أيام من تاريخ الاشتراك الأول، بشرط عدم استهلاك أكثر من ١٠% من سعة الباقة المتاحة.</li>
                <li>لا يتم رد مبالغ الاشتراكات الشهرية أو السنوية جزئياً بعد مرور أول ٧ أيام على الاشتراك.</li>
                <li>في حالة وجود مشكلة تقنية ناتجة عن "دَوْرَك" أدت لتوقف الخدمة لأكثر من ٤٨ ساعة متواصلة، يحق للعميل طلب تعويض بمدة إضافية أو رد جزء من مبلغ الشهر بنسبة فترة التوقف.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">3. تغيير الباقات</h2>
              <p>
                عند الترقية لباقة أعلى، يتم تطبيق التسعير الجديد فوراً ومحاسبتك على الفرق. عند الانتقال لباقة أقل (Downgrade)، يتم تطبيق التغيير من تاريخ التجديد القادم، ولا يتم رد فرق السعر للفترة المتبقية من الشهر الحالي.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">4. الحالات الاستثنائية</h2>
              <p>
                نحتفظ بالحق في دراسة كل حالة استرداد على حدة بناءً على الظروف الخاصة، وقد نقوم بإصدار استرداد كامل أو جزئي في حالات خاصة نراها مناسبة لرضا العميل.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">5. معالجة عمليات الاسترداد</h2>
              <p>
                تتم معالجة عمليات الاسترداد من خلال نفس وسيلة الدفع الأصلية. قد تستغرق عملية الاسترداد من ٥ إلى ١٥ يوم عمل لتظهر في كشف حسابك، وذلك بناءً على إجراءات البنك أو بوابات الدفع.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">6. التواصل لطلبات الاسترداد</h2>
              <p>
                لتقديم طلب استرداد أو استفسار حول سياسة الإلغاء، يرجى التواصل معنا عبر البريد الإلكتروني:
                <br />
                <a href="mailto:info@dourak.online" className="text-primary hover:underline">info@dourak.online</a>
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link to="/" className="text-primary hover:underline">← العودة للرئيسية</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RefundPolicy;
