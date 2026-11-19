import type { MetadataRoute } from "next";

const base = "https://neuralpathx.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/features", "/how-it-works", "/faq", "/contact", "/privacy", "/terms"].map(path => ({
    url: base + path,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
