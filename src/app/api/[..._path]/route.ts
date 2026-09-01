import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { NextRequest } from "next/server";

import { keycardConfig } from "@/lib/keycard/config";
import { TOKEN_COOKIE } from "@/lib/keycard/cookies";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

// With Keycard configured, this proxy is what authenticates the caller: it
// reads the signed-in browser's bearer from its httpOnly cookie and sends it as
// Authorization, so the token never reaches client JavaScript. Each browser
// carries its own cookie, so one deployment serves many callers, each under
// their own identity. With Keycard unset this returns nothing and the proxy
// behaves exactly like stock upstream.
function keycardHeaders(req: NextRequest): Record<string, string> {
  if (!keycardConfig()) return {};
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return {};
  // The LangSmith key is meaningless to a zone-authenticated server, and
  // sending both invites the server to pick the wrong one.
  return { Authorization: `Bearer ${token}`, "x-api-key": "" };
}

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
    apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
    headers: keycardHeaders,
  });
