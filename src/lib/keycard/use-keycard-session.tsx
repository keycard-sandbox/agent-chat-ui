"use client";

import { useCallback, useEffect, useState } from "react";

export interface KeycardSession {
  /** False when this deployment has no Keycard configuration, the stock path. */
  enabled: boolean;
  signedIn: boolean;
  identity?: string | null;
}

const SIGNED_OUT: KeycardSession = { enabled: false, signedIn: false };

/**
 * Whether the LangGraph server refused the request for lack of a valid caller.
 *
 * The SDK raises an HTTPError carrying the status, and formats its message as
 * "HTTP 401: ...", which is the fallback when the error crosses a boundary that
 * keeps only the message.
 */
export function isUnauthorized(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, message } = error as { status?: unknown; message?: unknown };
  if (status === 401 || status === 403) return true;
  return typeof message === "string" && /HTTP 40[13]\b/.test(message);
}

/** Send the browser to the zone, returning to wherever it currently is. */
export function startKeycardSignIn(): void {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/api/keycard/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * The signed-in state of this browser, read from the server route.
 *
 * The bearer is not part of it: it stays in an httpOnly cookie that the API
 * passthrough attaches server side. This hook only decides what the sign-in
 * control renders, and reports enabled=false when Keycard is unconfigured.
 */
export function useKeycardSession() {
  const [session, setSession] = useState<KeycardSession>(SIGNED_OUT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/keycard/session");
      setSession(res.ok ? ((await res.json()) as KeycardSession) : SIGNED_OUT);
    } catch {
      setSession(SIGNED_OUT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/keycard/session", { method: "DELETE" });
    await refresh();
    window.location.reload();
  }, [refresh]);

  return { session, loading, refresh, signOut, signIn: startKeycardSignIn };
}
