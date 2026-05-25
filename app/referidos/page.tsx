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
  referred_phone: string;
  referred_email?: string | null;
  consent: boolean;
  status: "registered" | "contacted" | "quoted" | "contracted" | "invalid";
  notes: string | null;
};

type ReferrerProfile = {
  id: string;
  full_name: string | null;
  dni: string | null;
  has_verisure: boolean | null;
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

const REGISTER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes



function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getFirstName(fullName: string | null | undefined) {
  const n = (fullName ?? "").trim();
  if (!n) return "";
  // take first token as the friendly name
  return n.split(/\s+/)[0];
}

export default function ReferralsPortalPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ReferrerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [registerStep, setRegisterStep] = useState<"profile" | "referral">("profile");
  const [profileName, setProfileName] = useState("");
  const [profileDni, setProfileDni] = useState("");
  const [profileHasVerisure, setProfileHasVerisure] = useState<boolean | null>(null);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; dni?: string; hasVerisure?: string }>({});

  const [openRegister, setOpenRegister] = useState(false);
  const [referredName, setReferredName] = useState("");
  const [referredEmail, setReferredEmail] = useState("");
  const [referredPhone, setReferredPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; phone?: string; consent?: string }>({});

  const total = useMemo(() => rows.length, [rows.length]);

  const firstName = useMemo(() => getFirstName(profile?.full_name), [profile?.full_name]);
  const greetName = firstName || (email ? email.split("@")[0] : "");

  // Cooldown logic
  const lastCreatedAt = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : null;
  const [nowTs, setNowTs] = useState(() => Date.now());

  const cooldownRemainingMs = useMemo(() => {
    if (!lastCreatedAt) return 0;
    const elapsed = nowTs - lastCreatedAt;
    const remaining = REGISTER_COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  }, [lastCreatedAt, nowTs]);

  const isInCooldown = cooldownRemainingMs > 0;

  function formatCooldown(ms: number) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

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

    // Cargar perfil del usuario (para pedir datos 1 sola vez)
    try {
      setProfileLoading(true);
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, dni, has_verisure")
        .eq("id", user.id)
        .maybeSingle();

      if (!profErr) {
        const p = (prof ?? { id: user.id, full_name: null, dni: null, has_verisure: null }) as ReferrerProfile;
        setProfile(p);

        // Prellenar estados (por si el usuario reabre el modal)
        setProfileName(p.full_name ?? "");
        setProfileDni(p.dni ?? "");
        setProfileHasVerisure(typeof p.has_verisure === "boolean" ? p.has_verisure : null);
      }
    } finally {
      setProfileLoading(false);
    }

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

    // Si cambia la sesión (login/logout), recargamos
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    // Timer for cooldown
    const t = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(t);
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
    setRegisterStep("profile");
    setProfileErrors({});
    // no reseteamos profileName/profileHasVerisure aquí si ya existen en DB; se prellenan desde `profile`.
  }

  function openRegisterModal() {
    if (isInCooldown) return;
    resetRegisterForm();
    const needsProfile = !profile?.full_name || !profile?.dni || typeof profile?.has_verisure !== "boolean";
    setRegisterStep(needsProfile ? "profile" : "referral");
    // prellenar por si ya existe parcialmente
    setProfileName(profile?.full_name ?? "");
    setProfileDni(profile?.dni ?? "");
    setProfileHasVerisure(typeof profile?.has_verisure === "boolean" ? profile.has_verisure : null);
    setProfileErrors({});
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

function normalizeDni(val: string) {
  // Keep digits only (PE DNI: 8 digits)
  return val.replace(/\D/g, "").slice(0, 8);
}


  function validateRegisterFields() {
    const errors: { name?: string; email?: string; phone?: string; consent?: string } = {};

    if (!referredName.trim()) errors.name = "El nombre es obligatorio.";

    // Correo opcional: solo validamos si el usuario escribió algo
    const emailRaw = referredEmail.trim();
    const emailNorm = emailRaw ? normalizeEmail(emailRaw) : "";

    if (emailRaw && !isEmail(emailNorm)) {
      errors.email = "Ingresa un correo válido.";
    }

    // Duplicados por correo (client-side) - solo si se ingresó correo
    if (emailNorm && rows.some((r) => normalizeEmail(r.referred_email ?? "") === emailNorm)) {
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

  function validateProfileFields() {
    const errors: { name?: string; dni?: string; hasVerisure?: string } = {};
  
    if (!profileName.trim()) errors.name = "Tu nombre es obligatorio.";
  
    const dniNorm = normalizeDni(profileDni);
    if (!dniNorm) errors.dni = "Tu DNI es obligatorio.";
    else if (!/^\d{8}$/.test(dniNorm)) errors.dni = "Ingresa un DNI válido (8 dígitos).";
  
    if (profileHasVerisure === null) errors.hasVerisure = "Selecciona una opción.";
  
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveProfileAndContinue() {
    setSubmitError("");
    const ok = validateProfileFields();
    if (!ok) {
      setSubmitState("error");
      return;
    }

    setSubmitState("loading");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("Tu sesión expiró. Vuelve a ingresar.");

      const payload = {
        id: user.id,
        full_name: profileName.trim(),
        dni: normalizeDni(profileDni),
        has_verisure: profileHasVerisure,
        updated_at: new Date().toISOString(),
      };

      const { data: up, error: upErr } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, full_name, dni, has_verisure")
        .single();

      if (upErr) throw new Error(upErr.message);

      setProfile(up as ReferrerProfile);
      setRegisterStep("referral");
      setSubmitState("idle");
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err instanceof Error ? err.message : "Error guardando tus datos.");
    }
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
          referredEmail: referredEmail.trim() ? normalizeEmail(referredEmail) : null,
          referredPhone: normalizePhone(referredPhone),
          consent,
          accessToken,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (res.status === 429) {
          throw new Error(json.message || "Por seguridad, espera unos minutos e intenta nuevamente.");
        }
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
      <main className="min-h-screen bg-[url('/home/bg-banner-home.webp')] bg-cover bg-center  bg-no-repeat">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-sm text-white">Cargando tu portal…</p>
        </div>
      </main>
    );
  }

  const isAuthed = !!email;

  return (
    <main className="min-h-screen bg-[url('/home/bg-banner-home.webp')] bg-cover bg-center  bg-no-repeat">
      <header className="absolute inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <Link
            href="/"
            className="text-sm font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] hover:opacity-90"
          >
            Programa de Referidos
          </Link>

          <div className="flex items-center gap-5 rounded-2xl  p-1 ">
            <Button
              variant="secondary"
              onClick={load}
              disabled={refreshing}
              className="border-white/20 bg-white text-white "
            >
              <span className="inline-flex items-center gap-2 text-black">
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Actualizar
              </span>
            </Button>
            {isAuthed && (
              <Button
                variant="secondary"
                onClick={logout}
                className="border-white/20 0 text-white "
              >
                <span className="inline-flex items-center gap-2 text-black">
                  <LogOut size={16} />
                  Salir
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-28 md:pt-32">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold leading-none text-white sm:text-5xl md:text-6xl">
              {isAuthed && greetName ? `Hola, ${greetName}` : "Mis referidos"}
            </h1>
            <p className="mt-2 text-lg leading-relaxed text-white sm:text-2xl md:mt-1 md:text-[2rem]">
              {isAuthed ? (
                <>
                  Sesión: <span className="font-medium text-white">{email}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-white sm:text-base md:mt-1 md:text-[1rem]">
                    Revisa tus referidos y el estado en el que van avanzando.
                  </span>
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
              disabled={isInCooldown}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-xl font-semibold shadow-sm transition-all sm:px-5 ${
                isInCooldown
                  ? "bg-[#00A47C] text-white cursor-not-allowed"
                  : "bg-[#00A47C] text-white hover:opacity-95 active:scale-[0.99]"
              }`}
            >
              {isInCooldown ? `Espera ${formatCooldown(cooldownRemainingMs)}` : "Registrar nuevo referido"}
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
                  correo (código OTP) desde la landing.
                </p>
              </div>
            </div>
          </div>
        )}

        {isAuthed && (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-base text-gray-500 sm:text-lg md:text-xl">Total referidos</p>
                <p className="mt-2 text-3xl font-bold leading-none text-gray-900 sm:text-4xl md:text-5xl">{total}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-base text-gray-500 sm:text-lg md:text-xl">Último registro</p>
                <p className="mt-2 text-lg font-semibold leading-tight text-gray-900 sm:text-xl md:text-2xl">
                  {rows[0] ? statusUi[rows[0].status].label : "—"}
                </p>
                <p className="mt-2 text-base text-gray-500 sm:text-lg md:text-xl">
                  {rows[0] ? formatDate(rows[0].created_at) : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-base text-gray-500 sm:text-lg md:text-xl">Nota</p>
                <p className="mt-2 text-base leading-relaxed text-gray-700 sm:text-lg md:text-xl">
                  Los estados se actualizarán cuando el flujo comercial avance.
                </p>
              </div>
            </div>
            <div className="relative mt-8 overflow-hidden rounded-[34px] px-4 pt-8 pb-6 text-white md:px-8 md:pt-10 md:pb-8 lg:px-12 lg:pt-12 lg:pb-10">
              <img
                src="/referidos/persona1.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute left-[-10px] top-[122px] z-20 hidden w-[135px] max-w-none md:block md:w-[190px] lg:left-[-6px] lg:top-[150px] lg:w-[245px] xl:left-0 xl:top-[158px] xl:w-[285px]"
              />
              <img
                src="/referidos/persona2.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute right-[-10px] top-[130px] z-20 hidden w-[135px] max-w-none md:block md:w-[190px] lg:right-[-6px] lg:top-[130px] lg:w-[245px] xl:right-0 xl:top-[230px] xl:w-[285px]"
              />
              <div className="relative z-10 text-center md:px-10 lg:px-16">
                <h2 className="text-[28px] font-extrabold leading-none text-transparent [text-shadow:none] [-webkit-text-stroke:1.5px_white] sm:text-[34px] md:text-[72px] md:[-webkit-text-stroke:3px_white]">
                  Mis premios
                </h2>
                <p className="mx-auto mt-4 max-w-5xl text-sm leading-relaxed text-white/95 sm:text-base md:mt-6 md:text-[2rem] md:leading-snug">
                  {firstName ? (
                    <>
                      {firstName}, aquí verás tus premios disponibles cuando tus referidos avancen en el programa.
                    </>
                  ) : (
                    <>Aquí verás tus premios disponibles cuando tus referidos avancen en el programa.</>
                  )}
                </p>
              </div>

              <div className="relative z-10 mt-12 rounded-[34px] border-[3px] border-white bg-transparent px-6 py-8 shadow-[0_0_24px_rgba(255,255,255,0.45)] md:mt-14 md:px-10 md:py-10 md:mx-16 lg:mt-16 lg:mx-24 xl:mx-28">
                <div className="text-center">
                  <p className="text-xl font-extrabold sm:text-2xl md:text-4xl">Canjeables</p>
                  <p className="mt-2 text-5xl font-black leading-none sm:text-6xl md:text-7xl">0</p>
                  <p className="mt-3 text-xl font-extrabold leading-tight sm:text-2xl md:text-4xl">
                    Aún no tienes premios habilitados
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-10 rounded-[34px] border-white/90 bg-transparent px-5 py-8 md:px-8 md:py-10 md:mx-10 lg:mx-16 xl:mx-20">
                <h3 className="text-center text-xl font-extrabold sm:text-2xl md:text-4xl">
                  ¿Cómo se habilitan?
                </h3>
                <ul className="mx-auto mt-5 max-w-5xl space-y-2 text-center text-sm leading-relaxed text-white/95 sm:text-base md:mt-6 md:text-2xl md:leading-snug">
                  <li>
                    • Tus referidos avanzan por estados: Registrado → Contactado → Cotización → Contratado.
                  </li>
                  <li>
                    • Cuando un referido llegue a Contratado, se habilita tu premio según la campaña vigente.
                  </li>
                  <li>
                    • El canje se activará en esta misma sección cuando el proceso esté habilitado.
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {isAuthed && (
          <div className="mt-10 overflow-hidden rounded-[34px] border border-white/70 bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            <div className="border-b border-gray-200 bg-white px-6 py-6 md:px-8 md:py-7">
              <p className="text-xl font-bold text-gray-900 sm:text-2xl md:text-4xl">Historial</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 sm:text-base md:text-xl">
                Se muestran los últimos registros primero.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white px-6 py-12 text-lg text-gray-600 md:px-8 md:text-2xl">
                Aún no tienes referidos registrados. Usa el botón
                <span className="font-bold text-gray-900"> "Registrar nuevo referido"</span>
                para crear el primero.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 bg-white">
                {rows.map((r) => {
                  const ui = statusUi[r.status];
                  return (
                    <li key={r.id} className="px-6 py-6 md:px-8 md:py-7">
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="inline-flex items-center gap-3 text-xl font-bold text-gray-900 sm:text-2xl md:text-3xl">
                            <User size={22} className="text-gray-400" />
                            {r.referred_name}
                          </p>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:mt-4 sm:text-base md:text-xl sm:grid-cols-2">
                            <p className="inline-flex items-center gap-2">
                              <Phone size={20} className="text-gray-400" />
                              {r.referred_phone}
                            </p>
                            {r.referred_email && (
                              <p className="inline-flex items-center gap-2">
                                <Mail size={20} className="text-gray-400" />
                                {r.referred_email}
                              </p>
                            )}
                            <p className="sm:col-span-2 inline-flex items-center gap-3 text-gray-500">
                              <Clock size={20} className="text-gray-400" />
                              <span>{formatDate(r.created_at)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold sm:px-5 sm:text-base md:px-6 md:py-3 md:text-xl ${ui.cls}`}
                          >
                            {ui.icon}
                            {ui.label}
                          </span>
                          {!r.consent && (
                            <span className="text-sm font-medium text-red-600 md:text-base">
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

        <p className="mt-10 text-xs leading-relaxed text-white sm:text-sm">
          *Aplican términos y condiciones del programa.
        </p>
      {/* Modal para registrar referido */}
      {isAuthed && openRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeRegisterModal} />

          <div className="relative w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isAuthed && greetName ? `Registrar referido — ${greetName}` : "Registrar referido"}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {isAuthed && firstName ? (
                    <span className="font-medium text-gray-800">Hola {firstName}. </span>
                  ) : null}
                  {registerStep === "profile"
                    ? "Primero completa tus datos (solo una vez). Luego podrás registrar referidos."
                    : "Completa los datos del referido para registrarlo en el programa."}
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
            {isInCooldown && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Por seguridad, espera antes de registrar otro referido.</p>
                <p className="mt-1 text-amber-800">
                  Podrás registrar un nuevo referido en <span className="font-semibold">{formatCooldown(cooldownRemainingMs)}</span>.
                </p>
              </div>
            )}

            {registerStep === "profile" ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Tu nombre</label>
                  <input
                    value={profileName}
                    onChange={(e) => {
                      setProfileName(e.target.value);
                      if (profileErrors.name) setProfileErrors((p) => ({ ...p, name: undefined }));
                    }}
                    onBlur={validateProfileFields}
                    aria-invalid={!!profileErrors.name}
                    type="text"
                    placeholder="Nombre y apellido"
                    className={`mt-1 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 ${
                      profileErrors.name ? "border-red-300" : "border-gray-200"
                    }`}
                  />
                  {profileErrors.name && <p className="mt-1 text-xs text-red-600">{profileErrors.name}</p>}
                </div>
                <div>
  <label className="block text-sm font-semibold text-gray-900">Tu DNI</label>
  <input
    value={profileDni}
    onChange={(e) => {
      const digits = normalizeDni(e.target.value);
      setProfileDni(digits);
      if (profileErrors.dni) setProfileErrors((p) => ({ ...p, dni: undefined }));
    }}
    onBlur={validateProfileFields}
    inputMode="numeric"
    pattern="\d{8}"
    maxLength={8}
    aria-invalid={!!profileErrors.dni}
    type="text"
    placeholder="Ej: 12345678"
    className={`mt-1 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 ${
      profileErrors.dni ? "border-red-300" : "border-gray-200"
    }`}
  />
  {profileErrors.dni && <p className="mt-1 text-xs text-red-600">{profileErrors.dni}</p>}
</div>

                <div>
                  <p className="block text-sm font-semibold text-gray-900">¿Tienes Verisure?</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                      profileHasVerisure === true ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}>
                      <input
                        type="radio"
                        name="has_verisure"
                        checked={profileHasVerisure === true}
                        onChange={() => {
                          setProfileHasVerisure(true);
                          if (profileErrors.hasVerisure) setProfileErrors((p) => ({ ...p, hasVerisure: undefined }));
                        }}
                      />
                      Sí
                    </label>
                    <label className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                      profileHasVerisure === false ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}>
                      <input
                        type="radio"
                        name="has_verisure"
                        checked={profileHasVerisure === false}
                        onChange={() => {
                          setProfileHasVerisure(false);
                          if (profileErrors.hasVerisure) setProfileErrors((p) => ({ ...p, hasVerisure: undefined }));
                        }}
                      />
                      No
                    </label>
                  </div>
                  {profileErrors.hasVerisure && (
                    <p className="mt-1 text-xs text-red-600">{profileErrors.hasVerisure}</p>
                  )}
                </div>

                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button type="button" variant="secondary" onClick={closeRegisterModal} disabled={submitState === "loading"}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveProfileAndContinue} disabled={submitState === "loading"}>
                    {submitState === "loading" ? "Guardando…" : "Continuar"}
                  </Button>
                </div>
              </div>
            ) : (
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
                  {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900">Teléfono del referido</label>
                  <input
                    value={referredPhone}
                    onChange={(e) => {
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
                  {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900">Correo del referido (opcional)</label>
                  <input
                    value={referredEmail}
                    onChange={(e) => {
                      setReferredEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    onBlur={() => {
                      setReferredEmail((prev) => {
                        const raw = prev.trim();
                        return raw ? normalizeEmail(raw) : "";
                      });
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
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
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
                {fieldErrors.consent && <p className="mt-1 text-xs text-red-600">{fieldErrors.consent}</p>}

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
                      isInCooldown ||
                      submitState === "loading" ||
                      !referredName.trim() ||
                      !referredPhone.trim() ||
                      !consent
                    }
                  >
                    {submitState === "loading" ? "Registrando…" : "Registrar"}
                  </Button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => {
                      // permitir volver a editar perfil
                      setRegisterStep("profile");
                      setSubmitState("idle");
                      setSubmitError("");
                    }}
                  >
                    ← Editar mis datos
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </section>
    </main>
  );
}