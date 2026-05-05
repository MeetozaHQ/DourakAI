import { MessageCircle } from "lucide-react";

const WHATSAPP_URL = `https://wa.me/201035851931?text=${encodeURIComponent(
  "مرحباً، أرغب في معرفة المزيد عن نظام إدارة الطوابير دَوْرَك",
)}`;

export const WhatsAppButton = () => {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      title="تواصل عبر واتساب"
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      style={{
        backgroundColor: "#25D366",
        boxShadow: "0 8px 24px rgba(37, 211, 102, 0.45)",
      }}
    >
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: "#25D366" }}
      />
      <MessageCircle className="relative w-7 h-7 md:w-8 md:h-8" strokeWidth={2.2} />
    </a>
  );
};

export default WhatsAppButton;
