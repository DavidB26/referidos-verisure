"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const nextParam = params.get("next");
    const safeNext =
      nextParam && nextParam.startsWith("/") ? nextParam : "/referidos/app";

    const run = async () => {
      try {
        // 1) PKCE (?code=...)
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            router.replace(
              `/admin/login?error=${encodeURIComponent(error.message)}`
            );
            return;
          }
          router.replace(safeNext);
          return;
        }

        // 2) Implicit/hash (#access_token=...)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authAny: any = supabase.auth as any;
        if (typeof authAny.getSessionFromUrl === "function") {
          const { data, error } = await authAny.getSessionFromUrl({
            storeSession: true,
          });
          if (error) {
            router.replace(
              `/admin/login?error=${encodeURIComponent(error.message)}`
            );
            return;
          }
          if (data?.session) {
            router.replace(safeNext);
            return;
          }
        }

        // 3) Si ya hay sesión, continúa
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          router.replace(safeNext);
          return;
        }

        router.replace("/admin/login?error=missing_code");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unexpected";
        router.replace(`/admin/login?error=${encodeURIComponent(msg)}`);
      }
    };

    run();
  }, [params, router]);

  return (
    <main style={{ padding: 24 }}>
      Validando sesión…
    </main>
  );
}