"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "../actions/auth";
import WorkspaceGoalsPanel from "./workspace-goals";
import WorkspaceProfilePanel from "./workspace-profile";
import AiTutorPanel from "./ai-tutor-panel";
import LearnerInsightsPanel from "./learner-insights-panel";
import { neuralPathApi, type ApiPath, type ApiPathItem, type WorkspaceDashboard } from "../../lib/api/client";

type Tab = "overview" | "roadmap" | "ai";

export default function Home() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [activeDay, setActiveDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const next = await neuralPathApi.getDashboard();
    setDashboard(next);
    const selected = next.paths.find(path => path.id === selectedPathId)
      ?? next.paths.find(path => path.status === "active")
      ?? next.paths[0];
    setSelectedPathId(selected?.id ?? "");
  }, [selectedPathId]);

  useEffect(() => {
    let mounted = true;
    neuralPathApi.getDashboard()
      .then(data => {
        if (!mounted) return;
        setDashboard(data);
        const selected = data.paths.find(path => path.status === "active") ?? data.paths[0];
        setSelectedPathId(selected?.id ?? "");
      })
      .catch(cause => { if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load your workspace."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selectedPath: ApiPath | undefined = dashboard?.paths.find(path => path.id === selectedPathId);
  const items = useMemo(() => [...(selectedPath?.items ?? [])].sort((a,b) => a.position-b.position), [selectedPath]);
  const days = useMemo(() => Array.from(new Set(items.map(item => Math.floor(item.position / 4) + 1))), [items]);
  const dayItems = items.filter(item => Math.floor(item.position / 4) + 1 === activeDay);
  const completed = items.filter(item => item.progress === "completed" || item.status === "completed").length;

  async function generate(goalId: string) {
    setGenerating(true); setError(""); setNotice("");
    try {
      const path = await neuralPathApi.bootstrapPath(goalId);
      setSelectedPathId(path.id);
      setNotice("Your personalized learning path has been saved.");
      await refresh();
      setTab("roadmap");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI roadmap generation failed. Please try again.");
    } finally { setGenerating(false); }
  }

  async function toggle(item: ApiPathItem) {
    const nextStatus = item.progress === "completed" || item.status === "completed" ? "in_progress" : "completed";
    setError(""); setNotice("");
    try {
      await neuralPathApi.saveProgress({ path_item_id: item.id, status: nextStatus });
      await refresh();
      setNotice("Progress saved to your account.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save progress.");
    }
  }

  if (loading) return <main className="min-h-screen grid place-items-center p-6"><p>Loading your saved NeuralPath workspace…</p></main>;

  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div><strong className="text-xl">NeuralPath</strong><p className="text-xs text-slate-400">Your AI-personalized learning workspace</p></div>
      <nav className="flex flex-wrap gap-2" aria-label="Workspace navigation">
        <button className="rounded-lg px-3 py-2 bg-white/10" onClick={() => setTab("overview")}>Overview</button>
        <button className="rounded-lg px-3 py-2 bg-white/10" onClick={() => setTab("roadmap")}>Learning path</button>
        <button className="rounded-lg px-3 py-2 bg-white/10" onClick={() => setTab("ai")}>AI tutor</button>
        <form action={signOut}><button className="rounded-lg px-3 py-2 border border-white/20">Sign out</button></form>
      </nav>
    </header>
    <div className="max-w-7xl mx-auto p-5 md:p-8 space-y-6">
      {error && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-4 text-emerald-200">{notice}</div>}
      {tab === "overview" && <>
        <WorkspaceGoalsPanel />
        <WorkspaceProfilePanel />
        <LearnerInsightsPanel />
        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Learning goals" value={dashboard?.stats.totalGoals ?? 0} />
          <Metric label="Saved learning paths" value={dashboard?.stats.totalPaths ?? 0} />
          <Metric label="Completed tasks" value={dashboard?.stats.completedItems ?? 0} />
          <Metric label="Progress" value={`${dashboard?.stats.progressPercent ?? 0}%`} />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h1 className="text-2xl font-semibold">Generate a learning path from your goal</h1>
          <p className="text-slate-300">The backend uses your saved goal, learner profile, experience and study schedule to request a real AI-generated curriculum. It is saved to your account before appearing here.</p>
          {dashboard?.goals.length ? dashboard.goals.map(goal => <div key={goal.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div><h2 className="font-medium">{goal.title}</h2><p className="text-sm text-slate-400">{goal.category} · {goal.current_level} · {goal.weekly_minutes} minutes/week</p></div>
            <button disabled={generating} onClick={() => generate(goal.id)} className="rounded-lg bg-indigo-500 px-4 py-2 font-medium disabled:opacity-50">{generating ? "Generating…" : "Generate / open path"}</button>
          </div>) : <p className="text-slate-400">Create a learning goal first. Your saved goals will appear here.</p>}
        </section>
      </>}
      {tab === "roadmap" && <section className="space-y-5">
        <div><h1 className="text-3xl font-semibold">Your learning path</h1><p className="text-slate-400">Every topic and task below is loaded from your saved learning path API.</p></div>
        {dashboard?.paths.length ? <div className="flex flex-wrap gap-2">{dashboard.paths.map(path => <button key={path.id} onClick={() => {setSelectedPathId(path.id);setActiveDay(1);}} className={`rounded-lg px-3 py-2 border ${path.id === selectedPathId ? "border-indigo-400 bg-indigo-500/20" : "border-white/15"}`}>{path.title}</button>)}</div> : <p className="rounded-xl border border-white/10 p-5 text-slate-300">No saved learning path yet. Generate one from an active goal in Overview.</p>}
        {selectedPath && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-medium">{selectedPath.title}</h2><p className="text-sm text-slate-400">{completed} of {items.length} tasks completed</p></div><span className="text-lg font-semibold">{items.length ? Math.round(completed/items.length*100) : 0}%</span></div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-indigo-400" style={{width:`${items.length ? completed/items.length*100 : 0}%`}} /></div>
          <div className="flex flex-wrap gap-2">{days.map(day => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-lg px-3 py-2 ${activeDay === day ? "bg-indigo-500" : "bg-white/10"}`}>Day {day}</button>)}</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <h3 className="text-xl font-semibold">Day {activeDay}</h3>
            {dayItems.length ? dayItems.map(item => <article key={item.id} className="flex gap-3 border-t border-white/10 pt-4">
              <input type="checkbox" aria-label={`Complete ${item.title}`} checked={item.progress === "completed" || item.status === "completed"} onChange={() => toggle(item)} />
              <div><h4 className="font-medium">{item.title}</h4><p className="text-sm text-slate-300 whitespace-pre-wrap">{item.description}</p></div>
            </article>) : <p className="text-slate-400">No saved tasks for this day.</p>}
          </div>
        </>}
      </section>}
      {tab === "ai" && <section className="space-y-4"><h1 className="text-3xl font-semibold">AI tutor</h1><AiTutorPanel /></section>}
    </div>
  </main>;
}

function Metric({label,value}:{label:string;value:string|number}) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
