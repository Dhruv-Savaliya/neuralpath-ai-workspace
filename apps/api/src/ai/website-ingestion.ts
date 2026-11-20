import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_TEXT_CHARACTERS = 50_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 12_000;

type PageResponse = { status: number; headers: import("node:http").IncomingHttpHeaders; body: string };

export function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function validateUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a valid public HTTPS webpage URL."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !url.hostname || url.hostname.endsWith(".") || /^\d+(?:\.\d+){3}$/.test(url.hostname) ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) {
    throw new Error("Only public HTTPS webpages on the standard port are supported.");
  }
  return url;
}

async function resolvePublicIpv4(hostname: string): Promise<string> {
  const records = await lookup(hostname, { all: true, family: 4, verbatim: true });
  if (!records.length || records.some(record => !isPublicIpv4(record.address))) {
    throw new Error("This webpage host does not resolve exclusively to public IPv4 addresses.");
  }
  return records[0].address;
}

function requestPage(url: URL, pinnedAddress: string): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      headers: {
        "User-Agent": "NeuralPath-KnowledgeImporter/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        "Accept-Encoding": "identity",
      },
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, pinnedAddress, 4);
      }) as never,
    }, response => {
      const chunks: string[] = [];
      let size = 0;
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("The webpage is larger than the 1 MB import limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: chunks.join(""),
      }));
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("The webpage took too long to respond.")));
    request.on("error", reject);
    request.end();
  });
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Math.min(0x10ffff, Number(code))))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(code, 16))));
}

export function extractWebpageText(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = decodeEntities((titleMatch?.[1] ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160);
  const content = decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/(p|div|article|section|main|h[1-6]|li|tr|br)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " "))
    .trim()
    .slice(0, MAX_TEXT_CHARACTERS);
  return { title, content };
}

export async function fetchPublicWebpage(input: string): Promise<{ title: string; content: string; url: string }> {
  let current = validateUrl(input);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const address = await resolvePublicIpv4(current.hostname);
    const response = await requestPage(current, address);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || redirects === MAX_REDIRECTS) throw new Error("The webpage redirected too many times.");
      current = validateUrl(new URL(location, current).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`The webpage returned HTTP ${response.status}.`);
    const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new Error("This URL is not a supported HTML or plain-text webpage.");
    }
    const extracted = contentType.includes("text/plain")
      ? { title: "", content: response.body.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARACTERS) }
      : extractWebpageText(response.body);
    if (extracted.content.length < 40) throw new Error("We couldn't find enough readable text on this webpage.");
    return {
      title: extracted.title || current.hostname,
      content: extracted.content,
      url: current.toString(),
    };
  }
  throw new Error("Unable to import this webpage.");
}
