"use client";

import { createClient } from "../supabase/client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export type ApiGoal = {
  id: string;
  title: string;
  category: string;
  desired_outcome: string;
  current_level: string;
  target_date: string | null;
  status: "active" | "paused" | "completed" | "archived";
  paths: Array<{ id: string; title: string; status: string; items: Array<{ id: string; title: string; progress: string }> }>;
};

export type WorkspaceDashboard = {
  profile: { id: string; display_name: string; profession: string; experience_level: string } | null;
  goals: ApiGoal[];
  paths: ApiGoal["paths"];
  stats: {
    totalGoals: number;
    activeGoals: number;
    totalPaths: number;
    totalItems: number;
    completedItems: number;
    progressPercent: number;
    completedThisWeek: number;
  };
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
  createGoal: (input: { title: string; category?: string; desired_outcome?: string; current_level?: string; target_date?: string; weekly_minutes?: number }) =>
    request<ApiGoal>("/goals", { method: "POST", body: JSON.stringify(input) }),
  saveProgress: (input: { path_item_id: string; status: "in_progress" | "completed"; reflection?: string }) =>
    request<{ id: string; status: string; completed_at: string | null }>("/progress", { method: "POST", body: JSON.stringify(input) }),
};
