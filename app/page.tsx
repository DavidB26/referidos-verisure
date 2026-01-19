"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import AccessByEmailModal from "@/components/AccessByEmailModal";
import { pushDataLayer } from "@/lib/gtm";
import { Check, HelpCircle, Mail, User, Shield, ClipboardList } from "lucide-react";

const faqs = [
  {
    q: "¿Necesito ingresar para registrar un referido?",
    a: "Sí. Por seguridad, el registro de referidos se realiza únicamente dentro del portal y requiere validar tu acceso con un código enviado a tu correo.",
  },
  {
    q: "¿Qué recibe mi referido?",
    a: "Tu referido recibirá un mensaje informativo indicando que fue referido y que el equipo de Verisure se pondrá en contacto (según campaña vigente).",
  },
  {
    q: "¿Se envía correo al referido?",
    a: "No. En el nuevo flujo la notificación al referido se realiza vía mensaje (por definir: SMS/WhatsApp) para acelerar el contacto y reducir fricción.",
  },
  {
    q: "¿Qué datos necesito para registrar un referido?",
    a: "Los datos pueden variar por campaña, pero normalmente solicitamos nombre, DNI y teléfono. El correo del referido puede ser opcional.",
  },
  {
    q: "¿Qué pasa si el referido ya había cotizado antes?",
    a: "Podría no ser válido. Revisa los términos y condiciones del programa.",
  },
  {
    q: "¿Cuándo se acredita el beneficio/puntos?",
    a: "Si existe beneficio o puntos, se acreditan una vez confirmado el contrato del referido (según reglas del programa).",
  },
];

const TRACKING_KEY = "ref_tracking_v1";

export default function Page() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Login modal (opcional)
  const [openLogin, setOpenLogin] = useState(false);
  const [loginSource, setLoginSource] = useState<"header" | "form" | "sticky">("header");


  useEffect(() => {
    pushDataLayer("referrals_view", { page: "landing_register" });
    saveTrackingFromUrl();
  }, []);

  function openLoginModal(source: "header" | "form" | "sticky") {
    setLoginSource(source);
    setOpenLogin(true);
    pushDataLayer("referrals_login_open", { source });
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
    } catch {
      // ignore
    }
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
    } catch {
      stored = null;
    }
  
    // prioridad: URL actual > storage
    return {
      camp: fromUrl.camp ?? stored?.camp ?? null,
      utm_source: fromUrl.utm_source ?? stored?.utm_source ?? null,
      utm_medium: fromUrl.utm_medium ?? stored?.utm_medium ?? null,
      utm_campaign: fromUrl.utm_campaign ?? stored?.utm_campaign ?? null,
      utm_term: fromUrl.utm_term ?? stored?.utm_term ?? null,
      utm_content: fromUrl.utm_content ?? stored?.utm_content ?? null,
      landing_path: window.location.pathname,
      referer: document.referrer,
      // primer touch opcional
      first_landing_path: stored?.first_landing_path ?? null,
      first_referer: stored?.first_referer ?? null,
    };
  }


  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-web.svg"
              alt="Verisure"
              width={120}
              height={78}
              priority
              className="h-7 w-auto"
            />
          </div>

          <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
            <a href="#como-funciona" className="hover:text-gray-900">Cómo funciona</a>
            <a href="#beneficios" className="hover:text-gray-900">Beneficios</a>
            <a href="#preguntas" className="hover:text-gray-900">Preguntas</a>
          </nav>

          <Button variant="secondary" onClick={() => openLoginModal("header")}>Ingresar</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          {/* Copy */}
          <div className="animate-fade-up">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
              Registra a tu referido <br /> y nosotros lo contactamos
            </h1>
            <p className="mt-4 text-base text-gray-600 md:text-lg">
              Completa los datos del referido y recibirá un correo informativo indicando que fue referido.
              El equipo de Verisure se pondrá en contacto para continuar la atención.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-gray-700 animate-fade-up-delay-1">
              {[
                "Registro en menos de 1 minuto",
                "Correo informativo para tu referido",
                "Si ingresas, podrás ver el estado en tu portal",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-brand">
                    <Check size={14} />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-fade-up-delay-2">
              <Button onClick={() => openLoginModal("form")}>Ingresar y registrar</Button>
              <Button variant="secondary" onClick={() => openLoginModal("header")}>
                Ya tengo cuenta
              </Button>
            </div>
          </div>

          {/* Preview card */}
          <div className="relative animate-fade-up-delay-1">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    ¿Cómo ganas con tus referidos?
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    En 4 pasos. Rápido, simple y transparente.
                  </p>
                </div>
                <span className="rounded-xl bg-gray-50 p-2 text-gray-700">
                  <ClipboardList size={18} />
                </span>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl bg-gray-50 p-4">
                {[
                  "1) Registras a tu referido",
                  "2) Le llega un correo informativo",
                  "3) Verisure lo contacta",
                  "4) Si contrata, tú ganas"
                ].map((s) => (
                  <div key={s} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm border border-gray-100">
                    <span className="text-gray-700">{s}</span>
                    <span className="text-xs text-gray-500">—</span>
                  </div>
                ))}

                <div className="rounded-xl bg-white p-3 text-xs text-gray-600 border border-gray-100">
                  El beneficio aplica según <strong>campaña vigente</strong>. Podrás revisar el estado si ingresas.
                </div>

                <Button className="w-full" variant="secondary" onClick={() => openLoginModal("header")}>
                  Ingresar y ver mi estado
                </Button>
              </div>
            </div>

            {/* decor */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-red-50 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-gray-100 blur-2xl" />
          </div>
        </div>
      </section>

      {/* Acceso (sin formulario en home) */}
      <section id="acceso" className="scroll-mt-28 md:scroll-mt-24 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Accede para registrar referidos</h2>
              <p className="mt-2 text-sm text-gray-600">
                Por seguridad, el registro de referidos se realiza solo dentro de tu portal. Ingresa con tu correo y listo.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-600">¿Listo para empezar?</p>
              <Button className="mt-2 w-full" variant="secondary" onClick={() => openLoginModal("form")}>
                Ingresar con correo
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[{
              title: "1) Ingresa con código",
              desc: "Te enviamos un código OTP a tu correo para validar tu acceso.",
              icon: <Mail />,
            }, {
              title: "2) Completa tus datos una sola vez",
              desc: "Nombre, DNI y si tienes Verisure (se guarda para tus próximos ingresos).",
              icon: <User />,
            }, {
              title: "3) Registra y haz seguimiento",
              desc: "Desde tu portal podrás registrar referidos y ver su estado en el proceso.",
              icon: <ClipboardList />,
            }].map((c) => (
              <div key={c.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="inline-flex rounded-xl bg-gray-50 p-3 text-gray-700">{c.icon}</div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">{c.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{c.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-gray-100 bg-gray-50 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">¿Quieres registrar un referido ahora?</p>
                <p className="mt-1 text-sm text-gray-600">Ingresa y te llevamos directo a tu portal.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => openLoginModal("form")}>Ingresar</Button>
                <Button variant="secondary" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>
                  Ver cómo funciona
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">*Aplican términos y condiciones del programa.</p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-28 md:scroll-mt-24 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-gray-900">¿Cómo funciona?</h2>
          <p className="mt-2 text-sm text-gray-600">En 3 pasos. Sin complicaciones.</p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "Registra a tu referido",
                desc: "Completa los datos básicos del referido.",
                icon: <User />,
              },
              {
                title: "Enviamos un mensaje informativo",
                desc: "Tu referido recibe un aviso indicando que fue referido.",
                icon: <Mail />,
              },
              {
                title: "Verisure lo contacta",
                desc: "Un asesor se comunicará para continuar la atención.",
                icon: <Shield />,
              },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="inline-flex rounded-xl bg-gray-50 p-3 text-gray-700">{s.icon}</div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="scroll-mt-28 md:scroll-mt-24 border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="text-xl font-bold text-gray-900">Beneficios</h2>
              <p className="mt-2 text-sm text-gray-600">Un programa pensado para referir de forma simple y transparente.</p>

              <div className="mt-6 grid grid-cols-1 gap-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Para ti</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Podrás llevar control de tus referidos al ingresar. Si hay puntos o beneficios, se aplican según campaña vigente.
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Para tu referido</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Recibe un mensaje informativo y es contactado por el equipo de Verisure para continuar la atención.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="text-xl font-bold text-gray-900">Privacidad y seguridad</h2>
              <p className="mt-2 text-sm text-gray-600">
                Protegemos los datos y usamos el correo solo para el proceso de referidos.
              </p>

              <div className="mt-6 space-y-3">
                {["Datos mínimos necesarios", "Registro con autorización del referido", "Acceso seguro por correo"].map((t) => (
                  <div key={t} className="flex items-start gap-2 rounded-2xl bg-gray-50 p-4">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-brand">
                      <Check size={14} />
                    </span>
                    <p className="text-sm text-gray-700">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="scroll-mt-28 md:scroll-mt-24 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-gray-900">Preguntas frecuentes</h2>
          <p className="mt-2 text-sm text-gray-600">Resolvemos lo típico antes de que preguntes 😄</p>

          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-gray-100 bg-white p-5"
                onToggle={(e) => {
                  const el = e.currentTarget;
                  if (el.open) pushDataLayer("referrals_faq_open", { question: f.q });
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-gray-900">{f.q}</span>
                  <span className="rounded-xl bg-gray-50 p-2 text-gray-700">
                    <HelpCircle size={18} />
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>

          <p className="mt-8 text-xs text-gray-500">*Aplican términos y condiciones del programa.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <p>© {year} Verisure Perú</p>
          <div className="flex gap-4">
            <a className="hover:text-gray-900" href="#">Privacidad</a>
            <a className="hover:text-gray-900" href="#">Términos</a>
          </div>
        </div>
      </footer>

      {/* Sticky CTA (mobile) */}
      <div className="fixed bottom-4 left-0 right-0 z-40 mx-auto w-full max-w-6xl px-4 md:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => document.getElementById("acceso")?.scrollIntoView({ behavior: "smooth" })}>
              Acceder
            </Button>
            <Button variant="secondary" onClick={() => openLoginModal("sticky")}>Ingresar</Button>
          </div>
        </div>
      </div>

      <AccessByEmailModal open={openLogin} onClose={() => setOpenLogin(false)} source={loginSource} />
    </main>
  );
}