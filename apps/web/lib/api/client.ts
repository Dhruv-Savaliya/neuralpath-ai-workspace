"use client";

import { createClient } from "../supabase/client";

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? (typeof window !== "undefined" ? "" : "")).replace(/\/$/, "");

export type ApiPathItem = {
  id: string;
  path_id: string;
  title: string;
  description: string;
  position: number;
  status: string;
  progress?: string;
  reflection?: string;
  completedAt?: string | null;
};

export type ApiPath = {
  id: string;
  title: string;
  status: string;
  goal_id: string;
  items: ApiPathItem[];
};

export type ApiGoal = {
  id: string;
  title: string;
  category: string;
  desired_outcome: string;
  current_level: string;
  target_date: string | null;
  status: "active" | "paused" | "completed" | "archived";
  paths: ApiPath[];
};

export type WorkspaceDashboard = {
  profile: { id: string; display_name: string; profession: string; experience_level: string; interests: string[]; timezone: string } | null;
  goals: ApiGoal[];
  paths: ApiPath[];
  stats: {
    totalGoals: number;
    activeGoals: number;
    totalPaths: number;
    totalItems: number;
    completedItems: number;
    progressPercent: number;
    completedThisWeek: number;
    completedDays: number;
    currentStreak: number;
    xp: number;
  };
};

export type LearnerInsights = {
  generatedAt: string;
  dataSource: "supabase";
  hasActivity: boolean;
  learner: {
    displayName: string;
    experienceLevel: string | null;
    interests: string[];
    timezone: string;
  };
  preferences: {
    learning_formats: string[];
    learning_pace: string;
    weekly_minutes: number;
    language_code: string;
    preferred_days: number[];
  } | null;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    priority: number;
    targetDate: string | null;
    daysUntilTarget: number | null;
    weeklyMinutes: number;
  }>;
  roadmap: {
    pathId: string | null;
    title: string | null;
    completedTasks: number;
    totalTasks: number;
    progressPercent: number;
    nextTasks: Array<{ id: string; title: string; description: string; day: number; status: string }>;
    phases: Array<{ name: string; firstDay: number; lastDay: number; completedTasks: number; totalTasks: number; progressPercent: number }>;
  };
  activity: {
    completedLast7Days: number;
    completedLast30Days: number;
    currentStreak: number;
    lastCompletedAt: number | null;
    weekly: Array<{ weekStart: string; completedTasks: number }>;
  };
  emptyState: { needsGoal: boolean; needsRoadmap: boolean; needsProgress: boolean };
};

export type LearningRecommendation = {
  candidateId: string;
  kind: "focus_task" | "adjust_weekly_minutes";
  taskId: string | null;
  goalId: string | null;
  title: string;
  actionValue: number | null;
  estimatedMinutes: number;
  reason: string;
  priority: number;
};
export type LearningRecommendations = {
  id?: string;
  source: "gemini" | "groq" | "deterministic";
  recommendations: LearningRecommendation[];
  message?: string;
};

export type KnowledgeSource = {
  source_id: string;
  title: string;
  url: string | null;
  created_at: string;
  chunks: number;
};

export type AiConversation = { id: string; title: string; created_at: string; updated_at: string };


export type LearningResource = {
  title: string;
  creator: string;
  description: string;
  url: string;
  thumbnail: string | null;
  audioUrl?: string | null;
  provider: "YouTube" | "Apple Podcasts" | "GitHub";
  verified: boolean;
  stars?: number;
};
export type LearningResourceResults = {
  topic: string;
  videos: LearningResource[];
  audio: LearningResource[];
  projects: LearningResource[];
  availability: { videos: "live" | "search_link" | "unavailable"; audio: "live" | "unavailable"; projects: "live" | "unavailable" };
};

export type AiChatResponse = {
  conversation_id: string;
  answer: string;
  provider: string;
  model: string;
  sources: Array<{ citation: string; title: string; url: string | null; similarity: number; visibility?: "private" | "public" | string }>;
};

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<T> {
  if (baseUrl === undefined) throw new Error("NeuralPath is not connected to its learning service. Please try again later.");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Your session has expired. Please sign in again.");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1${path}`, {
      ...init,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new Error("This is taking longer than expected. Check your connection and try again.");
    }
    throw new Error("We couldn't reach NeuralPath. Check your internet connection and try again.");
  }

  const raw = response.status === 204 ? "" : await response.text();
  type ApiErrorPayload = { message?: string; error?: string; detail?: string };
  let payload: ApiErrorPayload | null = null;
  if (raw) {
    try { payload = JSON.parse(raw) as ApiErrorPayload; } catch { payload = null; }
  }
  if (!response.ok) {
    const serverMessage = payload?.message ?? payload?.detail ?? payload?.error;
    const messages: Record<number, string> = {
      400: "Some information is missing or invalid. Review your entries and try again.",
      401: "Your session has expired. Please sign in again.",
      403: "You don't have permission to access this information.",
      404: "We couldn't find the requested learning resource. Refresh and try again.",
      409: "This change conflicts with a newer update. Refresh the page and try again.",
      422: "Some information couldn't be processed. Check your entries and try again.",
      429: "You're making requests a little too quickly. Please wait a moment and try again.",
      500: "NeuralPath hit a temporary server error. Your saved progress is safe — please retry.",
      502: "The learning service is temporarily unavailable. Please try again shortly.",
      503: "The learning service is under maintenance. Please try again shortly.",
      504: "The learning service took too long to respond. Please retry.",
    };
    throw new Error(serverMessage || messages[response.status] || `The request couldn't be completed (HTTP ${response.status}). Please try again.`);
  }
  if (!raw) return undefined as T;
  try { return JSON.parse(raw) as T; }
  catch { throw new Error("NeuralPath returned an unexpected response. Please refresh and try again."); }
}

export const neuralPathApi = {
  isConfigured: Boolean(baseUrl),
  getDashboard: () => request<WorkspaceDashboard>("/dashboard"),
  getLearnerInsights: () => request<LearnerInsights>("/learning/insights"),
  getLearningRecommendations: () => request<LearningRecommendations>("/learning/recommendations"),
  sendRecommendationFeedback: (id: string, candidateId: string, feedback: "helpful" | "dismissed") => request<{ saved: boolean }>(`/learning/recommendations/${id}/feedback`, { method: "POST", body: JSON.stringify({ candidateId, feedback }) }),
  acceptLearningRecommendation: (id: string, candidateId: string) => request<{ accepted: boolean }>(`/learning/recommendations/${id}/accept`, { method: "POST", body: JSON.stringify({ candidateId }) }),
  getGoals: () => request<ApiGoal[]>("/goals"),
  getProfile: () => request<{ id: string; display_name: string; profession: string; experience_level: string; interests: string[]; timezone: string }>("/profile"),
  updateProfile: (input: { display_name?: string; profession?: string; experience_level?: string; interests?: string[]; timezone?: string }) =>
    request("/profile", { method: "PATCH", body: JSON.stringify(input) }),
  createGoal: (input: { title: string; category?: string; desired_outcome?: string; current_level?: string; target_date?: string; weekly_minutes?: number }) =>
    request<ApiGoal>("/goals", { method: "POST", body: JSON.stringify(input) }),
  updateGoal: (id: string, input: Partial<Pick<ApiGoal, "title" | "category" | "desired_outcome" | "current_level" | "target_date" | "status">>) =>
    request<ApiGoal>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteGoal: (id: string) => request<{ deleted: boolean; id: string }>(`/goals/${id}`, { method: "DELETE" }),
  bootstrapPath: (goal_id: string) => request<ApiPath>("/paths/bootstrap", { method: "POST", body: JSON.stringify({ goal_id }) }, 180_000),
  saveProgress: (input: { path_item_id: string; status: "in_progress" | "completed"; reflection?: string }) =>
    request<{ id: string; status: string; completed_at: string | null }>("/progress", { method: "POST", body: JSON.stringify(input) }),
  getKnowledgeSources: () => request<KnowledgeSource[]>("/ai/knowledge"),
  getAiConversations: () => request<AiConversation[]>("/ai/conversations"),
  getAiConversation: (id: string) => request<{ conversation: AiConversation; messages: Array<{ id: string; role: "user" | "assistant"; content: string; sources: Array<{ citation: string; title: string; url: string | null; similarity: number }>; created_at: string }> }>(`/ai/conversations/${id}`),
  ingestKnowledge: (input: { title: string; content: string; source_url?: string }) =>
    request<{ source_id: string; source_title: string; chunks_created: number; embedding_model: string; dimensions: number }>("/ai/knowledge", { method: "POST", body: JSON.stringify(input) }),
  ingestWebsite: (input: { url: string; title?: string }) =>
    request<{ source_id: string; source_title: string; chunks_created: number; embedding_model: string; dimensions: number }>("/ai/knowledge/website", { method: "POST", body: JSON.stringify(input) }),
  ingestDocument: async (file: File, title?: string) => {
    if (baseUrl === undefined) throw new Error("NeuralPath is not connected to its learning service. Please try again later.");
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new Error("Your session has expired. Please sign in again.");
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    const response = await fetch(`${baseUrl}/api/v1/ai/knowledge/document`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const raw = await response.text();
      let message = "Document upload failed. Please try again.";
      try { message = (JSON.parse(raw) as { message?: string }).message ?? message; } catch { /* ignore */ }
      throw new Error(message);
    }
    return response.json() as Promise<{ source_id: string; source_title: string; chunks_created: number; embedding_model: string; dimensions: number }>;
  },
  deleteKnowledge: (sourceId: string) =>
    request<{ deleted: boolean; chunks_deleted: number }>(`/ai/knowledge/${sourceId}`, { method: "DELETE" }),

  discoverLearningResources: (topic: string) => request<LearningResourceResults>("/ai/resources/discover", { method: "POST", body: JSON.stringify({ topic }) }, 20_000),
  askAiStream: async (
    question: string, conversationId: string | undefined, onToken: (token: string) => void, signal?: AbortSignal,
  ): Promise<AiChatResponse> => {
    if (baseUrl === undefined) throw new Error("NeuralPath is not connected to its learning service. Please try again later.");
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new Error("Your session has expired. Please sign in again.");
    const timeoutSignal = AbortSignal.timeout(120_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1/ai/chat/stream`, {
        method: "POST", cache: "no-store", signal: requestSignal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }),
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "TimeoutError") throw new Error("This is taking longer than expected. Please try again.");
      if (cause instanceof DOMException && cause.name === "AbortError") throw new Error("Generation stopped.");
      throw new Error("We couldn't reach NeuralPath. Check your internet connection and try again.");
    }
    if (!response.ok) {
      const raw = await response.text();
      let message = "NeuralPath could not start the response. Please try again.";
      try { message = (JSON.parse(raw) as { message?: string }).message ?? message; } catch { /* safe fallback */ }
      throw new Error(message);
    }
    if (!response.body) throw new Error("Your browser could not read the AI response stream.");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", result: AiChatResponse | null = null;
    const processBlock = (block: string) => {
      const lines = block.split(/\r\n|\r|\n/);
      const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim() ?? "message";
      const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, "")).join("\n");
      if (!data) return;
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(data) as Record<string, unknown>; }
      catch { throw new Error("NeuralPath sent an invalid stream event. Please retry."); }
      if (event === "token" && typeof payload.content === "string") onToken(payload.content);
      if (event === "done") result = payload as unknown as AiChatResponse;
      if (event === "error") {
        const err = new Error(typeof payload.message === "string" ? payload.message : "NeuralPath could not complete this answer.") as Error & { code?: unknown; retryable?: boolean };
        err.code = payload.code ?? "STREAM_INTERRUPTED";
        err.retryable = payload.retryable !== false;
        throw err;
      }
    };
    const drain = () => {
      const delimiter = /(?:\r\n\r\n|\r\r|\n\n)/;
      let match: RegExpExecArray | null;
      while ((match = delimiter.exec(buffer))) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        processBlock(block);
      }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }
      buffer += decoder.decode();
      drain();
      if (buffer.trim()) processBlock(buffer);
    } catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === "AbortError")) throw new Error("Generation stopped.");
      if (cause instanceof DOMException && cause.name === "TimeoutError") throw new Error("This is taking longer than expected. Please try again.");
      throw cause;
    } finally {
      if (signal?.aborted) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    if (!result) throw new Error("The AI response ended before completion. Please retry.");
    return result;
  },
  askAi: (question: string, conversationId?: string) =>
    request<AiChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }) }, 120_000),
};
