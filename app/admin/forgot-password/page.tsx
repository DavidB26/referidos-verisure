"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const eNorm = email.trim().toLowerCase();
    if (!eNorm) return setError("Ingresa tu correo.");

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/admin/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(eNorm, { redirectTo });
      if (resetErr) throw resetErr;

      setInfo("Listo. Te enviamos un correo para recuperar tu contraseña.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el correo de recuperación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Te enviaremos un enlace para crear una nueva contraseña.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Correo</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar enlace"}
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