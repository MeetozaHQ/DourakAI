import { LandingNav } from "@/components/LandingNav";
import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <LandingNav />
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">الشروط والأحكام</h1>
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <p>
              مرحباً بك في منصة دَوْرَك. باستخدامك لخدماتنا فإنك توافق على الشروط
              والأحكام الموضحة أدناه. يرجى قراءتها بعناية قبل البدء في استخدام
              المنصة.
            </p>

            <div>
              <h2 className="text-2xl font-bold mb-3">1. قبول الشروط</h2>
              <p>
                باستخدامك لمنصة دَوْرَك سواء كصاحب محل أو كزبون، فإنك تقر بأنك
                قرأت ووافقت على جميع الشروط والأحكام، وتلتزم بالامتثال لها.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">2. استخدام الخدمة</h2>
              <p>
                تُقدم منصة دَوْرَك خدمة إدارة الطوابير الإلكترونية. يلتزم
                المستخدم باستخدام الخدمة بشكل قانوني وعدم إساءة استخدامها أو
                استخدامها لأغراض غير مشروعة.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">3. الحساب والأمان</h2>
              <p>
                المستخدم مسؤول عن الحفاظ على سرية بيانات حسابه وكلمة المرور،
                ويتحمل كامل المسؤولية عن جميع الأنشطة التي تتم من خلال حسابه.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">4. الاشتراكات والمدفوعات</h2>
              <p>
                تتوفر باقات مختلفة (مجانية ومدفوعة). يلتزم المستخدم بدفع رسوم
                الاشتراك في الباقة التي يختارها وفقاً للأسعار المعلنة. يحق
                لدَوْرَك تعديل الأسعار مع إخطار المستخدمين مسبقاً.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">5. إنهاء الخدمة</h2>
              <p>
                يحق لدَوْرَك إيقاف أو إنهاء حساب أي مستخدم في حالة مخالفة
                الشروط أو إساءة استخدام الخدمة، دون الحاجة لإخطار مسبق.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">6. حدود المسؤولية</h2>
              <p>
                تُقدم الخدمة "كما هي" دون أي ضمانات. لا تتحمل دَوْرَك المسؤولية
                عن أي خسائر مباشرة أو غير مباشرة قد تنتج عن استخدام أو عدم
                القدرة على استخدام الخدمة.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">7. تعديل الشروط</h2>
              <p>
                يحق لدَوْرَك تعديل هذه الشروط في أي وقت. سيتم إخطار المستخدمين
                بالتغييرات الجوهرية، ويُعد استمرار استخدام الخدمة موافقة على
                الشروط المعدّلة.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">8. التواصل</h2>
              <p>
                لأي استفسار حول هذه الشروط، يمكنك التواصل معنا عبر البريد:
                support@dourak.app
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

export default Terms;
