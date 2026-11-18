"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "../actions/auth";
import WorkspaceGoalsPanel from "./workspace-goals";
import WorkspaceProfilePanel from "./workspace-profile";
import AiTutorPanel from "./ai-tutor-panel";
import { neuralPathApi, type ApiPathItem, type WorkspaceDashboard } from "../../lib/api/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ArrowUpRight, Award, BookOpen, BrainCircuit, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Flame,
  Github, GraduationCap, LayoutDashboard, Lightbulb, LockKeyhole, Menu,
  Play, Rocket, Sparkles, Target, Trophy, X, Zap, ExternalLink, Star,
  ChartNoAxesCombined, type LucideIcon
} from "lucide-react";

type Task = { id: string; title: string; detail: string; minutes: number; xp: number };
type Day = { day: number; title: string; phase: string; focus: string; tasks: Task[]; resource: { label: string; url: string }; video: { label: string; url: string }; deliverable: string; quiz: string };
const phases = [
  { name: "Python foundations", range: "01—07", tone: "violet", icon: Code2 },
  { name: "Math & data", range: "08—12", tone: "blue", icon: ChartNoAxesCombined },
  { name: "Machine learning", range: "13—20", tone: "cyan", icon: Activity },
  { name: "Deep learning", range: "21—25", tone: "pink", icon: BrainCircuit },
  { name: "LLMs & GenAI", range: "26—32", tone: "orange", icon: Sparkles },
  { name: "AI application engineering", range: "33—38", tone: "green", icon: Rocket },
  { name: "Portfolio & shipping", range: "39—45", tone: "gold", icon: Trophy },
];
const topics = [
["Python setup & syntax","Variables, types, operators, input/output"],
["Control flow","Conditions, loops, debugging"],
["Core collections","Lists, tuples, sets, dictionaries"],
["Functions","Arguments, return values, scope, lambdas"],
["OOP essentials","Classes, objects, inheritance, composition"],
["Files & exceptions","Read/write files, JSON, error handling"],
["Python mini-project","Build a CLI expense tracker; Git basics"],
["Linear algebra essentials","Vectors, matrices, dot products"],
["Statistics & probability","Distributions, mean, variance, conditional probability"],
["NumPy","Arrays, broadcasting, vectorized operations"],
["Pandas","DataFrames, cleaning, filtering, groupby"],
["Data visualization","Matplotlib charts and exploratory analysis"],
["ML workflow","Problem framing, features, labels, train/test split"],
["Regression","Linear regression, loss, MAE and RMSE"],
["Classification","Logistic regression, precision, recall, F1"],
["Model evaluation","Cross-validation, confusion matrix, overfitting"],
["Preprocessing","Missing values, encoding, scaling, pipelines"],
["Tree models","Decision trees, random forests, feature importance"],
["Unsupervised learning","K-means, clustering, dimensionality reduction"],
["ML mini-project","Train and evaluate an expense-category model"],
["Neural network concepts","Perceptrons, layers, activations, gradients"],
["PyTorch tensors","Tensor shapes, operations, autograd"],
["Build a neural network","Modules, loss functions, optimizers"],
["Training loop","Batches, epochs, validation, checkpoints"],
["Deep learning mini-project","Train a small image or tabular classifier"],
["NLP foundations","Text cleaning, tokenization, embeddings"],
["Transformers","Attention, encoder/decoder, context windows"],
["LLM APIs","Structured outputs, retries, streaming, safety"],
["Prompt engineering","System prompts, few-shot, evaluation"],
["Embeddings","Similarity search, chunking, vector concepts"],
["Vector databases","Chroma/Qdrant concepts, metadata filters"],
["RAG fundamentals","Retrieval, context assembly, grounded answers"],
["AI service with FastAPI","Pydantic schemas, endpoints, async basics"],
["LangChain or LlamaIndex","Chains, retrievers, document loaders"],
["Build a RAG assistant","Ingest documents, retrieve, cite sources"],
["Tool calling & agents","Tools, planning loops, guardrails, human approval"],
["Persist AI app data","MongoDB/Postgres, user sessions, history"],
["Docker fundamentals","Images, containers, environment variables"],
["AI app integration","Connect Python API to a Next.js interface"],
["Capstone planning","Define BizDhan AI use case, data and success metrics"],
["BizDhan AI: ingestion","Expense records, receipt data, validation"],
["BizDhan AI: intelligence","Cash-flow insights, anomaly and category analysis"],
["BizDhan AI: RAG assistant","Grounded finance Q&A over user-owned records"],
["Quality & evaluation","Test cases, hallucination checks, latency and cost"],
["Deployment & observability","Deploy API, logs, rate limits, secrets"],
["Portfolio launch","README, demo, architecture diagram, interview story"],
];
const resources: [string, string][] = [
["Python tutorial","https://docs.python.org/3/tutorial/"],["Kaggle Python","https://www.kaggle.com/learn/python"],["Kaggle Pandas","https://www.kaggle.com/learn/pandas"],["Google ML Crash Course","https://developers.google.com/machine-learning/crash-course"],["scikit-learn user guide","https://scikit-learn.org/stable/user_guide.html"],["PyTorch tutorials","https://pytorch.org/tutorials/"],["Hugging Face LLM Course","https://huggingface.co/learn/llm-course/chapter1/1"],["DeepLearning.AI short courses","https://www.deeplearning.ai/short-courses/"],["FastAPI tutorial","https://fastapi.tiangolo.com/tutorial/"],["Docker getting started","https://docs.docker.com/get-started/"],["Next.js Learn","https://nextjs.org/learn"],["GitHub Skills","https://skills.github.com/"]
];
const videoLinks: [string, string][] = [
["Python for Beginners — freeCodeCamp","https://www.youtube.com/results?search_query=freecodecamp+python+for+beginners+full+course"],
["Python OOP — Corey Schafer","https://www.youtube.com/results?search_query=Corey+Schafer+Python+OOP"],
["Machine Learning — StatQuest","https://www.youtube.com/results?search_query=StatQuest+machine+learning+playlist"],
["PyTorch for Deep Learning — freeCodeCamp","https://www.youtube.com/results?search_query=freecodecamp+pytorch+deep+learning+course"],
["Transformers & LLMs — Hugging Face","https://www.youtube.com/results?search_query=Hugging+Face+transformers+course"],
["RAG explained — freeCodeCamp","https://www.youtube.com/results?search_query=RAG+LLM+tutorial+freecodecamp"],
["FastAPI full course","https://www.youtube.com/results?search_query=FastAPI+full+course+freecodecamp"],
];
const days: Day[] = topics.map((t, i) => ({
  day: i+1, title: t[0], phase: phases.find(p => i + 1 >= Number(p.range.slice(0, 2)) && i + 1 <= Number(p.range.slice(-2)))?.name ?? "Portfolio & shipping",
  focus: t[1],
  tasks: [
    {id:"learn",title:"Learn the core concept",detail:`Study ${t[0].toLowerCase()} and write a short explanation in your own words.`,minutes:35,xp:20},
    {id:"code",title:"Code without copying",detail:"Create a small working example. Test at least two edge cases.",minutes:55,xp:35},
    {id:"notes",title:"Make concise notes",detail:"Write 3 takeaways and 1 question you still have.",minutes:15,xp:10},
    {id:"ship",title:"Commit your progress",detail:"Push today's code and add a useful README note.",minutes:15,xp:15},
  ],
  resource: (() => { const item = resources[Math.min(i < 7 ? 0 : i < 12 ? 1 : i < 20 ? 4 : i < 25 ? 5 : i < 32 ? 6 : i < 38 ? 8 : 9, resources.length-1)]; return { label: item[0], url: item[1] }; })(),
  video: (() => { const item = videoLinks[Math.min(i < 7 ? 0 : i < 20 ? 2 : i < 25 ? 3 : i < 32 ? 4 : i < 38 ? 5 : 6, videoLinks.length-1)]; return { label: item[0], url: item[1] }; })(),
  deliverable: i===6 ? "A CLI expense tracker with JSON persistence and clear input validation." : i===19 ? "A reproducible ML model that predicts expense categories and reports evaluation metrics." : i===24 ? "A trained PyTorch model with a saved checkpoint and a short experiment log." : i===34 ? "A document Q&A prototype that retrieves relevant chunks and cites its sources." : i===44 ? "A deployed BizDhan AI demo, architecture diagram, README, and portfolio case study." : `A small, tested ${t[0].toLowerCase()} exercise committed to your learning repository.`,
  quiz: `Can you explain ${t[0].toLowerCase()} in plain language, implement a tiny example from memory, and describe one real-world use?`
}));

export default function Home() {
  const [activeDay,setActiveDay] = useState(1);
  const [tab,setTab] = useState("overview");
  const [completed,setCompleted] = useState<number[]>([]);
  const [checked,setChecked] = useState<Record<string,boolean>>({});
  const [xp,setXp] = useState(0);
  const [streak,setStreak] = useState(0);
  const [menuOpen,setMenuOpen] = useState(false);
  const [showQuiz,setShowQuiz] = useState(false);
  const [quizAnswer,setQuizAnswer] = useState("");
  const [toast,setToast] = useState("");
  const [pathItems,setPathItems] = useState<ApiPathItem[]>([]);
  const [profileName,setProfileName] = useState("Learner");
  const notify = useCallback((s:string) => { setToast(s); window.setTimeout(()=>setToast(""),2600); },[]);
  const applyDashboard = useCallback((dashboard: WorkspaceDashboard, preferredPathId?: string) => {
    const selectedPath =
      dashboard.paths.find(path => path.id === preferredPathId) ??
      dashboard.paths.find(path => path.status === "active") ??
      dashboard.paths[0];
    setProfileName(dashboard.profile?.display_name?.trim() || "Learner");
    setXp(dashboard.stats.xp);
    setStreak(dashboard.stats.currentStreak);

    if (!selectedPath) {
      setPathItems([]);
      setChecked({});
      setCompleted([]);
      return;
    }

    const items = selectedPath.items ?? [];
    const nextChecked: Record<string, boolean> = {};
    const nextCompleted: number[] = [];
    for (const item of items) {
      const dayNumber = Math.floor(item.position / 4) + 1;
      const taskId = ["learn", "code", "notes", "ship"][item.position % 4];
      if (item.progress === "completed" && dayNumber >= 1 && dayNumber <= 45) {
        nextChecked[`${dayNumber}-${taskId}`] = true;
      }
    }
    for (let dayNumber = 1; dayNumber <= 45; dayNumber++) {
      if (["learn", "code", "notes", "ship"].every(taskId => nextChecked[`${dayNumber}-${taskId}`])) {
        nextCompleted.push(dayNumber);
      }
    }
    setPathItems(items);
    setChecked(nextChecked);
    setCompleted(nextCompleted);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let dashboard = await neuralPathApi.getDashboard();
        let selectedPath = dashboard.paths.find(path => path.status === "active") ?? dashboard.paths[0];
        if (!selectedPath && dashboard.goals.length) {
          await neuralPathApi.bootstrapPath(
            dashboard.goals.find(goal => goal.status === "active")?.id ?? dashboard.goals[0].id,
          );
          dashboard = await neuralPathApi.getDashboard();
          selectedPath = dashboard.paths.find(path => path.status === "active") ?? dashboard.paths[0];
        }
        if (active) applyDashboard(dashboard, selectedPath?.id);
      } catch (cause) {
        if (active) notify(cause instanceof Error ? cause.message : "Cloud progress could not be loaded.");
      }
    })();
    return () => { active = false; };
  }, [applyDashboard, notify]);
  const baseDay = days[activeDay-1];
  const dayItems = pathItems.filter(item => item.position >= (activeDay-1)*4 && item.position < activeDay*4);
  const day: Day = dayItems.length === 4 ? {
    ...baseDay,
    title: dayItems[0].description.split(" — ")[0] || baseDay.title,
    tasks: baseDay.tasks.map((task, index) => ({
      ...task,
      title: dayItems[index].title.replace(/^Day \\d+: /, ""),
      detail: dayItems[index].description.split(" — ").slice(1).join(" — ") || task.detail,
    })),
  } : baseDay;
  const avatarInitials = profileName.trim().split(/\\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("") || "L";
  const doneTasks = day.tasks.filter(t=>checked[`${activeDay}-${t.id}`]).length;
  const progress = Math.round(completed.length/45*100);
  const level = Math.floor(xp/250)+1;
  const xpInLevel = xp%250;
  const nextDay = completed.length ? Math.min(45,Math.max(...completed)+1) : 1;
  async function toggleTask(id:string) {
    const key=`${activeDay}-${id}`, was=!!checked[key];
    const itemPosition=(activeDay-1)*4+["learn","code","notes","ship"].indexOf(id);
    const item=pathItems.find(candidate=>candidate.position===itemPosition);
    if (!item) { notify("Your cloud learning path is still being prepared. Refresh and try again."); return; }
    setChecked(v=>({...v,[key]:!was}));
    if(!was) { notify(`Saving task completion and XP to your account…`); }
    else { notify("Saving your progress update…"); }
    try {
      await neuralPathApi.saveProgress({path_item_id:item.id,status:was?"in_progress":"completed"});
      const refreshed = await neuralPathApi.getDashboard();
      applyDashboard(refreshed, item.path_id);
      notify(was?"Progress updated in your account.":"Progress saved to your account.");
    } catch(cause) {
      setChecked(v=>({...v,[key]:was}));
      notify(cause instanceof Error?cause.message:"Unable to save progress. Please retry.");
    }
  }
  function finishDay() {
    if(doneTasks<day.tasks.length){notify("Complete all daily tasks before claiming the day.");return;}
    if(!completed.includes(activeDay)){notify("All tasks are saved. Refreshing your completed-day total…");}
    else notify("This day is already in your saved progress.");
  }
  const badges = [
    {name:"First commit",desc:"Complete your first learning day",icon:Code2,earned:completed.length>=1},
    {name:"Consistent builder",desc:"Complete 5 learning days",icon:Flame,earned:completed.length>=5},
    {name:"Python explorer",desc:"Finish the Python foundation phase",icon:GraduationCap,earned:completed.includes(7)},
    {name:"Model maker",desc:"Finish the machine learning phase",icon:BrainCircuit,earned:completed.includes(20)},
    {name:"GenAI creator",desc:"Finish the LLM engineering phase",icon:Sparkles,earned:completed.includes(32)},
    {name:"Ship it!",desc:"Complete the capstone journey",icon:Rocket,earned:completed.includes(45)},
  ];
  const nav=[{id:"overview",label:"Overview",icon:LayoutDashboard},{id:"ai",label:"AI Tutor",icon:BrainCircuit},{id:"roadmap",label:"Learning path",icon:BookOpen},{id:"rewards",label:"Rewards",icon:Trophy},{id:"resources",label:"Library",icon:GraduationCap}];
  return <main className="app-shell">
    <aside className={`sidebar ${menuOpen?"sidebar-open":""}`}>
      <div className="brand"><div className="brand-mark"><BrainCircuit size={21}/></div><div><strong>neuralpath</strong><span>AI ENGINEERING WORKSPACE</span></div><button className="mobile-close" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.id} onClick={()=>{setTab(n.id);setMenuOpen(false)}} className={`nav-link ${tab===n.id?"nav-active":""}`}><n.icon size={18}/><span>{n.label}</span>{n.id==="rewards"&&<span className="nav-count">{badges.filter(b=>b.earned).length}</span>}</button>)}</nav>
      <div className="side-divider"/>
      <div className="workspace-label">YOUR JOURNEY</div>
      <div className="side-progress"><div className="side-progress-top"><span>Overall progress</span><b>{progress}%</b></div><div className="progress-track"><i style={{width:`${progress}%`}}/></div><small>{completed.length} of 45 days completed</small></div>
      <div className="phase-menu">{phases.map((p,i)=><button key={p.name} onClick={()=>{setActiveDay(Number(p.range.slice(0,2)));setTab("roadmap");setMenuOpen(false)}} className="phase-link"><span className={`phase-dot ${p.tone}`}/><span>{p.name}</span><small>{p.range}</small></button>)}</div>
      <div className="sidebar-bottom"><div className="streak-card"><div className="streak-icon"><Flame size={18}/></div><div><b>{streak} day streak</b><small>Keep your momentum alive</small></div><Sparkles size={16} className="streak-spark"/></div><div className="profile-row"><div className="avatar">{avatarInitials}</div><div><b>{profileName}</b><small>Level {level} · AI Engineer in progress</small></div><ChevronDown size={16}/></div><form action={signOut} className="signout-form"><button type="submit">Sign out</button></form></div>
    </aside>
    {menuOpen&&<div className="mobile-scrim" onClick={()=>setMenuOpen(false)}/>}
    <section className="main-area">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setMenuOpen(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{nav.find(n=>n.id===tab)?.label}</b></div></div><div className="top-actions"><div className="date-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div><div className="xp-chip"><Zap size={15}/><b>{xp.toLocaleString()}</b><span>XP</span></div><div className="avatar top-avatar">{avatarInitials}</div></div></header>
      <div className="page-content">
        {tab === "overview" && <><WorkspaceGoalsPanel /><WorkspaceProfilePanel /></>}
        {tab==="overview"&&<AnimatePresence mode="wait"><motion.div key="overview" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.25}}>
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR PERSONAL AI BUILD SPACE</div><h1>Build your future in <span>AI.</span></h1><p className="subhead">Small steps. Real projects. Skills that compound. Let&apos;s make today count.</p></div><div className="date-note"><span>YOUR NEXT SESSION</span><b>Day {nextDay} <span>of 45</span></b><small>{days[nextDay-1].title}</small></div></div>
          <div className="hero-card"><div className="hero-grid"/><div className="hero-content"><div className="hero-kicker"><Sparkles size={14}/> TODAY&apos;S FOCUS · DAY {activeDay.toString().padStart(2,"0")}</div><h2>{day.title}</h2><p>{day.focus}. Build understanding by doing, not just watching.</p><div className="hero-meta"><span><Clock3 size={14}/> 2–3 hours</span><span><Target size={14}/> 4 focused tasks</span><span><Zap size={14}/> Up to 130 XP</span></div><button className="primary-btn" onClick={()=>setTab("roadmap")}>Open today&apos;s plan <ArrowUpRight size={16}/></button></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="core"><BrainCircuit size={46}/></div><div className="float-tag tag-top"><Code2 size={14}/> BUILD</div><div className="float-tag tag-bottom"><Sparkles size={14}/> EVOLVE</div></div></div>
          <div className="stats-grid"><Stat icon={ChartNoAxesCombined} label="Learning progress" value={`${progress}%`} detail={`${completed.length} days completed`} tone="purple"/><Stat icon={Zap} label="Total experience" value={xp.toLocaleString()} detail={`Level ${level} · ${250-xpInLevel} XP to next`} tone="blue"/><Stat icon={Flame} label="Current streak" value={`${streak} days`} detail="Consistency beats intensity" tone="orange"/><Stat icon={Award} label="Badges unlocked" value={`${badges.filter(b=>b.earned).length}/${badges.length}`} detail="Earn rewards as you grow" tone="green"/></div>
          <div className="content-grid"><section className="panel today-panel"><div className="panel-head"><div><span className="section-eyebrow">YOUR CHECKLIST</span><h3>Today&apos;s action plan</h3></div><button className="text-btn" onClick={()=>setTab("roadmap")}>View full plan <ArrowUpRight size={14}/></button></div><div className="task-list">{day.tasks.map((t,i)=><TaskRow key={t.id} task={t} index={i} done={!!checked[`${activeDay}-${t.id}`]} onToggle={()=>toggleTask(t.id)}/>)}</div><div className="task-footer"><span>{doneTasks} of {day.tasks.length} tasks completed</span><div className="mini-track"><i style={{width:`${doneTasks/day.tasks.length*100}%`}}/></div><button className="complete-btn" onClick={finishDay}><Check size={15}/> Claim day</button></div></section>
          <section className="panel side-panel"><div className="panel-head"><div><span className="section-eyebrow">KEEP GROWING</span><h3>Next milestone</h3></div><Trophy size={19} className="muted-icon"/></div><div className="milestone-card"><div className="milestone-icon"><Rocket size={22}/></div><div><b>{completed.includes(45)?"AI Engineer journey complete!":"Build your AI portfolio"}</b><p>{completed.length<20?"Create a working ML model and understand its performance.":completed.length<38?"Turn AI concepts into a reliable application.":"Ship your BizDhan AI capstone and tell its story."}</p></div></div><div className="panel-divider"/><div className="resource-quick"><div className="resource-icon"><BookOpen size={17}/></div><div><b>Recommended lesson</b><small>{day.video.label}</small></div><a href={day.video.url} target="_blank" rel="noreferrer" aria-label="Open lesson"><ArrowUpRight size={16}/></a></div><div className="resource-quick"><div className="resource-icon mint"><ExternalLink size={17}/></div><div><b>Official study material</b><small>{day.resource.label}</small></div><a href={day.resource.url} target="_blank" rel="noreferrer" aria-label="Open study material"><ArrowUpRight size={16}/></a></div></section></div>
          <div className="bottom-grid"><section className="panel path-panel"><div className="panel-head"><div><span className="section-eyebrow">THE BIG PICTURE</span><h3>Your learning path</h3></div><button className="text-btn" onClick={()=>setTab("roadmap")}>Explore roadmap <ArrowUpRight size={14}/></button></div><div className="phase-cards">{phases.map((p,i)=>{const Icon=p.icon;const start=Number(p.range.slice(0,2)),end=Number(p.range.slice(-2));const count=completed.filter(d=>d>=start&&d<=end).length;return <button key={p.name} className="phase-card" onClick={()=>{setActiveDay(start);setTab("roadmap")}}><div className={`phase-icon ${p.tone}`}><Icon size={17}/></div><div className="phase-card-text"><b>{p.name}</b><small>{count}/{end-start+1} lessons</small></div><ChevronRight size={15}/></button>})}</div></section><section className="quote-panel"><div className="quote-mark">“</div><p>The goal isn&apos;t to finish a course. It&apos;s to become someone who can build useful things with AI.</p><span>YOUR BUILDER MINDSET</span><div className="quote-stars"><Star/><Star/><Star/></div></section></div>
        </motion.div></AnimatePresence>}
        {tab==="ai"&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> ASK · LEARN · APPLY</div><h1>Your AI <span>tutor.</span></h1><p className="subhead">Build a private knowledge library and get answers grounded in your own learning material.</p></div></div><AiTutorPanel/></motion.div>}
        {tab==="roadmap"&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> LEARN · BUILD · SHIP</div><h1>Your learning <span>path.</span></h1><p className="subhead">A practical progression from Python foundations to production-ready AI applications.</p></div><div className="roadmap-progress"><b>{progress}%</b><span>overall complete</span></div></div><div className="roadmap-layout"><div className="day-picker"><div className="picker-head">ROADMAP DAYS <span>{completed.length}/45 done</span></div>{phases.map(p=>{const start=Number(p.range.slice(0,2)),end=Number(p.range.slice(-2));return <div className="day-group" key={p.name}><div className="day-group-title"><span className={`phase-dot ${p.tone}`}/>{p.name}</div><div className="day-grid">{days.slice(start-1,end).map(d=><button key={d.day} onClick={()=>setActiveDay(d.day)} className={`day-number ${activeDay===d.day?"selected":""} ${completed.includes(d.day)?"is-done":""}`}>{completed.includes(d.day)?<Check size={14}/>:String(d.day).padStart(2,"0")}</button>)}</div></div>})}</div><div className="panel day-detail"><div className="day-detail-top"><div><span className="section-eyebrow">{day.phase.toUpperCase()} · DAY {String(day.day).padStart(2,"0")}</span><h2>{day.title}</h2><p>{day.focus}</p></div><span className={`status-pill ${completed.includes(day.day)?"done-pill":""}`}>{completed.includes(day.day)?"Completed":"In progress"}</span></div><div className="detail-section"><h4><Target size={16}/> Learning objectives</h4><ul><li>Understand the key concepts and explain them in your own words.</li><li>Implement a small example and test edge cases.</li><li>Connect the topic to a real AI engineering workflow.</li></ul></div><div className="detail-section"><h4><Clock3 size={16}/> Step-by-step plan</h4><div className="task-list">{day.tasks.map((t,i)=><TaskRow key={t.id} task={t} index={i} done={!!checked[`${activeDay}-${t.id}`]} onToggle={()=>toggleTask(t.id)}/>)}</div></div><div className="detail-section deliverable"><h4><Rocket size={16}/> Practical deliverable</h4><p>{day.deliverable}</p></div><div className="detail-section"><h4><BookOpen size={16}/> Study resources</h4><div className="link-row"><a href={day.video.url} target="_blank" rel="noreferrer"><Play size={15}/>{day.video.label}<ExternalLink size={13}/></a><a href={day.resource.url} target="_blank" rel="noreferrer"><BookOpen size={15}/>{day.resource.label}<ExternalLink size={13}/></a></div></div><div className="quiz-box"><div><div className="quiz-label"><CircleHelp size={15}/> QUICK CHECKPOINT</div><p>{day.quiz}</p></div><button className="outline-btn" onClick={()=>setShowQuiz(true)}>Test myself <ArrowUpRight size={14}/></button></div><div className="day-bottom"><button className="outline-btn" disabled={activeDay===1} onClick={()=>setActiveDay(d=>d-1)}>Previous day</button><button className="primary-btn" onClick={()=>{finishDay();if(doneTasks===day.tasks.length&&activeDay<45)setActiveDay(d=>d+1)}}>{completed.includes(activeDay)?"Continue learning":"Complete day"} <ArrowUpRight size={15}/></button></div></div></div></motion.div>}
        {tab==="rewards"&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> PROGRESS THAT FEELS GOOD</div><h1>Your <span>rewards.</span></h1><p className="subhead">Every focused session earns experience. Every milestone unlocks a new badge.</p></div></div><div className="reward-hero"><div className="level-orb"><span>LEVEL</span><b>{level}</b></div><div className="reward-copy"><span className="section-eyebrow">YOUR BUILDER LEVEL</span><h2>{level<3?"Curious Explorer":level<6?"Hands-on Builder":level<10?"AI Practitioner":"AI Engineer"}</h2><p>You&apos;ve earned {xp.toLocaleString()} experience points. Keep shipping small things.</p><div className="level-track"><i style={{width:`${xpInLevel/250*100}%`}}/></div><small>{xpInLevel} / 250 XP to level {level+1}</small></div><div className="reward-xp"><Zap size={19}/><b>{xp.toLocaleString()}</b><span>TOTAL XP</span></div></div><div className="reward-grid"><div className="panel"><div className="panel-head"><div><span className="section-eyebrow">MILESTONES</span><h3>Achievement badges</h3></div><span className="badge-count">{badges.filter(b=>b.earned).length} unlocked</span></div><div className="badge-list">{badges.map(b=><div className={`badge-row ${b.earned?"badge-earned":""}`} key={b.name}><div className="badge-art">{b.earned?<b.icon size={22}/>:<LockKeyhole size={19}/>}</div><div><b>{b.name}</b><small>{b.desc}</small></div><span>{b.earned?<CheckCircle2 size={17}/>:<LockKeyhole size={15}/>}</span></div>)}</div></div><div className="panel reward-rules"><div className="panel-head"><div><span className="section-eyebrow">HOW TO EARN</span><h3>XP rules</h3></div><Award size={19} className="muted-icon"/></div>{[[20,"Learn the concept","Read or watch with notes"],[35,"Write working code","Build and test it yourself"],[10,"Reflect & document","Capture your key takeaways"],[15,"Commit your work","Push a meaningful change"],[50,"Complete a day","Finish all daily tasks"]].map(([n,t,d])=><div className="xp-rule" key={String(t)}><span>+{n} XP</span><div><b>{t}</b><small>{d}</small></div></div>)}</div></div></motion.div>}
        {tab==="resources"&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> CURATED LEARNING LIBRARY</div><h1>Your resource <span>library.</span></h1><p className="subhead">Free courses, official documentation and hands-on learning platforms.</p></div></div><div className="resource-grid">{resources.map((r,i)=><a key={r[0]} className="resource-card" href={r[1]} target="_blank" rel="noreferrer"><div className={`resource-card-icon tone-${i%5}`}><BookOpen size={19}/></div><div><b>{r[0]}</b><small>{new URL(r[1]).hostname}</small></div><ArrowUpRight size={16}/></a>)}</div><div className="panel video-library"><div className="panel-head"><div><span className="section-eyebrow">VIDEO LEARNING</span><h3>Free video lessons</h3></div><Play size={18} className="muted-icon"/></div><div className="video-list">{videoLinks.map((v,i)=><a href={v[1]} target="_blank" rel="noreferrer" key={v[0]}><span className="video-play"><Play size={14}/></span><div><b>{v[0]}</b><small>Open video search on YouTube</small></div><ExternalLink size={15}/></a>)}</div></div></motion.div>}
        <footer className="footer"><span>NEURALPATH <i>·</i> BUILT FOR THE LONG GAME</span><span>Learn with intent. Build with care. Ship with confidence.</span></footer>
      </div>
    </section>
    <AnimatePresence>{showQuiz&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowQuiz(false)}><motion.div className="quiz-modal" initial={{y:20,scale:.97}} animate={{y:0,scale:1}} exit={{y:15,scale:.98}} onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowQuiz(false)}><X size={18}/></button><div className="quiz-label"><CircleHelp size={16}/> KNOWLEDGE CHECK</div><h2>Can you teach it back?</h2><p>{day.quiz}</p><textarea value={quizAnswer} onChange={e=>setQuizAnswer(e.target.value)} placeholder="Write a short answer in your own words..." rows={4}/><button className="primary-btn full-btn" onClick={async ()=>{if(quizAnswer.trim().length<20){notify("Write at least a couple of sentences to reflect.");return;}const item=pathItems.find(candidate=>candidate.position===(activeDay-1)*4);if(!item){notify("Your cloud learning path is not ready yet.");return;}try{await neuralPathApi.saveProgress({path_item_id:item.id,status:checked[`${activeDay}-learn`]?"completed":"in_progress",reflection:quizAnswer.trim()});setShowQuiz(false);setQuizAnswer("");notify("Reflection saved to your account.");}catch(cause){notify(cause instanceof Error?cause.message:"Unable to save reflection.");}}}>Save reflection <Check size={15}/></button><small className="modal-hint">Your reflection is saved with your learning progress.</small></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}><CheckCircle2 size={17}/>{toast}</motion.div>}</AnimatePresence>
  </main>;
}
function Stat({icon:Icon,label,value,detail,tone}:{icon:LucideIcon,label:string,value:string,detail:string,tone:string}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><div><small>{label}</small><b>{value}</b><span>{detail}</span></div></div>}
function TaskRow({task,index,done,onToggle}:{task:Task,index:number,done:boolean,onToggle:()=>void}){return <div className={`task-row ${done?"task-done":""}`}><button className="task-check" onClick={onToggle} aria-label={done?"Mark incomplete":"Mark complete"}>{done?<Check size={15}/>:<span/>}</button><div className="task-index">{String(index+1).padStart(2,"0")}</div><div className="task-copy"><b>{task.title}</b><small>{task.detail}</small></div><div className="task-meta"><span><Clock3 size={12}/>{task.minutes}m</span><span className="task-xp">+{task.xp} XP</span></div></div>}
