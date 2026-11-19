/* eslint-disable react/no-unescaped-entities */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { saveOnboarding } from "../actions/auth";

const professions = [
  ["student", "Student"],
  ["employed", "Working professional"],
  ["freelancer", "Freelancer"],
  ["founder", "Founder"],
  ["career_changer", "Career changer"],
  ["creator", "Creator"],
  ["exploring", "Exploring"],
  ["other", "Other"],
] as const;
const interests = [
  "Technology", "Design", "Business", "Marketing", "Finance", "Data", "Science",
  "Communication", "Leadership", "Creative arts", "Health & fitness", "Languages", "Personal growth",
];
const formats = [
  ["reading", "Reading"],
  ["video", "Videos"],
  ["hands_on_projects", "Hands-on projects"],
  ["exercises", "Exercises"],
  ["audio", "Audio"],
  ["guided_explanations", "Guided explanations"],
] as const;
const levels = [
  ["beginner", "Beginner"],
  ["some_experience", "Some experience"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
] as const;

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [{ data: profile }, { data: preferences }, { data: primaryGoal }] = await Promise.all([
    supabase.from("profiles")
      .select("display_name,profession,experience_level,interests,timezone")
      .eq("id", user.id).maybeSingle(),
    supabase.from("learner_preferences")
      .select("learning_formats,learning_pace,weekly_minutes,language_code")
      .eq("user_id", user.id).maybeSingle(),
    supabase.from("learning_goals")
      .select("id,title,category,desired_outcome,target_date,status")
      .eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const message = error === "invalid_input"
    ? "Please complete the required fields and check your selections."
    : error === "save_failed"
      ? "We couldn't save your profile. Your existing goals have been kept safe. Please try again."
      : null;
  const selectedInterests = new Set(profile?.interests ?? []);
  const selectedFormats = new Set(preferences?.learning_formats ?? ["reading", "hands_on_projects"]);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/" className="auth-brand">✳ neural<span>path</span></Link>
        <span>PERSONALIZE YOUR JOURNEY</span>
      </header>
      <section className="onboarding-wrap">
        <div className="onboarding-progress">
          <span>YOUR LEARNING PROFILE</span>
          <b>5 PARTS · ONE SIMPLE PROFILE</b>
          <i><em style={{ width: "100%" }} /></i>
        </div>
        <div className="onboarding-heading">
          <div className="eyebrow">A PATH THAT STARTS WITH YOU</div>
          <h1>Let's get to know<br /><span>your ambitions.</span></h1>
          <p>Share what matters once. NeuralPath uses these answers to personalize your learning path, and you can update them whenever you need.</p>
        </div>
        {message && <div className="auth-error" role="alert">{message}</div>}

        <form action={saveOnboarding} className="onboarding-form">
          <input type="hidden" name="goal_id" value={primaryGoal?.id ?? ""} />

          <section className="onboarding-section">
            <div>
              <h2>01. Where are you right now?</h2>
              <p>Choose the option that best describes your current situation.</p>
            </div>
            <div className="choice-grid">
              {professions.map(([value, label]) => (
                <label className="choice-option" key={value}>
                  <input type="radio" name="profession" value={value} defaultChecked={(profile?.profession ?? "exploring") === value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <label className="field-label">What should we call you?
              <input name="display_name" maxLength={80} defaultValue={profile?.display_name ?? user.user_metadata?.display_name ?? ""} placeholder="Your name (optional)" />
            </label>
            <label className="field-label">Timezone
              <input name="timezone" maxLength={80} defaultValue={profile?.timezone ?? "Asia/Kolkata"} placeholder="e.g. Asia/Kolkata" />
            </label>
          </section>

          <section className="onboarding-section">
            <div>
              <h2>02. What interests you?</h2>
              <p>Select the areas you want NeuralPath to consider. Choose at least one.</p>
            </div>
            <div className="choice-grid">
              {interests.map(value => (
                <label className="choice-option" key={value}>
                  <input type="checkbox" name="interests" value={value} defaultChecked={selectedInterests.has(value)} />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="onboarding-section">
            <div>
              <h2>03. Your starting point</h2>
              <p>Choose your current experience level. This is used as the starting level for your primary goal.</p>
            </div>
            <div className="choice-grid">
              {levels.map(([value, label]) => (
                <label className="choice-option" key={value}>
                  <input type="radio" name="experience_level" value={value} defaultChecked={(profile?.experience_level ?? "beginner") === value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="onboarding-section">
            <div>
              <h2>04. What would you like to achieve?</h2>
              <p>Set one clear primary goal. You can add and manage more goals from your dashboard without repeating your profile details.</p>
            </div>
            <div className="goal-input-card">
              <label className="field-label">Your primary learning goal
                <input name="goal_title" required minLength={3} maxLength={120} defaultValue={primaryGoal?.title ?? ""} placeholder="e.g. Build a portfolio in product design" />
              </label>
              <label className="field-label">Area or category
                <input name="goal_category" maxLength={60} defaultValue={primaryGoal?.category ?? ""} placeholder="e.g. Design, data, leadership, languages" />
              </label>
              <label className="field-label">What does success look like?
                <textarea name="desired_outcome" maxLength={1000} rows={3} defaultValue={primaryGoal?.desired_outcome ?? ""} placeholder="Describe what you want to be able to do..." />
              </label>
              <label className="field-label">Target date (optional)
                <input name="target_date" type="date" defaultValue={primaryGoal?.target_date ?? ""} min={new Date().toISOString().slice(0, 10)} />
              </label>
            </div>
            <p className="field-hint">Your existing additional goals are not deleted or overwritten when you update this profile.</p>
          </section>

          <section className="onboarding-section">
            <div>
              <h2>05. How do you like to learn?</h2>
              <p>Choose formats and a pace that fit your routine.</p>
            </div>
            <div className="choice-grid">
              {formats.map(([value, label]) => (
                <label className="choice-option" key={value}>
                  <input type="checkbox" name="learning_formats" value={value} defaultChecked={selectedFormats.has(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <label className="field-label">Your preferred pace
              <select name="learning_pace" defaultValue={preferences?.learning_pace ?? "balanced"}>
                <option value="relaxed">Relaxed — steady progress</option>
                <option value="balanced">Balanced — sustainable rhythm</option>
                <option value="intensive">Intensive — focused learning</option>
              </select>
            </label>
            <label className="field-label">Time available per week
              <select name="weekly_minutes" defaultValue={String(preferences?.weekly_minutes ?? 150)}>
                <option value="60">About 1 hour</option>
                <option value="150">2–3 hours</option>
                <option value="300">About 5 hours</option>
                <option value="600">About 10 hours</option>
                <option value="1200">10–20 hours</option>
              </select>
            </label>
          </section>

          <div className="onboarding-submit">
            <p>Your profile is private. Updating it will update your primary goal, not create another copy.</p>
            <button className="site-button" type="submit">Save profile & continue ↗</button>
          </div>
        </form>
      </section>
    </main>
  );
}
