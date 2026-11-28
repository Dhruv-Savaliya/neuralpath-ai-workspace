"use server";

import { safeNextPath } from "../../lib/safe-next-path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

async function getAuthRedirectBaseUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const normalizedHost = host.split(",")[0].trim().toLowerCase();

  // Trust only this app's Vercel deployment hosts and local development.
  if (
    normalizedHost === "neuralpathx.vercel.app" ||
    (normalizedHost.endsWith(".vercel.app") && normalizedHost === process.env.VERCEL_URL?.toLowerCase())
  ) {
    return `https://${normalizedHost}`;
  }

  if (normalizedHost === "localhost:3000" || normalizedHost === "127.0.0.1:3000") {
    return `http://${normalizedHost}`;
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://neuralpathx.vercel.app").replace(/\/$/, "");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    redirect("/auth/sign-up?error=invalid_input");
  }
  const supabase = await createClient();
  const redirectBaseUrl = await getAuthRedirectBaseUrl();
  const { data, error } = await supabase.auth.signUp({
    email, password, options: {
      data: { display_name: displayName },
      emailRedirectTo: `${redirectBaseUrl}/auth/callback?next=/onboarding`,
    },
  });
  if (error) redirect("/auth/sign-up?error=signup_failed");
  if (data.session) redirect("/onboarding");
  redirect("/auth/check-email");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) {
    redirect("/auth/sign-in?error=invalid_input");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/auth/sign-in?error=invalid_credentials");
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/auth/forgot-password?error=invalid_input");
  }
  const supabase = await createClient();
  const redirectBaseUrl = await getAuthRedirectBaseUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectBaseUrl}/auth/callback?next=/auth/update-password`,
  });
  if (error) redirect("/auth/forgot-password?error=request_failed");
  redirect("/auth/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8 || password.length > 128) {
    redirect("/auth/update-password?error=invalid_password");
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/sign-in?error=recovery_session_invalid");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/update-password?error=update_failed");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  redirect("/");
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/sign-in");

  const professions = ["student","employed","freelancer","founder","career_changer","creator","exploring","other"];
  const levels = ["beginner","some_experience","intermediate","advanced"];
  const formatsAllowed = ["reading","video","hands_on_projects","exercises","audio","guided_explanations"];
  const p = String(formData.get("profession") ?? "exploring");
  const level = String(formData.get("experience_level") ?? "beginner");
  const pace = String(formData.get("learning_pace") ?? "balanced");
  const minutes = Number(formData.get("weekly_minutes") ?? 150);
  const interests = formData.getAll("interests").map(String).map(v => v.trim().slice(0,40)).filter(Boolean).slice(0,20);
  const formats = formData.getAll("learning_formats").map(String).filter(v => formatsAllowed.includes(v)).slice(0,10);
  const rawGoals = formData.getAll("goal_title").map(String);
  const goalId = String(formData.get("goal_id") ?? "").trim();
  const categories = formData.getAll("goal_category").map(String);
  const outcomes = formData.getAll("desired_outcome").map(String);
  const goalLevels = formData.getAll("goal_level").map(String);
  const dates = formData.getAll("target_date").map(String);
  const goals = rawGoals.map((title,i)=>({
    ...(i === 0 && /^[0-9a-f-]{36}$/i.test(goalId) ? { id: goalId } : {}),
    title:title.trim().slice(0,120),
    category:(categories[i] ?? "general").trim().slice(0,60),
    desired_outcome:(outcomes[i] ?? "").trim().slice(0,1000),
    current_level:levels.includes(goalLevels[i])?goalLevels[i]:level,
    target_date:/^\d{4}-\d{2}-\d{2}$/.test(dates[i] ?? "")?dates[i]:null,
  })).filter(g=>g.title.length>=3).slice(0,10);

  if (!professions.includes(p) || !levels.includes(level) || !["relaxed","balanced","intensive"].includes(pace) ||
      !Number.isInteger(minutes) || minutes<15 || minutes>3000 || interests.length<1 || goals.length<1) {
    redirect("/onboarding?error=invalid_input");
  }

  const { error } = await supabase.rpc("complete_onboarding", {
    p_profession:p,
    p_experience_level:level,
    p_interests:interests,
    p_timezone:String(formData.get("timezone") ?? "Asia/Kolkata").slice(0,80),
    p_learning_formats:formats,
    p_learning_pace:pace,
    p_weekly_minutes:minutes,
    p_goals:goals,
    p_display_name:String(formData.get("display_name") ?? "").trim().slice(0,80),
  });
  if (error) redirect("/onboarding?error=save_failed");
  redirect("/dashboard");
}
