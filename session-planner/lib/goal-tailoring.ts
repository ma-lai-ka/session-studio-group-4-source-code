import { emptyDesignBrief } from './planner-contract.mjs';
import type { Project,ProjectGoal,ProgrammeInput } from './projects';
export type TailoringState=NonNullable<ProjectGoal['tailoring']>['status'];
export type TailoringRequest={id:string;projectId:string;goalId:string;fingerprint:string;claimed?:boolean;force?:boolean;ack?:(result:{ok:boolean;message:string;jobId?:string})=>void;done:(status:TailoringState,message:string)=>void};
export function briefForGoal(project:Project,goal:ProjectGoal){
 if(goal.designBrief)return goal.designBrief;
 const input=goal.setup,session=project.sessions.find(s=>goal.sessionIds.includes(s.id));
 const evidence=project.designBrief?.evidence||project.completedWork||'';
 return {...emptyDesignBrief(),...project.designBrief,confirmed:false,
  endpoint:goal.title,
  evidence:evidence.length>4000?evidence.slice(0,3900)+' [Excerpt: review the complete saved notes before confirming this brief.]':evidence,
  team:project.designBrief?.team||(input?`${input.participants} participants; ${input.level} experience`:session?`${session.intake.participants} participants; ${session.intake.level} experience`:''),
  timeBudget:project.designBrief?.timeBudget||(input?`${input.hours} hours ${input.timeMode==='weekly'?'per week':'in total'} of session time; ${input.weeks??'unspecified'} weeks. Preparation and total team labour are not yet confirmed.`:''),
 };
}
export function tailoringFingerprint(project:Project,goal:ProjectGoal){
 const text=JSON.stringify({name:project.name,description:project.description,title:goal.title,setup:goal.setup,diamonds:goal.diamonds,brief:briefForGoal(project,goal)});
 let first=2166136261,second=3335557771;for(let i=0;i<text.length;i++){first=Math.imul(first^text.charCodeAt(i),16777619);second=Math.imul(second^text.charCodeAt(i),2246822507);}
 return (first>>>0).toString(16).padStart(8,'0')+(second>>>0).toString(16).padStart(8,'0');
}
export function tailoringMessage(goal:ProjectGoal){
 return `Tailor goal "${goal.title}" to the specific project nature and scope. This automatic request follows the human's intake or brief confirmation. Target only goal ID ${goal.id}; preserve every other goal and completed work. The Introduction/Closing agendas are preliminary scaffolds, not method recommendations. If consequential brief facts are missing, ask concise questions and return a brief_update using known facts without guessing. If the brief is complete but unconfirmed, return a brief_update for human confirmation and stop. Once confirmed, screen the complete Delft catalogue, inspect the one or two strongest shortlisted source entries first, then return one coherent plan_edit proposal. You may change the number/order/type of sessions and activities and preparation tasks, within selected phases, confirmed session availability and team-hour budgets. Do not stop after conversational advice or after creating scaffolding. Proposed changes require human Accept/Reject; never accept them yourself.`;
}
export function sameIntake(goal:ProjectGoal,input:ProgrammeInput){return JSON.stringify(goal.setup)===JSON.stringify(input);}
