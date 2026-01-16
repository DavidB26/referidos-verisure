"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");

    async function run() {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      router.replace("/referidos/app"); // o la ruta que quieras para el portal
    }

    run();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Validando acceso...</p>
    </div>
  );
}