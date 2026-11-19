"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./globals.css";
export default function GlobalError({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  useEffect(()=>{console.error("NeuralPath global error:",error);},[error]);
  return <html lang="en"><body><main className="np-error-page"><div className="np-error-content"><div className="np-error-symbol"><AlertTriangle size={29}/></div><span className="np-eyebrow"><i/> SYSTEM RECOVERY</span><h1>NeuralPath needs a moment.</h1><p>A critical error interrupted the application. Please retry to start a fresh session.</p><button className="np-primary" onClick={()=>reset()}><RefreshCw size={16}/> Reload experience</button><small className="np-error-code">ERROR 500 · GLOBAL APPLICATION ERROR</small></div></main></body></html>;
}