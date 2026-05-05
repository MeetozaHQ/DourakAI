import postgres from "npm:postgres@3.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sql = postgres(Deno.env.get("SUPABASE_DB_URL") ?? "", {
  prepare: false,
  ssl: "require",
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

type Body = {
  action?: "get" | "join" | "leave";
  slug?: string;
  queueSlug?: string;
  entryId?: string;
  notifyToken?: string;
  name?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as Body;
    const action = body.action ?? "get";

    if (!body.slug) return json({ error: "Missing shop slug" }, 400);

    const [shop] = await sql`
      select id, name, slug, plan, daily_limit, brand_color, logo_url
      from public.shops
      where slug = ${body.slug} and active = true
      limit 1
    `;

    if (!shop) return json({ error: "المحل غير موجود أو غير مُفعّل" }, 404);

    const queues = body.queueSlug
      ? await sql`
          select id, current_serving, name, slug
          from public.queues
          where shop_id = ${shop.id} and active = true and slug = ${body.queueSlug}
          limit 1
        `
      : await sql`
          select id, current_serving, name, slug
          from public.queues
          where shop_id = ${shop.id} and active = true
          order by created_at asc
          limit 1
        `;
    const queue = queues[0];

    if (!queue) return json({ error: "لا يوجد طابور نشط لهذا المحل" }, 404);

    if (action === "join") {
      const cleanName = body.name?.trim().slice(0, 50);
      if (!cleanName) return json({ error: "اكتب اسمك أولاً" }, 400);

      // Enforce daily limit for free plan
      if (shop.plan === "free") {
        const limit = shop.daily_limit ?? 10;
        const [countRow] = await sql`
          select count(*)::int as cnt
          from public.queue_entries
          where queue_id = ${queue.id}
            and joined_at::date = current_date
        `;
        if ((countRow?.cnt ?? 0) >= limit) {
          return json({ error: `تم الوصول للحد اليومي (${limit} زبون). المحل وصل لطاقته اليومية، حاول غداً 🙏` }, 429);
        }
      }

      const [entry] = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${queue.id}::text))`;
        const [next] = await tx`
          select coalesce(max(number), 0) + 1 as number
          from public.queue_entries
          where queue_id = ${queue.id}
            and joined_at::date = current_date
        `;
        return tx`
          insert into public.queue_entries (queue_id, shop_id, number, customer_name, status)
          values (${queue.id}, ${shop.id}, ${next.number}, ${cleanName}, 'waiting')
          returning id, number, status, notify_token
        `;
      });

      return json({ shop, queue, entry, entries: await getEntries(queue.id) });
    }

    if (action === "leave") {
      if (!body.entryId || !body.notifyToken) return json({ error: "Missing entry" }, 400);
      await sql`
        update public.queue_entries
        set status = 'left'
        where id = ${body.entryId}
          and queue_id = ${queue.id}
          and notify_token = ${body.notifyToken}
          and status in ('waiting', 'serving')
      `;
      return json({ shop, queue, entry: null, entries: await getEntries(queue.id) });
    }

    const entries = await getEntries(queue.id);
    let entry = null;
    if (body.entryId && body.notifyToken) {
      const [stored] = await sql`
        select id, number, status, notify_token
        from public.queue_entries
        where id = ${body.entryId}
          and queue_id = ${queue.id}
          and notify_token = ${body.notifyToken}
          and status in ('waiting', 'serving')
        limit 1
      `;
      entry = stored ?? null;
    }

    return json({ shop, queue, entry, entries });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error); return json({ error: msg }, 400);
  }
});

async function getEntries(queueId: string) {
  return sql`
    select id, number, status, notify_token
    from public.queue_entries
    where queue_id = ${queueId}
      and joined_at >= date_trunc('day', now())
    order by number asc
  `;
}