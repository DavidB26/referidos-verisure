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
    (async () => {
      const nextParam = params.get("next");
      const safeNext = nextParam?.startsWith("/") ? nextParam : "/referidos/app";

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type"); // magiclink / recovery / invite

      // 1) PKCE flow (most common)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          for (let i = 0; i < 10; i++) {
            const { data } = await supabase.auth.getSession();
            if (data?.session) break;
            await sleep(150);
          }
          router.replace(safeNext);
          return;
        }
      }

      // 2) Verify token_hash flow (sometimes used)
      if (tokenHash && type) {
        // verifyOtp is supported for magiclink/recovery depending on template
        const { error } = await supabase.auth.verifyOtp({
          type: type as any,
          token_hash: tokenHash,
        });

        if (!error) {
          for (let i = 0; i < 10; i++) {
            const { data } = await supabase.auth.getSession();
            if (data?.session) break;
            await sleep(150);
          }
          router.replace(safeNext);
          return;
        }
      }

      // 3) Hash in URL (#access_token=...)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authAny: any = supabase.auth as any;
      if (typeof authAny.getSessionFromUrl === "function") {
        const { data, error } = await authAny.getSessionFromUrl({ storeSession: true });
        if (!error && data?.session) {
          router.replace(safeNext);
          return;
        }
      }

      // fallback
      router.replace("/?login=1");
    })();
  }, [params, router]);

  return <div style={{ padding: 24 }}>Validando sesión…</div>;
}