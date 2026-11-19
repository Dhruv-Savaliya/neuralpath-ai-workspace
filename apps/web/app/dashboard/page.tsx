"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { signOut } from "../actions/auth";
import {
  Activity, ArrowRight, ArrowUpRight, Award, BookOpen, BrainCircuit, CalendarDays,
  CheckCircle2, ChevronLeft, ChevronRight, Circle,
  Flame, GraduationCap, LayoutDashboard, LoaderCircle, LogOut, Menu,
  Plus, RefreshCw, Rocket, Sparkles, Target, Trophy, UserRound, X, Zap,
} from "lucide-react";
import WorkspaceGoalsPanel from "./workspace-goals";
import WorkspaceProfilePanel from "./workspace-profile";
import AiTutorPanel from "./ai-tutor-panel";
import LearnerInsightsPanel from "./learner-insights-panel";
import {
  neuralPathApi,
  type ApiGoal,
  type ApiPath,
  type ApiPathItem,
  type LearnerInsights,
  type WorkspaceDashboard,
} from "../../lib/api/client";

type Tab = "overview" | "roadmap" | "insights" | "goals" | "profile" | "achievements" | "ai";
const navItems: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "roadmap", label: "Learning path", icon: BookOpen },
  { id: "insights", label: "Learning insights", icon: Activity },
  { id: "goals", label: "Learning goals", icon: Target },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "ai", label: "AI tutor & library", icon: BrainCircuit },
];

const phaseTones = ["violet", "blue", "cyan", "pink", "orange", "green", "gold"];

function isDone(item: ApiPathItem) {
  return item.progress === "completed" || item.status === "completed";
}

function getDay(item: ApiPathItem) {
  return Math.floor(item.position / 4) + 1;
}

function makePhases(items: ApiPathItem[]) {
  if (!items.length) return [];
  const maxDay = Math.max(...items.map(getDay));
  const phases = [];
  for (let firstDay = 1; firstDay <= maxDay; firstDay += 7) {
    const lastDay = Math.min(firstDay + 6, maxDay);
    const phaseItems = items.filter(item => getDay(item) >= firstDay && getDay(item) <= lastDay);
    const firstTopic = phaseItems[0]?.title
      .replace(/^Day\s+\d+\s*:\s*/i, "")
      .replace(/^(lesson|exercise|resource|project)\s*[—–:-]\s*/i, "")
      .trim();
    const completed = phaseItems.filter(isDone).length;
    phases.push({
      name: firstTopic || `Learning days ${firstDay}–${lastDay}`,
      firstDay,
      lastDay,
      completed,
      total: phaseItems.length,
      percent: phaseItems.length ? Math.round(completed / phaseItems.length * 100) : 0,
    });
  }
  return phases;
}

function friendlyName(profile: WorkspaceDashboard["profile"]) {
  return profile?.display_name?.trim() || "Learner";
}

function formatDate() {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

export default function Home() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
  const [insights, setInsights] = useState<LearnerInsights | null>(null);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [activeDay, setActiveDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingItem, setSavingItem] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const refresh = useCallback(async () => {
    const next = await neuralPathApi.getDashboard();
    setDashboard(next);
    setSelectedPathId(current => {
      const selected = next.paths.find(path => path.id === current)
        ?? next.paths.find(path => path.status === "active")
        ?? next.paths[0];
      return selected?.id ?? "";
    });
    try {
      setInsights(await neuralPathApi.getLearnerInsights());
    } catch {
      setInsights(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      neuralPathApi.getDashboard(),
      neuralPathApi.getLearnerInsights().catch(() => null),
    ]).then(([data, nextInsights]) => {
      if (!mounted) return;
      setDashboard(data);
      setInsights(nextInsights);
      const selected = data.paths.find(path => path.status === "active") ?? data.paths[0];
      setSelectedPathId(selected?.id ?? "");
    }).catch(cause => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load your learning workspace.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const selectedPath: ApiPath | undefined = dashboard?.paths.find(path => path.id === selectedPathId);
  const selectedGoal: ApiGoal | undefined = dashboard?.goals.find(goal => goal.id === selectedPath?.goal_id);
  const items = useMemo(() => [...(selectedPath?.items ?? [])].sort((a, b) => a.position - b.position), [selectedPath]);
  const days = useMemo(() => Array.from(new Set(items.map(getDay))), [items]);
  const phases = useMemo(() => makePhases(items), [items]);
  const dayItems = items.filter(item => getDay(item) === activeDay);
  const completed = items.filter(isDone).length;
  const progress = items.length ? Math.round(completed / items.length * 100) : 0;
  const nextTask = items.find(item => !isDone(item));
  const weekly = insights?.activity.weekly ?? [];
  const weeklyMax = Math.max(1, ...weekly.map(week => week.completedTasks));
  const stats = dashboard?.stats;

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refresh();
      setNotice("Your workspace is up to date.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh your workspace.");
    } finally {
      setRefreshing(false);
    }
  }


  async function toggle(item: ApiPathItem) {
    setSavingItem(item.id);
    setError("");
    setNotice("");
    try {
      await neuralPathApi.saveProgress({
        path_item_id: item.id,
        status: isDone(item) ? "in_progress" : "completed",
      });
      await refresh();
      setNotice(isDone(item) ? "Progress updated." : "Task completion saved to your account.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save task progress.");
    } finally {
      setSavingItem("");
    }
  }

  function changeTab(next: Tab) {
    setTab(next);
    setMobileNavOpen(false);
    setError("");
    setNotice("");
  }

  if (loading) return (
    <main className="np-loading np-loading-screen" aria-busy="true" aria-label="Loading your learning workspace">
      <div className="np-skeleton-brand"><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line"/></div>
      <div className="np-skeleton-heading"><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line title"/><span className="np-skeleton np-skeleton-line"/></div>
      <div className="np-skeleton-grid">{Array.from({length:4},(_,i)=><div className="np-skeleton-card" key={i}><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line"/></div>)}</div>
      <div className="np-skeleton-panel"><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line title"/><span className="np-skeleton np-skeleton-block"/></div>
      <p className="np-loading-caption"><LoaderCircle className="np-spin" size={16}/> Preparing your learning workspace…</p>
    </main>
  );
  if (!dashboard) return (
    <main className="np-loading np-failure-screen">
      <div className="np-failure-icon"><Activity size={26}/></div>
      <span className="np-eyebrow"><span/> WORKSPACE CONNECTION</span>
      <h1>We couldn&apos;t load your workspace.</h1>
      <p>{error || "Your learning data is safe. Check your connection and try again."}</p>
      <button className="np-primary" onClick={() => { setLoading(true); setError(""); void refresh().catch(cause => setError(cause instanceof Error ? cause.message : "Unable to load your workspace.")).finally(() => setLoading(false)); }}>
        <RefreshCw size={15}/> Try again
      </button>
      <a href="/auth/sign-in" className="np-text-action">Return to sign in <ArrowRight size={14}/></a>
    </main>
  );

  return (
    <motion.main className="np-shell" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}>
      {mobileNavOpen ? <button className="np-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}/> : null}
      <aside className={`np-sidebar ${mobileNavOpen ? "np-sidebar-open" : ""}`}>
        <div className="np-brand">
          <div className="np-brand-mark"><BrainCircuit size={21}/></div>
          <div><b>neural<span>path</span></b><small>YOUR LEARNING OS</small></div>
          <button className="np-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button>
        </div>
        <div className="np-nav-label">WORKSPACE</div>
        <nav className="np-nav" aria-label="Main navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`np-nav-link ${tab === item.id ? "active" : ""}`} onClick={() => changeTab(item.id)}>
              <Icon size={17}/><span>{item.label}</span>
              {item.id === "goals" && dashboard?.goals.length ? <small>{dashboard.goals.length}</small> : null}
            </button>;
          })}
        </nav>
        <div className="np-sidebar-divider"/>
        <div className="np-nav-label">YOUR CURRENT PATH</div>
        {selectedPath ? (
          <div className="np-side-path">
            <div className="np-side-path-title"><span className="np-live-dot"/><span>{selectedPath.title}</span></div>
            <div className="np-progress-track"><i style={{ width: `${progress}%` }}/></div>
            <div className="np-side-progress-label"><span>{completed} of {items.length} tasks</span><b>{progress}%</b></div>
            {phases.map((phase, index) => <button key={phase.firstDay} className="np-phase-nav" onClick={() => { setActiveDay(phase.firstDay); changeTab("roadmap"); }}>
              <span className={`np-phase-dot ${phaseTones[index % phaseTones.length]}`}/><span>{phase.name}</span><small>{String(phase.firstDay).padStart(2, "0")}–{String(phase.lastDay).padStart(2, "0")}</small>
            </button>)}
          </div>
        ) : <p className="np-sidebar-empty">Your personalized path will appear here after you create one.</p>}
        <div className="np-sidebar-bottom">
          <div className="np-streak-card"><div><Flame size={17}/></div><span><b>{stats?.currentStreak ?? 0} day streak</b><small>Consistency compounds</small></span><Sparkles size={16}/></div>
          <div className="np-user-row"><div className="np-avatar">{friendlyName(dashboard?.profile ?? null).slice(0, 1).toUpperCase()}</div><div><b>{friendlyName(dashboard?.profile ?? null)}</b><small>{dashboard?.profile?.profession?.replaceAll("_", " ") || "Learner"}</small></div></div>
          <form action={signOut}><button className="np-signout"><LogOut size={15}/> Sign out</button></form>
        </div>
      </aside>

      <section className="np-main">
        <header className="np-topbar">
          <div className="np-top-left">
            <button className="np-mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={20}/></button>
            <div className="np-breadcrumb">Workspace <ChevronRight size={14}/><b>{navItems.find(item => item.id === tab)?.label}</b></div>
          </div>
          <div className="np-top-actions">
            <span className="np-date"><CalendarDays size={14}/>{formatDate()}</span>
            <span className="np-xp"><Zap size={14}/>{(stats?.xp ?? 0).toLocaleString()} <small>XP</small></span>
            <button className="np-refresh" onClick={() => void handleRefresh()} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw size={16} className={refreshing ? "np-spin" : ""}/></button>
            <button className="np-top-avatar" onClick={() => changeTab("profile")} aria-label="Open profile">{friendlyName(dashboard?.profile ?? null).slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="np-content">
          {error ? <div className="np-alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15}/></button></div> : null}
          {notice ? <div className="np-alert success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div> : null}

          {tab === "overview" ? (
            <>
              <div className="np-welcome">
                <div><div className="np-eyebrow"><span/> YOUR PERSONAL LEARNING SPACE</div>
                  <h1>Welcome back, <em>{friendlyName(dashboard?.profile ?? null).split(" ")[0]}.</em></h1>
                  <p>Your goals, progress and next steps — all in one place. Make today count.</p>
                </div>
                <div className="np-today-chip"><small>TODAY</small><b>{formatDate().split(",")[0]}</b><span>{formatDate().split(",").slice(1).join(",").trim()}</span></div>
              </div>

              <section className="np-hero">
                <div className="np-hero-grid"/>
                <div className="np-hero-copy">
                  <div className="np-hero-kicker"><Sparkles size={14}/> YOUR NEXT STEP</div>
                  <h2>{nextTask ? nextTask.title.replace(/^Day\s+\d+\s*:\s*/i, "") : selectedPath ? "Your path is complete. Celebrate your progress." : "Start with a goal that matters to you."}</h2>
                  <p>{nextTask ? nextTask.description : selectedPath ? "You have completed every saved task in this learning path." : "NeuralPath will turn your ambition into a practical, personalized learning journey."}</p>
                  <div className="np-hero-meta">
                    {selectedPath ? <span><BookOpen size={14}/>{selectedPath.title}</span> : <span><Target size={14}/>{dashboard?.goals.length ?? 0} saved goals</span>}
                    {nextTask ? <span><CalendarDays size={14}/>Day {getDay(nextTask)}</span> : null}
                    {nextTask ? <span><Circle size={12}/>Not started</span> : null}
                  </div>
                  <button className="np-primary" onClick={() => selectedPath ? (setActiveDay(nextTask ? getDay(nextTask) : 1), changeTab("roadmap")) : changeTab("goals")}>
                    {selectedPath ? "Continue learning" : "Create your first goal"} <ArrowUpRight size={16}/>
                  </button>
                </div>
                <div className="np-hero-art" aria-hidden="true"><div className="np-orbit one"/><div className="np-orbit two"/><div className="np-orb-core"><BrainCircuit size={47}/></div><span className="np-float f1"><Target size={13}/> FOCUS</span><span className="np-float f2"><Sparkles size={13}/> GROW</span></div>
              </section>

              <div className="np-kpi-grid">
                <Kpi icon={Target} label="Learning goals" value={stats?.totalGoals ?? 0} detail={`${stats?.activeGoals ?? 0} active goals`} tone="violet"/>
                <Kpi icon={BookOpen} label="Learning paths" value={stats?.totalPaths ?? 0} detail="Saved to your workspace" tone="blue"/>
                <Kpi icon={CheckCircle2} label="Tasks completed" value={stats?.completedItems ?? 0} detail={`${stats?.completedThisWeek ?? 0} this week`} tone="green"/>
                <Kpi icon={Activity} label="Overall progress" value={`${stats?.progressPercent ?? 0}%`} detail={`${stats?.completedDays ?? 0} full days completed`} tone="cyan"/>
                <Kpi icon={Flame} label="Current streak" value={`${stats?.currentStreak ?? 0} days`} detail="Keep your momentum alive" tone="orange"/>
                <Kpi icon={Zap} label="Experience points" value={(stats?.xp ?? 0).toLocaleString()} detail="Earn XP as you complete tasks" tone="gold"/>
                <Kpi icon={CalendarDays} label="This week" value={stats?.completedThisWeek ?? 0} detail="Tasks completed in 7 days" tone="pink"/>
                <Kpi icon={Award} label="Roadmap days" value={stats?.completedDays ?? 0} detail="Four tasks completed in a day" tone="violet"/>
              </div>

              <div className="np-dashboard-grid">
                <section className="np-panel np-activity-panel">
                  <div className="np-panel-head"><div><small>YOUR CONSISTENCY</small><h3>Learning activity</h3></div><span className="np-source-tag"><Activity size={13}/> Live data</span></div>
                  {weekly.length ? <div className="np-chart" aria-label="Weekly completed learning tasks">
                    {weekly.map(week => <div className="np-chart-col" key={week.weekStart} title={`${week.completedTasks} completed tasks`}>
                      <div className="np-chart-bar-wrap"><i style={{ height: `${Math.max(5, week.completedTasks / weeklyMax * 100)}%` }}/></div>
                      <b>{week.completedTasks}</b><small>{new Date(week.weekStart + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>
                    </div>)}
                  </div> : <div className="np-empty-chart"><Activity size={22}/><b>Your activity will appear here</b><span>Complete a roadmap task to start tracking your weekly learning consistency.</span></div>}
                </section>
                <section className="np-panel np-progress-panel">
                  <div className="np-panel-head"><div><small>YOUR CURRENT JOURNEY</small><h3>Path progress</h3></div><button className="np-text-action" onClick={() => changeTab("roadmap")}>View path <ArrowUpRight size={14}/></button></div>
                  {selectedPath ? <>
                    <div className="np-progress-title"><b>{selectedPath.title}</b><strong>{progress}%</strong></div>
                    <div className="np-progress-track large"><i style={{ width: `${progress}%` }}/></div>
                    <div className="np-progress-foot"><span>{completed} of {items.length} tasks completed</span><span>{items.length - completed} remaining</span></div>
                    <div className="np-next-task"><span className="np-next-icon"><Rocket size={17}/></span><div><small>NEXT UP</small><b>{nextTask?.title ?? "All tasks completed"}</b><span>{nextTask ? `Day ${getDay(nextTask)} · Continue your learning path` : "Excellent work — your path is complete."}</span></div></div>
                  </> : <div className="np-empty-state"><BookOpen size={23}/><b>No learning path yet</b><span>Create a goal and generate your personalized curriculum.</span><button className="np-primary small" onClick={() => changeTab("goals")}>Explore goals <ArrowRight size={14}/></button></div>}
                </section>
              </div>

              <section className="np-panel np-phases-panel">
                <div className="np-panel-head"><div><small>THE BIG PICTURE</small><h3>Your personalized learning journey</h3><p>Curriculum phases are generated from the topics in your saved roadmap.</p></div><button className="np-text-action" onClick={() => changeTab("roadmap")}>Open roadmap <ArrowUpRight size={14}/></button></div>
                {phases.length ? <div className="np-phase-grid">{phases.map((phase, index) => <button key={phase.firstDay} className="np-phase-card" onClick={() => { setActiveDay(phase.firstDay); changeTab("roadmap"); }}>
                  <div className={`np-phase-icon ${phaseTones[index % phaseTones.length]}`}>{index === phases.length - 1 ? <Trophy size={17}/> : <GraduationCap size={17}/>}</div>
                  <div className="np-phase-card-copy"><div><b>{phase.name}</b><strong>{phase.percent}%</strong></div><small>Days {phase.firstDay}–{phase.lastDay} · {phase.completed}/{phase.total} tasks</small><div className="np-progress-track"><i style={{ width: `${phase.percent}%` }}/></div></div><ChevronRight size={15}/>
                </button>)}</div> : <p className="np-muted">Generate a learning path to see your personalized curriculum phases.</p>}
              </section>

              <div className="np-dashboard-grid lower">
                <section className="np-panel">
                  <div className="np-panel-head"><div><small>YOUR PRIORITIES</small><h3>Learning goals</h3></div><button className="np-text-action" onClick={() => changeTab("goals")}>Manage <ArrowUpRight size={14}/></button></div>
                  {dashboard?.goals.length ? <div className="np-goal-list">{dashboard.goals.slice(0, 4).map(goal => <div className="np-goal-row" key={goal.id}><span><Target size={16}/></span><div><b>{goal.title}</b><small>{goal.category} · {goal.status}</small></div><ChevronRight size={15}/></div>)}</div> : <div className="np-empty-state compact"><Target size={21}/><b>Nothing on your goal list yet</b><span>Add your first goal to personalize NeuralPath.</span><button className="np-text-action" onClick={() => changeTab("goals")}>Add a goal <Plus size={14}/></button></div>}
                </section>
                <section className="np-panel">
                  <div className="np-panel-head"><div><small>PERSONALIZED FOR YOU</small><h3>Learning preferences</h3></div><button className="np-text-action" onClick={() => changeTab("profile")}>Edit profile <ArrowUpRight size={14}/></button></div>
                  <div className="np-preference-grid"><Preference label="Profession" value={dashboard?.profile?.profession?.replaceAll("_", " ") || "Not set"}/><Preference label="Experience" value={dashboard?.profile?.experience_level?.replaceAll("_", " ") || "Not set"}/><Preference label="Learning pace" value={insights?.preferences?.learning_pace || "Not set"}/><Preference label="Weekly study time" value={insights?.preferences ? `${insights.preferences.weekly_minutes} min` : "Not set"}/></div>
                  <div className="np-quote"><Sparkles size={15}/><span>Small, consistent steps turn ambitious goals into real skills.</span></div>
                </section>
              </div>
            </>
          ) : null}

          {tab === "roadmap" ? (
            <section className="np-page-section">
              <PageHeading eyebrow="LEARN · PRACTISE · PROGRESS" title="Your learning path" subtitle="A personalized roadmap built from your saved goal and learning preferences."/>
              {dashboard?.paths.length ? <div className="np-path-switcher">{dashboard.paths.map(path => <button key={path.id} className={path.id === selectedPathId ? "selected" : ""} onClick={() => { setSelectedPathId(path.id); setActiveDay(1); }}>{path.title}</button>)}</div> : null}
              {!selectedPath ? <div className="np-panel np-empty-state"><BookOpen size={28}/><b>Your learning journey starts here</b><span>Save a learning goal, then generate your personalized path.</span><button className="np-primary" onClick={() => changeTab("goals")}>Create a goal <ArrowRight size={15}/></button></div> : <>
                <div className="np-roadmap-summary"><div><small>YOUR SELECTED GOAL</small><h2>{selectedGoal?.title || selectedPath.title}</h2><p>{selectedGoal?.category || "Personalized learning"} · {selectedPath.title}</p></div><div><b>{progress}%</b><small>complete</small></div></div>
                <div className="np-roadmap-layout">
                  <aside className="np-day-picker"><div className="np-panel-head"><div><small>CURRICULUM</small><h3>Choose a day</h3></div><span>{completed}/{items.length}</span></div>
                    {phases.map((phase, index) => <div className="np-day-phase" key={phase.firstDay}><b><i className={`np-phase-dot ${phaseTones[index % phaseTones.length]}`}/>{phase.name}</b><div>{days.filter(day => day >= phase.firstDay && day <= phase.lastDay).map(day => <button key={day} className={`${activeDay === day ? "active" : ""} ${items.filter(item => getDay(item) === day).every(isDone) ? "done" : ""}`} onClick={() => setActiveDay(day)}>{day}</button>)}</div></div>)}
                  </aside>
                  <section className="np-panel np-day-detail">
                    <div className="np-day-head"><div><small>DAY {String(activeDay).padStart(2, "0")} · {phases.find(phase => activeDay >= phase.firstDay && activeDay <= phase.lastDay)?.name}</small><h2>{dayItems[0]?.title.replace(/^Day\s+\d+\s*:\s*/i, "") || `Day ${activeDay}`}</h2><p>{dayItems[0]?.description || "Your saved learning tasks for this day."}</p></div><span className={dayItems.length && dayItems.every(isDone) ? "done" : ""}>{dayItems.length && dayItems.every(isDone) ? "Completed" : "In progress"}</span></div>
                    <div className="np-task-list">{dayItems.length ? dayItems.map((item, index) => <article className={`np-task ${isDone(item) ? "completed" : ""}`} key={item.id}>
                      <button disabled={savingItem === item.id} aria-label={isDone(item) ? "Mark task incomplete" : "Mark task complete"} onClick={() => void toggle(item)}>{savingItem === item.id ? <LoaderCircle size={16} className="np-spin"/> : isDone(item) ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button>
                      <div><small>{(item as ApiPathItem & { item_type?: string }).item_type?.replaceAll("_", " ") || `TASK ${index + 1}`}</small><b>{item.title.replace(/^Day\s+\d+\s*:\s*/i, "")}</b><p>{item.description}</p></div>
                    </article>) : <div className="np-empty-state compact"><BookOpen size={22}/><b>No tasks for this day</b><span>Choose another day from your curriculum, or refresh your learning path.</span><button className="np-text-action" onClick={() => void handleRefresh()} disabled={refreshing}>Refresh path <RefreshCw size={13}/></button></div>}</div>
                    <div className="np-day-footer"><button className="np-secondary" disabled={!days.length || activeDay <= Math.min(...days)} onClick={() => setActiveDay(day => Math.max(Math.min(...days), day - 1))}><ChevronLeft size={15}/> Previous</button><span>{dayItems.filter(isDone).length}/{dayItems.length} tasks complete</span><button className="np-primary small" disabled={!days.length || activeDay >= Math.max(...days)} onClick={() => setActiveDay(day => Math.min(Math.max(...days), day + 1))}>Next day <ChevronRight size={15}/></button></div>
                  </section>
                </div>
              </>}
            </section>
          ) : null}

          {tab === "insights" ? <section className="np-page-section"><PageHeading eyebrow="YOUR LEARNING INTELLIGENCE" title="Learning insights" subtitle="Progress, consistency and adaptive recommendations grounded in your saved learning activity."/><LearnerInsightsPanel/></section> : null}
          {tab === "goals" ? <section className="np-page-section"><PageHeading eyebrow="YOUR DIRECTION" title="Learning goals" subtitle="Manage your ambitions and create a roadmap for each goal."/><WorkspaceGoalsPanel/></section> : null}
          {tab === "profile" ? <section className="np-page-section"><PageHeading eyebrow="YOUR LEARNING IDENTITY" title="Personalize your workspace" subtitle="Keep your learner profile current so your roadmap stays relevant."/><WorkspaceProfilePanel/></section> : null}
          {tab === "achievements" ? <section className="np-page-section"><PageHeading eyebrow="MILESTONES · EXPERIENCE · MOMENTUM" title="Your achievements" subtitle="A record of the progress saved to your account — no sample activity or browser-only XP."/><AchievementsPanel xp={stats?.xp ?? 0} completedTasks={stats?.completedItems ?? 0} completedDays={stats?.completedDays ?? 0} totalPaths={stats?.totalPaths ?? 0}/></section> : null}
          {tab === "ai" ? <section className="np-page-section"><PageHeading eyebrow="YOUR PERSONAL LEARNING ASSISTANT" title="AI tutor" subtitle="Ask questions grounded in your own learning notes and saved material."/><AiTutorPanel/></section> : null}

          <footer className="np-footer"><span>NEURALPATH <i>·</i> YOUR LEARNING OS</span><span>Built around your goals. Powered by your progress.</span></footer>
        </div>
      </section>
    </motion.main>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone }: { icon: typeof Target; label: string; value: string | number; detail: string; tone: string }) {
  return <article className="np-kpi"><span className={`np-kpi-icon ${tone}`}><Icon size={18}/></span><div><small>{label}</small><b>{value}</b><span>{detail}</span></div></article>;
}

function Preference({ label, value }: { label: string; value: string }) {
  return <div className="np-preference"><small>{label}</small><b>{value}</b></div>;
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="np-page-heading"><div className="np-eyebrow"><span/>{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>;
}

function AchievementsPanel({ xp, completedTasks, completedDays, totalPaths }: { xp: number; completedTasks: number; completedDays: number; totalPaths: number }) {
  const level = Math.floor(xp / 250) + 1;
  const levelProgress = xp % 250;
  const badges = [
    { title: "First steps", description: "Complete your first learning task", earned: completedTasks >= 1, icon: CheckCircle2 },
    { title: "Momentum builder", description: "Complete five full learning days", earned: completedDays >= 5, icon: Flame },
    { title: "Consistent learner", description: "Complete ten full learning days", earned: completedDays >= 10, icon: Activity },
    { title: "Dedicated practitioner", description: "Complete fifty learning tasks", earned: completedTasks >= 50, icon: GraduationCap },
    { title: "Path creator", description: "Save your first personalized learning path", earned: totalPaths >= 1, icon: BookOpen },
    { title: "Journey complete", description: "Complete all tasks in a learning path", earned: completedDays >= 45, icon: Trophy },
  ];
  const earned = badges.filter(badge => badge.earned).length;
  return <div className="np-achievements">
    <section className="np-reward-hero"><div className="np-level-orb"><small>LEVEL</small><b>{level}</b></div><div><small>YOUR LEARNING LEVEL</small><h2>{level < 3 ? "Curious explorer" : level < 6 ? "Hands-on builder" : level < 10 ? "Skilled practitioner" : "Master learner"}</h2><p>{xp.toLocaleString()} experience points earned from your saved progress.</p><div className="np-progress-track large"><i style={{ width: `${levelProgress / 250 * 100}%` }}/></div><small>{levelProgress} / 250 XP to level {level + 1}</small></div><div className="np-reward-total"><Zap size={18}/><b>{xp.toLocaleString()}</b><small>TOTAL XP</small></div></section>
    <section className="np-panel"><div className="np-panel-head"><div><small>UNLOCKED THROUGH REAL PROGRESS</small><h3>Achievement badges</h3></div><span className="np-source-tag"><Award size={13}/>{earned}/{badges.length} unlocked</span></div><div className="np-badge-grid">{badges.map(badge => { const Icon = badge.icon; return <article className={`np-badge ${badge.earned ? "earned" : ""}`} key={badge.title}><span><Icon size={20}/></span><div><b>{badge.title}</b><small>{badge.description}</small></div><strong>{badge.earned ? "Unlocked" : "Locked"}</strong></article>; })}</div></section>
  </div>;
}
