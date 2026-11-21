/**
 * Split learner-provided material into bounded, structure-aware retrieval chunks.
 * Headings are carried into every chunk in their section; paragraphs, lists and
 * fenced code blocks are kept intact where possible, with overlap only when a
 * single block is too large to fit.
 */
export function chunkKnowledgeText(input: string, maxChars = 1200, overlap = 180): string[] {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized || maxChars < 80) return [];

  const blocks: string[] = [];
  const lines = normalized.split("\n");
  let heading = "";
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  const withHeading = (content: string) => heading ? `${heading}\n${content}` : content;
  const flushParagraph = () => {
    const content = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (content) blocks.push(withHeading(content));
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(withHeading(list.join("\n")));
    list = [];
  };
  const flushCode = () => {
    if (code?.length) blocks.push(withHeading(code.join("\n")));
    code = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (code) {
      code.push(rawLine);
      if (/^\s*```/.test(line)) flushCode();
      continue;
    }
    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      code = [rawLine];
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      flushList();
      heading = line;
      continue;
    }
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^(?:[-*+]\s+|\d+[.)]\s+|>\s+)/.test(line)) {
      flushParagraph();
      list.push(line);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushCode();

  const splitLargeBlock = (block: string): string[] => {
    if (block.length <= maxChars) return [block];
    const firstBreak = block.indexOf("\n");
    const prefix = firstBreak > 0 && /^#{1,6}\s+/.test(block.slice(0, firstBreak))
      ? block.slice(0, firstBreak)
      : "";
    const body = prefix ? block.slice(firstBreak + 1) : block;
    const bodyLimit = Math.max(40, maxChars - (prefix ? prefix.length + 1 : 0));
    const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(bodyLimit / 3)));
    const pieces: string[] = [];
    let cursor = 0;

    while (cursor < body.length) {
      const limit = Math.min(cursor + bodyLimit, body.length);
      let end = limit;
      if (limit < body.length) {
        const window = body.slice(cursor, limit);
        const minimum = Math.floor(bodyLimit * 0.6);
        const lineBreak = window.lastIndexOf("\n");
        const sentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
        const wordBreak = window.lastIndexOf(" ");
        const boundary = [lineBreak, sentenceBreak, wordBreak].find(index => index >= minimum);
        if (boundary !== undefined) end = cursor + boundary + 1;
      }
      const content = body.slice(cursor, end).trim();
      if (content) pieces.push(prefix ? `${prefix}\n${content}` : content);
      if (end >= body.length) break;
      cursor = Math.max(end - safeOverlap, cursor + 1);
    }
    return pieces;
  };

  const chunks: string[] = [];
  let current = "";
  for (const block of blocks) {
    for (const piece of splitLargeBlock(block)) {
      if (!current) {
        current = piece;
      } else if (current.length + 2 + piece.length <= maxChars) {
        current += `\n\n${piece}`;
      } else {
        if (current.length >= 40) chunks.push(current);
        current = piece;
      }
    }
  }
  if (current.length >= 40) chunks.push(current);
  return chunks;
}
