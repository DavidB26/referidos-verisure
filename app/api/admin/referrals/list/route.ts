import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
    }

    // Validate admin role via profiles table
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ ok: false, message: "Error validando permisos." }, { status: 500 });
    }

    if (!prof || prof.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Sin permisos de admin." }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("referrals")
      .select(
        "id, created_at, status, referrer_email, referrer_user_id, referred_name, referred_email, referred_phone, consent, notes, camp, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_path, referer",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    if (q) {
      const safe = q.replace(/%/g, "\\%");
      query = query.or(
        `referred_name.ilike.%${safe}%,referred_email.ilike.%${safe}%,referred_phone.ilike.%${safe}%,referrer_email.ilike.%${safe}%`
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    // Enrich with referrer profile data (name/dni/has_verisure) for admin export/UI.
    // We do a second query because referrals.referrer_user_id maps to profiles.id (auth uid)
    // but there is no FK relationship configured for a nested select.
    let enriched = data || [];
    const referrerIds = Array.from(
      new Set((enriched || []).map((r: any) => r.referrer_user_id).filter(Boolean))
    );

    if (referrerIds.length) {
      const { data: profs, error: profsErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, dni, has_verisure, role")
        .in("id", referrerIds);

      if (!profsErr && profs) {
        const map = new Map(profs.map((p: any) => [p.id, p]));
        enriched = enriched.map((r: any) => ({
          ...r,
          referrer_profile: map.get(r.referrer_user_id) || null,
        }));
      }
    }

    if (error) return NextResponse.json({ ok: false, message: "Error cargando referidos." }, { status: 500 });

    return NextResponse.json({ ok: true, data: enriched, total: count || 0 });
  } catch {
    return NextResponse.json({ ok: false, message: "Error inesperado." }, { status: 500 });
  }
}