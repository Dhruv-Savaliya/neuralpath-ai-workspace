"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  useEffect(()=>{console.error("NeuralPath route error:",error);},[error]);
  return <main className="np-error-page"><div className="np-error-stars" aria-hidden="true"/><div className="np-error-content">
    <div className="np-error-symbol"><AlertTriangle size={29}/></div><span className="np-eyebrow"><i/> TEMPORARY INTERRUPTION</span>
    <h1>Something didn't go as planned.</h1><p>An unexpected error interrupted this page. Your saved learning progress is not affected. Try again, or return to a safe page.</p>
    {error.digest?<small className="np-error-digest">Reference: {error.digest}</small>:null}
    <div className="np-error-actions"><button className="np-primary" onClick={()=>reset()}><RefreshCw size={16}/> Try again</button><Link className="np-secondary" href="/"><ArrowLeft size={16}/> Back home</Link></div>
    <small className="np-error-code">ERROR 500 · APPLICATION ERROR</small>
  </div></main>;
}