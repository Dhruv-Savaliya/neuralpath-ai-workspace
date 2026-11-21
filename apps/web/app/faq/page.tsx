import type { Metadata } from "next";
import { Shell, Intro } from "../components/marketing";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about NeuralPath accounts, learning paths, saved AI tutor conversations, knowledge sources and learner data.",
  alternates: { canonical: "/faq" },
};

const qs = [
  ["Who is NeuralPath for?", "Anyone who wants to learn or grow: students, professionals, career changers, and lifelong learners across many fields."],
  ["Do I need to know what I want to learn?", "Having a goal helps, but you can start with an area of interest or say that you are exploring."],
  ["Will every learner get the same roadmap?", "No. NeuralPath uses your goals, experience, time, and preferences to shape your learning workspace. Recommendations may evolve as you make progress."],
  ["Is NeuralPath an AI-only learning platform?", "No. AI is intended to provide guidance. Learning still comes from practice, trusted resources, projects, and your own effort."],
  ["Can I change my goals later?", "Yes. Your learning profile and goals can be updated as your priorities change."],
  ["Is my progress synced across devices?", "Yes. When you sign in, your profile, goals, learning paths, and progress are stored in your account and can be accessed across devices."],
  ["Can the AI tutor remember earlier questions?", "Yes. Signed-in tutor conversations are saved to your account and can be reopened from the AI Tutor panel."],
  ["Can the tutor read a website just from its URL?", "Not currently. You can paste learning text into your private knowledge library; an optional URL is stored as a reference and is not fetched or imported automatically."],
  ["Are AI answers always correct?", "No AI system is perfect. Check important information against trusted sources, and do not use NeuralPath as a substitute for professional advice."],
];

export default function FAQ() {
  return <Shell><Intro tag="GOOD QUESTIONS" title="A few things you might be wondering." desc="A little clarity before you begin your learning journey."/><section className="faq-grid">{qs.map(([question, answer]) => <article className="info-card" key={question}><h3>{question}</h3><p>{answer}</p></article>)}</section></Shell>;
}
