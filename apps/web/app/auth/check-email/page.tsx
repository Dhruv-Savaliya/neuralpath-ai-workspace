import type { Metadata } from "next";
/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
export const metadata: Metadata = {
  title: "Check your email",
  description: "Check your inbox for the secure link to continue with your NeuralPath account.",
  robots: { index: false, follow: false },
};

export default function CheckEmail(){return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">✳ neural<span>path</span></Link><div className="eyebrow">ONE LAST STEP</div><h1>Check your inbox.</h1><p>If the address can receive a confirmation email, Supabase has sent instructions. Open that message to verify your email and continue.</p><Link href="/auth/sign-in" className="site-button">Back to sign in</Link><small className="auth-note">If the email doesn't arrive, check spam and verify the Supabase Auth email and redirect configuration.</small></section></main>}