import Link from "next/link";
import { ArrowLeft, RefreshCw, Server } from "lucide-react";
export default function HttpVersionNotSupported() {
  return <main className="np-error-page"><div className="np-error-stars" aria-hidden="true"/><div className="np-error-content">
    <div className="np-error-symbol"><Server size={29}/></div><span className="np-eyebrow"><i/> PROTOCOL MISMATCH</span>
    <h1>This connection isn&apos;t supported.</h1><p>The server cannot process the HTTP protocol version used by this request. Update your browser or retry using a current connection.</p>
    <div className="np-error-actions"><Link className="np-primary" href="/"><RefreshCw size={16}/> Return to NeuralPath</Link><Link className="np-secondary" href="/contact"><ArrowLeft size={16}/> Get support</Link></div>
    <small className="np-error-code">HTTP 505 · VERSION NOT SUPPORTED</small>
  </div></main>;
}