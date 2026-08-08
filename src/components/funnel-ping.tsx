"use client";

import { useEffect } from "react";

const KEY = "ficco_fsid";

/** Stable anonymous session id for funnel measurement (no PII). */
export function getFunnelSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** Fire-and-forget funnel beacon on mount. Renders nothing. */
export function FunnelPing({ step, propertyId }: { step: string; propertyId?: string }) {
  useEffect(() => {
    const sessionId = getFunnelSessionId();
    if (!sessionId) return;
    fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, sessionId, propertyId }),
      keepalive: true,
    }).catch(() => {});
  }, [step, propertyId]);
  return null;
}
