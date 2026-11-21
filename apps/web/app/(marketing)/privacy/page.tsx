import type { Metadata } from "next";
import { Shell, Intro } from "../components/marketing";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read how NeuralPath protects your personal information, account credentials, study activity, and private learning materials with secure data practices.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | NeuralPath",
    description: "Read how NeuralPath protects your personal information, account credentials, study activity, and private learning materials with secure data practices.",
    url: "/privacy",
    type: "website",
  },
};

export default function Privacy() {
  return <Shell><Intro tag="YOUR DATA MATTERS" title="Privacy at NeuralPath." desc="A plain-language overview of the privacy principles guiding the product. This page is a draft and must be reviewed before public launch."/><section className="prose"><h2>Our approach</h2><p>NeuralPath is being designed to collect only the information needed to provide a personalized learning experience, such as account details, learning goals, preferences, and activity you choose to record.</p><h2>AI and learning content</h2><p>When AI features are introduced, relevant prompts and learning material may be processed by selected AI service providers. We will document providers, retention practices, and controls before enabling these features for production users.</p><h2>Your control</h2><p>Users should be able to review and update profile information, manage learning data, and request deletion. Private learning material must be protected by authentication and database authorization policies.</p><h2>Contact</h2><p>Privacy contact details and applicable legal disclosures must be added before this policy is treated as final.</p></section></Shell>;
}
