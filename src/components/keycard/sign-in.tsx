"use client";

import { LogIn, LogOut } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useKeycardSession } from "@/lib/keycard/use-keycard-session";

/** Report a sign-in the callback route could not finish, once, then forget it. */
function useSignInError() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get("keycardError");
    if (!error) return;
    toast.error("Keycard sign-in failed", {
      description: error,
      richColors: true,
      closeButton: true,
    });
    url.searchParams.delete("keycardError");
    window.history.replaceState(null, "", url.toString());
  }, []);
}

/**
 * Sign in and sign out for a Keycard zone.
 *
 * Renders nothing at all when Keycard is unconfigured, which is what keeps the
 * stock upstream UI untouched on deployments that do not use it.
 */
export function KeycardSignIn() {
  const { session, loading, signIn, signOut } = useKeycardSession();
  useSignInError();

  if (loading || !session.enabled) return null;

  if (!session.signedIn) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={signIn}
      >
        <LogIn className="size-4" />
        Sign in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground max-w-[16ch] truncate text-sm">
        {session.identity ?? "Signed in"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        title="Sign out"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
