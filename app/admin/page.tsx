"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { pushDataLayer } from "@/lib/gtm";
import { supabase } from "@/lib/supabase";
import { ClipboardList, FileDown, LogOut, RefreshCcw, Search, ShieldAlert } from "lucide-react";

type ReferralRow = {
  id: string;
  created_at: string;
  status: "registered" | "contacted" | "quoted" | "contracted";

  // Referrer (who registers)
  referrer_email: string | null;
  referrer_user_id: string | null;
  referrer_profile?: {
    full_name?: string | null;
    has_verisure?: boolean | null;
    role?: string | null;
  } | null;

  // Referred (lead)
  referred_name: string;
  referred_email?: string | null; // optional
  referred_phone: string;

  // Tracking / metadata
  notes?: string | null;
  camp?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  landing_path?: string | null;
  referer?: string | null;
};

const STATUS_LABEL: Record<ReferralRow["status"], string> = {
  registered: "Registrado",
  contacted: "Contactado",
  quoted: "Cotización",
  contracted: "Contratado",
};

const STATUS_OPTIONS: Array<{ value: ReferralRow["status"]; label: string }> = [
  { value: "registered", label: "Registrado" },
  { value: "contacted", label: "Contactado" },
  { value: "quoted", label: "Cotización" },
  { value: "contracted", label: "Contratado" },
];

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatYesNo(v: boolean | null | undefined) {
  if (typeof v !== "boolean") return "—";
  return v ? "Sí" : "No";
}

function prettyNameFallback(fullName: string | null | undefined, email: string | null | undefined) {
  const name = (fullName || "").trim();
  if (name) return name;

  const e = (email || "").trim();
  if (!e) return "—";

  const local = e.split("@")[0] || "";
  if (!local) return e;

  // Replace separators and title-case lightly
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return e;

  return cleaned
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function fnv1a32(str: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (FNV prime) using 32-bit ops
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function uuidToCode15(uuid: string) {
  const s = (uuid || "").trim();
  if (!s) return "000000000000000";

  // Two independent 32-bit hashes -> combine into a 15-digit safe integer
  const h1 = fnv1a32(s, 0x811c9dc5);
  const h2 = fnv1a32(s, 0x9747b28c);

  // h1 up to ~4e9 -> h1 * 1e6 up to ~4e15 (still < 2^53), add 6 digits from h2
  const codeNum = h1 * 1_000_000 + (h2 % 1_000_000);
  return String(codeNum).padStart(15, "0");
}

function formatDateTimeForCsv(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function csvEscape(v: unknown) {
  const s = (v ?? "").toString();
  // Wrap in quotes and escape internal quotes
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(data: ReferralRow[]) {
  const headers = [
    "Fecha registro",
    "Estado",
    "Código",
    "Referidor",
    "Correo referidor",
    "¿Tiene Verisure?",
    "Referido",
    "Teléfono referido",
    "Correo referido",
    "Campaña",
    "Landing",
    "Notas",
  ];

  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));

  for (const r of data) {
    const row = [
      formatDateTimeForCsv(r.created_at),
      STATUS_LABEL[r.status],
      uuidToCode15(r.id),
      prettyNameFallback(r.referrer_profile?.full_name ?? null, r.referrer_email),
      r.referrer_email ?? "",
      formatYesNo(r.referrer_profile?.has_verisure),
      r.referred_name,
      r.referred_phone,
      r.referred_email ?? "",
      r.camp ?? "",
      r.landing_path ?? "",
      r.notes ?? "",
    ];

    lines.push(row.map(csvEscape).join(","));
  }

  // BOM para Excel
  return "\ufeff" + lines.join("\n");
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [exporting, setExporting] = useState(false);

  const [accessState, setAccessState] = useState<"checking" | "no-session" | "no-admin" | "admin">("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const [page, setPage] = useState(0);
  const pageSize = 10;

  const [total, setTotal] = useState<number>(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  async function fetchRows(opts?: { resetPage?: boolean }) {
    setLoading(true);
    setError("");

    try {
      const curPage = opts?.resetPage ? 0 : page;
      if (opts?.resetPage) setPage(0);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      params.set("limit", String(pageSize));
      params.set("offset", String(curPage * pageSize));

      const res = await fetch(`/api/admin/referrals/list?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "No pudimos cargar los referidos.");
      }

      setRows(json.data || []);
      setTotal(json.total || 0);

      pushDataLayer("referrals_admin_list", {
        q: q.trim() || null,
        status: status || null,
        page: curPage,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando el admin.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setAccessState("checking");
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const email = sessionData.session?.user?.email ?? null;

      if (!token) {
        setAccessToken(null);
        setCurrentEmail(null);
        setAccessState("no-session");
        return;
      }

      setAccessToken(token);
      setCurrentEmail(email);

      try {
        // Validate admin permissions
        const res = await fetch(`/api/admin/referrals/list?limit=1&offset=0`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => ({}));

        if (res.status === 403) {
          setAccessState("no-admin");
          return;
        }

        if (!res.ok || !json.ok) {
          // If unauthorized for any other reason
          if (res.status === 401) {
            setAccessToken(null);
            setCurrentEmail(null);
            setAccessState("no-session");
          } else {
            setAccessState("no-admin");
          }
          return;
        }

        setAccessState("admin");
      } catch {
        // Conservative default: block access
        setAccessState("no-admin");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessState !== "admin") return;
    fetchRows({ resetPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessState]);

  useEffect(() => {
    if (accessState !== "admin") return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function updateStatus(id: string, next: ReferralRow["status"]) {
    setError("");

    // optimistic UI
    const prev = rows;
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status: next } : r)));

    try {
      const res = await fetch(`/api/admin/referrals/update-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ id, status: next }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "No pudimos actualizar el estado.");
      }

      pushDataLayer("referrals_admin_update_status", { id, status: next });
    } catch (e) {
      setRows(prev);
      setError(e instanceof Error ? e.message : "No pudimos actualizar el estado.");
    }
  }

  async function handleExport() {
    if (!accessToken) return;
    setExporting(true);
    setError("");

    try {
      // First request to get total
      const base = new URLSearchParams();
      if (q.trim()) base.set("q", q.trim());
      if (status) base.set("status", status);

      const firstRes = await fetch(`/api/admin/referrals/list?${base.toString()}&limit=1&offset=0`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const firstJson = await firstRes.json();
      if (!firstRes.ok || !firstJson.ok) {
        throw new Error(firstJson.message || "No pudimos preparar la exportación.");
      }

      const totalToExport: number = firstJson.total || 0;
      const chunk = 500;
      const all: ReferralRow[] = [];

      for (let offset = 0; offset < totalToExport; offset += chunk) {
        const params = new URLSearchParams(base);
        params.set("limit", String(chunk));
        params.set("offset", String(offset));

        const res = await fetch(`/api/admin/referrals/list?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Error exportando los referidos.");
        }

        all.push(...(json.data || []));
      }

      const csv = buildCsv(all);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadTextFile(`referidos-export-${stamp}.csv`, csv);

      pushDataLayer("referrals_admin_export", {
        q: q.trim() || null,
        status: status || null,
        total: totalToExport,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos exportar.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSignOut() {
    try {
      pushDataLayer("referrals_admin_sign_out", {});
    } catch {}

    try {
      await supabase.auth.signOut();
    } catch {}

    window.location.href = "/admin/login";
  }

  if (accessState === "checking") {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Verificando acceso…</p>
            <p className="mt-2 text-sm text-gray-600">Estamos validando tu sesión y permisos de administrador.</p>
          </div>
        </div>
      </main>
    );
  }

  if (accessState === "no-session") {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Ingresa para acceder</p>
            <p className="mt-2 text-sm text-gray-600">
              Debes iniciar sesión para entrar al admin de referidos.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => {
                  pushDataLayer("referrals_admin_go_login", {});
                  window.location.href = "/admin/login";
                }}
              >
                Ir a login admin
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Ya ingresé, reintentar
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (accessState === "no-admin") {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Sin permisos</p>
            <p className="mt-2 text-sm text-gray-600">
              Tu cuenta no tiene acceso al admin.{currentEmail ? ` Sesión actual: ${currentEmail}` : ""} Si crees que es un error, solicita permisos.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    pushDataLayer("referrals_admin_change_account", {});
                  } catch {}

                  try {
                    await supabase.auth.signOut();
                  } catch {}

                  window.location.href = "/admin/login";
                }}
              >
                Cambiar cuenta
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </Button>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Tip: si cambiaste de cuenta, vuelve a ingresar por <span className="font-semibold">/admin/login</span> con el usuario que tenga <span className="font-semibold">role = admin</span> en <span className="font-semibold">profiles</span>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-brand">
              <ClipboardList size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Admin de Referidos</p>
              <p className="text-xs text-gray-500">Gestiona estados y monitorea registros.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-gray-900">Sesión</p>
              <p className="text-xs text-gray-500">{currentEmail || "—"}</p>
            </div>

            <Button variant="secondary" onClick={() => fetchRows()} disabled={loading || accessState !== "admin"}>
              <span className="inline-flex items-center gap-2">
                <RefreshCcw size={16} />
                {loading ? "Actualizando..." : "Refrescar"}
              </span>
            </Button>

            <Button variant="secondary" onClick={handleExport} disabled={loading || exporting || accessState !== "admin"}>
              <span className="inline-flex items-center gap-2">
                <FileDown size={16} />
                {exporting ? "Exportando..." : "Exportar"}
              </span>
            </Button>

            <Button variant="secondary" onClick={handleSignOut}>
              <span className="inline-flex items-center gap-2">
                <LogOut size={16} />
                Cerrar sesión
              </span>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700">Buscar</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <Search size={18} className="text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre/teléfono del referido"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Mostrando <strong>{rows.length}</strong> de <strong>{total}</strong> registros.
            </p>

            <Button variant="secondary" onClick={() => fetchRows({ resetPage: true })} disabled={loading}>
              Aplicar filtros
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <ShieldAlert size={18} className="mt-0.5" />
                <div>
                  <p className="font-semibold">Ups</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Datos del referidor</th>
                    <th className="px-4 py-3">Datos del referido</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha de registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-gray-500" colSpan={4}>
                        Cargando...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-gray-500" colSpan={4}>
                        No hay resultados.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 align-top">
                          <p className="text-base font-semibold text-gray-900">
                            {prettyNameFallback(r.referrer_profile?.full_name ?? null, r.referrer_email)}
                          </p>
                          <div className="mt-2 space-y-1 text-xs text-gray-700">
                            <p>
                              <span className="font-semibold text-gray-900">Correo:</span>{" "}
                              <span className="break-all">{r.referrer_email || "—"}</span>
                            </p>
                            <p><span className="font-semibold text-gray-900">¿Tiene Verisure?:</span> {formatYesNo(r.referrer_profile?.has_verisure)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="text-base font-semibold text-gray-900">{r.referred_name}</p>
                          <div className="mt-2 space-y-1 text-xs text-gray-700">
                            <p><span className="font-semibold text-gray-900">Teléfono:</span> {r.referred_phone || "—"}</p>
                            <p>
                              <span className="font-semibold text-gray-900">Correo:</span>{" "}
                              {r.referred_email ? (
                                <span className="break-all">{r.referred_email}</span>
                              ) : (
                                <span className="text-gray-500">Sin correo</span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <select
                            value={r.status}
                            onChange={(e) => updateStatus(r.id, e.target.value as ReferralRow["status"])}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="mt-1 text-sm text-gray-700">{formatDate(r.created_at)}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            *Los cambios se verán reflejados en el portal del usuario al recargar o volver a ingresar.
          </p>
        </div>
      </section>
    </main>
  );
}