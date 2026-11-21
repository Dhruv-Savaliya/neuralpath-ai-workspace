import type { Metadata } from "next";
import Link from "next/link";
import { updatePassword } from "../../actions/auth";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your NeuralPath account.",
  robots: { index: false, follow: false },
};

export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    invalid_password: "Use a password between 8 and 128 characters.",
    update_failed: "We couldn't update your password. Request a new recovery link and try again.",
  };
  return <main className="auth-page"><section className="auth-card">
    <Link href="/" className="auth-brand">✳ neural<span>path</span></Link>
    <div className="eyebrow">SECURE YOUR ACCOUNT</div>
    <h1>Choose a new password.</h1>
    <p>Use at least 8 characters. Your new password will replace the old one.</p>
    {error ? <div className="auth-error" role="alert">{messages[error] ?? "Your recovery session may have expired. Request a new link."}</div> : null}
    <form action={updatePassword} className="auth-form">
      <label>New password <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="At least 8 characters"/></label>
      <button className="site-button" type="submit">Update password ↗</button>
    </form>
  </section></main>;
}
