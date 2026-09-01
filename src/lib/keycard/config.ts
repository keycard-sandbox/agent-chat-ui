/**
 * Keycard sign-in configuration, read server side only (ECO-238).
 *
 * Nothing here is exposed to the browser: no NEXT_PUBLIC variables, and the
 * bearer this configuration acquires stays in an httpOnly cookie that only the
 * API passthrough reads. With KEYCARD_ZONE_URL or KEYCARD_CLIENT_ID unset,
 * keycardConfig() returns null and every Keycard route and control disables
 * itself, so the fork behaves exactly like stock upstream.
 */

export interface KeycardConfig {
  /** Zone issuer URL. Sign-in and token verification both resolve from it. */
  zoneUrl: string;
  clientId: string;
  /** Only for confidential clients. Public clients leave it unset. */
  clientSecret?: string;
  /**
   * The resource the bearer is audienced at, which is the LangGraph server's
   * own URL. The server checks this audience, so a token minted for anything
   * else is rejected there.
   */
  agentResource: string;
  /** Overrides the request origin when building the redirect URI. */
  appUrl?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function keycardConfig(): KeycardConfig | null {
  const zoneUrl = process.env.KEYCARD_ZONE_URL?.trim();
  const clientId = process.env.KEYCARD_CLIENT_ID?.trim();
  if (!zoneUrl || !clientId) return null;

  const agentResource =
    process.env.KEYCARD_AGENT_RESOURCE?.trim() ||
    process.env.LANGGRAPH_API_URL?.trim();
  if (!agentResource) {
    throw new Error(
      "Keycard sign-in is configured but has no resource to audience the token at. Set KEYCARD_AGENT_RESOURCE, or LANGGRAPH_API_URL.",
    );
  }

  return {
    zoneUrl: trimTrailingSlash(zoneUrl),
    clientId,
    clientSecret: process.env.KEYCARD_CLIENT_SECRET?.trim() || undefined,
    agentResource: trimTrailingSlash(agentResource),
    appUrl: process.env.KEYCARD_APP_URL?.trim()
      ? trimTrailingSlash(process.env.KEYCARD_APP_URL.trim())
      : undefined,
  };
}

/** The registered redirect URI, which must match at begin and at completion. */
export function redirectUri(config: KeycardConfig, requestUrl: string): string {
  const origin = config.appUrl ?? new URL(requestUrl).origin;
  return `${origin}/api/keycard/callback`;
}
