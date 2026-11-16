import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuralPath — AI Engineering Workspace",
  description: "Your personal AI engineering learning cockpit. Learn, build, ship, and level up.",
  applicationName: "NeuralPath",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
