"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Save, UserRound } from "lucide-react";
import { neuralPathApi } from "../../lib/api/client";

const professions = ["student","employed","freelancer","founder","career_changer","creator","exploring","other"];
const levels = ["beginner","some_experience","intermediate","advanced"];

export default function WorkspaceProfilePanel() {
  const [name,setName] = useState("");
  const [profession,setProfession] = useState("exploring");
  const [level,setLevel] = useState("beginner");
  const [timezone,setTimezone] = useState("Asia/Kolkata");
  const [interests,setInterests] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  useEffect(() => {
    let active = true;
    neuralPathApi.getProfile().then(profile => {
      if (!active) return;
      setName(profile.display_name ?? "");
      setProfession(profile.profession ?? "exploring");
      setLevel(profile.experience_level ?? "beginner");
      setTimezone(profile.timezone ?? "Asia/Kolkata");
      setInterests((profile.interests ?? []).join(", "));
    }).catch(cause => { if(active) setError(cause instanceof Error ? cause.message : "Unable to load your profile."); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  },[]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await neuralPathApi.updateProfile({
        display_name:name.trim(),
        profession,
        experience_level:level,
        timezone:timezone.trim() || "Asia/Kolkata",
        interests:interests.split(",").map(v=>v.trim()).filter(Boolean).slice(0,20),
      });
      setNotice("Your learning profile has been updated.");
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  return <section className="panel" style={{marginBottom:24,padding:22}}>
    <div className="panel-head"><div><span className="section-eyebrow">YOUR LEARNING PROFILE</span><h3>Personalize your workspace</h3></div><UserRound size={18}/></div>
    {loading ? <div className="np-profile-skeleton" role="status" aria-label="Loading profile">{[1,2,3,4,5].map(n=><div key={n}><span className="np-skeleton np-skeleton-line short"/><span className="np-skeleton np-skeleton-block"/></div>)}</div> : <form onSubmit={submit} className="workspace-profile-form">
      <label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
      <label>Profession<select value={profession} onChange={e=>setProfession(e.target.value)}>{professions.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label>
      <label>Experience level<select value={level} onChange={e=>setLevel(e.target.value)}>{levels.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label>
      <label>Interests (comma-separated)<input value={interests} onChange={e=>setInterests(e.target.value)} maxLength={1000} placeholder="Technology, AI, design"/></label>
      <label>Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)} maxLength={80}/></label>
      <button className="primary-btn" type="submit" disabled={saving}>{saving?<LoaderCircle size={15}/>:<Save size={15}/>} Save profile</button>
    </form>}
    {error&&<div className="np-inline-error" role="alert"><span>{error}</span><button type="button" className="text-btn" onClick={()=>window.location.reload()}>Retry</button></div>}
    {notice&&<p role="status" style={{color:"#34d399"}}>{notice}</p>}
  </section>;
}
