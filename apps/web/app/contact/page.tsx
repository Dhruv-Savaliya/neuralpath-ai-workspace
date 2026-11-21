import type { Metadata } from "next";
import Link from "next/link";
import { Shell, Intro } from "../components/marketing";

export const metadata: Metadata = {
  title: "Contact NeuralPath",
  description: "Contact the NeuralPath team with questions, ideas or product feedback.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return <Shell><Intro tag="LET'S TALK" title="We'd love to hear from you." desc="Have a question, idea, or feedback? Reach out and help us make NeuralPath better."/><section className="contact-panel"><p>Contact form submissions will be connected to a secure support workflow in a later release. For now, reach the team through the project repository.</p><Link className="site-button" href="https://github.com/Dhruv-Savaliya/neuralpath-ai-workspace">Visit NeuralPath on GitHub ↗</Link><small>Please do not include passwords, API keys, or sensitive information in public issues.</small></section></Shell>;
}
