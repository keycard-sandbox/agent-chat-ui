/**
 * Cookies the Keycard sign-in flow uses (ECO-238).
 *
 * The bearer lands in an httpOnly cookie, so client JavaScript cannot read it
 * and the API passthrough is the only thing that ever attaches it to a request.
 * The PKCE verifier and CSRF state live in a second httpOnly cookie for the few
 * seconds between the redirect and the callback, so the verifier is never a
 * value the browser can read, and each browser's flow is its own.
 */

import type { NextRequest } from "next/server";

export const TOKEN_COOKIE = "keycard_token";
export const FLOW_COOKIE = "keycard_flow";

/** An authorization request that has been redirected but not yet completed. */
export interface PendingFlow {
  state: string;
  codeVerifier: string;
  /** Where to send the browser once the callback completes. */
  returnTo: string;
}

export const FLOW_MAX_AGE_SECONDS = 600;
export const DEFAULT_TOKEN_MAX_AGE_SECONDS = 3600;

/**
 * Whether the browser reached us over HTTPS, and so whether to mark cookies
 * secure. Behind a TLS terminating proxy the request itself arrives as plain
 * HTTP, so the forwarded protocol decides.
 */
export function isSecureRequest(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeFlow(flow: PendingFlow): string {
  return encodeBase64Url(JSON.stringify(flow));
}

export function decodeFlow(value: string | undefined): PendingFlow | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as PendingFlow).state !== "string" ||
      typeof (parsed as PendingFlow).codeVerifier !== "string"
    ) {
      return null;
    }
    const flow = parsed as PendingFlow;
    return { ...flow, returnTo: safeReturnTo(flow.returnTo) };
  } catch {
    return null;
  }
}

/**
 * Confine post-sign-in redirects to this app, so a crafted login link cannot
 * bounce a freshly signed-in browser to another origin.
 */
export function safeReturnTo(value: string | null | undefined): string {
  // The URL parser treats backslashes as slashes for http(s), so "/\evil.com"
  // resolves to https://evil.com/ despite starting with a single "/". Reject
  // any second character that a parser can read as a second slash, then prove
  // the survivor still resolves inside this origin.
  if (!value || !value.startsWith("/")) return "/";
  if (value[1] === "/" || value[1] === "\\") return "/";
  const probe = "https://relative.invalid";
  try {
    if (new URL(value, probe).origin !== probe) return "/";
  } catch {
    return "/";
  }
  return value;
}

/** Claims worth showing in the UI. The zone remains the only verifier. */
export function unverifiedIdentity(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(decodeBase64Url(payload));
    if (typeof claims !== "object" || claims === null) return null;
    const { email, sub } = claims as { email?: unknown; sub?: unknown };
    if (typeof email === "string" && email) return email;
    if (typeof sub === "string" && sub) return sub;
    return null;
  } catch {
    return null;
  }
}
