"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Ajusta el import según tu proyecto:
import { Modal } from "@/components/ui/Modal"; 

type Props = {
  open: boolean;
  onClose: () => void;
  source?: string; // para tracking (opcional)
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export default function AccessByEmailModal({ open, onClose, source }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Reset cuando se abre/cierra
  useEffect(() => {
    if (!open) return;
    setStep("email");
    setEmail("");
    setOtp("");
    setMsg(null);
    setCooldown(0);
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);
  const otpClean = useMemo(() => otp.replace(/\D/g, "").slice(0, 6), [otp]);

  const sendOtp = async () => {
    setMsg(null);
    if (!isValidEmail(emailNorm)) {
      setMsg("Ingresa un correo válido.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailNorm,
        options: { shouldCreateUser: true }, // ✅ cualquiera puede entrar
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setStep("otp");
      setCooldown(30);
      setMsg("Te enviamos un código de 6 dígitos. Revisa tu correo.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setMsg(null);
    if (otpClean.length !== 6) {
      setMsg("El código debe tener 6 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailNorm,
        token: otpClean,
        type: "email",
      });

      if (error) {
        setMsg(error.message.includes("expired") ? "El código expiró. Pide uno nuevo." : error.message);
        return;
      }

      if (data?.session) {
        onClose(); // cierra modal
        router.replace("/referidos/app");
        return;
      }

      setMsg("No se pudo iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Accede con correo">
    <div className="px-2 sm:px-4">
      <p className="text-sm text-gray-500 mb-6">
        Te enviaremos un código de 6 dígitos para ingresar.
      </p>
  
      {step === "email" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Correo</label>
  
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@gmail.com"
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
  
            <div className="text-xs text-gray-500">
              Usa un correo válido (te llegará el código en segundos).
            </div>
          </div>
  
          <button
            disabled={loading}
            onClick={sendOtp}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar código"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">Enviamos el código a</div>
            <div className="text-sm font-medium text-gray-900">{emailNorm}</div>
          </div>
  
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Código de verificación
            </label>
  
            <input
              value={otpClean}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full tracking-[0.35em] text-center text-lg rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
  
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>6 dígitos</span>
              <button
                disabled={loading || cooldown > 0}
                onClick={sendOtp}
                className="text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                type="button"
              >
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
              </button>
            </div>
          </div>
  
          <button
            disabled={loading || otpClean.length !== 6}
            onClick={verifyOtp}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Verificando..." : "Verificar y entrar"}
          </button>
  
          <button
            disabled={loading}
            onClick={() => {
              setStep("email");
              setOtp("");
              setMsg(null);
            }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
          >
            Cambiar correo
          </button>
        </div>
      )}
  
      {msg && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {msg}
        </div>
      )}
    </div>
  </Modal>
  );
}