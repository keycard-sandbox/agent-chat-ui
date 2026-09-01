import { NextRequest, NextResponse } from "next/server";

import { keycardConfig } from "@/lib/keycard/config";
import { TOKEN_COOKIE, unverifiedIdentity } from "@/lib/keycard/cookies";

export const runtime = "nodejs";

/**
 * What the calling browser's session is, for the sign-in control to render.
 *
 * The bearer itself is never returned: the API passthrough attaches it from the
 * cookie, so client JavaScript has no reason to hold it. `enabled` is how the
 * client learns whether this deployment has Keycard configured at all, without
 * a NEXT_PUBLIC variable.
 */
export async function GET(req: NextRequest) {
  const config = keycardConfig();
  if (!config) return NextResponse.json({ enabled: false, signedIn: false });

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  return NextResponse.json({
    enabled: true,
    signedIn: Boolean(token),
    identity: token ? unverifiedIdentity(token) : null,
  });
}

/** Sign out this browser. Nobody else's session is affected. */
export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
