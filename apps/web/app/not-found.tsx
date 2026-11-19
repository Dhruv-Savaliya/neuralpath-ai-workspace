import Link from "next/link";
import { ArrowLeft, Compass, Home, Search } from "lucide-react";
export default function NotFound() {
  return <main className="np-error-page"><div className="np-error-stars" aria-hidden="true"/><div className="np-error-content">
    <div className="np-error-orbit"><span>4</span><i/><b>0</b><i/><span>4</span></div>
    <span className="np-eyebrow"><i/> SIGNAL NOT FOUND</span>
    <h1>This path doesn't exist.</h1><p>The page may have moved, the link may be outdated, or the address may be incorrect. Your learning journey is still right where you left it.</p>
    <div className="np-error-actions"><Link className="np-primary" href="/"><Home size={16}/> Back to home</Link><Link className="np-secondary" href="/dashboard"><Compass size={16}/> Open workspace</Link></div>
    <Link className="np-error-back" href="/"><ArrowLeft size={13}/> Return to NeuralPath</Link>
  </div><small className="np-error-code">ERROR 404 · PAGE NOT FOUND</small></main>;
}