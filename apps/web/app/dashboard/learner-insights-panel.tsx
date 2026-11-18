"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, CalendarClock, CheckCircle2, Flame, LoaderCircle, RefreshCw, Target } from "lucide-react";
import { neuralPathApi, type LearnerInsights, type LearningRecommendations } from "../../lib/api/client";

export default function LearnerInsightsPanel() {
  const [insights, setInsights] = useState<LearnerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<LearningRecommendations | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [recommendationBusy, setRecommendationBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextInsights, nextRecommendations] = await Promise.all([
        neuralPathApi.getLearnerInsights(),
        neuralPathApi.getLearningRecommendations(),
      ]);
      setInsights(nextInsights);
      setRecommendations(nextRecommendations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load learner insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="panel" style={{ marginBottom: 24, padding: 22 }}>
      <div className="panel-head">
        <div>
          <span className="section-eyebrow">PHASE 6 · LEARNER INTELLIGENCE</span>
          <h3>Your learning insights</h3>
          <p style={{ color: "var(--muted,#9ca3af)", fontSize: 12, margin: "5px 0 0" }}>
            Calculated from your saved goals, roadmap and completed tasks — no sample activity.
          </p>
        </div>
        <button className="text-btn" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {loading ? <p role="status"><LoaderCircle size={15}/> Calculating your learning insights…</p> : null}
      {error ? <p role="alert" style={{ color: "#f59e0b" }}><AlertCircle size={15}/> {error}</p> : null}

      {!loading && !error && insights ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Completed tasks", value: insights.roadmap.completedTasks, icon: CheckCircle2 },
              { label: "Last 7 days", value: insights.activity.completedLast7Days, icon: Activity },
              { label: "Last 30 days", value: insights.activity.completedLast30Days, icon: CalendarClock },
              { label: "Current streak", value: insights.activity.currentStreak, icon: Flame },
            ].map(metric => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 10, padding: 12 }}>
                  <Icon size={16} style={{ color: "var(--muted,#9ca3af)" }}/>
                  <b style={{ display: "block", fontSize: 22, marginTop: 6 }}>{metric.value}</b>
                  <small style={{ color: "var(--muted,#9ca3af)" }}>{metric.label}</small>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 16 }}>
            <b style={{ fontSize: 13 }}>Weekly consistency</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 8, marginTop: 9 }}>
              {insights.activity.weekly.map(week => {
                const max = Math.max(1, ...insights.activity.weekly.map(item => item.completedTasks));
                return (
                  <div key={week.weekStart} title={`${week.weekStart}: ${week.completedTasks} completed`} style={{ textAlign: "center" }}>
                    <div style={{ height: 42, display: "flex", alignItems: "end", background: "var(--border,rgba(148,163,184,.12))", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: "100%", height: `${Math.max(4, week.completedTasks / max * 100)}%`, background: "var(--accent,#8b5cf6)" }}/>
                    </div>
                    <small style={{ color: "var(--muted,#9ca3af)", fontSize: 9 }}>{new Date(week.weekStart + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>
                    <b style={{ display: "block", fontSize: 11 }}>{week.completedTasks}</b>
                  </div>
                );
              })}
            </div>
          </div>

          {!insights.hasActivity ? (
            <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13, margin: "0 0 16px" }}>
              No completed learning activity has been saved yet. Complete a roadmap task and your activity trends will appear here.
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            <div style={{ border: "1px solid var(--border,rgba(148,163,184,.18))", borderRadius: 10, padding: 12 }}>
              <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><Target size={15}/> Active learning goals</b>
              {insights.goals.length ? insights.goals.map(goal => (
                <div key={goal.id} style={{ marginTop: 8, fontSize: 12 }}>
                  <b>{goal.title}</b>
                  <small style={{ display: "block", color: "var(--muted,#9ca3af)" }}>
                    Priority {goal.priority}{goal.daysUntilTarget === null ? "" : ` · ${goal.daysUntilTarget} days to target`}
                  </small>
                </div>
              )) : <small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 8 }}>No active goals saved.</small>}
            </div>
            <div style={{ border: "1px solid var(--border,rgba(148,163,184,.18))", borderRadius: 10, padding: 12 }}>
              <b style={{ display: "block", fontSize: 13 }}>Learning preferences</b>
              {insights.preferences ? (
                <small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 8 }}>
                  {insights.preferences.learning_pace} pace · {insights.preferences.weekly_minutes} minutes/week · {insights.preferences.language_code}
                </small>
              ) : <small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 8 }}>No learning preferences saved yet.</small>}
            </div>
          </div>

          {!insights.roadmap.pathId ? (
            <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13 }}>
              {insights.emptyState.needsGoal ? "Add a learning goal to create your first roadmap." : "Create a roadmap from one of your saved goals to see phase insights."}
            </p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>{insights.roadmap.title}</b>
                <span style={{ color: "var(--muted,#9ca3af)", fontSize: 12 }}>{insights.roadmap.progressPercent}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 20, background: "var(--border,rgba(148,163,184,.2))", overflow: "hidden", marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${insights.roadmap.progressPercent}%`, background: "var(--accent,#8b5cf6)", borderRadius: 20 }}/>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 18 }}>
                {insights.roadmap.phases.map(phase => (
                  <div key={phase.name} style={{ border: "1px solid var(--border,rgba(148,163,184,.18))", borderRadius: 10, padding: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                      <b>{phase.name}</b><span style={{ color: "var(--muted,#9ca3af)" }}>{phase.progressPercent}%</span>
                    </div>
                    <small style={{ display: "block", color: "var(--muted,#9ca3af)", margin: "4px 0 7px" }}>
                      Days {phase.firstDay}–{phase.lastDay} · {phase.completedTasks}/{phase.totalTasks} tasks
                    </small>
                    <div style={{ height: 5, borderRadius: 20, background: "var(--border,rgba(148,163,184,.2))", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${phase.progressPercent}%`, background: "var(--accent,#8b5cf6)" }}/>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border,rgba(148,163,184,.2))", paddingTop: 14 }}>
                <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, marginBottom: 9 }}>
                  <Target size={15}/> Next tasks from your saved roadmap
                </b>
                {insights.roadmap.nextTasks.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {insights.roadmap.nextTasks.slice(0, 3).map(task => (
                      <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                        <span><b>Day {task.day}:</b> {task.title.replace(/^Day \d+: /, "")}</span>
                        <small style={{ color: "var(--muted,#9ca3af)", whiteSpace: "nowrap" }}>{task.status.replaceAll("_", " ")}</small>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13 }}>All tasks in this roadmap are completed.</p>}
              </div>
            </>
          )}

          <div style={{ borderTop: "1px solid var(--border,rgba(148,163,184,.2))", paddingTop: 14, marginTop: 16 }}>
            <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
              <Target size={15}/> Adaptive recommendations
            </b>
            <small style={{ display: "block", color: "var(--muted,#9ca3af)", margin: "4px 0 10px" }}>
              {recommendations?.source === "gemini" ? "AI-ranked using your saved learning context." : "Grounded suggestions from your saved roadmap. AI may be unavailable."}
            </small>
            {recommendations?.recommendations?.length ? recommendations.recommendations.map(item => (
              <div key={item.candidateId} style={{ border: "1px solid var(--border,rgba(148,163,184,.18))", borderRadius: 10, padding: 12, marginTop: 8 }}>
                <b style={{ fontSize: 13 }}>{item.title}</b>
                <p style={{ color: "var(--muted,#9ca3af)", fontSize: 12, margin: "5px 0 10px" }}>{item.reason}</p>
                <small style={{ color: "var(--muted,#9ca3af)" }}>About {item.estimatedMinutes} min · Priority {item.priority}</small>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                  <button className="text-btn" type="button" disabled={recommendationBusy} onClick={() => void respondToRecommendation(item.candidateId, "accept")}>Accept</button>
                  <button className="text-btn" type="button" disabled={recommendationBusy} onClick={() => void respondToRecommendation(item.candidateId, "helpful")}>Helpful</button>
                  <button className="text-btn" type="button" disabled={recommendationBusy} onClick={() => void respondToRecommendation(item.candidateId, "dismissed")}>Dismiss</button>
                </div>
              </div>
            )) : <p style={{ color: "var(--muted,#9ca3af)", fontSize: 12 }}>{recommendations?.message ?? "No recommendations available yet."}</p>}
            {recommendationMessage ? <p role="status" style={{ color: "var(--muted,#9ca3af)", fontSize: 12 }}>{recommendationMessage}</p> : null}
          </div>

          <p style={{ color: "var(--muted,#9ca3af)", fontSize: 11, margin: "14px 0 0" }}>
            Data source: Supabase · Updated {new Date(insights.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </section>
  );
}
