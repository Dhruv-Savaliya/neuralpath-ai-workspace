"use client";

import { createClient } from "../supabase/client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

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

export type AiChatResponse = {
  conversation_id: string;
  answer: string;
  provider: string;
  model: string;
  sources: Array<{ citation: string; title: string; url: string | null; similarity: number }>;
};

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<T> {
  if (!baseUrl) throw new Error("NeuralPath is not connected to its learning service. Please try again later.");
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
  bootstrapPath: (goal_id: string) => request<ApiPath>("/paths/bootstrap", { method: "POST", body: JSON.stringify({ goal_id }) }),
  saveProgress: (input: { path_item_id: string; status: "in_progress" | "completed"; reflection?: string }) =>
    request<{ id: string; status: string; completed_at: string | null }>("/progress", { method: "POST", body: JSON.stringify(input) }),
  getKnowledgeSources: () => request<KnowledgeSource[]>("/ai/knowledge"),
  getAiConversations: () => request<AiConversation[]>("/ai/conversations"),
  getAiConversation: (id: string) => request<{ conversation: AiConversation; messages: Array<{ id: string; role: "user" | "assistant"; content: string; created_at: string }> }>(`/ai/conversations/${id}`),
  ingestKnowledge: (input: { title: string; content: string; source_url?: string }) =>
    request<{ source_id: string; source_title: string; chunks_created: number; embedding_model: string; dimensions: number }>("/ai/knowledge", { method: "POST", body: JSON.stringify(input) }),
  deleteKnowledge: (sourceId: string) =>
    request<{ deleted: boolean; chunks_deleted: number }>(`/ai/knowledge/${sourceId}`, { method: "DELETE" }),
  askAi: (question: string, conversationId?: string) =>
    request<AiChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }) }, 95_000),
};
