import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

const REGISTER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function normalizeEmail(val: unknown): string | null {
  const v = String(val ?? "").trim().toLowerCase();
  return v ? v : null;
}

function isEmail(val: string) {
  // Basic but stricter email format validation (does not guarantee the inbox exists)
  if (!val) return false;
  if (val.length > 254) return false;
  if (val.includes("..")) return false;

  // local@domain.tld (tld >= 2)
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(val);
}

function normalizePhone(val: string) {
  // Keep digits only (PE mobile: 9 digits)
  return String(val || "").replace(/\D/g, "").slice(0, 9);
}

function isPeMobile9(val: string) {
  return /^\d{9}$/.test(normalizePhone(val));
}

function normalizeDni(val: unknown) {
  // Keep digits only (PE DNI: 8 digits)
  return String(val ?? "").replace(/\D/g, "").slice(0, 8);
}

function isPeDni8(val: string) {
  return /^\d{8}$/.test(normalizeDni(val));
}

function cleanTrack(val: unknown, max = 120) {
  if (typeof val !== "string") return null;
  const v = val.trim();
  if (!v) return null;
  return v.slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Allow "claim" action to attach previously anonymous referrals (by referrer_email)
    // to the currently authenticated user.
    if (body?.action === "claim") {
      const accessToken = body?.accessToken;
      if (!accessToken || typeof accessToken !== "string") {
        return NextResponse.json(
          { ok: false, message: "Access token requerido." },
          { status: 400 }
        );
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
      if (userErr || !userData?.user) {
        return NextResponse.json(
          { ok: false, message: "Sesión inválida." },
          { status: 401 }
        );
      }

      const userId = userData.user.id;
      const userEmail = userData.user.email;
      if (!userEmail) {
        return NextResponse.json(
          { ok: false, message: "Tu usuario no tiene email." },
          { status: 400 }
        );
      }

      const claimRes = await supabaseAdmin
        .from("referrals")
        .update({ referrer_user_id: userId })
        .is("referrer_user_id", null)
        .eq("referrer_email", userEmail)
        // We avoid select options for compatibility with different supabase-js versions.
        .select("id");

      if (claimRes.error) {
        return NextResponse.json(
          { ok: false, message: "No se pudo asociar tus referidos." },
          { status: 500 }
        );
      }

      const claimed = Array.isArray(claimRes.data) ? claimRes.data.length : 0;
      return NextResponse.json({ ok: true, claimed });
    }

    const {
      referrerEmail,       // requerido si NO hay sesión
      referredName,
      referredEmail,
      referredPhone,
      consent,
      accessToken,         // opcional (si está logueado)
      // tracking / campaign (send from client using URL params)
      camp,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      landing_path,
      referer,
    } = body ?? {};

    const referredEmailNorm = normalizeEmail(referredEmail);
    const referredPhoneNorm = normalizePhone(referredPhone);

    const tracking = {
      camp: cleanTrack(camp, 80),
      utm_source: cleanTrack(utm_source, 80),
      utm_medium: cleanTrack(utm_medium, 80),
      utm_campaign: cleanTrack(utm_campaign, 120),
      utm_term: cleanTrack(utm_term, 120),
      utm_content: cleanTrack(utm_content, 120),
      landing_path: cleanTrack(landing_path, 200),
      referer: cleanTrack(referer, 300),
    };

    if (!referredName || typeof referredName !== "string") {
      return NextResponse.json({ ok: false, message: "Nombre del referido requerido." }, { status: 400 });
    }
    // Correo del referido es OPCIONAL: solo validar si viene con valor
    if (referredEmailNorm !== null && !isEmail(referredEmailNorm)) {
      return NextResponse.json({ ok: false, message: "Correo del referido inválido." }, { status: 400 });
    }
    if (!referredPhone || typeof referredPhone !== "string" || !isPeMobile9(referredPhoneNorm)) {
      return NextResponse.json(
        { ok: false, message: "Teléfono del referido inválido (9 dígitos, solo números)." },
        { status: 400 }
      );
    }
    if (consent !== true) {
      return NextResponse.json({ ok: false, message: "Debes confirmar la autorización del referido." }, { status: 400 });
    }

    // Si viene accessToken, validamos usuario y usamos ese referrer
    let referrer_user_id: string | null = null;
    let final_referrer_email: string | null = null;

    if (accessToken && typeof accessToken === "string") {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (!error && data?.user) {
        referrer_user_id = data.user.id;
        final_referrer_email = (data.user.email ?? null);
      }
    }

    // Si no hay sesión válida, usamos el correo del referidor
    if (!referrer_user_id) {
      const referrerEmailNorm = normalizeEmail(referrerEmail);
      // referrerEmailNorm ya viene normalizado; si es null o no cumple formato, es inválido
      if (!referrerEmailNorm || !isEmail(referrerEmailNorm)) {
        return NextResponse.json(
          { ok: false, message: "Ingresa tu correo (referidor) válido." },
          { status: 400 }
        );
      }
      final_referrer_email = referrerEmailNorm;
    }

    // Cooldown anti-abuso: 1 registro cada 5 minutos por referidor
    const since = new Date(Date.now() - REGISTER_COOLDOWN_MS).toISOString();

    // Preferimos referrer_user_id si existe; si no, usamos referrer_email
    const recentQuery = supabaseAdmin
      .from("referrals")
      .select("id")
      .gte("created_at", since)
      .limit(1);

    const recentRes = referrer_user_id
      ? await recentQuery.eq("referrer_user_id", referrer_user_id)
      : await recentQuery.eq("referrer_email", final_referrer_email);

    if (recentRes.error) {
      return NextResponse.json(
        { ok: false, message: "No pudimos validar seguridad del registro. Intenta nuevamente." },
        { status: 500 }
      );
    }

    if (Array.isArray(recentRes.data) && recentRes.data.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Por seguridad, espera 5 minutos antes de registrar otro referido." },
        { status: 429 }
      );
    }

    // Duplicados (server-side): evita registrar el mismo correo o teléfono más de una vez
    const [dupEmailRes, dupPhoneRes] = await Promise.all([
      referredEmailNorm
        ? supabaseAdmin.from("referrals").select("id").eq("referred_email", referredEmailNorm).limit(1)
        : Promise.resolve({ data: [], error: null } as any),
      supabaseAdmin.from("referrals").select("id").eq("referred_phone", referredPhoneNorm).limit(1),
    ]);

    if (dupEmailRes.error) {
      return NextResponse.json(
        { ok: false, message: "Error validando duplicados (correo)." },
        { status: 500 }
      );
    }

    if (dupPhoneRes.error) {
      return NextResponse.json(
        { ok: false, message: "Error validando duplicados (teléfono)." },
        { status: 500 }
      );
    }

    if (Array.isArray(dupEmailRes.data) && dupEmailRes.data.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Este correo ya fue registrado." },
        { status: 409 }
      );
    }

    if (Array.isArray(dupPhoneRes.data) && dupPhoneRes.data.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Este teléfono ya fue registrado." },
        { status: 409 }
      );
    }

    // Insert DB (best-effort: also return id/created_at for internal email)
    const insertRes = await supabaseAdmin
      .from("referrals")
      .insert({
        referrer_user_id,
        referrer_email: final_referrer_email,
        referred_name: referredName.trim(),
        referred_email: referredEmailNorm,
        referred_phone: referredPhoneNorm,
        consent: true,
        status: "registered",
        // tracking
        camp: tracking.camp,
        utm_source: tracking.utm_source,
        utm_medium: tracking.utm_medium,
        utm_campaign: tracking.utm_campaign,
        utm_term: tracking.utm_term,
        utm_content: tracking.utm_content,
        landing_path: tracking.landing_path,
        referer: tracking.referer,
      })
      .select("id, created_at, camp, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_path, referer");

    const insertError = insertRes.error;

    // Si hay violación de unique (DB), avisa bonito
  // Si hay error al insertar
if (insertError) {
  const code = (insertError as any).code; // Postgres error code (ej: 23505)
  const msg = String(insertError.message || "");
  const lower = msg.toLowerCase();

  // Unique violation
  if (code === "23505" || lower.includes("duplicate key")) {
    // Detectar cuál campo chocó (según el nombre del índice/constraint o el mensaje)
    const isEmail =
      lower.includes("referrals_referred_email_uq") ||
      lower.includes("referred_email");

      const isPhone =
      lower.includes("referred_phone") ||
      lower.includes("referred_phone_uq") ||
      lower.includes("referred_phone_unique");

    const fieldMsg = isPhone
      ? "Este teléfono ya fue registrado."
      : isEmail
      ? "Este correo ya fue registrado."
      : "Este referido ya fue registrado.";

    return NextResponse.json(
      { ok: false, message: fieldMsg },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { ok: false, message: "Error guardando el referido." },
    { status: 400 }
  );
}

    // Extract id/created_at from insert response (supports array/object)
    const inserted = Array.isArray(insertRes.data) ? insertRes.data[0] : (insertRes.data as any);
    const referralId: string | null = inserted?.id ?? null;
    const createdAt: string = inserted?.created_at ?? new Date().toISOString();

    const insertedTracking = {
      camp: inserted?.camp ?? tracking.camp,
      utm_source: inserted?.utm_source ?? tracking.utm_source,
      utm_medium: inserted?.utm_medium ?? tracking.utm_medium,
      utm_campaign: inserted?.utm_campaign ?? tracking.utm_campaign,
      utm_term: inserted?.utm_term ?? tracking.utm_term,
      utm_content: inserted?.utm_content ?? tracking.utm_content,
      landing_path: inserted?.landing_path ?? tracking.landing_path,
      referer: inserted?.referer ?? tracking.referer,
    };

    // Enviar correo informativo al referido
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
    // EMAIL_INTERNAL_TO: internal notification recipient (e.g. leads@empresa.com)
    const internalTo = process.env.EMAIL_INTERNAL_TO || "";

    const referidor = final_referrer_email ?? "una persona";

    const subject = "Te han referido a Verisure";
    const html = `
      <div style="font-family: Arial, sans-serif; color:#111;">
        <h2 style="margin:0 0 12px 0;">Hola ${escapeHtml(referredName.trim())},</h2>
        <p style="margin:0 0 12px 0;">
          ${escapeHtml(referidor)} te ha referido a <strong>Verisure</strong>.
        </p>
        <p style="margin:0 0 12px 0;">
          Este es un mensaje informativo. En breve, un asesor de Verisure se pondrá en contacto contigo para continuar la atención.
        </p>
        <p style="margin:18px 0 0 0; font-size:12px; color:#666;">
          Si no esperabas este contacto, puedes ignorar este mensaje.
        </p>
        <p style="margin:10px 0 0 0; font-size:12px; color:#999;">
          © Verisure Perú
        </p>
      </div>
    `;

    let email_sent = false;
    let internal_email_sent = false;

    // 1) correo al referido (solo si el referido dejó correo)
    if (referredEmailNorm) {
      try {
        await resend.emails.send({
          from,
          to: referredEmailNorm,
          subject,
          html,
        });
        email_sent = true;
      } catch {
        // No bloqueamos el registro si el envío falla
        email_sent = false;
      }
    }

    // 2) correo interno (más info)
    if (internalTo) {
      const internalSubject = `Nuevo referido: ${referredName.trim()} (${referredPhoneNorm})`;
      const internalHtml = `
        <div style="font-family: Arial, sans-serif; color:#111;">
          <h2 style="margin:0 0 12px 0;">Nuevo referido registrado</h2>
          <table cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size:14px;">
            <tr><td><b>ID</b></td><td>${escapeHtml(referralId || "—")}</td></tr>
            <tr><td><b>Fecha</b></td><td>${escapeHtml(createdAt)}</td></tr>
            <tr><td><b>Referido</b></td><td>${escapeHtml(referredName.trim())}</td></tr>
            <tr><td><b>Email referido</b></td><td>${escapeHtml(referredEmailNorm || "—")}</td></tr>
            <tr><td><b>Teléfono</b></td><td>${escapeHtml(referredPhoneNorm)}</td></tr>
            <tr><td><b>Referidor (email)</b></td><td>${escapeHtml(final_referrer_email || "—")}</td></tr>
            <tr><td><b>Consentimiento</b></td><td>${consent === true ? "Sí" : "No"}</td></tr>
            <tr><td><b>Status</b></td><td>registered</td></tr>
            <tr><td><b>Camp</b></td><td>${escapeHtml(insertedTracking.camp || "—")}</td></tr>
            <tr><td><b>UTM Source</b></td><td>${escapeHtml(insertedTracking.utm_source || "—")}</td></tr>
            <tr><td><b>UTM Medium</b></td><td>${escapeHtml(insertedTracking.utm_medium || "—")}</td></tr>
            <tr><td><b>UTM Campaign</b></td><td>${escapeHtml(insertedTracking.utm_campaign || "—")}</td></tr>
            <tr><td><b>UTM Term</b></td><td>${escapeHtml(insertedTracking.utm_term || "—")}</td></tr>
            <tr><td><b>UTM Content</b></td><td>${escapeHtml(insertedTracking.utm_content || "—")}</td></tr>
            <tr><td><b>Landing</b></td><td>${escapeHtml(insertedTracking.landing_path || "—")}</td></tr>
            <tr><td><b>Referer</b></td><td>${escapeHtml(insertedTracking.referer || "—")}</td></tr>
          </table>
          <p style="margin:16px 0 0 0; font-size:12px; color:#666;">Enviado automáticamente desde verisure-referidos.</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from,
          to: internalTo,
          subject: internalSubject,
          html: internalHtml,
        });
        internal_email_sent = true;
      } catch {
        internal_email_sent = false;
      }
    }

    return NextResponse.json({ ok: true, email_sent, internal_email_sent });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Error inesperado." }, { status: 500 });
  }
}

// helper simple para evitar inyección en HTML
function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}