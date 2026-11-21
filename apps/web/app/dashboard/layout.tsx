import "../dashboard.css";
import "../dashboard-mobile.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
