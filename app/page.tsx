"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import AccessByEmailModal from "@/components/AccessByEmailModal";


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



export default function Page() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Login modal (opcional)
  const [openLogin, setOpenLogin] = useState(false);
  const [loginSource, setLoginSource] = useState<"header" | "form" | "sticky">(
    "header"
  );
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqContentRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    faqContentRefs.current.forEach((el, index) => {
      if (!el) return;

      if (openFaq === index) {
        el.style.maxHeight = `${el.scrollHeight}px`;
        el.style.opacity = "1";
        el.style.transform = "translateY(0px)";
      } else {
        el.style.maxHeight = "0px";
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
      }
    });
  }, [openFaq]);


  function openLoginModal(source: "header" | "form" | "sticky") {
    setLoginSource(source);
    setOpenLogin(true);
  }

  useEffect(() => {
    const onScroll = () => {
      setIsHeaderScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



  return (
    <main className="min-h-screen  bg-[url('/home/bg-banner-home.webp')] bg-cover bg-center  bg-no-repeat">
      {/* Header */}
      <header
        className={[
          "sticky top-0 z-40 w-full transition-all duration-300",
          isHeaderScrolled
            ? "bg-white/95 shadow-[0_10px_30px_rgba(16,24,40,0.12)] backdrop-blur"
            : "bg-transparent",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 md:gap-6 md:px-6 md:py-6">
          <div className="shrink-0">
            <Image
              src={isHeaderScrolled ? "/logo-web.svg" : "/home/logo-white.webp"}
              alt="Verisure"
              width={160}
              height={60}
              priority
              className="h-9 w-auto md:h-12"
            />
          </div>

          <div
            className={[
              "hidden h-[82px] flex-1 items-stretch overflow-hidden rounded-full lg:flex transition-all duration-300",
              isHeaderScrolled
                ? "bg-transparent shadow-none"
                : "bg-[#F3F3F3] shadow-[0_4px_18px_rgba(22,22,22,0.12)]",
            ].join(" ")}
          >
            <nav className="flex h-full items-stretch">
              <a
                href="#como-funciona"
                className="flex h-full min-w-[220px] items-center justify-center px-8 text-[18px] font-extrabold text-[#4A3F42] transition hover:bg-[#ED002F] hover:text-white xl:min-w-[260px] xl:px-10 xl:text-[20px]"
              >
                ¿Cómo funciona?
              </a>

              <a
                href="#beneficios"
                className="flex h-full min-w-[180px] items-center justify-center px-8 text-[18px] font-extrabold text-[#4A3F42] transition hover:bg-[#ED002F] hover:text-white xl:min-w-[210px] xl:px-10 xl:text-[20px]"
              >
                Beneficios
              </a>

              <a
                href="#preguntas"
                className="flex h-full min-w-[180px] items-center justify-center px-8 text-[18px] font-extrabold text-[#4A3F42] transition hover:bg-[#ED002F] hover:text-white xl:min-w-[210px] xl:px-10 xl:text-[20px]"
              >
                Preguntas
              </a>
            </nav>

            <div className="ml-auto flex h-full items-center pr-4 xl:pr-5">
              <button
                type="button"
                onClick={() => openLoginModal("header")}
                className="inline-flex h-[56px] min-w-[220px] items-center justify-center gap-3 rounded-full bg-[#00A47C] px-6 text-[17px] font-extrabold text-white transition hover:brightness-95 xl:h-[66px] xl:min-w-[275px] xl:gap-4 xl:px-8 xl:text-[18px]"
              >
                <Image
                  src="/home/icon-user.webp"
                  alt=""
                  width={34}
                  height={34}
                  className="h-7 w-7 xl:h-[34px] xl:w-[34px]"
                />
                <span>Ingresar</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openLoginModal("header")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#00A47C] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition hover:brightness-95 lg:hidden"
          >
            <Image
              src="/home/icon-user.webp"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span>Ingresar</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="mx-auto grid max-w-[1720px] grid-cols-1 gap-8 px-4 py-10 md:grid-cols-[0.65fr_0.35fr] md:items-center md:gap-6 md:px-8 md:py-12">
          {/* Copy */}
          <div className="animate-fade-up flex items-center justify-center">
            <Image
              src="/home/img-referido.webp"
              width={1500}
              height={1062}
              className="mx-auto h-auto w-full object-contain object-center"
              alt="Registra a tu referido"
              priority
            />
          </div>

          {/* Preview card */}
          <div className="relative animate-fade-up-delay-1 flex justify-center md:justify-end">
            <div className="relative flex w-full max-w-[540px] flex-col rounded-[34px] border-[4px] border-white bg-[#C7001F] px-8 pb-16 pt-10 shadow-[0_0_24px_rgba(255,255,255,0.55),0_16px_40px_rgba(120,0,22,0.42)] md:px-9 md:pb-20 md:pt-11">
              <h1 className="text-center text-[24px] font-extrabold leading-[1.1] text-white md:text-[30px]">
                ¿Cómo ganas con tus referidos?
              </h1>

              <div className="mt-8 space-y-5">
                {[
                  "1) Registras a tu referido",
                  "2) Le llega un correo informativo",
                  "3) Verisure lo contacta",
                  "4) Si contrata, tú ganas",
                ].map((s) => (
                  <div
                    key={s}
                    className="flex min-h-[52px] items-center rounded-full bg-[#BC7480] px-5 text-[16px] font-extrabold leading-[1.2] text-white md:min-h-[60px] md:px-7 md:text-[20px]"
                  >
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              <p className="mt-7 px-4 text-[14px] leading-[1.35] text-white md:px-6 md:text-[17px]">
                El beneficio aplica según{" "}
                <strong className="font-extrabold">campaña vigente</strong>.
                Podrás revisar el estado si ingresas.
              </p>

              <div className="absolute bottom-0 left-1/2 flex w-full -translate-x-1/2 translate-y-1/2 justify-center px-6">
                <Button
                  className="min-h-[60px] w-full max-w-[280px] rounded-4 bg-[#00A47C] px-6 text-[17px] font-extrabold text-white md:min-h-[70px] md:max-w-[300px] md:px-8 md:text-[20px]"
                  onClick={() => openLoginModal("header")}
                >
                  Ingresar y ver mi estado
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="acceso"
        className="scroll-mt-28 md:scroll-mt-24  bg-transparent"
      >
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-center">
            <div>
              <h2 className="text-center text-3xl font-bold text-white md:text-4xl">
                Accede para registrar referidos
              </h2>
              <p className="mt-3 text-center text-base leading-[1.35] text-white md:text-xl">
                Por seguridad, el registro de referidos se realiza solo dentro
                de tu portal. Ingresa con tu correo y listo.
              </p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {[
              {
                title: "Ingresa con código",
                desc: "Te enviamos un código OTP a tu correo para validar tu acceso.",
                image: "/home/icon-1.webp",
                imageAlt: "Paso 1 ingresa con código",
                step: "1.",
              },
              {
                title: "Completa tus datos una sola vez",
                desc: "Nombre, DNI y si tienes Verisure (se guarda para tus próximos ingresos).",
                image: "/home/icon-2.webp",
                imageAlt: "Paso 2 completa tus datos una sola vez",
                step: "2.",
              },
              {
                title: "Registra y haz seguimiento",
                desc: "Desde tu portal podrás registrar referidos y ver su estado en el proceso.",
                image: "/home/icon-3.webp",
                imageAlt: "Paso 3 registra y haz seguimiento",
                step: "3.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="relative overflow-hidden rounded-[40px] bg-white p-[8px] shadow-[0_12px_28px_rgba(88,0,18,0.12)] md:min-h-[280px]"
              >
                <div className="relative h-full overflow-hidden rounded-[34px] border-[2px] border-[#ED002F] bg-white px-3 pb-3 pt-3 text-center md:px-4 md:pb-2 md:pt-2">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[104px] bg-[#E8E8E8] md:h-[108px]" />
                  <div className="pointer-events-none absolute inset-x-0 top-[100px] h-px md:top-[104px]" />
                  <div className="relative z-[1] mx-auto flex min-h-[112px] items-start justify-center md:min-h-[120px]">
                    <div className="relative flex w-full max-w-[220px] items-start justify-center">
                      <span className="absolute left-[20px] top-[26px] text-[58px] font-extrabold leading-none text-white [-webkit-text-stroke:3px_#ED002F] md:left-[22px] md:top-[24px] md:text-[62px]">
                        {c.step}
                      </span>

                      <Image
                        src={c.image}
                        alt={c.imageAlt}
                        width={150}
                        height={110}
                        className="ml-[46px] h-auto w-auto max-h-[92px] object-contain md:ml-[52px] md:max-h-[100px]"
                      />
                    </div>
                  </div>

                  <h3 className="relative z-[1] mx-auto mt-4 text-[21px] font-extrabold leading-[0.96] text-[#4B4043] md:mt-2 md:text-[24px]">
                    {c.title}
                  </h3>
                  <p className="relative z-[1] mx-auto mt-4 max-w-[300px] text-[14px] leading-[1.32] text-[#111111] md:text-[16px]">
                    {c.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* Cómo funciona */}
      <section
        id="como-funciona"
        className="scroll-mt-28 md:scroll-mt-24 bg-white"
      >
        <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
          <div className="rounded-[44px]  px-6 py-12 text-center md:px-12 md:py-16">
            <div className="mx-auto max-w-[760px]">
              <p className="text-[28px] font-extrabold italic leading-[1.08] text-[#ED002F] md:text-[42px]">
                ¿Quieres registrar un referido ahora?
              </p>
              <p className="mt-3 text-[22px] leading-[1.25] text-[#4B4B4B] md:text-[34px]">
                Ingresa y te llevamos directo a tu portal.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openLoginModal("form")}
                  className="inline-flex min-h-[60px] min-w-[250px] items-center justify-center gap-3 rounded-full bg-[#00A47C] px-6 text-[20px] font-extrabold text-white shadow-[0_8px_20px_rgba(88,84,174,0.18)] transition hover:brightness-95 md:min-h-[72px] md:min-w-[290px] md:gap-4 md:px-8 md:text-[24px]"
                >
                  <Image
                    src="/home/icon-user.webp"
                    alt=""
                    width={34}
                    height={34}
                    className="h-[34px] w-[34px]"
                  />
                  <span>Ingresar</span>
                </button>
              </div>

              <p className="mt-8 text-[15px] leading-[1.4] text-[#4B4B4B] md:mt-10 md:text-[20px]">
                *Aplican términos y condiciones del programa.
              </p>
            </div>

            <div className="mt-10">
              <h2 className="text-[28px] font-extrabold italic leading-[1.08] text-[#ED002F] md:text-[42px]">
                ¿Cómo funciona?
              </h2>
              <p className="mt-3 text-[22px] leading-[1.25] text-[#4B4B4B] md:text-[34px]">
                En 3 pasos. Sin complicaciones.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
              {[
                {
                  title: "Registra a tu referido",
                  desc: "Completa los datos básicos del referido.",
                },
                {
                  title: "Enviamos un mensaje informativo",
                  desc: "Tu referido recibe un aviso indicando que fue referido.",
                },
                {
                  title: "Verisure lo contacta",
                  desc: "Un asesor se comunicará para continuar la atención.",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="rounded-[34px] border-[3px] border-[#ED002F] bg-white px-6 py-5 text-center"
                >
                  <h3 className="text-[22px] font-extrabold leading-[1.06] text-[#4B4043] md:text-[30px]">
                    {s.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-[290px] text-[14px] leading-[1.35] text-[#4B4B4B] md:text-[18px]">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="scroll-mt-28 md:scroll-mt-24 bg-transparent">
        <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
          <div className="text-center">
            <h2 className="text-[40px] font-extrabold leading-none text-transparent [text-shadow:none] [-webkit-text-stroke:2px_white] md:text-[72px] md:[-webkit-text-stroke:3px_white]">
              BENEFICIOS
            </h2>
            <p className="mx-auto mt-4 max-w-[980px] text-[20px] leading-[1.25] text-white md:mt-6 md:text-[32px]">
              Un programa pensado para referir de forma simple y transparente.
            </p>
          </div>

          <div className="mt-14 overflow-hidden rounded-[44px] bg-[#F3F3F3] px-8 py-10 md:px-12 md:py-12">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto_1fr] md:gap-10">
              <div className="text-center">
                <h3 className="text-[26px] font-extrabold leading-none text-[#4B4043] md:text-[40px]">
                  Para ti
                </h3>
                <p className="mx-auto mt-4 max-w-[430px] text-[16px] leading-[1.35] text-[#111111] md:mt-5 md:text-[24px]">
                  Podrás llevar control de tus referidos al ingresar. Si hay puntos o beneficios, se aplican según campaña vigente.
                </p>
              </div>

              <div className="mx-auto hidden h-[130px] w-[2px] bg-[#ED002F] md:block" />

              <div className="text-center">
                <h3 className="text-[26px] font-extrabold leading-none text-[#4B4043] md:text-[40px]">
                  Para tu referido
                </h3>
                <p className="mx-auto mt-4 max-w-[430px] text-[16px] leading-[1.35] text-[#111111] md:mt-5 md:text-[24px]">
                  Recibe un mensaje informativo y es contactado por el equipo de Verisure para continuar la atención.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="privacidad-seguridad"
        className="scroll-mt-28 md:scroll-mt-24 bg-white"
      >
        <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
          <div className="text-center">
            <h2 className="text-[28px] font-extrabold italic leading-[1.08] text-[#ED002F] md:text-[42px]">
              Privacidad y seguridad
            </h2>
            <p className="mx-auto mt-4 max-w-[1080px] text-[20px] leading-[1.25] text-[#4B4B4B] md:text-[34px]">
              Protegemos los datos y usamos el correo solo para el proceso de referidos.
            </p>
          </div>

          <div className="mt-10 rounded-full bg-[#E8E8E8] px-8 py-7 md:px-14 md:py-8">
            <div className="grid grid-cols-1 gap-6 text-center md:grid-cols-3 md:gap-8">
              {[
                "Datos mínimos necesarios",
                "Registro con autorización del referido",
                "Acceso seguro por correo",
              ].map((t) => (
                <div key={t} className="text-[18px] font-extrabold leading-[1.2] text-[#4B4043] md:text-[28px]">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="preguntas"
        className="scroll-mt-28 md:scroll-mt-24 bg-white"
      >
        <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
          <div className="text-center">
            <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:gap-4">
              <Image
                src="/home/icon-4.webp"
                alt="Preguntas frecuentes"
                width={62}
                height={62}
                className="h-[48px] w-[48px] object-contain md:h-[62px] md:w-[62px]"
              />
              <h2 className="text-[28px] font-extrabold italic leading-[1.08] text-[#ED002F] md:text-[42px]">
                Preguntas frecuentes
              </h2>
            </div>
            <p className="mt-3 text-[15px] leading-[1.4] text-[#4B4B4B] md:text-[20px]">
              Resolvemos lo típico antes de que preguntes
            </p>
          </div>

          <div className="mt-10 space-y-7">
            {faqs.map((f, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={f.q}
                  className="rounded-[28px] bg-[#E8E8E8] px-5 py-5 md:rounded-full md:px-8 md:py-6"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="text-left text-[18px] font-extrabold leading-[1.2] text-[#4B4043] md:text-[28px]">
                      {f.q}
                    </span>
                    <span
                      className={`shrink-0 text-[#ED002F] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                    >
                      <svg
                        width="32"
                        height="20"
                        viewBox="0 0 32 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        className="h-4 w-6 md:h-6 md:w-10"
                      >
                        <path
                          d="M4 4L16 16L28 4"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  <div
                    ref={(el) => {
                      faqContentRefs.current[index] = el;
                    }}
                    className="overflow-hidden transition-[max-height,opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[max-height,opacity,transform]"
                    style={{ maxHeight: 0, opacity: 0, transform: "translateY(-6px)" }}
                  >
                    <p className="mt-4 text-left text-[14px] leading-[1.45] text-[#4B4B4B] md:text-[18px]">
                      {f.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className=" bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <p>© {year} Verisure Perú</p>
          <div className="flex gap-4">
            <a className="hover:text-gray-900" href="#">
              Privacidad
            </a>
            <a className="hover:text-gray-900" href="#">
              Términos
            </a>
          </div>
        </div>
      </footer>

      {/* Sticky CTA (mobile) */}
      <div className="fixed bottom-4 left-0 right-0 z-40 mx-auto w-full max-w-6xl px-4 md:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() =>
                document
                  .getElementById("acceso")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Acceder
            </Button>
            <Button
              variant="secondary"
              onClick={() => openLoginModal("sticky")}
            >
              Ingresar
            </Button>
          </div>
        </div>
      </div>

      <AccessByEmailModal
        open={openLogin}
        onClose={() => setOpenLogin(false)}
        source={loginSource}
      />
    </main>
  );
}
