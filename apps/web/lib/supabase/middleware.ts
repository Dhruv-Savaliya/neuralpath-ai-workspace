import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const authRoute = path === "/auth/sign-in" || path === "/auth/sign-up";
  function redirectTo(pathname: string, next?: string) {
    const destination = new URL(pathname, request.url);
    if (next) destination.searchParams.set("next", next);
    const redirect = NextResponse.redirect(destination);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return authRoute ? response : redirectTo("/auth/sign-in", path);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const protectedRoute = path.startsWith("/dashboard") || path.startsWith("/onboarding") || path.startsWith("/settings");

  if (protectedRoute && !user) {
    return redirectTo("/auth/sign-in", path);
  }

  if (authRoute && user) {
    return redirectTo("/onboarding");
  }

  if (user && (path.startsWith("/dashboard") || path === "/onboarding")) {
    const { data: profile, error } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
    if (error) return new NextResponse("Unable to load your learning profile. Please retry.", { status: 503, headers: { "Cache-Control": "no-store" } });
    if (path.startsWith("/dashboard") && !profile?.onboarding_completed) {
      return redirectTo("/onboarding");
    }
    if (path === "/onboarding" && profile?.onboarding_completed) {
      return redirectTo("/dashboard");
    }
  }

  return response;
}
