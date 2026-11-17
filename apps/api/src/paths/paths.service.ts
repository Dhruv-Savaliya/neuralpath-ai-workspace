import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import type { BootstrapPathDto } from "./dto/bootstrap-path.dto";

const topics = [
  "Python setup & syntax","Control flow","Core collections","Functions","OOP essentials","Files & exceptions","Python mini-project",
  "Linear algebra essentials","Statistics & probability","NumPy","Pandas","Data visualization",
  "ML workflow","Regression","Classification","Model evaluation","Preprocessing","Tree models","Unsupervised learning","ML mini-project",
  "Neural network concepts","PyTorch tensors","Build a neural network","Training loop","Deep learning mini-project",
  "NLP foundations","Transformers","LLM APIs","Prompt engineering","Embeddings","Vector databases","RAG fundamentals",
  "AI service with FastAPI","LangChain or LlamaIndex","Build a RAG assistant","Tool calling & agents","Persist AI app data",
  "Docker fundamentals","AI app integration","Capstone planning","BizDhan AI: ingestion","BizDhan AI: intelligence","BizDhan AI: RAG assistant",
  "Quality & evaluation","Deployment, observability & portfolio launch",
];
const taskTemplates = [
  { title:"Learn the core concept", description:"Study the topic and write a short explanation in your own words.", item_type:"lesson" },
  { title:"Code without copying", description:"Create a small working example and test at least two edge cases.", item_type:"exercise" },
  { title:"Make concise notes", description:"Write three takeaways and one question you still have.", item_type:"resource" },
  { title:"Commit your progress", description:"Push today's code and add a useful README note.", item_type:"project" },
];

@Injectable()
export class PathsService {
  async bootstrap(req: AuthenticatedRequest, dto: BootstrapPathDto) {
    const userId = req.user.id;
    const db = req.supabase;
    const { data: goal, error: goalError } = await db.from("learning_goals").select("id,title").eq("id",dto.goal_id).eq("user_id",userId).maybeSingle();
    if (goalError) throw new InternalServerErrorException("Unable to verify the learning goal.");
    if (!goal) throw new NotFoundException("Learning goal was not found.");

    const { data: existing, error: pathError } = await db.from("learning_paths").select("*").eq("user_id",userId).eq("goal_id",goal.id).eq("title","45-day AI engineering roadmap").maybeSingle();
    if (pathError) throw new InternalServerErrorException("Unable to load the learning path.");
    let path = existing;
    if (!path) {
      const { data, error } = await db.from("learning_paths").insert({user_id:userId,goal_id:goal.id,title:"45-day AI engineering roadmap",description:"A practical 45-day progression from Python foundations to production-ready AI applications.",status:"active"}).select("*").single();
      if (error || !data) throw new InternalServerErrorException("Unable to create your learning path.");
      path = data;
      const items = topics.flatMap((topic,day)=>taskTemplates.map((task,index)=>({user_id:userId,path_id:path!.id,title:"Day "+(day+1)+": "+task.title,description:topic+" — "+task.description,item_type:task.item_type,position:day*4+index,status:"not_started"})));
      const { error: itemError } = await db.from("learning_path_items").insert(items);
      if (itemError) {
        await db.from("learning_paths").delete().eq("id",path.id).eq("user_id",userId);
        throw new InternalServerErrorException("Unable to create roadmap tasks. Please retry.");
      }
    }

    let { data: items, error: itemsError } = await db.from("learning_path_items").select("*").eq("path_id",path.id).eq("user_id",userId).order("position",{ascending:true});
    if (itemsError) throw new InternalServerErrorException("Unable to load roadmap tasks.");

    // Safely repair the original 46-day seed only when the four excess tasks
    // have no learner progress. Keep the existing IDs for the first 180 tasks.
    if (items?.length === 184 && items.every((item,index)=>item.position===index)) {
      const excessItems = items.slice(180);
      const excessIds = excessItems.map(item=>item.id);
      const { data: savedProgress, error: progressError } = await db.from("learning_progress").select("path_item_id").eq("user_id",userId).in("path_item_id",excessIds);
      if (progressError) throw new InternalServerErrorException("Unable to verify existing roadmap progress.");
      if (savedProgress?.length) throw new ConflictException("This older roadmap has progress on its final day and cannot be automatically shortened without losing learner data.");

      const finalDayItems = items.slice(176,180);
      for (let index=0; index<finalDayItems.length; index++) {
        const task = taskTemplates[index];
        const { error } = await db.from("learning_path_items").update({
          title:"Day 45: "+task.title,
          description:"Deployment, observability & portfolio launch — "+task.description,
        }).eq("id",finalDayItems[index].id).eq("user_id",userId);
        if (error) throw new InternalServerErrorException("Unable to update the final roadmap day.");
      }
      const { error: deleteError } = await db.from("learning_path_items").delete().eq("path_id",path.id).eq("user_id",userId).in("id",excessIds);
      if (deleteError) throw new InternalServerErrorException("Unable to remove the four unused duplicate roadmap tasks.");
      const refreshed = await db.from("learning_path_items").select("*").eq("path_id",path.id).eq("user_id",userId).order("position",{ascending:true});
      if (refreshed.error) throw new InternalServerErrorException("Unable to verify the repaired roadmap.");
      items = refreshed.data;
    }

    return {...path,items:items??[]};
  }
}
