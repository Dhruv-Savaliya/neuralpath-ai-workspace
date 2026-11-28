export function safeNextPath(value: unknown) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/[\u0000-\u001f]/.test(path)
    ? path
    : "/onboarding";
}
