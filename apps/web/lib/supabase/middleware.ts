import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

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
  const path = request.nextUrl.pathname;
  const protectedRoute = path.startsWith("/dashboard") || path.startsWith("/onboarding") || path.startsWith("/settings");
  const authRoute = path === "/auth/sign-in" || path === "/auth/sign-up";

  if (protectedRoute && !user) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/auth/sign-in";
    destination.searchParams.set("next", path);
    return NextResponse.redirect(destination);
  }

  if (authRoute && user) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/onboarding";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (user && (path.startsWith("/dashboard") || path === "/onboarding")) {
    const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
    if (path.startsWith("/dashboard") && !profile?.onboarding_completed) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/onboarding";
      destination.search = "";
      return NextResponse.redirect(destination);
    }
    if (path === "/onboarding" && profile?.onboarding_completed) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/dashboard";
      destination.search = "";
      return NextResponse.redirect(destination);
    }
  }

  return response;
}
