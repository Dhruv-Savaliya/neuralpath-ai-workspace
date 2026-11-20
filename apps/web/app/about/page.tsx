import type { Metadata } from "next";
import { Shell, Intro } from "../components/marketing";

export const metadata: Metadata = {
  title: "About NeuralPath",
  description: "Learn about NeuralPath's mission to make learning more personal, practical and connected to the goals that matter to you.",
};

export default function About() {
  return <Shell><Intro tag="ABOUT NEURALPATH" title="Learning should move with you." desc="Growth looks different for everyone. NeuralPath exists to make learning more personal, practical, and connected to the goals that matter to you."/><section className="content-grid">{[["✳","Our mission","Help people turn curiosity into meaningful progress with learning journeys that fit their goals, starting point, and everyday life."],["⌁","Our vision","A world where anyone can find a clear next step, build useful skills, and keep growing — whatever their profession or background."],["◈","Our approach","Combine thoughtful learning design, practical work, and responsible AI assistance while keeping learners in control."]].map(x=><article className="info-card" key={x[1]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</section><section className="prose"><h2>For every kind of ambition</h2><p>Whether you are exploring a new field, developing skills in your current role, studying, or learning for the joy of it, your journey starts with what you want to achieve.</p></section></Shell>;
}
