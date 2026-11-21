import type { Metadata } from "next";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = {
  title: "Your Learning Dashboard",
  description: "Your private NeuralPath workspace for learning goals, progress, insights and AI tutoring.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
