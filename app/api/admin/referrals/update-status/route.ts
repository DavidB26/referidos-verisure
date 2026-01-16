import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["registered", "contacted", "quoted", "contracted"]);

export async function PATCH(req: Request) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();

    if (!id) return NextResponse.json({ ok: false, message: "ID requerido." }, { status: 400 });
    if (!ALLOWED.has(status)) return NextResponse.json({ ok: false, message: "Estado inválido." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("referrals")
      .update({ status })
      .eq("id", id)
      .select("id, created_at, status, referrer_email, referrer_user_id, referred_name, referred_email, referred_phone")
      .single();

    if (error) return NextResponse.json({ ok: false, message: "No pudimos actualizar el estado." }, { status: 500 });

    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, message: "Error inesperado." }, { status: 500 });
  }
}