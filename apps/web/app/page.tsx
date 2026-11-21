import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check, Code2,
  Compass, Layers3, Lightbulb, LockKeyhole,
  Palette, Play, Rocket, Sparkles, Target, TrendingUp, WandSparkles,
} from "lucide-react";
import { Shell } from "./components/marketing";
import { HeroArtMotion, HeroCopyMotion, Reveal } from "./components/marketing-motion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tutor for Every Subject",
  description: "Learn coding, mathematics, science, business, design and more with an AI tutor that explains concepts, adapts to your level and helps you practise.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "NeuralPath — Your AI tutor for every subject",
    description: "A personal AI tutor and learning workspace for your goals, notes and next steps.",
    url: "/",
    type: "website",
  },
};

const highlights = [
  { icon: Target, title: "Personal learning paths", copy: "Turn a goal into clear milestones and practical next steps." },
  { icon: BrainCircuit, title: "AI tutor for every subject", copy: "Get clear explanations, explore concepts and practise at your own pace." },
  { icon: TrendingUp, title: "Progress that makes sense", copy: "Keep track of completed tasks, learning momentum and goals." },
  { icon: Layers3, title: "Resources in one place", copy: "Bring lessons, notes, useful links and projects together." },
];
const areas = [
  { icon: Code2, title: "Technology & AI", copy: "Programming, AI engineering, data and digital skills" },
  { icon: Palette, title: "Design & creativity", copy: "UI/UX, visual design, product thinking and creative work" },
  { icon: TrendingUp, title: "Business & finance", copy: "Entrepreneurship, strategy, finance and marketing" },
  { icon: Lightbulb, title: "Personal growth", copy: "Communication, leadership, languages and more" },
];

function NeuralArtwork() {
  return <div className="np-neural-art" aria-label="Abstract glowing neural network illustration" role="img">
    <div className="np-art-halo"/><div className="np-art-orbit np-art-orbit-a"/><div className="np-art-orbit np-art-orbit-b"/>
    <svg className="np-brain-svg" viewBox="0 0 420 340" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="brainFill" cx="0" cy="0" r="1" gradientTransform="matrix(0 180 -170 0 210 70)" gradientUnits="userSpaceOnUse"><stop stopColor="#9BEAFF" stopOpacity=".95"/><stop offset=".48" stopColor="#438DFF" stopOpacity=".68"/><stop offset="1" stopColor="#7954F6" stopOpacity=".14"/></radialGradient>
        <linearGradient id="brainStroke" x1="85" y1="70" x2="330" y2="255" gradientUnits="userSpaceOnUse"><stop stopColor="#A8F4FF"/><stop offset=".5" stopColor="#4B9EFF"/><stop offset="1" stopColor="#A47BFF"/></linearGradient>
        <filter id="brainGlow" x="30" y="12" width="360" height="330" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <path d="M210 54c-29-31-78-19-91 13-38-2-63 29-54 65-24 25-18 64 8 82-3 34 24 59 57 53 19 26 55 27 80 7 25 20 61 19 80-7 33 6 60-19 57-53 26-18 32-57 8-82 9-36-16-67-54-65-13-32-62-44-91-13Z" fill="url(#brainFill)" opacity=".48" filter="url(#brainGlow)"/>
      <path d="M210 54c-29-31-78-19-91 13-38-2-63 29-54 65-24 25-18 64 8 82-3 34 24 59 57 53 19 26 55 27 80 7 25 20 61 19 80-7 33 6 60-19 57-53 26-18 32-57 8-82 9-36-16-67-54-65-13-32-62-44-91-13Z" fill="url(#brainFill)" stroke="url(#brainStroke)" strokeWidth="2.5"/>
      <path d="M210 55v217M210 93c-27-30-59-30-82-7m82 7c25-30 58-30 82-7M210 132c-34-23-66-11-82 13m82-13c34-23 66-11 82 13M210 170c-35-15-65-3-76 23m76-23c35-15 65-3 76 23M210 208c-25-12-45-3-57 20m57-20c25-12 45-3 57 20M128 111l-33 21m33 13-46 27m47 8-29 38m202-107 33 21m-33 13 46 27m-47 8 29 38" stroke="#B9F2FF" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round"/>
      {[[128,111],[210,93],[292,111],[128,145],[210,132],[292,145],[82,172],[338,172],[134,184],[210,170],[286,184],[105,230],[153,228],[210,208],[267,228],[315,230],[210,272]] .map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i%3===0?5:3.5} fill="#D9FAFF" stroke="#69C9FF" strokeWidth="2"/>)}
    </svg>
    <div className="np-art-platform"><span/><span/><span/></div>
    <div className="np-art-chip np-chip-one"><Code2 size={17}/><b>BUILD</b></div>
    <div className="np-art-chip np-chip-two"><Sparkles size={17}/><b>LEARN</b></div>
    <div className="np-art-chip np-chip-three"><TrendingUp size={17}/><b>GROW</b></div>
    <div className="np-art-star np-star-one">✦</div><div className="np-art-star np-star-two">✧</div>
  </div>;
}

function DashboardPreview() {
  return <div className="np-preview-frame">
    <div className="np-preview-top"><div className="np-window-dots"><i/><i/><i/></div><div className="np-preview-search"><span/> Search your learning space… <kbd>⌘ K</kbd></div><div className="np-preview-user"><span>DS</span></div></div>
    <div className="np-preview-layout">
      <aside className="np-preview-sidebar"><div className="np-preview-brand"><Image src="/icon.svg" alt="" width={23} height={23}/><b>Neural<span>Path</span></b></div>{[[Compass,"Overview"],[BookOpen,"Learning paths"],[Target,"My goals"],[BrainCircuit,"AI companion"],[Layers3,"Resources"]].map(([Icon,label],i)=>{const I=Icon as typeof Compass;return <div className={i===0?"np-preview-nav active":"np-preview-nav"} key={label as string}><I size={13}/>{label as string}</div>})}<div className="np-preview-sidebar-note">YOUR SPACE. YOUR PACE.</div></aside>
      <div className="np-preview-main"><div className="np-preview-greeting"><small>YOUR LEARNING SPACE</small><b>A little progress goes a long way.</b><span>Keep your curiosity moving.</span></div>
        <div className="np-preview-stat-grid"><div><small>ACTIVE PATH</small><b>AI Engineering</b><span>Keep exploring <ArrowUpRight size={11}/></span></div><div><small>YOUR MOMENTUM</small><b>12 <em>tasks done</em></b><span>Small steps add up</span></div><div><small>LEARNING GOALS</small><b>03 <em>in progress</em></b><span>One step at a time</span></div></div>
        <div className="np-preview-content-grid"><div className="np-preview-panel"><div className="np-preview-panel-head"><b>Continue your path</b><small>VIEW ROADMAP <ArrowUpRight size={10}/></small></div><div className="np-preview-task"><span className="np-preview-check"><Check size={10}/></span><div><b>Understand the foundations</b><small>Completed · Core concepts</small></div><strong>Done</strong></div><div className="np-preview-task"><span className="np-preview-check current"><span/></span><div><b>Build your first project</b><small>Next step · Hands-on practice</small></div><strong>Next</strong></div><div className="np-preview-task"><span className="np-preview-check"><span/></span><div><b>Review and reflect</b><small>Coming up · Make it stick</small></div><strong>Later</strong></div></div>
        <div className="np-preview-panel np-preview-ai"><div className="np-ai-orb"><BrainCircuit size={24}/></div><small>YOUR AI COMPANION</small><b>Curiosity, meet clarity.</b><p>Explore a concept or get help with your next step.</p><span>Ask a question <ArrowUpRight size={11}/></span></div></div>
      </div>
    </div>
    <div className="np-preview-caption"><span><i/> PRODUCT PREVIEW</span><small>A glimpse of the NeuralPath learning workspace</small></div>
  </div>;
}

export default function Home() {
  return <Shell>
    <div className="np-home">
      <section className="np-home-hero">
        <div className="np-hero-stars" aria-hidden="true"/>
        <HeroCopyMotion className="np-home-hero-copy">
          <span className="np-kicker"><i/> LEARN · BUILD · GROW</span>
          <h1>Your AI tutor<br/>for <em>every subject.</em></h1>
          <p>Learn coding, mathematics, science, business, design and more with an AI tutor that explains concepts, adapts to your level and helps you practise.</p>
          <div className="np-home-actions"><Link className="np-primary-action" href="/auth/sign-up">Try AI Tutor <ArrowUpRight size={17}/></Link><Link className="np-secondary-action" href="/how-it-works"><Play size={14} fill="currentColor"/> Explore learning paths</Link></div>
          <div className="np-hero-assurances"><span><ShieldIcon/> Built around your goals</span><span><LockKeyhole size={14}/> Your progress, your space</span></div>
        </HeroCopyMotion>
        <HeroArtMotion className="np-home-hero-art"><NeuralArtwork/></HeroArtMotion>
        <div className="np-hero-bottomline"><span>ONE SPACE FOR YOUR NEXT CHAPTER</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section className="np-home-trust"><span>MADE FOR THE WAY YOU WANT TO GROW</span><div><b>Learn a new skill</b><i/><b>Explore AI</b><i/><b>Change direction</b><i/><b>Build something real</b></div></section>

      <section className="np-home-section np-feature-section" id="features">
        <Reveal className="np-section-heading"><span className="np-kicker"><i/> YOUR IDEAS, WITH A WAY FORWARD</span><h2>Everything you need<br/>to <em>keep growing.</em></h2><p>NeuralPath brings your goals, learning activities and helpful AI tools into one focused space.</p></Reveal>
        <div className="np-feature-grid">{highlights.map((item,i)=>{const Icon=item.icon;return <Reveal key={item.title} delay={i*.06}><article className="np-feature-card"><span className="np-feature-icon"><Icon size={21}/></span><small>0{i+1}</small><h3>{item.title}</h3><p>{item.copy}</p><ArrowUpRight className="np-card-arrow" size={17}/></article></Reveal>})}</div>
      </section>

      <section className="np-home-preview-section">
        <div className="np-preview-copy"><Reveal><span className="np-kicker"><i/> YOUR LEARNING WORKSPACE</span><h2>A clear view<br/>of <em>what&apos;s next.</em></h2><p>See your learning paths, goals and next actions together. Keep your focus on the work that matters, without losing sight of the bigger picture.</p><ul><li><Check size={15}/> Follow a structured learning path</li><li><Check size={15}/> Track tasks and personal goals</li><li><Check size={15}/> Get help from your AI companion</li></ul><Link className="np-text-action" href="/auth/sign-up">Explore your workspace <ArrowRight size={16}/></Link></Reveal></div>
        <Reveal className="np-preview-visual"><DashboardPreview/></Reveal>
      </section>

      <section className="np-home-section np-areas-section">
        <Reveal className="np-section-heading np-centered"><span className="np-kicker"><i/> FOLLOW YOUR CURIOSITY</span><h2>One platform.<br/><em>Many possibilities.</em></h2><p>Start with a subject you love, combine interests or choose a direction you haven&apos;t explored yet.</p></Reveal>
        <div className="np-area-grid">{areas.map((item,i)=>{const Icon=item.icon;return <Reveal key={item.title} delay={i*.05}><article className="np-area-card"><span><Icon size={20}/></span><div><h3>{item.title}</h3><p>{item.copy}</p></div><ArrowUpRight size={17}/></article></Reveal>})}</div>
      </section>

      <section className="np-home-ai">
        <div className="np-ai-glow"/>
        <Reveal className="np-ai-copy"><span className="np-kicker"><i/> YOUR AI TUTOR, READY TO HELP</span><h2>Understand more.<br/><em>Learn with confidence.</em></h2><p>Ask about a difficult concept, get a step-by-step explanation, or explore a new subject. Use your learning materials as private context when you want answers grounded in your own notes.</p><Link className="np-primary-action" href="/features">Explore tutor features <ArrowUpRight size={16}/></Link></Reveal>
        <Reveal className="np-ai-feature-stack"><div><span><WandSparkles size={18}/></span><b>Make complex ideas clearer</b><small>Break a topic into understandable pieces.</small></div><div><span><BookOpen size={18}/></span><b>Learn by doing</b><small>Turn concepts into practice and projects.</small></div><div><span><Rocket size={18}/></span><b>Find your next step</b><small>Keep moving with a plan that can evolve.</small></div></Reveal>
      </section>

      <section className="np-home-final"><Reveal><span className="np-kicker"><i/> THE NEXT STEP IS YOURS</span><h2>Big goals begin<br/>with <em>one small step.</em></h2><p>Start exploring what you could learn, make and become with NeuralPath.</p><Link className="np-primary-action" href="/auth/sign-up">Create your free account <ArrowUpRight size={17}/></Link><small>Learn at your pace. Grow in your own direction.</small></Reveal></section>
    </div>
  </Shell>;
}

function ShieldIcon(){return <span className="np-shield-check"><Check size={10}/></span>}
