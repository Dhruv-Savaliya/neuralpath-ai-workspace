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

export type KnowledgeSource = {
  source_id: string;
  title: string;
  url: string | null;
  created_at: string;
  chunks: number;
};

export type AiChatResponse = {
  answer: string;
  provider: string;
  model: string;
  sources: Array<{ citation: string; title: string; url: string | null; similarity: number }>;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Please sign in again to continue.");
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "The NeuralPath API request failed.");
  }
  return response.json() as Promise<T>;
}

export const neuralPathApi = {
  isConfigured: Boolean(baseUrl),
  getDashboard: () => request<WorkspaceDashboard>("/dashboard"),
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
  ingestKnowledge: (input: { title: string; content: string; source_url?: string }) =>
    request<{ source_id: string; source_title: string; chunks_created: number; embedding_model: string; dimensions: number }>("/ai/knowledge", { method: "POST", body: JSON.stringify(input) }),
  deleteKnowledge: (sourceId: string) =>
    request<{ deleted: boolean; chunks_deleted: number }>(`/ai/knowledge/${sourceId}`, { method: "DELETE" }),
  askAi: (question: string) =>
    request<AiChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ question }) }),
};
