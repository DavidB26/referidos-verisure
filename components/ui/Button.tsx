import { cn } from "@/lib/cn";
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all " +
    "focus:outline-none focus:ring-2 focus:ring-[rgba(255,0,51,0.25)] focus:ring-offset-2 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const styles =
    variant === "primary"
      ? "bg-brand text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
      : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50";

  return <button className={cn(base, styles, className)} {...props} />;
}