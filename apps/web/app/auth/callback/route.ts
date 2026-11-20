import { NextResponse,type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
export async function GET(request:NextRequest){
 const url=new URL(request.url); const code=url.searchParams.get("code"); const raw=url.searchParams.get("next")??"/onboarding";
 const next=raw.startsWith("/")&&!raw.startsWith("//")&&!raw.includes("\\\\")&&!/[\\u0000-\\u001f]/.test(raw)?raw:"/onboarding";
 if(code){const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}
 return NextResponse.redirect(new URL("/auth/sign-in?error=callback_failed",url.origin));
}