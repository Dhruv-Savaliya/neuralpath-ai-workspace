"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, LoaderCircle, Plus, RefreshCw, Target, Pencil, Trash2, Route } from "lucide-react";
import { neuralPathApi, type ApiGoal, type WorkspaceDashboard } from "../../lib/api/client";

export default function WorkspaceGoalsPanel() {
  const [data,setData] = useState<WorkspaceDashboard|null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [title,setTitle] = useState("");
  const [category,setCategory] = useState("");
  const [editing,setEditing] = useState<string|null>(null);
  const [retryGoalId,setRetryGoalId] = useState<string|null>(null);
  const [editTitle,setEditTitle] = useState("");
  const [editCategory,setEditCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await neuralPathApi.getDashboard()); }
    catch(cause) { setError(cause instanceof Error?cause.message:"Unable to load your saved learning workspace."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load();},[load]);

  async function submitGoal(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(title.trim().length<3){setError("Please enter a goal with at least 3 characters.");return;}
    setSaving(true);setError("");setNotice("");
    try {
      await neuralPathApi.createGoal({title:title.trim(),category:category.trim()||"general"});
      setTitle("");setCategory("");setNotice("Your learning goal has been saved to your account.");await load();
    } catch(cause){setError(cause instanceof Error?cause.message:"Unable to save this goal.");}
    finally{setSaving(false);}
  }
  function startEdit(goal:ApiGoal){setEditing(goal.id);setEditTitle(goal.title);setEditCategory(goal.category);}
  async function saveEdit(id:string){
    if(editTitle.trim().length<3){setError("Goal title must contain at least 3 characters.");return;}
    setSaving(true);setError("");
    try{await neuralPathApi.updateGoal(id,{title:editTitle.trim(),category:editCategory.trim()||"general"});setEditing(null);setNotice("Goal updated.");await load();}
    catch(cause){setError(cause instanceof Error?cause.message:"Unable to update goal.");}
    finally{setSaving(false);}
  }
  async function deleteGoal(goal:ApiGoal){
    if(!window.confirm("Delete this goal and its learning path?"))return;
    setSaving(true);setError("");
    try{await neuralPathApi.deleteGoal(goal.id);setNotice("Goal deleted.");await load();}
    catch(cause){setError(cause instanceof Error?cause.message:"Unable to delete goal.");}
    finally{setSaving(false);}
  }
  async function createPath(goal:ApiGoal){
    setSaving(true);setError("");setNotice("");
    try{await neuralPathApi.bootstrapPath(goal.id);setRetryGoalId(null);setNotice("Your 45-day learning path is ready.");await load();}
    catch(cause){setRetryGoalId(goal.id);setError(cause instanceof Error?cause.message:"Unable to create the learning path.");}
    finally{setSaving(false);}
  }

  return <section className="panel" style={{marginBottom:24,padding:22}}>
    <div className="panel-head"><div><span className="section-eyebrow">CLOUD-SAVED WORKSPACE</span><h3>Your learning goals</h3></div><button className="text-btn" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {loading&&!data?<p role="status"><LoaderCircle size={16}/> Loading your saved goals…</p>:null}
    {error?<p role="alert" style={{color:"#f59e0b",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><AlertCircle size={16}/> {error}
      <button className="text-btn" type="button" disabled={saving||loading} onClick={()=>{const goal=data?.goals.find(item=>item.id===retryGoalId);if(goal)void createPath(goal);else void load();}}>Retry</button>
    </p>:null}
    {data?<>
      <p style={{color:"var(--muted,#9ca3af)",margin:"0 0 14px"}}>{data.profile?.display_name ? "Welcome back, "+data.profile.display_name+". " : ""}{data.stats.totalGoals??0} saved goal(s) · {data.stats.totalPaths??0} learning path(s)</p>
      {data.goals.length?<div style={{display:"grid",gap:10,marginBottom:18}}>
        {data.goals.map(goal=><article key={goal.id} style={{border:"1px solid var(--border,rgba(148,163,184,.2))",borderRadius:12,padding:14}}>
          {editing===goal.id?<div className="workspace-goals-edit"><input value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={120}/><input value={editCategory} onChange={e=>setEditCategory(e.target.value)} maxLength={60}/><button className="primary-btn" type="button" disabled={saving} onClick={()=>void saveEdit(goal.id)}>Save</button><button className="text-btn" type="button" onClick={()=>setEditing(null)}>Cancel</button></div>:<>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><b>{goal.title}</b><p style={{margin:"4px 0 0",color:"var(--muted,#9ca3af)",fontSize:13}}>{goal.category} · {goal.status}</p></div><Target size={18}/></div>
            {goal.desired_outcome?<p style={{margin:"8px 0 0",fontSize:13}}>{goal.desired_outcome}</p>:null}
            <div className="workspace-goal-actions">
              <button className="text-btn" type="button" onClick={()=>startEdit(goal)}><Pencil size={13}/> Edit</button>
              <button className="text-btn" type="button" disabled={saving} onClick={()=>void createPath(goal)}><Route size={13}/> {goal.paths?.length?"Open 45-day path":"Create 45-day path"}</button>
              <button className="text-btn" type="button" disabled={saving} onClick={()=>void deleteGoal(goal)}><Trash2 size={13}/> Delete</button>
            </div>
            {goal.paths?.map(path=><p key={path.id} style={{fontSize:12,color:"var(--muted,#9ca3af)",margin:"8px 0 0"}}>{path.title} · {path.items?.filter(item=>item.progress==="completed").length??0}/{path.items?.length??0} tasks complete</p>)}
          </>}
        </article>)}
      </div>:<p style={{color:"var(--muted,#9ca3af)",marginBottom:18}}>No saved goals yet. Add your first goal below.</p>}
    </>:null}
    <form className="workspace-goals-form" onSubmit={submitGoal}>
      <label style={{display:"grid",gap:6,fontSize:13}}>Goal title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} minLength={3} required placeholder="e.g. Learn full-stack development"/></label>
      <label style={{display:"grid",gap:6,fontSize:13}}>Category<input value={category} onChange={e=>setCategory(e.target.value)} maxLength={60} placeholder="e.g. Technology"/></label>
      <button className="primary-btn workspace-goals-submit" type="submit" disabled={saving||loading}>{saving?<LoaderCircle size={15}/>:<Plus size={15}/>} Save goal</button>
    </form>
    {notice?<p role="status" style={{color:"#34d399",margin:"12px 0 0",fontSize:13}}>{notice}</p>:null}
    <p style={{color:"var(--muted,#9ca3af)",fontSize:12,margin:"12px 0 0"}}>Saved through your signed-in session and the NeuralPath API. <a href="/onboarding" style={{textDecoration:"underline"}}>Edit your learning profile <ArrowUpRight size={11} style={{display:"inline"}}/></a></p>
  </section>;
}
