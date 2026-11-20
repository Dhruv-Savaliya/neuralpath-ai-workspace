import type { Metadata } from "next";
import { Shell, Intro } from "../components/marketing";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the preliminary NeuralPath terms of use and responsible-use guidance.",
};

export default function Terms() {
  return <Shell><Intro tag="THE IMPORTANT DETAILS" title="Terms of use." desc="A preliminary overview of responsible use of NeuralPath. This draft is not legal advice and requires review before public launch."/><section className="prose"><h2>Using the platform</h2><p>Use NeuralPath lawfully and respectfully. Do not attempt to access another person&apos;s account or private learning information, disrupt the service, or misuse its resources.</p><h2>Learning and AI outputs</h2><p>Learning suggestions and AI-generated content are provided as assistance. They may be incomplete or inaccurate and should be checked against trusted sources, especially for consequential decisions.</p><h2>Availability</h2><p>Features may change as the platform develops. We will communicate material changes and provide appropriate safeguards for user data.</p><h2>Before launch</h2><p>Operator identity, governing law, liability terms, subscription terms (if any), and formal contact details must be reviewed and completed by qualified counsel.</p></section></Shell>;
}
