import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { authApi } from "@/api";
import { useAuth } from "@/stores/auth";
import { apiErrorMessage } from "@/lib/http";

export default function Signup() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const push = useToast((s) => s.push);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password)
      return push("Please fill in all fields", "error");
    if (form.password.length < 6)
      return push("Password must be at least 6 characters", "error");
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.signup(form);
      setSession(accessToken, user);
      push("Account created 🎉", "success");
      navigate("/app");
    } catch (err) {
      push(apiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold text-text-hi">Create account</h1>
      <p className="mt-1.5 text-sm text-text-mid">
        Start running smarter meetings in minutes.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Tanishk Mittal" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={set("password")}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Spinner /> : <>Create account <ArrowRight className="size-4" /></>}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-mid">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-signal-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
