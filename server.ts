import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// --- Paymob Helpers ---

async function getPaymobToken() {
  const resp = await axios.post("https://egypt.paymob.com/api/auth/tokens", {
    api_key: process.env.PAYMOB_API_KEY
  });
  return resp.data.token;
}

async function registerOrder(token: string, amount: number) {
  const resp = await axios.post("https://egypt.paymob.com/api/ecommerce/orders", {
    auth_token: token,
    delivery_needed: "false",
    amount_cents: amount * 100, // Cents
    currency: "EGP",
    items: []
  });
  return resp.data.id;
}

async function getPaymentKey(token: string, orderId: string, amount: number, customer: { email?: string; first_name?: string; last_name?: string; phone?: string }) {
  const resp = await axios.post("https://egypt.paymob.com/api/ecommerce/payment_keys", {
    auth_token: token,
    amount_cents: amount * 100,
    expiration: 3600,
    order_id: orderId,
    billing_data: {
      apartment: "NA",
      email: customer.email || "test@example.com",
      floor: "NA",
      first_name: customer.first_name || "NA",
      street: "NA",
      building: "NA",
      phone_number: customer.phone || "NA",
      shipping_method: "NA",
      postal_code: "NA",
      city: "NA",
      country: "EG",
      last_name: customer.last_name || "NA",
      state: "NA"
    },
    currency: "EGP",
    integration_id: process.env.PAYMOB_WALLET_INTEGRATION_ID, 
    lock_order_when_paid: "false"
  });
  return resp.data.token;
}

// --- API Routes ---

app.post("/api/pay/initiate", async (req, res) => {
  try {
    const { shopId, amount, customer } = req.body;
    if (!shopId) return res.status(400).json({ error: "Missing shopId" });

    // 1. Auth
    const token = await getPaymobToken();
    
    // 2. Order
    const orderId = await registerOrder(token, amount);
    
    // 3. Payment Key
    const paymentToken = await getPaymentKey(token, orderId, amount, customer);

    // For Wallets, we can either redirect to Paymob checkout or do direct wallet
    // Checkout is easier: https://egypt.paymob.com/api/acceptance/iframes/{IFRAME_ID}?payment_token={token}
    // But for wallets it's often a direct link or specific wallet URL
    
    res.json({ 
      token: paymentToken,
      url: `https://egypt.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&paymentToken=${paymentToken}`
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    console.error("Paymob Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

app.post("/api/pay/webhook", async (req, res) => {
  try {
    const { obj } = req.body;
    if (!obj) return res.sendStatus(200);

    // Verify HMAC
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET || "";
    const {
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order,
      owner,
      pending,
      source_data,
      success
    } = obj;

    const dataArr = [
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order.id,
      owner,
      pending,
      source_data.pan,
      source_data.sub_type,
      source_data.type,
      success
    ];

    const message = dataArr.join("");
    const hash = crypto.createHmac("sha512", hmacSecret).update(message).digest("hex");

    if (hash !== req.query.hmac) {
       console.error("Invalid HMAC signature");
       // return res.status(400).send("Invalid HMAC");
    }

    if (success === true || success === "true") {
      // Find shop by order id (we'd need to store order_id mapping usually)
      // Or use extra_billing_data or merchant_order_id
      // For now, let's assume we use merchant_order_id as shopId
      const shopId = obj.order.merchant_order_id; 
      
      if (shopId) {
        await supabaseAdmin
          .from("shops")
          .update({ plan: "pro", active: true })
          .eq("id", shopId);
        
        console.log(`Payment success for shop ${shopId}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error);
    res.sendStatus(500);
  }
});

app.post("/api/queue", async (req, res) => {
  try {
    const { action, slug, queueSlug, entryId, notifyToken, name } = req.body;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    // 1. Get Shop
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (shopErr || !shop) return res.status(404).json({ error: "المحل غير موجود" });

    // 2. Get Queue
    let queueQuery = supabaseAdmin.from("queues").select("*").eq("shop_id", shop.id).eq("active", true);
    if (queueSlug) {
      queueQuery = queueQuery.eq("slug", queueSlug);
    } else {
      queueQuery = queueQuery.order("created_at", { ascending: true }).limit(1);
    }

    const { data: qList, error: qErr } = await queueQuery;
    const queue = qList?.[0];

    if (qErr || !queue) return res.status(404).json({ error: "لا يوجد طابور نشط حالياً" });

    // Action: Get (Load status)
    if (action === "get") {
      const { data: entries } = await supabaseAdmin
        .from("queue_entries")
        .select("id, number, status")
        .eq("queue_id", queue.id)
        .in("status", ["waiting", "serving"])
        .order("number", { ascending: true });

      let entry = null;
      if (entryId && notifyToken) {
        const { data: e } = await supabaseAdmin
          .from("queue_entries")
          .select("*")
          .eq("id", entryId)
          .eq("notify_token", notifyToken)
          .maybeSingle();
        if (e && (e.status === "waiting" || e.status === "serving")) {
          entry = e;
        }
      }

      return res.json({ shop, queue, entries: entries || [], entry });
    }

    // Action: Join
    if (action === "join") {
      if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

      // Get next number
      const { data: lastEntry } = await supabaseAdmin
        .from("queue_entries")
        .select("number")
        .eq("queue_id", queue.id)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (lastEntry?.number || 0) + 1;
      const newNotifyToken = crypto.randomUUID();

      const { data: newEntry, error: insertErr } = await supabaseAdmin
        .from("queue_entries")
        .insert({
          queue_id: queue.id,
          name,
          number: nextNumber,
          status: "waiting",
          notify_token: newNotifyToken
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const { data: entries } = await supabaseAdmin
        .from("queue_entries")
        .select("id, number, status")
        .eq("queue_id", queue.id)
        .in("status", ["waiting", "serving"])
        .order("number", { ascending: true });

      return res.json({ shop, queue, entries: entries || [], entry: newEntry });
    }

    // Action: Leave
    if (action === "leave") {
      if (!entryId || !notifyToken) return res.status(400).json({ error: "Missing credentials" });
      
      await supabaseAdmin
        .from("queue_entries")
        .update({ status: "left", left_at: new Date().toISOString() })
        .eq("id", entryId)
        .eq("notify_token", notifyToken);

      return res.json({ success: true });
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (error: unknown) {
    console.error("Queue API Error:", error);
    res.status(500).json({ error: "فشل في معالجة طلب الطابور" });
  }
});

// --- Vite Middleware ---

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
