import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { authApi } from "@/api";
import { useAuth } from "@/stores/auth";
import { apiErrorMessage } from "@/lib/http";
import { GoogleButton } from "@/components/GoogleButton";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const push = useToast((s) => s.push);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const oauth = params.get("oauth");
    if (!oauth) return;
    if (oauth === "unavailable") {
      push("Google sign-in isn't set up yet — use email and password.", "error");
    } else if (oauth === "failed") {
      push("Google sign-in failed. Please try again.", "error");
    }
    params.delete("oauth");
    setParams(params, { replace: true });
  }, [params, setParams, push]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return push("Please fill in all fields", "error");
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.login({ email, password });
      setSession(accessToken, user);
      push(`Welcome back, ${user.name.split(" ")[0]}`, "success");
      navigate("/app");
    } catch (err) {
      push(apiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("demo@intellmeet.io");
    setPassword("demo1234");
  };

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold text-text-hi">Sign in</h1>
      <p className="mt-1.5 text-sm text-text-mid">Welcome back. Enter your details to continue.</p>

      <div className="mt-8">
        <GoogleButton label="Sign in with Google" />
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-text-lo">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-signal-400 hover:underline">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <Spinner />
          ) : (
            <>
              Sign in <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <button
        onClick={fillDemo}
        className="mt-4 w-full rounded-lg border border-dashed border-line py-2.5 text-xs text-text-lo transition-colors hover:border-signal-500/50 hover:text-text-mid"
      >
        Use demo account (demo@intellmeet.io)
      </button>

      <p className="mt-6 text-center text-sm text-text-mid">
        No account?{" "}
        <Link to="/signup" className="font-medium text-signal-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
