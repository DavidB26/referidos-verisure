export function pushDataLayer(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;
    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    // @ts-ignore
    window.dataLayer.push({ event, ...payload });
  }