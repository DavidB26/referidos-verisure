"use client";

import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { pushDataLayer } from "@/lib/gtm";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useMemo, useState } from "react";

const schema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  consent: z.boolean().refine((v) => v === true, "Debes aceptar para continuar"),
});

type FormValues = z.infer<typeof schema>;

export function AccessByEmailModal({
  open,
  onClose,
  source = "header",
}: {
  open: boolean;
  onClose: () => void;
  source?: "header" | "form" | "sticky";
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const defaultValues = useMemo<FormValues>(() => ({ email: "", consent: false }), []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  function closeAll() {
    onClose();
    setStatus("idle");
    setErrorMsg("");
    reset(defaultValues);
  }

  const onSubmit = async (values: FormValues) => {
    setStatus("loading");
    setErrorMsg("");
    pushDataLayer("referrals_magiclink_submit", { source });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          // Asegúrate de tener esta URL permitida en Supabase Auth → URL Configuration
          emailRedirectTo: `${origin}/auth/callback?next=/referidos/app`,
        },
      });

      if (error) throw error;

      setStatus("success");
      pushDataLayer("referrals_magiclink_success", { source });
    } catch (e) {
      setStatus("error");
      const message = e instanceof Error ? e.message : "No pudimos enviar el link. Intenta nuevamente.";
      setErrorMsg(message);
      pushDataLayer("referrals_magiclink_error", { source });
    }
  };

  return (
    <Modal open={open} onClose={closeAll} title="Genera tu link / Accede con correo">
      {status !== "success" ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">Correo</label>
            <input
              type="email"
              placeholder="tuemail@correo.com"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              {...register("email")}
            />
            {errors.email?.message && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-1" {...register("consent")} />
            <span>
              Acepto que Verisure me contacte y confirmo haber leído los términos y condiciones.
            </span>
          </label>
          {errors.consent?.message && (
            <p className="-mt-2 text-xs text-red-600">{errors.consent.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Enviando..." : "Enviar link de acceso"}
          </Button>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <p className="text-center text-xs text-gray-500">Toma menos de un minuto.</p>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">¡Listo!</p>
            <p className="mt-1 text-sm text-gray-600">
              Te enviamos un correo con tu link de acceso. Revisa también Promociones/Spam.
            </p>
          </div>

          <Button className="w-full" onClick={closeAll}>
            Entendido
          </Button>
        </div>
      )}
    </Modal>
  );
}