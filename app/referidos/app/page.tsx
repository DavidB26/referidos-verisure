"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";

type ReferralRow = {
  id: string;
  created_at: string;
  referrer_user_id: string | null;
  referrer_email: string | null;
  referred_name: string;
  referred_email: string;
  referred_phone: string;
  consent: boolean;
  status: "registered" | "contacted" | "quoted" | "contracted" | "invalid";
  notes: string | null;
};

const statusUi: Record<
  ReferralRow["status"],
  { label: string; icon: ReactNode; cls: string }
> = {
  registered: {
    label: "Registrado",
    icon: <Clock size={16} />,
    cls: "bg-gray-50 text-gray-700 border-gray-200",
  },
  contacted: {
    label: "Contactado",
    icon: <Phone size={16} />,
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  quoted: {
    label: "Cotización",
    icon: <Mail size={16} />,
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  contracted: {
    label: "Contratado",
    icon: <CheckCircle2 size={16} />,
    cls: "bg-green-50 text-green-800 border-green-200",
  },
  invalid: {
    label: "No válido",
    icon: <AlertTriangle size={16} />,
    cls: "bg-red-50 text-red-700 border-red-200",
  },
};

const TRACKING_KEY = "ref_tracking_v1";


function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReferralsPortalPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openRegister, setOpenRegister] = useState(false);
  const [referredName, setReferredName] = useState("");
  const [referredEmail, setReferredEmail] = useState("");
  const [referredPhone, setReferredPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; phone?: string; consent?: string }>({});

  const total = useMemo(() => rows.length, [rows.length]);

  async function load() {
    setError(null);
    setRefreshing(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      setEmail(null);
      setRows([]);
      setRefreshing(false);
      setLoading(false);
      return;
    }

    setEmail(user.email ?? null);

    // Reclamar referidos creados sin login (guardados con referrer_email)
    // para que aparezcan en el portal al iniciar sesión.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;
      if (accessToken) {
        await fetch("/api/referrals/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim", accessToken }),
        });
      }
    } catch {
      // si falla el claim, igual continuamos con el listado
    }

    // Filtramos por usuario para mayor claridad (además de RLS)
    const { data, error: selErr } = await supabase
      .from("referrals")
      .select(
        "id, created_at, referrer_user_id, referrer_email, referred_name, referred_email, referred_phone, consent, status, notes"
      )
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (selErr) {
      setError(selErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ReferralRow[]);
    }

    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    load();
    saveTrackingFromUrl();


    // Si cambia la sesión (login/logout), recargamos
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  function resetRegisterForm() {
    setReferredName("");
    setReferredEmail("");
    setReferredPhone("");
    setConsent(false);
    setSubmitState("idle");
    setSubmitError("");
    setFieldErrors({});
  }

  function openRegisterModal() {
    resetRegisterForm();
    setOpenRegister(true);
  }

  function closeRegisterModal() {
    setOpenRegister(false);
  }

function isEmail(val: string) {
  const v = val.trim().toLowerCase();

  // Basic but stricter email format validation (does not guarantee the inbox exists)
  if (v.length > 254) return false;
  if (v.includes("..")) return false;

  // local@domain.tld (tld >= 2)
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(v);
}

function normalizeEmail(val: string) {
  return val.trim().toLowerCase();
}

function normalizePhone(val: string) {
  // Keep digits only (PE mobile: 9 digits)
  return val.replace(/\D/g, "").slice(0, 9);
}

function saveTrackingFromUrl() {
  if (typeof window === "undefined") return;

  const sp = new URLSearchParams(window.location.search);
  const tracking = {
    camp: sp.get("camp"),
    utm_source: sp.get("utm_source"),
    utm_medium: sp.get("utm_medium"),
    utm_campaign: sp.get("utm_campaign"),
    utm_term: sp.get("utm_term"),
    utm_content: sp.get("utm_content"),
    first_landing_path: window.location.pathname,
    first_referer: document.referrer,
    ts: Date.now(),
  };

  const hasAny =
    !!tracking.camp ||
    !!tracking.utm_source ||
    !!tracking.utm_medium ||
    !!tracking.utm_campaign ||
    !!tracking.utm_term ||
    !!tracking.utm_content;

  if (!hasAny) return;

  try {
    localStorage.setItem(TRACKING_KEY, JSON.stringify(tracking));
  } catch {}
}

function getTrackingPayload() {
  if (typeof window === "undefined") return {};

  const sp = new URLSearchParams(window.location.search);

  const fromUrl = {
    camp: sp.get("camp"),
    utm_source: sp.get("utm_source"),
    utm_medium: sp.get("utm_medium"),
    utm_campaign: sp.get("utm_campaign"),
    utm_term: sp.get("utm_term"),
    utm_content: sp.get("utm_content"),
  };

  let stored: any = null;
  try {
    stored = JSON.parse(localStorage.getItem(TRACKING_KEY) || "null");
  } catch {}

  return {
    camp: fromUrl.camp ?? stored?.camp ?? null,
    utm_source: fromUrl.utm_source ?? stored?.utm_source ?? null,
    utm_medium: fromUrl.utm_medium ?? stored?.utm_medium ?? null,
    utm_campaign: fromUrl.utm_campaign ?? stored?.utm_campaign ?? null,
    utm_term: fromUrl.utm_term ?? stored?.utm_term ?? null,
    utm_content: fromUrl.utm_content ?? stored?.utm_content ?? null,
    landing_path: window.location.pathname,
    referer: document.referrer,
    // opcional primer touch
    first_landing_path: stored?.first_landing_path ?? null,
    first_referer: stored?.first_referer ?? null,
  };
}

  function validateRegisterFields() {
    const errors: { name?: string; email?: string; phone?: string; consent?: string } = {};

    if (!referredName.trim()) errors.name = "El nombre es obligatorio.";

    const emailNorm = normalizeEmail(referredEmail);
    if (!emailNorm) errors.email = "El correo es obligatorio.";
    else if (!isEmail(emailNorm)) errors.email = "Ingresa un correo válido.";

    // Duplicados (client-side, usando lo ya cargado en la tabla)
    if (emailNorm && rows.some((r) => normalizeEmail(r.referred_email) === emailNorm)) {
      errors.email = "Este correo ya fue registrado.";
    }

    const phoneNormForDup = normalizePhone(referredPhone);
    if (phoneNormForDup && rows.some((r) => normalizePhone(r.referred_phone) === phoneNormForDup)) {
      errors.phone = "Este teléfono ya fue registrado.";
    }

    const phone = referredPhone.trim();
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) errors.phone = "El teléfono es obligatorio.";
    else if (!/^\d{9}$/.test(phoneNorm)) {
      errors.phone = "Ingresa un teléfono válido (9 dígitos, solo números).";
    }

    if (!consent) errors.consent = "Debes confirmar la autorización.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const ok = validateRegisterFields();
    if (!ok) {
      setSubmitState("error");
      return;
    }

    setSubmitState("loading");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;

      if (!accessToken) {
        throw new Error("Tu sesión expiró. Vuelve a ingresar desde la landing.");
      }

      const res = await fetch("/api/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referredName: referredName.trim(),
          referredEmail: normalizeEmail(referredEmail),
          referredPhone: normalizePhone(referredPhone),
          consent,
          accessToken,
          ...getTrackingPayload(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "No pudimos registrar el referido.");
      }

      setSubmitState("success");
      // recargar tabla
      await load();

      // cerrar modal
      setTimeout(() => {
        closeRegisterModal();
      }, 350);
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err instanceof Error ? err.message : "Error registrando el referido.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-sm text-gray-600">Cargando tu portal…</p>
        </div>
      </main>
    );
  }

  const isAuthed = !!email;

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="text-sm font-semibold text-gray-900 hover:opacity-90"
          >
            Programa de Referidos
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={refreshing}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Actualizar
              </span>
            </Button>
            {isAuthed && (
              <Button variant="secondary" onClick={logout}>
                <span className="inline-flex items-center gap-2">
                  <LogOut size={16} />
                  Salir
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis referidos</h1>
            <p className="mt-1 text-sm text-gray-600">
              {isAuthed ? (
                <>
                  Sesión: <span className="font-medium text-gray-900">{email}</span>
                </>
              ) : (
                "Ingresa desde la landing para ver tus referidos."
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openRegisterModal}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold bg-brand text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
            >
              Registrar nuevo referido
            </button>
          </div>
        </div>

        {!isAuthed && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5" size={18} />
              <div>
                <p className="font-semibold">No has iniciado sesión</p>
                <p className="mt-1 text-amber-800">
                  Para ver el estado de tus referidos necesitas ingresar con tu
                  correo (magic link) desde la landing.
                </p>
              </div>
            </div>
          </div>
        )}

        {isAuthed && (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs text-gray-500">Total referidos</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs text-gray-500">Último registro</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {rows[0] ? statusUi[rows[0].status].label : "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {rows[0] ? formatDate(rows[0].created_at) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs text-gray-500">Nota</p>
              <p className="mt-1 text-sm text-gray-700">
                Los estados se actualizarán cuando el flujo comercial avance.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {isAuthed && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-100">
            <div className="border-b border-gray-100 bg-white px-5 py-4">
              <p className="text-sm font-semibold text-gray-900">Historial</p>
              <p className="mt-1 text-xs text-gray-500">
                Se muestran los últimos registros primero.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white px-5 py-10 text-sm text-gray-600">
                Aún no tienes referidos registrados. Usa el botón
                <span className="font-semibold text-gray-900"> "Registrar nuevo referido"</span>
                para crear el primero.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => {
                  const ui = statusUi[r.status];
                  return (
                    <li key={r.id} className="px-5 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
                            <User size={16} className="text-gray-400" />
                            {r.referred_name}
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2">
                            <p className="inline-flex items-center gap-2">
                              <Mail size={14} className="text-gray-400" />
                              {r.referred_email}
                            </p>
                            <p className="inline-flex items-center gap-2">
                              <Phone size={14} className="text-gray-400" />
                              {r.referred_phone}
                            </p>
                            <p className="sm:col-span-2 text-gray-500">
                              Registrado: {formatDate(r.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <span
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs ${ui.cls}`}
                          >
                            {ui.icon}
                            {ui.label}
                          </span>
                          {!r.consent && (
                            <span className="text-xs text-red-600">
                              Sin consentimiento
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <p className="mt-10 text-xs text-gray-500">
          *Aplican términos y condiciones del programa.
        </p>
      {/* Modal para registrar referido */}
      {isAuthed && openRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeRegisterModal} />

          <div className="relative w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Registrar referido</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Estás logueado, así que no necesitamos tu correo. Solo completa los datos del referido.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitRegister} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900">Nombre del referido</label>
                <input
                  value={referredName}
                  onChange={(e) => {
                    setReferredName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  onBlur={validateRegisterFields}
                  aria-invalid={!!fieldErrors.name}
                  type="text"
                  placeholder="Nombre y apellido"
                  className={`mt-1 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 ${
                    fieldErrors.name ? "border-red-300" : "border-gray-200"
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900">Correo del referido</label>
                <input
                  value={referredEmail}
                  onChange={(e) => {
                    setReferredEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                  }}
                  onBlur={() => {
                    // normalize on blur
                    setReferredEmail((prev) => normalizeEmail(prev));
                    validateRegisterFields();
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={!!fieldErrors.email}
                  type="email"
                  placeholder="referido@correo.com"
                  className={`mt-1 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 ${
                    fieldErrors.email ? "border-red-300" : "border-gray-200"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900">Teléfono del referido</label>
                <input
                  value={referredPhone}
                  onChange={(e) => {
                    // digits only, max 9
                    const digits = normalizePhone(e.target.value);
                    setReferredPhone(digits);
                    if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
                  }}
                  onBlur={validateRegisterFields}
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  aria-invalid={!!fieldErrors.phone}
                  type="tel"
                  placeholder="Ej: 999999999"
                  className={`mt-1 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 ${
                    fieldErrors.phone ? "border-red-300" : "border-gray-200"
                  }`}
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (fieldErrors.consent) setFieldErrors((p) => ({ ...p, consent: undefined }));
                  }}
                  className="mt-1"
                />
                <span>
                  Confirmo que cuento con la autorización del referido para compartir sus datos y que Verisure pueda contactarlo.
                </span>
              </label>
              {fieldErrors.consent && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.consent}</p>
              )}

              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {submitError}
                </div>
              )}

              {submitState === "success" && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700">
                  Referido registrado ✅
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" onClick={closeRegisterModal} disabled={submitState === "loading"}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitState === "loading" ||
                    !referredName.trim() ||
                    !referredEmail.trim() ||
                    !referredPhone.trim() ||
                    !consent
                  }
                >
                  {submitState === "loading" ? "Registrando…" : "Registrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </section>
    </main>
  );
}