import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Shield, Store, Users, DollarSign, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PLANS, PlanId } from "@/lib/plans";

const Admin = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  type ShopRow = { id: string; name: string; slug: string; plan: string; created_at: string; owner_id: string };
  type Commission = {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    referrer?: { name: string; owner_id: string };
    referred?: { name: string };
  };
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);
  const [refs, setRefs] = useState<Record<string, unknown>[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<{
    id: string;
    amount: number;
    phone_number: string;
    account_name: string;
    status: string;
    created_at: string;
    admin_note?: string;
    shop?: { id: string; name: string; owner_id: string };
  }[]>([]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!loading) {
        if (!user) {
          navigate("/login");
        } else if (!isAdmin) {
          toast.error("ليس لديك صلاحية");
          navigate("/dashboard");
        } else {
          try {
            await load();
          } catch (error) {
            console.error("Error loading admin data:", error);
            toast.error("حدث خطأ أثناء تحميل البيانات");
          }
        }
      }
    };
    
    void checkAccess();
  }, [loading, user, isAdmin, navigate, load]);

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }, { data: r }, { data: c }, { data: w }] = await Promise.all([
      supabase.from("shops").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("referrals").select("*"),
      supabase.from("commissions").select(`
        *,
        referrer:referrer_shop_id (name, owner_id),
        referred:referred_shop_id (name)
      `).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select(`
        *,
        shop:shop_id (id, name, owner_id)
      `).order("created_at", { ascending: false }),
    ]);

    const rawShops = (s ?? []) as ShopRow[];
    
    // Deduplicate shops by owner_id in frontend (keep most recent)
    const uniqueShops = rawShops.reduce((acc, current) => {
      const x = acc.find(item => item.owner_id === current.owner_id);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as ShopRow[]);

    // If there were duplicates, try to clean them up from DB (most recent stay)
    if (rawShops.length > uniqueShops.length && isAdmin) {
      const idsToDelete = rawShops
        .filter(rs => !uniqueShops.some(us => us.id === rs.id))
        .map(rs => rs.id);
      
      if (idsToDelete.length > 0) {
        try {
          await supabase.from("shops").delete().in("id", idsToDelete);
          console.log("Cleaned up duplicate shops from DB:", idsToDelete.length);
        } catch (err) {
          console.error("Failed to clean up duplicates:", err);
        }
      }
    }

    setShops(uniqueShops);
    setProfiles(p ?? []);
    setRefs(r ?? []);
    setCommissions(c ?? []);
    setWithdrawals(w ?? []);
  }, [isAdmin]);

  const setPlan = async (shopId: string, plan: PlanId) => {
    await supabase.from("shops").update({ plan, daily_limit: plan === "free" ? 10 : 999999 }).eq("id", shopId);
    toast.success("تم التحديث");
    void load();
  };

  const markCommissionPaid = async (id: string) => {
    const { error } = await supabase.from("commissions").update({ status: "paid" }).eq("id", id);
    if (error) toast.error("تعذر تحديث الحالة");
    else { toast.success("تم التحديث"); void load(); }
  };

  const setWithdrawalStatus = async (id: string, status: string, shopId?: string) => {
    let note = "";
    if (status === "paid") {
      note = prompt("أضف ملاحظة (مثل رقم التحويل أو تم الإرسال):") || "";
    } else if (status === "rejected") {
      note = prompt("سبب الرفض:") || "";
      if (!note) return;
    }

    const { error } = await supabase.from("withdrawals").update({ status, admin_note: note }).eq("id", id);
    
    if (error) {
      toast.error("تعذر تحديث الحالة");
    } else {
      // If paid, also mark all pending commissions for this shop as paid
      if (status === "paid" && shopId) {
        await supabase
          .from("commissions")
          .update({ status: "paid" })
          .eq("referrer_shop_id", shopId)
          .eq("status", "pending");
      }
      
      toast.success("تم التحديث");
      void load();
    }
  };

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo size="lg" className="animate-pulse" />
        <div className="text-surface-fg/50 font-bold animate-pulse">جاري التحميل...</div>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-4 text-xs opacity-50">
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <Shield className="w-16 h-16 text-destructive/20 mb-2" />
        <h1 className="text-2xl font-black text-surface-fg">دخول غير مصرح</h1>
        <p className="text-surface-muted max-w-xs">ليس لديك صلاحيات كافية للوصول لهذه الصفحة. سيتم تحويلك للوحة التحكم.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4 rounded-xl">
          العودة للوحة التحكم
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen" dir="rtl">
      <header className="bg-surface-card border-b border-surface px-4 md:px-6 py-4 sticky top-0 z-50 backdrop-blur-md bg-surface-card/80">
        <div className="container mx-auto flex items-center justify-between max-w-7xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-surface-fg/70 hover:bg-surface-muted gap-2 rounded-xl h-10 px-3 md:px-4">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            <span className="hidden sm:inline">رجوع</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <Logo size="md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-surface-fg">لوحة المشرف</h1>
          <p className="text-surface-muted text-sm">إدارة المحلات والاشتراكات والإحالات</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          {[
            { icon: Store, label: "إجمالي المحلات", value: shops.length, color: "text-primary bg-primary/10" },
            { icon: Users, label: "المستخدمون", value: profiles.length, color: "text-accent bg-accent/10" },
            { icon: DollarSign, label: "اشتراكات نشطة", value: shops.filter(s => s.plan !== "free").length, color: "text-success bg-success/10" },
            { icon: Shield, label: "إحالات", value: refs.length, color: "text-warning bg-warning/10" },
          ].map((s, i) => (
            <div key={i} className="bg-surface-card rounded-2xl p-4 md:p-5 shadow-soft border border-surface flex flex-col items-center sm:items-start text-center sm:text-right">
              <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-surface-fg">{s.value}</div>
              <div className="text-[10px] md:text-xs text-surface-muted font-bold uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface-card rounded-[2rem] p-4 md:p-6 shadow-soft border border-surface mb-8">
          <h2 className="text-xl font-black text-surface-fg mb-4">المحلات</h2>
          
          {/* Mobile View - Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {shops.map(s => (
              <div key={s.id} className="bg-surface-muted/30 rounded-2xl p-4 border border-surface">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-surface-fg">{s.name}</div>
                    <div className="text-[10px] font-mono text-surface-muted">{s.slug}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    s.plan === "pro" ? "bg-primary/10 text-primary" : s.plan === "business" ? "bg-warning/10 text-warning" : "bg-surface-muted text-surface-muted"
                  }`}>{PLANS[s.plan as PlanId]?.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.keys(PLANS).map(p => (
                    <Button key={p} size="sm" variant="outline" onClick={() => setPlan(s.id, p as PlanId)} className={`h-8 px-2 text-[10px] border-surface rounded-lg ${s.plan === p ? 'bg-surface border-primary ring-1 ring-primary' : 'bg-white'}`}>
                      {PLANS[p as PlanId].name}
                    </Button>
                  ))}
                </div>
                <div className="text-[10px] text-surface-muted text-left">
                  {new Date(s.created_at).toLocaleDateString("ar-EG")}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface text-surface-muted">
                  <th className="text-right py-3 px-2">الاسم</th>
                  <th className="text-right py-3 px-2">المعرف</th>
                  <th className="text-right py-3 px-2 text-center">الباقة</th>
                  <th className="text-right py-3 px-2">تغيير الباقة</th>
                  <th className="text-left py-3 px-2">تاريخ</th>
                </tr>
              </thead>
              <tbody>
                {shops.map(s => (
                  <tr key={s.id} className="border-b border-surface text-surface-fg group hover:bg-surface-muted/30 transition-colors">
                    <td className="py-4 px-2 font-bold">{s.name}</td>
                    <td className="py-4 px-2 font-mono text-xs text-surface-muted">{s.slug}</td>
                    <td className="py-4 px-2 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        s.plan === "pro" ? "bg-primary/10 text-primary" : s.plan === "business" ? "bg-warning/10 text-warning" : "bg-surface-muted text-surface-muted"
                      }`}>{PLANS[s.plan as PlanId]?.name}</span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex gap-1">
                        {Object.keys(PLANS).map(p => (
                          <Button key={p} size="sm" variant={s.plan === p ? "default" : "outline"} onClick={() => setPlan(s.id, p as PlanId)} className={`h-7 px-2 text-xs ${s.plan === p ? '' : 'border-surface text-surface-fg'}`}>
                            {PLANS[p as PlanId].name}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-surface-muted text-xs text-left">{new Date(s.created_at).toLocaleDateString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-card rounded-[2rem] p-4 md:p-6 shadow-soft border border-surface mb-8">
          <h2 className="text-xl font-black text-surface-fg mb-4">العمولات</h2>
          
          {/* Mobile View - Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {commissions.length > 0 ? (
              commissions.map(c => (
                <div key={c.id} className="bg-surface-muted/30 rounded-2xl p-4 border border-surface">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-[10px] text-surface-muted mb-0.5">المسوق (المحل)</div>
                      <div className="font-bold text-surface-fg">{c.referrer?.name || "مجهول"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-surface-muted mb-0.5 text-left">المحل المشترك</div>
                      <div className="text-sm text-surface-fg text-left">{c.referred?.name || "مجهول"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-primary">{c.amount} <span className="text-xs font-normal opacity-70">ج</span></div>
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold mt-1 ${
                        c.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>{c.status === "paid" ? "تم التحويل" : "انتظار"}</span>
                    </div>
                    {c.status === "pending" && (
                      <Button size="sm" onClick={() => markCommissionPaid(c.id)} className="bg-success text-white rounded-xl h-9 px-4 font-bold">
                        تأكيد الدفع
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-surface-muted italic text-sm">لا توجد عمولات حالياً</div>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface text-surface-muted">
                  <th className="text-right py-3 px-2">المسوق (المحل)</th>
                  <th className="text-right py-3 px-2">المحل المشترك</th>
                  <th className="text-center py-3 px-2">المبلغ</th>
                  <th className="text-center py-3 px-2">الحالة</th>
                  <th className="text-left py-3 px-2">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {commissions.length > 0 ? (
                  commissions.map(c => (
                    <tr key={c.id} className="border-b border-surface text-surface-fg group hover:bg-surface-muted/30 transition-colors">
                      <td className="py-4 px-2 font-bold">{c.referrer?.name || "مجهول"}</td>
                      <td className="py-4 px-2">{c.referred?.name || "مجهول"}</td>
                      <td className="py-4 px-2 font-black text-primary text-center">{c.amount} ج</td>
                      <td className="py-4 px-2 text-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          c.status === "paid" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-500"
                        }`}>{c.status === "paid" ? "تم التحويل" : "انتظار"}</span>
                      </td>
                      <td className="py-4 px-2 text-left">
                        {c.status === "pending" && (
                          <Button size="sm" onClick={() => markCommissionPaid(c.id)} className="h-8 bg-success text-white rounded-lg px-4 hover:shadow-lg transition-shadow">
                            تأكيد الدفع
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-surface-muted italic">لا توجد عمولات حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-card rounded-[2rem] p-4 md:p-6 shadow-soft border border-surface">
          <h2 className="text-xl font-black text-surface-fg mb-4">طلبات السحب</h2>
          
          {/* Mobile View - Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {withdrawals.length > 0 ? (
              withdrawals.map(w => (
                <div key={w.id} className="bg-surface-muted/30 rounded-2xl p-4 border border-surface">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] text-surface-muted mb-0.5">المسوق (المحل)</div>
                      <div className="font-bold text-surface-fg">{w.shop?.name || "مجهول"}</div>
                    </div>
                    <div className="text-left">
                       <div className="font-bold text-sm">{w.account_name}</div>
                       <div className="text-[10px] text-surface-muted">{w.phone_number}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-2xl font-black text-success">{w.amount} <span className="text-xs font-normal opacity-70 italic">ج</span></div>
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold mt-1 ${
                        w.status === "paid" ? "bg-success/10 text-success" : w.status === "pending" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                      }`}>{w.status === "paid" ? "تم" : w.status === "pending" ? "انتظار" : "مرفوض"}</span>
                    </div>
                    {w.admin_note && <div className="text-[10px] text-surface-muted italic border-r-2 border-primary/20 pr-3 py-1 max-w-[150px]">{w.admin_note}</div>}
                  </div>

                  {w.status === "pending" && (
                    <div className="flex gap-2 w-full pt-2 border-t border-surface/50">
                      <Button size="sm" onClick={() => setWithdrawalStatus(w.id, "paid", w.shop?.id)} className="flex-1 h-10 bg-success text-white rounded-xl font-bold">
                        تم الدفع
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setWithdrawalStatus(w.id, "rejected", w.shop?.id)} className="flex-1 h-10 text-destructive border-destructive rounded-xl">
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-surface-muted italic text-sm">لا توجد طلبات سحب حالياً</div>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface text-surface-muted">
                  <th className="text-right py-3 px-2">المسوق (المحل)</th>
                  <th className="text-right py-3 px-2">بيانات السحب</th>
                  <th className="text-center py-3 px-2">المبلغ</th>
                  <th className="text-right py-3 px-2">الحالة/ملاحظات</th>
                  <th className="text-left py-3 px-2">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length > 0 ? (
                  withdrawals.map(w => (
                    <tr key={w.id} className="border-b border-surface text-surface-fg group hover:bg-surface-muted/30 transition-colors">
                      <td className="py-4 px-2 font-bold">{w.shop?.name || "مجهول"}</td>
                      <td className="py-4 px-2">
                         <div className="font-bold">{w.account_name}</div>
                         <div className="text-[10px] text-surface-muted">{w.phone_number}</div>
                      </td>
                      <td className="py-4 px-2 font-black text-success text-center">{w.amount} ج</td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold w-fit ${
                            w.status === "paid" ? "bg-success/10 text-success" : w.status === "pending" ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"
                          }`}>{w.status === "paid" ? "تم" : w.status === "pending" ? "انتظار" : "مرفوض"}</span>
                          {w.admin_note && <span className="text-[10px] text-surface-muted italic">{w.admin_note}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-left">
                        {w.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setWithdrawalStatus(w.id, "paid", w.shop?.id)} className="h-8 bg-success text-white rounded-lg px-4">
                              تم الدفع
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setWithdrawalStatus(w.id, "rejected", w.shop?.id)} className="h-8 text-destructive border-destructive rounded-lg">
                              رفض
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-surface-muted italic">لا توجد طلبات سحب حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
