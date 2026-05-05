import { LandingNav } from "@/components/LandingNav";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <LandingNav />
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">سياسة الخصوصية</h1>
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <p>
              نحن في دَوْرَك نقدّر خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح
              هذه السياسة كيفية جمع واستخدام وحماية معلوماتك عند استخدام
              منصتنا.
            </p>

            <div>
              <h2 className="text-2xl font-bold mb-3">1. البيانات التي نجمعها</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف.</li>
                <li>بيانات المحل: اسم المحل، نوع النشاط، الموقع.</li>
                <li>بيانات الزبائن: الاسم ورقم الهاتف لإدارة الطابور فقط.</li>
                <li>بيانات الاستخدام: إحصائيات الطوابير وأوقات الانتظار.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">2. كيفية استخدام البيانات</h2>
              <p>
                نستخدم بياناتك لتقديم خدمة إدارة الطوابير، إرسال إشعارات الدور،
                تحسين الخدمة، وتقديم الدعم الفني. لا نستخدم بياناتك لأي أغراض
                تسويقية دون موافقتك.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">3. مشاركة البيانات</h2>
              <p>
                لا نبيع أو نؤجر أو نشارك بياناتك الشخصية مع أي طرف ثالث، إلا
                في الحالات التي يفرضها القانون أو لحماية حقوقنا القانونية.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">4. حماية البيانات</h2>
              <p>
                نستخدم تقنيات تشفير حديثة وسيرفرات آمنة بمعايير عالمية لحماية
                بياناتك. كما نطبق سياسات صارمة للوصول إلى البيانات داخل
                فريقنا.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">5. ملفات الكوكيز</h2>
              <p>
                نستخدم ملفات الكوكيز لتحسين تجربتك على المنصة، حفظ تفضيلاتك،
                وتحليل استخدام الموقع. يمكنك التحكم في الكوكيز من إعدادات
                المتصفح.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">6. حقوقك</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>الوصول إلى بياناتك الشخصية ومراجعتها.</li>
                <li>طلب تعديل أو تصحيح بياناتك.</li>
                <li>طلب حذف حسابك وبياناتك.</li>
                <li>الاعتراض على معالجة بياناتك في حالات معينة.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">7. الاحتفاظ بالبيانات</h2>
              <p>
                نحتفظ ببياناتك طوال فترة استخدامك للخدمة. عند حذف حسابك، يتم
                حذف بياناتك الشخصية خلال فترة معقولة، باستثناء ما يلزم
                الاحتفاظ به قانونياً.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">8. التواصل</h2>
              <p>
                لأي استفسار حول سياسة الخصوصية، يمكنك التواصل معنا عبر البريد:
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

export default Privacy;
