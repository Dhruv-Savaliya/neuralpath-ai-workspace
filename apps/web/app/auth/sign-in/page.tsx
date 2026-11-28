import SubmitButton from "../../components/submit-button";
import { safeNextPath } from "../../../lib/safe-next-path";
import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "../../actions/auth";
const errors:Record<string,string>={
 invalid_input:"Enter a valid email and password.",
 invalid_credentials:"Email or password is incorrect. If you just signed up, confirm your email first.",
 recovery_session_invalid:"Your password reset link is invalid or expired. Request a new one.",
 password_updated:"Your password has been updated. Sign in with your new password.",
};
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your private NeuralPath learning workspace.",
  robots: { index: false, follow: false },
};

export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string;next?:string | string[]}>}) {
 const {error,next}=await searchParams; const safeNext=safeNextPath(next);
 return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">✳ neural<span>path</span></Link><div className="eyebrow">WELCOME BACK</div><h1>Pick up where you left off.</h1><p>Your goals are waiting. Sign in to continue your journey.</p>{error&&<div className="auth-error" role="alert">{(Object.hasOwn(errors, error) ? errors[error] : undefined)??"Something went wrong. Please try again."}</div>}<form action={signIn} className="auth-form"><input type="hidden" name="next" value={safeNext}/><label>Email address <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label><label>Password <input name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Your password"/></label><SubmitButton>Sign in ↗</SubmitButton></form><p className="auth-switch"><Link href="/auth/forgot-password">Forgot your password?</Link></p><p className="auth-switch">New to NeuralPath? <Link href="/auth/sign-up">Create an account</Link></p><small className="auth-note">Your password is managed securely by Supabase Auth. Never share it with anyone.</small></section></main>;
}
