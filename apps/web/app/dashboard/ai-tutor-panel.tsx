"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, Bot, LoaderCircle, MessageCircle, Plus, Send, Trash2, UserRound } from "lucide-react";
import { neuralPathApi, type AiChatResponse, type KnowledgeSource } from "../../lib/api/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AiChatResponse;
};

export default function AiTutorPanel() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSources = useCallback(async () => {
    try {
      setSources(await neuralPathApi.getKnowledgeSources());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your knowledge library.");
    }
  }, []);

  useEffect(() => { void loadSources(); }, [loadSources]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3 || content.trim().length < 40) {
      setError("Add a title and at least 40 characters of learning material.");
      return;
    }
    setIngesting(true);
    setError("");
    setNotice("");
    try {
      const result = await neuralPathApi.ingestKnowledge({
        title: title.trim(),
        content: content.trim(),
        ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}),
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

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (prompt.length < 2 || loading) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: prompt };
    setMessages(previous => [...previous, userMessage]);
    setQuestion("");
    setLoading(true);
    setError("");
    try {
      const result = await neuralPathApi.askAi(prompt);
      setMessages(previous => [...previous, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.answer,
        result,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "NeuralPath could not answer right now.");
    } finally {
      setLoading(false);
    }
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
                {message.text}
                {message.result?.sources.length ? (
                  <div style={{ borderTop: "1px solid var(--border,rgba(148,163,184,.18))", marginTop: 10, paddingTop: 8 }}>
                    <small style={{ color: "var(--muted,#9ca3af)", display: "block", marginBottom: 5 }}>Retrieved sources</small>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {message.result.sources.map(source => (
                        <a key={source.citation} href={source.url ?? undefined} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined}
                          style={{ fontSize: 11, padding: "3px 7px", borderRadius: 7, border: "1px solid var(--border,rgba(148,163,184,.2))" }}>
                          [{source.citation}] {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {loading ? <p role="status" style={{ color: "var(--muted,#9ca3af)", fontSize: 13 }}><LoaderCircle size={14}/> NeuralPath is thinking…</p> : null}
          </div>
          <form onSubmit={ask} style={{ display: "grid", gap: 8 }}>
            <label htmlFor="neuralpath-ai-question" style={{ fontSize: 12, color: "var(--muted,#9ca3af)" }}>Your question</label>
            <textarea id="neuralpath-ai-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} minLength={2}
              placeholder="Ask about a topic, concept, or your uploaded notes…" rows={3} required
              style={{ width: "100%", resize: "vertical", borderRadius: 10, padding: 12, background: "var(--input,rgba(15,23,42,.35))", color: "inherit", border: "1px solid var(--border,rgba(148,163,184,.25))" }}/>
            <button className="primary-btn" type="submit" disabled={loading || question.trim().length < 2}>
              {loading ? <LoaderCircle size={15}/> : <Send size={15}/>} Ask NeuralPath
            </button>
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
                <textarea value={content} onChange={event => setContent(event.target.value)} maxLength={50000} minLength={40} rows={8} required placeholder="Paste your notes or learning material here (at least 40 characters)…" style={{ resize: "vertical" }}/>
              </label>
              <button className="primary-btn" type="submit" disabled={ingesting || title.trim().length < 3 || content.trim().length < 40}>
                {ingesting ? <LoaderCircle size={15}/> : <Plus size={15}/>} {ingesting ? "Embedding material…" : "Save to knowledge library"}
              </button>
              <small style={{ color: "var(--muted,#9ca3af)", lineHeight: 1.5 }}>
                Your text is split into chunks and embedded with Cloudflare BGE-M3. Source URLs are stored as references; the API does not fetch them.
              </small>
            </form>
          </details>

          <div style={{ border: "1px solid var(--border,rgba(148,163,184,.2))", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <b style={{ display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={16}/> Your knowledge library</b>
              <span style={{ fontSize: 11, color: "var(--muted,#9ca3af)" }}>{sources.length} sources</span>
            </div>
            {sources.length ? <div style={{ display: "grid", gap: 9 }}>
              {sources.map(source => (
                <article key={source.source_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, padding: "9px 0", borderTop: "1px solid var(--border,rgba(148,163,184,.15))" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13, overflowWrap: "anywhere" }}>{source.title}</b>
                    <small style={{ display: "block", color: "var(--muted,#9ca3af)", marginTop: 4 }}>{source.chunks} chunks · {new Date(source.created_at).toLocaleDateString()}</small>
                  </div>
                  <button className="text-btn" type="button" aria-label={`Delete ${source.title}`} onClick={() => void removeSource(source)}><Trash2 size={14}/></button>
                </article>
              ))}
            </div> : <p style={{ color: "var(--muted,#9ca3af)", fontSize: 13 }}>No learning material added yet.</p>}
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
