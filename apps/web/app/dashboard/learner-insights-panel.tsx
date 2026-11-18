"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, CalendarClock, CheckCircle2, Flame, LoaderCircle, RefreshCw, Target } from "lucide-react";
import { neuralPathApi, type LearnerInsights } from "../../lib/api/client";

export default function LearnerInsightsPanel() {
  const [insights, setInsights] = useState<LearnerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInsights(await neuralPathApi.getLearnerInsights());
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
                        <span><b>Day {task.day}:</b> {task.title.replace(/^Day \\d+: /, "")}</span>
                        <small style={{ color: "var(--muted,#9ca3af)", whiteSpace: "nowrap" }}>{task.status.replaceAll("_", " ")}</small>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13 }}>All tasks in this roadmap are completed.</p>}
              </div>
            </>
          )}

          <p style={{ color: "var(--muted,#9ca3af)", fontSize: 11, margin: "14px 0 0" }}>
            Data source: Supabase · Updated {new Date(insights.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </section>
  );
}
