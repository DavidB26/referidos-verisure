"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");

    async function run() {
      if (!code) {
        router.replace("/admin/login?error=missing_code");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace(`/admin/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      router.replace("/referidos/app");
    }

    run();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Validando acceso...</p>
    </div>
  );
}