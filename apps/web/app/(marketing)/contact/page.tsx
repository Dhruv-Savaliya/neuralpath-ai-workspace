import type { Metadata } from "next";
import Link from "next/link";
import { Shell, Intro } from "../components/marketing";
import { SUPPORT_EMAIL } from "../../lib/config";

export const metadata: Metadata = {
  title: "Contact NeuralPath",
  description: "Contact the NeuralPath team with questions, ideas or product feedback.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <Shell>
      <Intro
        tag="LET'S TALK"
        title="We'd love to hear from you."
        desc="Have a question, idea, or feedback? Reach out and help us make NeuralPath better."
      />
      <section className="contact-panel">
        <p>
          Have questions, suggestions, or account inquiries? Send a message to our support team and we will get back to you.
        </p>
        <a
          className="site-button"
          href={`mailto:${SUPPORT_EMAIL}`}
          aria-label={`Email NeuralPath support team at ${SUPPORT_EMAIL}`}
        >
          Email Support ({SUPPORT_EMAIL})
        </a>
        <div style={{ marginTop: "1rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>Encountering a bug or technical issue?</p>
          <Link
            className="site-button secondary"
            href="https://github.com/Dhruv-Savaliya/neuralpath-ai-workspace/issues"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report a technical issue on GitHub (opens in a new tab)"
          >
            Report a technical issue on GitHub ↗
          </Link>
        </div>
        <small>Please do not include passwords, API keys, or sensitive personal information in emails or public issues.</small>
      </section>
    </Shell>
  );
}
