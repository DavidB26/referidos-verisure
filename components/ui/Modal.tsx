"use client";

import React, { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}