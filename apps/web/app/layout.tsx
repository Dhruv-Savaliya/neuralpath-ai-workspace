import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "NeuralPath — Your goals. Your path. Your growth.", template: "%s | NeuralPath" },
  description: "A personal learning platform for every profession. Turn your goals into a learning journey that grows with you.",
  applicationName: "NeuralPath",
  metadataBase: new URL("https://neuralpath-ai-workspace.vercel.app"),
  openGraph: { title: "NeuralPath — Your goals. Your path. Your growth.", description: "A personal learning platform for every profession.", siteName: "NeuralPath", type: "website" },
  twitter: { card: "summary", title: "NeuralPath", description: "Your goals. Your path. Your growth." },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
