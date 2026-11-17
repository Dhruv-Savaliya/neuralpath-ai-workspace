"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, LoaderCircle, Plus, RefreshCw, Target } from "lucide-react";
import { neuralPathApi, type WorkspaceDashboard } from "../../lib/api/client";

export default function WorkspaceGoalsPanel() {
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await neuralPathApi.getDashboard();
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your saved learning workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) {
      setError("Please enter a goal with at least 3 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await neuralPathApi.createGoal({ title: title.trim(), category: category.trim() || "general" });
      setTitle("");
      setCategory("");
      setNotice("Your learning goal has been saved to your account.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 24, padding: 22 }}>
      <div className="panel-head">
        <div>
          <span className="section-eyebrow">CLOUD-SAVED WORKSPACE</span>
          <h3>Your learning goals</h3>
        </div>
        <button className="text-btn" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <p role="status" style={{ display: "flex", alignItems: "center", gap: 8 }}><LoaderCircle size={16} /> Loading your saved goals…</p>
      ) : error ? (
        <p role="alert" style={{ display: "flex", alignItems: "center", gap: 8, color: "#f59e0b" }}><AlertCircle size={16} /> {error}</p>
      ) : (
        <>
          <p style={{ color: "var(--muted, #9ca3af)", margin: "0 0 14px" }}>
            {data?.profile?.display_name ? `Welcome back, ${data.profile.display_name}. ` : ""}
            {data?.stats.totalGoals ?? 0} saved goal(s) · {data?.stats.totalPaths ?? 0} learning path(s)
          </p>
          {data?.goals.length ? (
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {data.goals.map((goal) => (
                <article key={goal.id} style={{ border: "1px solid var(--border, rgba(148,163,184,.2))", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <b>{goal.title}</b>
                      <p style={{ margin: "4px 0 0", color: "var(--muted, #9ca3af)", fontSize: 13 }}>{goal.category} · {goal.status}</p>
                    </div>
                    <Target size={18} aria-hidden="true" />
                  </div>
                  {goal.desired_outcome ? <p style={{ margin: "8px 0 0", fontSize: 13 }}>{goal.desired_outcome}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted, #9ca3af)", marginBottom: 18 }}>No saved goals yet. Add your first goal below.</p>
          )}
        </>
      )}

      <form onSubmit={submitGoal} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Goal title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} minLength={3} required placeholder="e.g. Learn full-stack development" style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: "1px solid var(--border, #374151)", background: "transparent", color: "inherit" }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Category
          <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="e.g. Technology" style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: "1px solid var(--border, #374151)", background: "transparent", color: "inherit" }} />
        </label>
        <button className="primary-btn" type="submit" disabled={saving || loading} style={{ whiteSpace: "nowrap" }}>
          {saving ? <LoaderCircle size={15} /> : <Plus size={15} />} Save goal
        </button>
      </form>
      {notice ? <p role="status" style={{ color: "#34d399", margin: "12px 0 0", fontSize: 13 }}>{notice}</p> : null}
      <p style={{ color: "var(--muted, #9ca3af)", fontSize: 12, margin: "12px 0 0" }}>
        Saved through your signed-in session and the NeuralPath API. <a href="/onboarding" style={{ textDecoration: "underline" }}>Edit your learning profile <ArrowUpRight size={11} style={{ display: "inline" }} /></a>
      </p>
    </section>
  );
}
