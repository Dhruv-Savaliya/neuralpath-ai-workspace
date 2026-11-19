export default function Loading() {
  return <main className="np-route-loading" aria-busy="true" aria-label="Loading page">
    <div className="np-skeleton-brand"><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line"/></div>
    <div className="np-skeleton-heading"><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line title"/><span className="np-skeleton np-skeleton-line"/></div>
    <div className="np-skeleton-grid">{[1,2,3].map(n=><div className="np-skeleton-card" key={n}><span className="np-skeleton np-skeleton-icon"/><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-line"/></div>)}</div>
    <div className="np-loading-caption">Preparing your NeuralPath experience…</div>
  </main>;
}