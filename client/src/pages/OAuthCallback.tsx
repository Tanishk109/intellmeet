import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "@/lib/http";
import { authApi } from "@/api";
import { useAuth } from "@/stores/auth";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Card";

/**
 * Lands here after Google sign-in. The backend redirected to
 * /oauth/callback#token=<accessToken>. We pull the token from the URL fragment
 * (fragments aren't sent to servers/logs), set it, load the user, and go to the
 * app. The refresh cookie was already set by the backend.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const push = useToast((s) => s.push);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against StrictMode double-invoke
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");

    if (!token) {
      push("Google sign-in failed", "error");
      navigate("/login", { replace: true });
      return;
    }

    setAccessToken(token);
    // Clear the token from the address bar immediately.
    window.history.replaceState(null, "", "/oauth/callback");

    authApi
      .me()
      .then((user) => {
        setUser(user);
        useAuth.setState({ status: "authenticated" });
        push(`Welcome, ${user.name.split(" ")[0]}`, "success");
        navigate("/app", { replace: true });
      })
      .catch(() => {
        push("Could not complete sign-in", "error");
        navigate("/login", { replace: true });
      });
  }, [navigate, setUser, push]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6 text-signal-400" />
        <p className="text-sm text-text-mid">Completing Google sign-in…</p>
      </div>
    </div>
  );
}
