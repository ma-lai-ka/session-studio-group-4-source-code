import { z } from 'zod';
const id=z.string().min(1).max(200),text=z.string().max(4000);
export const workItemSchema=z.object({id,goalId:id,week:z.number().int().min(1).max(520),title:z.string().min(1).max(200),kind:z.enum(['preparation','recruitment','fieldwork','analysis','coordination','waiting','other']),owner:text,personHours:z.number().finite().nonnegative().max(10000),elapsedNote:text,output:text,dependsOn:z.array(id).max(120)}).strict();
export const designBriefSchema=z.object({endpoint:text,evidence:text,team:text,access:text,timeBudget:text,constraints:text,weeklyPersonHours:z.array(z.number().finite().nonnegative().max(10000)).max(520),assumptions:z.array(text).max(30),confirmed:z.boolean()}).strict();
export const emptyDesignBrief=()=>({endpoint:'',evidence:'',team:'',access:'',timeBudget:'',constraints:'',weeklyPersonHours:[],assumptions:[],confirmed:false});
const activity=z.object({id,methodId:id,minutes:z.number().int().min(1).max(720),stageId:z.string().max(200).optional(),runId:z.string().max(200).optional()}).strict();
const session=z.object({id,goalId:id,week:z.number().int().min(1).max(520),title:z.string().min(1).max(160),purpose:text,output:text,phase:z.enum(['discover','define','develop','deliver','iterate']),goal:z.enum(['understand','frame','fluency','flexibility','select']),participants:z.number().int().min(1).max(100),level:z.enum(['novice','bachelor','master']),minutes:z.number().int().min(10).max(720),dependsOn:z.array(id).max(120),workDependencies:z.array(id).max(120).default([]),activities:z.array(activity).max(100)}).strict();
export const planBundleSchema=z.object({title:z.string().min(1).max(200),rationale:text,alternatives:text,screening:z.array(z.object({methodId:id,fit:z.enum(['candidate','excluded']),reason:z.string().min(1).max(600)}).strict()).max(100).optional(),assumptions:z.array(text).max(30),adaptations:z.array(z.object({methodId:id,prescription:text,change:text,constraint:text,retained:text,limits:text,core:z.boolean()}).strict()).max(30),operations:z.array(z.discriminatedUnion('op',[
 z.object({op:z.literal('session_put'),session}).strict(),z.object({op:z.literal('session_remove'),id}).strict(),
 z.object({op:z.literal('session_order'),goalId:id,ids:z.array(id).max(120)}).strict(),
 z.object({op:z.literal('task_put'),task:workItemSchema}).strict(),z.object({op:z.literal('task_remove'),id}).strict(),
 z.object({op:z.literal('task_order'),ids:z.array(id).max(300)}).strict(),
])).min(1).max(150)}).strict();
export const facilitatorActionSchema=z.object({kind:z.enum(['plan_edit','brief_update','inspect_methods']),payload:z.string().min(2).max(180000)}).strict();
