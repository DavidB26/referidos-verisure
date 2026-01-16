"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const nextParam = params.get("next");
    const safeNext = nextParam?.startsWith("/") ? nextParam : "/referidos/app";

    (async () => {
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace("/?login=1");
          return;
        }

        // ✅ Espera a que la sesión exista de verdad
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) break;
          await sleep(150);
        }

        router.replace(safeNext);
        return;
      }

      // hash/implicit fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authAny: any = supabase.auth as any;
      if (typeof authAny.getSessionFromUrl === "function") {
        const { data, error } = await authAny.getSessionFromUrl({ storeSession: true });
        if (!error && data?.session) {
          // mismo "confirm"
          for (let i = 0; i < 10; i++) {
            const { data: s } = await supabase.auth.getSession();
            if (s?.session) break;
            await sleep(150);
          }
          router.replace(safeNext);
          return;
        }
      }

      router.replace("/?login=1");
    })();
  }, [params, router]);

  return <div style={{ padding: 24 }}>Validando sesión…</div>;
}