"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function AdminResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  useEffect(() => {
    (async () => {
      // En la mayoría de setups, Supabase crea sesión al abrir el link de recovery.
      const { data } = await supabase.auth.getSession();
      const ok = !!data.session;
      setHasSession(ok);
      if (!ok) {
        setShowPassword(false);
        setShowPassword2(false);
      }
      setReady(true);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!hasSession) return setError("El enlace no es válido o expiró. Vuelve a pedir recuperación.");
    if (!password || password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;

      setInfo("Contraseña actualizada. Redirigiendo a login...");

      // Para evitar loops: cerramos sesión y forzamos login nuevo
      await supabase.auth.signOut();
      setTimeout(() => (window.location.href = "/admin/login"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">Crear nueva contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            {ready ? (hasSession ? "Ingresa tu nueva contraseña." : "Este enlace no es válido o expiró.") : "Cargando..."}
          </p>

          {!hasSession && ready && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Vuelve a solicitar la recuperación desde el login.
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Nueva contraseña</label>
              <div className="relative mt-1">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm outline-none"
                  disabled={!hasSession || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-600 hover:bg-gray-50"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={!hasSession || loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Repetir contraseña</label>
              <div className="relative mt-1">
                <input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type={showPassword2 ? "text" : "password"}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm outline-none"
                  disabled={!hasSession || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-600 hover:bg-gray-50"
                  aria-label={showPassword2 ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={!hasSession || loading}
                >
                  {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {info}
              </div>
            )}

            <Button type="submit" disabled={loading || !hasSession} className="w-full">
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => (window.location.href = "/admin/login")}
            >
              Volver a login
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}