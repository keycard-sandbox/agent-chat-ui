import { completeAuthorization } from "@keycardai/oauth";
import { NextRequest, NextResponse } from "next/server";

import { keycardConfig, redirectUri } from "@/lib/keycard/config";
import {
  DEFAULT_TOKEN_MAX_AGE_SECONDS,
  decodeFlow,
  FLOW_COOKIE,
  isSecureRequest,
  TOKEN_COOKIE,
} from "@/lib/keycard/cookies";

export const runtime = "nodejs";

function failed(returnTo: string, req: NextRequest, reason: string) {
  const target = new URL(returnTo, req.nextUrl.origin);
  target.searchParams.set("keycardError", reason);
  const response = NextResponse.redirect(target);
  response.cookies.delete(FLOW_COOKIE);
  return response;
}

/**
 * Complete a Keycard sign-in and keep the bearer server side.
 *
 * The token goes into an httpOnly cookie, so the browser holds a session it
 * cannot read and the API passthrough is the only thing that turns it into an
 * Authorization header. No resource parameter is sent here: the zone derives
 * the token's audience from the authorization code.
 */
export async function GET(req: NextRequest) {
  const config = keycardConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Keycard sign-in is not configured." },
      { status: 404 },
    );
  }

  const flow = decodeFlow(req.cookies.get(FLOW_COOKIE)?.value);
  if (!flow) return failed("/", req, "no sign-in in progress");

  let token;
  try {
    token = await completeAuthorization(config.zoneUrl, {
      callbackParams: req.nextUrl.searchParams,
      state: flow.state,
      codeVerifier: flow.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: redirectUri(config, req.url),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "sign-in failed";
    return failed(flow.returnTo, req, reason);
  }

  const response = NextResponse.redirect(
    new URL(flow.returnTo, req.nextUrl.origin),
  );
  response.cookies.delete(FLOW_COOKIE);
  response.cookies.set(TOKEN_COOKIE, token.accessToken, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: token.expiresIn ?? DEFAULT_TOKEN_MAX_AGE_SECONDS,
  });
  return response;
}
