"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!token) return;

      try {
        const res = await fetch(`/api/admin/referrals/list?limit=1&offset=0`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok && json?.ok) {
          window.location.href = "/admin";
        }
      } catch {
        // stay on page
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const eNorm = email.trim().toLowerCase();
    if (!eNorm) return setError("Ingresa tu correo.");

    setLoading(true);
    try {
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/admin/reset-password`;
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(eNorm, { redirectTo });
        if (resetErr) throw resetErr;

        // Do not reveal whether the email exists
        setError("");
        alert("Si el correo existe, te llegará un enlace para recuperar tu contraseña.");
        setMode("login");
        return;
      }

      if (!password) return setError("Ingresa tu contraseña.");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: eNorm,
        password,
      });

      if (signInErr) throw signInErr;

      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar la acción.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">Ingreso Admin</h1>
          <p className="mt-2 text-sm text-gray-600">
            {mode === "forgot" ? "Te enviaremos un enlace para recuperar tu contraseña." : "Acceso restringido."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Correo</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {mode === "login" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700">Contraseña</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
              className="text-left text-sm font-semibold text-gray-700 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Procesando..." : mode === "forgot" ? "Enviar enlace" : "Ingresar"}
            </Button>

            {mode === "forgot" && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Volver a login
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => (window.location.href = "/")}
            >
              Volver al inicio
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}