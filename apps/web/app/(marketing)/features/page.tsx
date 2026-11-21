import type { Metadata } from "next";
import { Shell, Intro } from "../../components/marketing";

export const metadata: Metadata = {
  title: "Personalized Learning Features",
  description: "Explore NeuralPath personalized learning paths, AI tutor companion, practical exercises, progress tracking, and curated study resource management.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Personalized Learning Features | NeuralPath",
    description: "Explore NeuralPath personalized learning paths, AI tutor companion, practical exercises, progress tracking, and curated study resource management.",
    url: "/features",
    type: "website",
  },
};

const items = [["⌁","Personal learning paths","A journey shaped around your goals, experience, available time, and preferred ways to learn."],["✧","AI learning companion","Get explanations, ideas, and next-step guidance with AI designed to support—not replace—your effort."],["◇","Practical projects","Turn concepts into useful work through exercises and projects connected to what you want to achieve."],["◷","Progress that makes sense","See completed work, milestones, consistency, and the skills you are developing."],["▤","A growing resource library","Keep relevant learning material organized around your goals and topics."],["✳","A flexible learning profile","Update your interests, goals, and schedule as your direction changes."]];

export default function Features() {
  return <Shell><Intro tag="THE NEURALPATH EXPERIENCE" title="Everything you need to keep moving." desc="A connected learning space that brings your goals, learning plan, practice, and progress together."/><section className="content-grid">{items.map(x=><article className="info-card" key={x[1]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</section></Shell>;
}
