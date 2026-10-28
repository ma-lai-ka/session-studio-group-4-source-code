import { assertGoalScope } from './goal-scope.mjs';
import { z } from 'zod';
import { planBundleSchema } from './planner-contract.mjs';
import { activityMinutes,allocate,fromMethod,fromMethodStages,fromSessionStep,minimum,sessionSteps } from './engine';
import { projectSchema,validateProjectChange,dependencyIssues,type Project,type Session } from './projects';
import { groupSessionsByWeek } from './programme';
import type { Activity,Method } from './types';
export type PlanBundle=z.infer<typeof planBundleSchema>;
export type PlannerProposal={goalId?:string;projectId:string;revision:number;bundle:PlanBundle;candidate:Project};
export type PlannerProposalRequest={goalId?:string;targetGoalId?:string;projectId:string;revision:number;payload:string;done:(result:{ok:boolean;message:string})=>void};
export function sessionWeeks(project:Project){const weeks=new Map<string,number>();for(const g of project.goals)for(const group of groupSessionsByWeek(g.sessionIds,g.weeks,g.weekSessionCounts))for(const id of group.sessions)weeks.set(id,group.week??1);return weeks;}
export function workIssues(project:Project):string[]{
 const weeks=sessionWeeks(project),nodes=new Map(project.sessions.map(s=>[s.id,{week:weeks.get(s.id)??1,dependencies:[...s.dependsOn,...(s.workDependencies??[])]}])),issues:string[]=[];
 for(const t of project.workItems??[]){const goal=project.goals.find(g=>g.id===t.goalId);if(!goal||t.week>(goal.weeks??1))issues.push(`${t.title}: unavailable goal/week.`);if(nodes.has(t.id))issues.push('Duplicate work identifier.');if(t.kind==='waiting'&&t.personHours!==0)issues.push('Waiting time must have zero active person-hours.');nodes.set(t.id,{week:t.week,dependencies:t.dependsOn});}
 const active=new Set<string>(),done=new Set<string>();function visit(id:string){if(done.has(id))return;if(active.has(id)){issues.push('Work dependencies contain a cycle.');return;}active.add(id);const n=nodes.get(id)!;for(const dep of n.dependencies){const before=nodes.get(dep);if(!before){issues.push('A work prerequisite is missing.');continue;}if(before.week>n.week)issues.push('A work prerequisite is scheduled too late.');visit(dep);}active.delete(id);done.add(id);}for(const id of nodes.keys())visit(id);
 const budget=project.designBrief?.weeklyPersonHours??[];if(budget.length){const hours=Array(budget.length).fill(0);for(const s of project.sessions){const week=weeks.get(s.id)!;if(week>hours.length){issues.push('A session falls outside the confirmed budget.');continue;}hours[week-1]+=s.intake.minutes*s.intake.participants/60;}for(const t of project.workItems??[]){if(t.week>hours.length)issues.push('A task falls outside the confirmed budget.');else hours[t.week-1]+=t.personHours;}hours.forEach((h,i)=>{if(h>budget[i]+.001)issues.push(`Week ${i+1}: ${h.toFixed(1)} person-hours exceeds ${budget[i]}.`);});}
 for(const g of project.goals){const budget=g.designBrief?.weeklyPersonHours??[];if(!budget.length)continue;
 const hours=budget.map(()=>0);for(const s of project.sessions.filter(s=>g.sessionIds.includes(s.id))){const week=weeks.get(s.id)??1;if(week>hours.length)issues.push(g.title+': session outside the confirmed budget.');else hours[week-1]+=s.intake.minutes*s.intake.participants/60;}
 for(const t of (project.workItems??[]).filter(t=>t.goalId===g.id)){if(t.week>hours.length)issues.push(g.title+': work outside the confirmed budget.');else hours[t.week-1]+=t.personHours;}
 hours.forEach((h,i)=>{if(h>budget[i]+.001)issues.push(g.title+': week '+(i+1)+' exceeds the confirmed person-hours.');});}
 return [...new Set(issues)];
}
export function proposePlannerEdit(project:Project,revision:number,value:unknown,catalogue:Method[],goalId?:string):PlannerProposal{
 if(revision!==project.revision)throw new Error('The project changed. Request a fresh proposal.');
 const bundle=planBundleSchema.parse(value),next=structuredClone(project),weeks=sessionWeeks(project),aliases=new Map<string,string>();
 assertGoalScope(project,bundle,goalId);
 const resolve=(id:string)=>aliases.get(id)??id;
 for(const op of bundle.operations)if(op.op==='session_put'&&!next.sessions.some(s=>s.id===op.session.id)&&!aliases.has(op.session.id))aliases.set(op.session.id,crypto.randomUUID());
 for(const op of bundle.operations){
  if(op.op==='session_put'){
   const spec=op.session,id=resolve(spec.id),old=next.sessions.find(s=>s.id===id),g=next.goals.find(g=>g.id===spec.goalId);
   if(!g)throw new Error('Choose an existing goal.');if(old?.status==='completed')throw new Error('Completed sessions cannot be edited.');
   if(spec.week>(g.weeks??1))throw new Error('The session week is outside its goal.');
   const cycle=g.diamonds.find(d=>d.phases.includes(spec.phase));if(!cycle)throw new Error('The requested phase is not selected in this goal. Edit the goal intake first.');
   if(new Set(spec.activities.map(a=>a.id)).size!==spec.activities.length)throw new Error('Each activity needs a distinct ID.');
   const activities:Activity[]=spec.activities.map(a=>{
    const retained=project.sessions.flatMap(s=>s.plan?.activities??[]).find(saved=>saved.instanceId===a.id&&saved.methodId===a.methodId&&saved.stageId===a.stageId);
    let result:Activity;if(retained)result=structuredClone(retained);
    else if(sessionSteps.some(s=>s.id===a.methodId))result=fromSessionStep(a.methodId);
    else{const method=catalogue.find(m=>m.id===a.methodId&&(m.id.startsWith('delft-')||m.id.startsWith('index-delft-')));if(!method)throw new Error('Choose a known Delft method.');if(!(g.designBrief??project.designBrief)?.confirmed)throw new Error('Confirm the consequential brief details before recommending new methods.');
     if(method.stages?.length){const stage=fromMethodStages(method).find(s=>s.stageId===a.stageId);if(!stage||!a.runId)throw new Error('Specify the documented stage and shared runId for staged methods.');result={...stage,methodRunId:a.runId};}else result=fromMethod(method);
    }
    if(a.minutes<Math.max(result.steps.length,result.operational?1:minimum(result)))throw new Error(`${result.name}: duration is below the editor minimum.`);
    const durations=allocate(a.minutes,result.steps.map(s=>s.minutes));return {...result,steps:result.steps.map((s,i)=>({...s,minutes:durations[i]}))};
   });
   const intake={name:next.name,description:next.description,phase:spec.phase,goal:spec.goal,participants:spec.participants,level:spec.level,minutes:spec.minutes};
   const updated:Session={...(old??{}),id,preliminary:false,title:spec.title,purpose:spec.purpose,expectedOutputs:spec.output,intake,phaseCycleId:cycle.id,status:'draft',completion:null,dependsOn:spec.dependsOn.map(resolve),workDependencies:spec.workDependencies.map(resolve),plan:{id:old?.plan?.id??crypto.randomUUID(),version:(old?.plan?.version??0)+1,intake,activities,demo:false,generatedAt:new Date().toISOString(),acceptedWarnings:[]}};
   if(activities.reduce((n,a)=>n+activityMinutes(a),0)>spec.minutes)throw new Error('Activities exceed session time. Increase the session budget or reduce scope.');
   next.sessions=next.sessions.filter(s=>s.id!==id);next.sessions.push(updated);for(const other of next.goals)if(other.id!==g.id)other.sessionIds=other.sessionIds.filter(s=>s!==id);if(!g.sessionIds.includes(id))g.sessionIds.push(id);weeks.set(id,spec.week);
  }else if(op.op==='session_remove'){const id=resolve(op.id),s=next.sessions.find(s=>s.id===id);if(!s||s.status==='completed')throw new Error('Choose an unfinished existing session.');next.sessions=next.sessions.filter(s=>s.id!==id);for(const g of next.goals)g.sessionIds=g.sessionIds.filter(s=>s!==id);
  }else if(op.op==='session_order'){const g=next.goals.find(g=>g.id===op.goalId),ids=op.ids.map(resolve);if(!g||ids.length!==g.sessionIds.length||new Set(ids).size!==ids.length||ids.some(id=>!g.sessionIds.includes(id)))throw new Error('Session order must include every session in the goal exactly once.');const slots=g.sessionIds.map(id=>weeks.get(id)??1).sort((a,b)=>a-b);g.sessionIds=ids;ids.forEach((id,i)=>weeks.set(id,slots[i]));
  }else if(op.op==='task_put'){const task={...op.task,dependsOn:op.task.dependsOn.map(resolve)};next.workItems=[...(next.workItems??[]).filter(t=>t.id!==task.id),task];
  }else if(op.op==='task_remove'){if(!next.workItems?.some(t=>t.id===op.id))throw new Error('Unknown work item.');next.workItems=next.workItems.filter(t=>t.id!==op.id);
  }else if(op.op==='task_order'){const tasks=next.workItems??[];if(op.ids.length!==tasks.length||new Set(op.ids).size!==tasks.length||op.ids.some(id=>!tasks.some(t=>t.id===id)))throw new Error('Task order must include each work item exactly once.');next.workItems=op.ids.map(id=>tasks.find(t=>t.id===id)!);}
 }
 for(const g of next.goals){g.sessionIds.sort((a,b)=>(weeks.get(a)??1)-(weeks.get(b)??1));if(g.weeks)g.weekSessionCounts=Array.from({length:g.weeks},(_,w)=>g.sessionIds.filter(id=>weeks.get(id)===w+1).length);}
 next.sessions=next.goals.flatMap(g=>g.sessionIds.map(id=>next.sessions.find(s=>s.id===id)!));
 projectSchema.parse(next);validateProjectChange(project,next,catalogue);const issues=[...dependencyIssues(next.sessions),...workIssues(next)];if(issues.length)throw new Error(issues.join(' '));
 const newRuns=new Set(next.sessions.flatMap(s=>s.plan?.activities??[]).filter(a=>a.methodRunId&&!project.sessions.some(s=>s.plan?.activities.some(old=>old.methodRunId===a.methodRunId))).map(a=>a.methodRunId));
 for(const run of newRuns){const stages=next.sessions.flatMap(s=>s.plan?.activities??[]).filter(a=>a.methodRunId===run);const method=catalogue.find(m=>m.id===stages[0].methodId);if(method?.stages?.some(stage=>!stages.some(a=>a.stageId===stage.id)))throw new Error('Include all required stages of a newly scheduled method.');}
 // Protect the placement as well as content of already completed work.
 const originalWeeks=sessionWeeks(project);for(const s of project.sessions.filter(s=>s.status==='completed'))if(weeks.get(s.id)!==originalWeeks.get(s.id)||next.goals.find(g=>g.sessionIds.includes(s.id))?.id!==project.goals.find(g=>g.sessionIds.includes(s.id))?.id)throw new Error('Completed sessions must keep their goal and week.');
 if(goalId){
  const g=next.goals.find(g=>g.id===goalId)!,setup=g.setup;
  if(setup){const available=setup.hours*60*(setup.timeMode==='weekly'?(setup.weeks??1):1);const used=next.sessions.filter(s=>g.sessionIds.includes(s.id)).reduce((n,s)=>n+s.intake.minutes,0);if(used>available+1)throw new Error('The tailored sessions exceed the confirmed session availability. Reduce scope or ask the human to revise intake.');}
 }
 return {goalId,projectId:project.id,revision,bundle,candidate:next};
}
export function acceptPlannerEdit(current:Project,proposal:PlannerProposal,approveAssumptions:boolean){if(current.id!==proposal.projectId||current.revision!==proposal.revision)throw new Error('The project changed after this preview. Request a fresh proposal.');if((proposal.bundle.assumptions.length||proposal.bundle.adaptations.some(a=>a.core))&&!approveAssumptions)throw new Error('Approve the stated assumptions and core adaptations first.');const {operations,...notes}=proposal.bundle;return {...proposal.candidate,goals:proposal.candidate.goals.map(g=>g.id===proposal.goalId&&g.tailoring?{...g,initialSessionCount:g.sessionIds.length,...(g.setup&&g.setup.sessionCount!==g.sessionIds.length?{setup:{...g.setup,sessionCount:g.sessionIds.length,countMode:'manual' as const}}:{}),tailoring:{...g.tailoring,status:'accepted' as const,message:'Tailored plan accepted. Review and confirm sessions before starting.'}}:g),facilitatorReview:{...notes,acceptedAt:new Date().toISOString()}};}
