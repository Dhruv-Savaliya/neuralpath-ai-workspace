export type CitationSource = {
  citation: string;
  title: string;
  url: string | null;
  similarity: number;
};

/**
 * Keep only citations that refer to sources actually retrieved for this answer.
 * Citation-like tokens that the model invents are removed rather than rendered
 * as links to unrelated material.
 */
export function validateAnswerCitations(answer: string, sources: CitationSource[]) {
  const allowed = new Map(sources.map(source => [source.citation, source]));
  const cited = new Set<string>();
  const cleaned = answer.replace(/\[(S\d+)\]/g, (token, citation: string) => {
    if (!allowed.has(citation)) return "";
    cited.add(citation);
    return token;
  }).replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return {
    answer: cleaned,
    sources: sources.filter(source => cited.has(source.citation)),
  };
}
