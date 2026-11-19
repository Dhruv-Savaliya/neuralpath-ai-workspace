import type { Metadata } from "next";
import ThemeControl from "./components/theme-control";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NeuralPath — Your goals. Your path. Your growth.", template: "%s | NeuralPath" },
  description: "A personal learning platform for every profession. Turn your goals into a learning journey that grows with you.",
  applicationName: "NeuralPath",
  metadataBase: new URL("https://neuralpathx.vercel.app"),
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: { title: "NeuralPath — Your goals. Your path. Your growth.", description: "A personal learning platform for every profession.", siteName: "NeuralPath", type: "website" },
  twitter: { card: "summary", title: "NeuralPath", description: "Your goals. Your path. Your growth." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {children}
        <ThemeControl />
      </body>
    </html>
  );
}
