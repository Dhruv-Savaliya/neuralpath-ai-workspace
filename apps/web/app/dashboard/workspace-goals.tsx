"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, LoaderCircle, Plus, RefreshCw, Target, Pencil, Trash2, Route } from "lucide-react";
import { neuralPathApi, type ApiGoal, type WorkspaceDashboard } from "../../lib/api/client";

export default function WorkspaceGoalsPanel({ data, refresh, openPath, openProfile }: {
  data: WorkspaceDashboard; refresh: () => Promise<void>; openPath: (id: string) => void; openProfile: () => void;
}) {
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [title,setTitle] = useState("");
  const [category,setCategory] = useState("");
  const [editing,setEditing] = useState<string|null>(null);
  const [retryGoalId,setRetryGoalId] = useState<string|null>(null);
  const [editTitle,setEditTitle] = useState("");
  const [editCategory,setEditCategory] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { await refresh(); }
    catch(cause) { setError(cause instanceof Error?cause.message:"Unable to load your saved learning workspace."); }
    finally { setLoading(false); }
  }

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
  function canOpenPath(goal: ApiGoal) {
    const path = goal.paths?.[0];
    return path && path.items.length > 0 && (path.status !== "in_progress" || path.items.length >= 45 * 4);
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
    setSaving(true);setError("");setNotice("Generating your personalized 45-day roadmap. This can take a little while; keep this page open.");
    try{await neuralPathApi.bootstrapPath(goal.id);setRetryGoalId(null);setNotice("Your 45-day learning path is ready.");await load();}
    catch(cause){setNotice("");setRetryGoalId(goal.id);setError(cause instanceof Error?cause.message:"Unable to create the learning path.");}
    finally{setSaving(false);}
  }

  return <section className="panel" style={{marginBottom:24,padding:22}}>
    <div className="panel-head"><div><span className="section-eyebrow">CLOUD-SAVED WORKSPACE</span><h3>Your learning goals</h3></div><button className="text-btn" type="button" onClick={()=>void load()} disabled={loading||saving}><RefreshCw size={14}/> Refresh</button></div>
    {error?<p role="alert" style={{color:"#f59e0b",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><AlertCircle size={16}/> {error}
      <button className="text-btn" type="button" disabled={saving||loading} onClick={()=>{const goal=data?.goals.find(item=>item.id===retryGoalId);if(goal)void createPath(goal);else void load();}}>Retry</button>
    </p>:null}
    <>
      <p style={{color:"var(--muted,#9ca3af)",margin:"0 0 14px"}}>{data.profile?.display_name ? "Welcome back, "+data.profile.display_name+". " : ""}{data.stats.totalGoals??0} saved goal(s) · {data.stats.totalPaths??0} learning path(s)</p>
      {data.goals.length?<div style={{display:"grid",gap:10,marginBottom:18}}>
        {data.goals.map(goal=><article key={goal.id} style={{border:"1px solid var(--border,rgba(148,163,184,.2))",borderRadius:12,padding:14}}>
          {editing===goal.id?<div className="workspace-goals-edit"><input aria-label="Goal title" value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={120}/><input aria-label="Goal category" value={editCategory} onChange={e=>setEditCategory(e.target.value)} maxLength={60}/><button className="primary-btn" type="button" disabled={saving} onClick={()=>void saveEdit(goal.id)}>Save</button><button className="text-btn" type="button" onClick={()=>setEditing(null)}>Cancel</button></div>:<>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><b>{goal.title}</b><p style={{margin:"4px 0 0",color:"var(--muted,#9ca3af)",fontSize:13}}>{goal.category} · {goal.status}</p></div><Target size={18}/></div>
            {goal.desired_outcome?<p style={{margin:"8px 0 0",fontSize:13}}>{goal.desired_outcome}</p>:null}
            <div className="workspace-goal-actions">
              <button className="text-btn" type="button" onClick={()=>startEdit(goal)}><Pencil size={13}/> Edit</button>
              <button className="text-btn" type="button" disabled={saving} onClick={()=>canOpenPath(goal) ? openPath(goal.paths[0].id) : void createPath(goal)}><Route size={13}/> {canOpenPath(goal) ? "Open 45-day path" : goal.paths?.length ? "Resume generation" : "Create 45-day path"}</button>
              <button className="text-btn" type="button" disabled={saving} onClick={()=>void deleteGoal(goal)}><Trash2 size={13}/> Delete</button>
            </div>
            {goal.paths?.map(path=><p key={path.id} style={{fontSize:12,color:"var(--muted,#9ca3af)",margin:"8px 0 0"}}>{path.title} · {path.items?.filter(item=>item.progress==="completed").length??0}/{path.items?.length??0} tasks complete</p>)}
          </>}
        </article>)}
      </div>:<div className="np-empty-state compact" style={{border:"1px dashed var(--border,rgba(148,163,184,.2))",borderRadius:12,marginBottom:18}}><Target size={22}/><b>Your next chapter starts with one goal</b><span>You haven&apos;t saved a learning goal yet. Add one below and NeuralPath can shape a practical path around it.</span></div>}
    </>
    <form className="workspace-goals-form" onSubmit={submitGoal}>
      <label style={{display:"grid",gap:6,fontSize:13}}>Goal title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} minLength={3} required placeholder="e.g. Learn full-stack development"/></label>
      <label style={{display:"grid",gap:6,fontSize:13}}>Category<input value={category} onChange={e=>setCategory(e.target.value)} maxLength={60} placeholder="e.g. Technology"/></label>
      <button className="primary-btn workspace-goals-submit" type="submit" disabled={saving||loading}>{saving?<LoaderCircle size={15}/>:<Plus size={15}/>} Save goal</button>
    </form>
    {notice?<p role="status" style={{color:"#34d399",margin:"12px 0 0",fontSize:13}}>{notice}</p>:null}
    <p style={{color:"var(--muted,#9ca3af)",fontSize:12,margin:"12px 0 0"}}>Saved through your signed-in session and the NeuralPath API. <button type="button" className="text-btn" onClick={openProfile}>Edit your learning profile</button></p>
  </section>;
}
