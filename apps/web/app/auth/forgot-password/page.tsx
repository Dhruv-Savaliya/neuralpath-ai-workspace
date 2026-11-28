import SubmitButton from "../../components/submit-button";
import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "../../actions/auth";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a secure password recovery link for your NeuralPath account.",
  robots: { index: false, follow: false },
};

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return <main className="auth-page"><section className="auth-card">
    <Link href="/" className="auth-brand">✳ neural<span>path</span></Link>
    <div className="eyebrow">ACCOUNT RECOVERY</div>
    <h1>Reset your password.</h1>
    <p>Enter the email address associated with your NeuralPath account. If it exists, Supabase will send a secure recovery link.</p>
    {sent ? <div className="auth-note" role="status">If the address is registered, a password reset email is on its way. Check your inbox and spam folder.</div> : null}
    {error ? <div className="auth-error" role="alert">{error === "invalid_input" ? "Enter a valid email address." : "We couldn't send the reset email. Please try again."}</div> : null}
    <form action={requestPasswordReset} className="auth-form">
      <label>Email address <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label>
      <SubmitButton>Send recovery link ↗</SubmitButton>
    </form>
    <p className="auth-switch"><Link href="/auth/sign-in">Back to sign in</Link></p>
  </section></main>;
}
