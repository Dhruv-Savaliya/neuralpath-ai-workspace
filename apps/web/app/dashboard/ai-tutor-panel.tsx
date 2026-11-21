"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Bot, ExternalLink, LoaderCircle, MessageCircle, Plus, Search, Send, Trash2, UserRound } from "lucide-react";
import { neuralPathApi, type AiChatResponse, type AiConversation, type KnowledgeSource, type LearningResourceResults } from "../../lib/api/client";
import { MarkdownMessage } from "./markdown-message";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AiChatResponse;
  sources?: AiChatResponse["sources"];
  interrupted?: boolean;
  retryPrompt?: string;
};

export default function AiTutorPanel() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [resourceTopic, setResourceTopic] = useState("");
  const [resourceResults, setResourceResults] = useState<LearningResourceResults | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      setSources(await neuralPathApi.getKnowledgeSources());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your knowledge library.");
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => { void loadSources(); }, [loadSources]);

  const loadConversations = useCallback(async () => {
    try { setConversations(await neuralPathApi.getAiConversations()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load tutor history."); }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  async function openConversation(id: string) {
    if (loading) return;
    if (!id) { setActiveConversationId(null); setMessages([]); setQuestion(""); setError(""); return; }
    setError("");
    try {
      const result = await neuralPathApi.getAiConversation(id);
      setActiveConversationId(id);
      setMessages(result.messages.map(message => ({ id: message.id, role: message.role, text: message.content, sources: message.sources ?? [] })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open this conversation."); }
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pastedContent = content.trim();
    const webpageUrl = sourceUrl.trim();
    if (pastedContent.length >= 40 && title.trim().length < 3) {
      setError("Add a title with at least 3 characters for pasted learning material.");
      return;
    }
    if (pastedContent.length < 40 && !webpageUrl) {
      setError("Paste at least 40 characters of notes or enter a public HTTPS webpage URL.");
      return;
    }
    if (webpageUrl && !pastedContent && title.trim().length > 0 && title.trim().length < 3) {
      setError("A custom webpage title must contain at least 3 characters.");
      return;
    }
    setIngesting(true);
    setError("");
    setNotice("");
    try {
      const result = pastedContent.length >= 40
        ? await neuralPathApi.ingestKnowledge({
            title: title.trim(),
            content: pastedContent,
            ...(webpageUrl ? { source_url: webpageUrl } : {}),
          })
        : await neuralPathApi.ingestWebsite({
            url: webpageUrl,
            ...(title.trim() ? { title: title.trim() } : {}),
          });
      setTitle("");
      setContent("");
      setSourceUrl("");
      setNotice(`Added ${result.chunks_created} searchable chunks using BGE-M3 (${result.dimensions} dimensions).`);
      await loadSources();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add this knowledge source.");
    } finally {
      setIngesting(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!docFile) {
      setError("Please select a PDF or DOCX file to upload.");
      return;
    }
    if (docFile.size > 10 * 1024 * 1024) {
      setError("Document exceeds the 10 MB size limit.");
      return;
    }
    setUploadingDoc(true);
    setError("");
    setNotice("");
    try {
      const result = await neuralPathApi.ingestDocument(docFile, docTitle.trim() || undefined);
      setDocFile(null);
      setDocTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice(`Added ${result.chunks_created} searchable chunks from "${result.source_title}" using BGE-M3.`);
      await loadSources();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to process document.");
    } finally {
      setUploadingDoc(false);
    }
  }


  async function discoverResources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const topic = resourceTopic.trim();
    if (topic.length < 2 || resourceLoading) return;
    setResourceLoading(true);
    setError("");
    try {
      const result = await neuralPathApi.discoverLearningResources(topic);
      setResourceResults(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to find learning resources right now.");
    } finally {
      setResourceLoading(false);
    }
  }

  async function sendPrompt(promptText: string) {
    const prompt = promptText.trim();
    if (prompt.length < 2 || loading) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: prompt };
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages(previous => [...previous, userMessage, { id: assistantId, role: "assistant", text: "", retryPrompt: prompt }]);
    setQuestion("");
    setLoading(true);
    setError("");
    let receivedTokens = false;
    try {
      const result = await neuralPathApi.askAiStream(
        prompt,
        activeConversationId ?? undefined,
        token => {
          receivedTokens = true;
          setMessages(previous =>
            previous.map(message =>
              message.id === assistantId ? { ...message, text: message.text + token, interrupted: false } : message
            )
          );
        },
        controller.signal
      );
      setActiveConversationId(result.conversation_id);
      void loadConversations();
      setMessages(previous =>
        previous.map(message =>
          message.id === assistantId ? { ...message, text: result.answer, result, interrupted: false } : message
        )
      );
    } catch (cause) {
      const isAbort = cause instanceof Error && cause.message === "Generation stopped.";
      if (isAbort) {
        setMessages(previous =>
          previous.filter(message => !(message.id === assistantId && message.text === ""))
        );
      } else if (receivedTokens) {
        setMessages(previous =>
          previous.map(message =>
            message.id === assistantId ? { ...message, interrupted: true } : message
          )
        );
      } else {
        setMessages(previous =>
          previous.filter(message => message.id !== assistantId && message.id !== userMessage.id)
        );
        setQuestion(prompt);
        setError(cause instanceof Error ? cause.message : "NeuralPath could not answer right now. Your question is ready to retry.");
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendPrompt(question);
  }

  async function removeSource(source: KnowledgeSource) {
    if (!window.confirm(`Delete "${source.title}" and all of its embedded chunks?`)) return;
    setError("");
    try {
      await neuralPathApi.deleteKnowledge(source.source_id);
      setSources(previous => previous.filter(item => item.source_id !== source.source_id));
      setNotice(`Deleted "${source.title}".`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this source.");
    }
  }

  return (
    <section className="panel" style={{ padding: 22, marginBottom: 24 }}>
      <div className="panel-head">
        <div>
          <span className="section-eyebrow">YOUR PERSONAL AI LEARNING SPACE</span>
          <h3>NeuralPath AI Tutor</h3>
          <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13, margin: "6px 0 0" }}>
            Ask questions grounded in your own notes and learning material.
          </p>
        </div>
        <div className="resource-icon"><Bot size={20}/></div>
      </div>

      {!neuralPathApi.isConfigured ? (
        <p role="alert" style={{ color: "#f59e0b" }}>The API URL is not configured for this deployment.</p>
      ) : null}


      <section style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Search size={16}/><b style={{ fontSize: 14 }}>Discover learning resources</b></div>
        <p style={{ color: "var(--muted,#9ca3af)", fontSize: 12, margin: "0 0 10px" }}>Find relevant YouTube lessons, podcasts and real open-source projects from GitHub.</p>
        <form onSubmit={discoverResources} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Topic to search for learning resources" value={resourceTopic} onChange={event => setResourceTopic(event.target.value)} minLength={2} maxLength={160} required placeholder="e.g. React hooks, Python machine learning" style={{ flex: "1 1 220px", minWidth: 0, borderRadius: 9, padding: 10, background: "var(--input,rgba(15,23,42,.35))", color: "inherit", border: "1px solid var(--border,rgba(148,163,184,.25))" }}/>
          <button className="primary-btn" type="submit" disabled={resourceLoading || resourceTopic.trim().length < 2}>{resourceLoading ? <LoaderCircle size={14}/> : <Search size={14}/>} {resourceLoading ? "Searching…" : "Find resources"}</button>
        </form>
        {resourceResults ? <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <ResourceGroup title="Videos · YouTube" items={resourceResults.videos} empty="No YouTube results returned. Configure YOUTUBE_API_KEY for ranked results."/>
          <ResourceGroup title="Audio · Podcasts" items={resourceResults.audio} empty="No matching podcast series were found."/>
          <ResourceGroup title="Projects · GitHub" items={resourceResults.projects} empty="No matching repositories were found."/>
        </div> : null}
      </section>

      <div style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={16}/>
            <b style={{ fontSize: 13 }}>Recent conversations</b>
            <span style={{ color: "var(--muted,#9ca3af)", fontSize: 11 }}>{conversations.length}/30</span>
          </div>
          <button type="button" className="text-btn" onClick={() => void openConversation("")} disabled={loading} aria-label="Start a new conversation">
            <Plus size={14}/> New chat
          </button>
        </div>
        {conversations.length ? (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {conversations.map(conversation => (
              <button key={conversation.id} type="button" onClick={() => void openConversation(conversation.id)} disabled={loading}
                aria-pressed={activeConversationId === conversation.id}
                style={{
                  flex: "0 0 auto", minWidth: 150, maxWidth: 230, textAlign: "left", padding: "9px 11px",
                  borderRadius: 10, border: "1px solid var(--border,rgba(148,163,184,.2))",
                  background: activeConversationId === conversation.id ? "rgba(99,102,241,.16)" : "transparent",
                  color: "inherit", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .65 : 1,
                }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.title}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 10, color: "var(--muted,#9ca3af)" }}>{new Date(conversation.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--muted,#9ca3af)", fontSize: 12 }}>Your saved chats will appear here after your first question.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={17}/>
            <b>Ask your AI tutor</b>
          </div>
          <div aria-live="polite" style={{
            minHeight: 320,
            maxHeight: 520,
            overflowY: "auto",
            display: "grid",
            alignContent: "start",
            gap: 12,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--border,rgba(148,163,184,.2))",
            background: "rgba(15,23,42,.18)",
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "42px 12px", color: "var(--muted,#9ca3af)" }}>
                <Bot size={30} style={{ margin: "0 auto 12px" }}/>
                <b style={{ display: "block", color: "var(--foreground,#e5e7eb)" }}>Ready when you are</b>
                <p style={{ fontSize: 13 }}>Add your notes to the knowledge library, then ask a question about them.</p>
              </div>
            ) : messages.map(message => (
              <article key={message.id} style={{
                justifySelf: message.role === "user" ? "end" : "stretch",
                maxWidth: message.role === "user" ? "88%" : "100%",
                padding: 12,
                borderRadius: 12,
                background: message.role === "user" ? "rgba(99,102,241,.16)" : "rgba(148,163,184,.08)",
                border: "1px solid var(--border,rgba(148,163,184,.18))",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 14,
                lineHeight: 1.65,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, color: "var(--muted,#9ca3af)", fontSize: 11 }}>
                  {message.role === "user" ? <UserRound size={13}/> : <Bot size={13}/>}
                  <b>{message.role === "user" ? "You" : "NeuralPath"}</b>
                  {message.result ? <span>· {message.result.provider} / {message.result.model}</span> : null}
                </div>
                {message.role === "assistant" ? <MarkdownMessage content={message.text} /> : message.text}
                {message.interrupted ? (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#f59e0b" }}>Response interrupted.</span>
                    <button
                      type="button"
                      className="site-button small"
                      style={{ padding: "3px 9px", fontSize: 11, minHeight: "auto" }}
                      onClick={() => message.retryPrompt && void sendPrompt(message.retryPrompt)}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {(message.result?.sources ?? message.sources ?? []).length ? (
                  <div style={{ borderTop: "1px solid var(--border,rgba(148,163,184,.18))", marginTop: 10, paddingTop: 8 }}>
                    <small style={{ color: "var(--muted,#9ca3af)", display: "block", marginBottom: 5 }}>Retrieved sources</small>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(message.result?.sources ?? message.sources ?? []).map(source => (
                        <a key={source.citation} href={source.url ?? undefined} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined}
                          style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, border: "1px solid var(--border,rgba(148,163,184,.2))", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span>[{source.citation}] {source.title}</span>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: source.visibility === "public" ? "rgba(103,215,237,0.15)" : "rgba(155,140,255,0.15)", color: source.visibility === "public" ? "var(--cyan,#67d7ed)" : "var(--purple,#9b8cff)" }}>
                            {source.visibility === "public" ? "NeuralPath library" : "Your notes"}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {loading ? <div className="np-chat-skeleton" role="status" aria-label="NeuralPath is preparing an answer"><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line"/><span className="np-skeleton np-skeleton-line"/></div> : null}
          </div>
          <form onSubmit={ask} style={{ display: "grid", gap: 8 }}>
            <label htmlFor="neuralpath-ai-question" style={{ fontSize: 12, color: "var(--muted,#9ca3af)" }}>Your question</label>
            <textarea id="neuralpath-ai-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} minLength={2}
              placeholder="Ask about a topic, concept, or your uploaded notes…" rows={3} required
              style={{ width: "100%", resize: "vertical", borderRadius: 10, padding: 12, background: "var(--input,rgba(15,23,42,.35))", color: "inherit", border: "1px solid var(--border,rgba(148,163,184,.25))" }}/>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="primary-btn" type="submit" disabled={loading || question.trim().length < 2}>
              {loading ? <LoaderCircle size={15}/> : <Send size={15}/>} {loading ? "Generating…" : "Ask NeuralPath"}
            </button>
            {loading ? <button className="text-btn" type="button" onClick={() => abortControllerRef.current?.abort()}>Stop generating</button> : null}
            </div>
          </form>
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <details open style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 12, padding: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15}/> Add learning material
            </summary>
            <form onSubmit={addSource} style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Title
                <input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} minLength={3} required placeholder="e.g. Python functions notes"/>
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Source URL (optional)
                <input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2048} placeholder="https://…"/>
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Text content
                <textarea value={content} onChange={event => setContent(event.target.value)} maxLength={50000} minLength={0} rows={8} placeholder="Paste notes (at least 40 characters), or leave blank to import the webpage URL…" style={{ resize: "vertical" }}/>
              </label>
              <button className="primary-btn" type="submit" disabled={ingesting || (content.trim().length < 40 && !sourceUrl.trim()) || (content.trim().length >= 40 && title.trim().length < 3)}>
                {ingesting ? <LoaderCircle size={15}/> : <Plus size={15}/>} {ingesting ? "Embedding material…" : "Save to knowledge library"}
              </button>
              <small style={{ color: "var(--muted,#9ca3af)", lineHeight: 1.5 }}>
                Paste text, import a public HTTPS webpage, or upload PDF and DOCX files. Files and webpages are parsed, cleaned, chunked and embedded with Cloudflare BGE-M3 into your private library. Video transcripts are not yet supported.
              </small>
            </form>
            <form onSubmit={uploadDocument} style={{ display: "grid", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--border,rgba(148,163,184,.25))" }}>
              <span style={{ fontSize: 12, fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
                📄 Upload document (PDF / DOCX)
              </span>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Document title (optional)
                <input value={docTitle} onChange={e => setDocTitle(e.target.value)} maxLength={160} placeholder="Defaults to file name" />
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Document file (PDF or DOCX, max 10 MB)
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => setDocFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
              <button className="primary-btn" type="submit" disabled={uploadingDoc || !docFile}>
                {uploadingDoc ? <LoaderCircle size={15}/> : <Plus size={15}/>} {uploadingDoc ? "Parsing & embedding…" : "Upload document"}
              </button>
            </form>
          </details>

          <div style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <b style={{ display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={16}/> Your knowledge library</b>
              <span style={{ fontSize: 11, color: "var(--muted,#9ca3af)" }}>{sources.length} sources</span>
            </div>
            {sourcesLoading ? <div className="np-library-skeleton" role="status" aria-label="Loading knowledge library">{[1,2,3].map(n=><span className="np-skeleton np-skeleton-line" key={n}/>)}</div> : sources.length ? <div style={{ display: "grid", gap: 9 }}>
              {sources.map(source => (
                <article key={source.source_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, padding: "9px 0", borderTop: "1px solid var(--border,rgba(148,163,184,.15))" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13, overflowWrap: "anywhere" }}>{source.title}</b>
                    <small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 4 }}>{source.chunks} chunks · {new Date(source.created_at).toLocaleDateString()}</small>
                  </div>
                  <button className="text-btn" type="button" aria-label={`Delete ${source.title}`} onClick={() => void removeSource(source)}><Trash2 size={14}/></button>
                </article>
              ))}
            </div> : <div className="np-empty-state compact"><BookOpen size={21}/><b>Your library is ready for its first note</b><span>Add study notes or learning material to give your AI tutor context.</span></div>}
          </div>
        </aside>
      </div>

      {error ? <p role="alert" style={{ color: "#f59e0b", fontSize: 13, marginTop: 12 }}><AlertCircle size={14}/> {error}</p> : null}
      {notice ? <p role="status" style={{ color: "#34d399", fontSize: 13, marginTop: 12 }}>{notice}</p> : null}
      <p style={{ color: "var(--muted,#9ca3af)", fontSize: 11, margin: "14px 0 0" }}>
        Your notes are private to your signed-in account. AI providers receive the text needed to create embeddings or answer your question; avoid adding passwords, API keys, or sensitive personal information.
      </p>
    </section>
  );
}

function ResourceGroup({ title, items, empty }: { title: string; items: LearningResourceResults["videos"]; empty: string }) {
  return <section>
    <b style={{ display: "block", fontSize: 13, marginBottom: 7 }}>{title}</b>
    {items.length ? <div style={{ display: "grid", gap: 7 }}>
      {items.map((item, index) => <a key={item.url || index} href={item.url} target="_blank" rel="noreferrer" style={{ display: "flex", gap: 10, alignItems: "center", padding: 9, border: "1px solid var(--border,rgba(148,163,184,.16))", borderRadius: 9, color: "inherit", textDecoration: "none" }}>
        {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" style={{ width: 76, height: 52, objectFit: "cover", borderRadius: 6 }}/> : null}
        <span style={{ minWidth: 0, flex: 1 }}><b style={{ display: "block", fontSize: 12, lineHeight: 1.4 }}>{item.title}</b><small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 3 }}>{item.creator} · {item.provider}{item.stars ? ` · ★ ${item.stars.toLocaleString()}` : ""}</small><small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 2 }}>{item.description.slice(0, 180)}</small></span>
        <ExternalLink size={14}/>
      </a>{item.audioUrl ? <audio key={item.audioUrl} controls preload="none" src={item.audioUrl} style={{ width: "100%", height: 38 }}/> : null}</div>)}
    </div> : <p style={{ color: "var(--muted,#9ca3af)", fontSize: 12, margin: 0 }}>{empty}</p>}
  </section>;
}
