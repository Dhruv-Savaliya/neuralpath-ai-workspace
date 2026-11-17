-- Keep the onboarding RPC callable only by authenticated users and execute
-- with the caller's privileges so the existing ownership RLS policies apply.
-- Grant only the profile columns that the RPC updates.
grant update (
  display_name,
  profession,
  experience_level,
  interests,
  timezone,
  onboarding_completed,
  onboarding_version
) on table public.profiles to authenticated;

alter function public.complete_onboarding(
  text, text, text[], text, text[], text, integer, jsonb, text
) security invoker;
