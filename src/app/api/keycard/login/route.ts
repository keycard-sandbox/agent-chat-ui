import { beginAuthorization } from "@keycardai/oauth";
import { NextRequest, NextResponse } from "next/server";

import { keycardConfig, redirectUri } from "@/lib/keycard/config";
import {
  encodeFlow,
  FLOW_COOKIE,
  FLOW_MAX_AGE_SECONDS,
  isSecureRequest,
  safeReturnTo,
} from "@/lib/keycard/cookies";

export const runtime = "nodejs";

/**
 * Start a Keycard sign-in: redirect the browser to the zone's authorize URL.
 *
 * The authorization is scoped to the agent's resource, so the issued token is
 * audienced at the LangGraph server and it can exchange it onward per tool
 * call. The PKCE verifier never reaches the browser as a readable value; it
 * rides in an httpOnly cookie the callback consumes.
 */
export async function GET(req: NextRequest) {
  const config = keycardConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Keycard sign-in is not configured." },
      { status: 404 },
    );
  }

  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const redirect = await beginAuthorization(config.zoneUrl, {
    clientId: config.clientId,
    redirectUri: redirectUri(config, req.url),
    resources: [config.agentResource],
    scopes: ["openid", "email", "profile"],
  });

  const response = NextResponse.redirect(redirect.url);
  const flow = encodeFlow({
    state: redirect.state,
    codeVerifier: redirect.codeVerifier,
    returnTo,
  });
  response.cookies.set(FLOW_COOKIE, flow, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: FLOW_MAX_AGE_SECONDS,
  });
  return response;
}
