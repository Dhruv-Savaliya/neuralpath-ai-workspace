"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Save, UserRound } from "lucide-react";
import { neuralPathApi, type WorkspaceDashboard } from "../../lib/api/client";

const professions = ["student","employed","freelancer","founder","career_changer","creator","exploring","other"];
const levels = ["beginner","some_experience","intermediate","advanced"];

export default function WorkspaceProfilePanel({ profile, onSaved }: { profile: NonNullable<WorkspaceDashboard["profile"]>; onSaved: (profile: NonNullable<WorkspaceDashboard["profile"]>) => void }) {
  const [name,setName] = useState(profile.display_name ?? "");
  const [profession,setProfession] = useState(profile.profession ?? "exploring");
  const [level,setLevel] = useState(profile.experience_level ?? "beginner");
  const [timezone,setTimezone] = useState(profile.timezone ?? "Asia/Kolkata");
  const [interests,setInterests] = useState((profile.interests ?? []).join(", "));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await neuralPathApi.updateProfile({
        display_name:name.trim(),
        profession,
        experience_level:level,
        timezone:timezone.trim() || "Asia/Kolkata",
        interests:interests.split(",").map(v=>v.trim()).filter(Boolean).slice(0,20),
      });
      onSaved(saved);
      setNotice("Your learning profile has been updated.");
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  return <section className="panel" style={{marginBottom:24,padding:22}}>
    <div className="panel-head"><div><span className="section-eyebrow">YOUR LEARNING PROFILE</span><h3>Personalize your workspace</h3></div><UserRound size={18}/></div>
    <form onSubmit={submit} className="workspace-profile-form">
      <label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
      <label>Profession<select value={profession} onChange={e=>setProfession(e.target.value)}>{professions.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label>
      <label>Experience level<select value={level} onChange={e=>setLevel(e.target.value)}>{levels.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label>
      <label>Interests (comma-separated)<input value={interests} onChange={e=>setInterests(e.target.value)} maxLength={1000} placeholder="Technology, AI, design"/></label>
      <label>Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)} maxLength={80}/></label>
      <button className="primary-btn" type="submit" disabled={saving}>{saving?<LoaderCircle size={15}/>:<Save size={15}/>} Save profile</button>
    </form>
    {error&&<div className="np-inline-error" role="alert"><span>{error}</span></div>}
    {notice&&<p role="status" style={{color:"#34d399"}}>{notice}</p>}
  </section>;
}
