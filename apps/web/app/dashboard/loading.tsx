export default function DashboardLoading() {
  return <main className="np-route-loading" aria-busy="true" aria-label="Loading your learning workspace">
    <div className="np-skeleton-brand"><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line"/></div>
    <div className="np-skeleton-heading"><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line title"/><span className="np-skeleton np-skeleton-line"/></div>
    <div className="np-skeleton-grid">{[1,2,3].map(n=><div className="np-skeleton-card" key={n}><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line"/></div>)}</div>
    <div className="np-loading-caption">Preparing your learning workspace…</div>
  </main>;
}
