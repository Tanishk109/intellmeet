import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Card";
import { authApi } from "@/api";
import { apiErrorMessage } from "@/lib/http";
import { useToast } from "@/components/ui/Toast";

export default function ForgotPassword() {
  const push = useToast((s) => s.push);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return push("Enter your email", "error");
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      push(apiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-signal-500/15">
            <MailCheck className="size-6 text-signal-400" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-text-hi">Check your email</h1>
          <p className="mt-2 text-sm text-text-mid">
            If an account exists for <span className="text-text-hi">{email}</span>, a reset link is
            on its way.
          </p>
          <Link to="/login">
            <Button variant="outline" className="mt-6 w-full">
              <ArrowLeft className="size-4" /> Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold text-text-hi">Reset password</h1>
          <p className="mt-1.5 text-sm text-text-mid">
            Enter your email and we'll send a reset link.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner /> : "Send reset link"}
            </Button>
          </form>
          <Link
            to="/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm text-text-mid hover:text-text-hi"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        </>
      )}
    </AuthLayout>
  );
}
