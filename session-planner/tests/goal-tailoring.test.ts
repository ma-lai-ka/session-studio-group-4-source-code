import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createProgrammeProject,appendProgrammeGoal,addEmptyGoalSession} from '../lib/programme';
import {createLocalProject,exportProject,importProject} from '../lib/local-projects';
import {allSourceMethods,withFacilitatorEstimates} from '../lib/catalogue';
import {emptyDesignBrief} from '../lib/planner-contract.mjs';
import {briefForGoal,tailoringFingerprint,tailoringMessage} from '../lib/goal-tailoring';
import {proposePlannerEdit,acceptPlannerEdit,type PlanBundle} from '../lib/planner-edits';
import {projectCardSummary} from '../lib/project-card';
import {completeRunnerSession} from '../lib/runner-completion';
const catalogue=withFacilitatorEstimates(allSourceMethods);
const input={goal:'Understand existing interview evidence',diamonds:[{id:'problem',phases:['discover' as const,'define' as const]}],participants:4,level:'bachelor' as const,hours:3,timeMode:'total' as const,weeks:2,sessionsPerWeek:1,sessionCount:2,countMode:'calculated' as const};
function fixture(){return createLocalProject(createProgrammeProject('Research','Specific project scope',input,catalogue));}
const bundle=(operations:PlanBundle['operations']):PlanBundle=>({title:'Tailored scope',rationale:'Specific project evidence',alternatives:'Keep the current approach',assumptions:[],adaptations:[],operations});
it('initial sessions and added sessions contain only five-minute Introduction and Closing blocks',()=>{
 const p=fixture();assert.equal(p.sessions.length,2);assert.equal(projectCardSummary(p).status,'Awaiting tailored plan');
 for(const s of p.sessions){assert.equal(s.intake.minutes,90);assert.equal(s.preliminary,true);assert.equal(s.status,'draft');assert.equal(s.purpose,'Awaiting tailored plan');assert.deepEqual(s.plan!.activities.map(a=>[a.name,a.steps.reduce((n,s)=>n+s.minutes,0)]),[['Introduction',5],['Closing',5]]);}
 const before=JSON.stringify(p),added=addEmptyGoalSession(p,p.goals[0].id,60);
 assert.equal(JSON.stringify(p),before);assert.deepEqual(added.sessions.slice(0,2),p.sessions);
 assert.deepEqual(added.sessions[2].plan!.activities.map(a=>a.methodId),['intro','closing']);
 assert.equal(new Set(added.sessions.flatMap(s=>s.plan!.activities.map(a=>a.instanceId))).size,6);
});
it('legacy project briefs seed each goal without transferring human confirmation',()=>{
 const p=fixture();p.designBrief={...emptyDesignBrief(),endpoint:'Another goal',evidence:'Existing records',confirmed:true};
 const brief=briefForGoal(p,p.goals[0]);assert.equal(brief.confirmed,false);assert.equal(brief.endpoint,input.goal);assert.equal(brief.evidence,'Existing records');assert.match(brief.timeBudget,/3 hours in total/);assert.equal(p.goals[0].designBrief,undefined);
});
it('request fingerprints ignore rendering, revision, accepted plans and workflow metadata',()=>{
 const p=fixture(),g=p.goals[0],fingerprint=tailoringFingerprint(p,g);
 const changed=structuredClone(p);changed.revision++;changed.sessions[0].title='Tailored session';changed.goals[0].tailoring={fingerprint,status:'accepted',message:'Saved'};
 assert.equal(tailoringFingerprint(changed,changed.goals[0]),fingerprint);
 changed.goals[0].setup!.hours=4;assert.notEqual(tailoringFingerprint(changed,changed.goals[0]),fingerprint);
 changed.goals[0].setup!.hours=3;changed.goals[0].designBrief={...briefForGoal(p,g),confirmed:true};assert.notEqual(tailoringFingerprint(changed,changed.goals[0]),fingerprint);
 assert.match(tailoringMessage(g),/not method recommendations/);assert.match(tailoringMessage(g),/human Accept\/Reject/);
});
it('scoped proposals cannot remove, overwrite or steal activities from another goal',()=>{
 const p=fixture(),other=appendProgrammeGoal(p,{...input,goal:'Another goal'},catalogue),target=other.goals[0].id,foreign=other.sessions[2];
 assert.throws(()=>proposePlannerEdit(other,other.revision,bundle([{op:'session_remove',id:foreign.id}]),catalogue,target),/other goals/);
 assert.throws(()=>proposePlannerEdit(other,other.revision,bundle([{op:'task_put',task:{id:'wrong',goalId:other.goals[1].id,week:1,title:'Other work',kind:'analysis',owner:'Team',personHours:1,elapsedNote:'',output:'Notes',dependsOn:[]}}]),catalogue,target),/other goals/);
 const s=other.sessions[0],spec={id:s.id,goalId:target,week:1,title:'Research',purpose:'Compare evidence',output:'Findings',phase:s.intake.phase,goal:s.intake.goal,participants:4,level:'bachelor' as const,minutes:90,dependsOn:[],workDependencies:[],activities:[{id:foreign.plan!.activities[0].instanceId,methodId:'intro',minutes:5}]};
 assert.throws(()=>proposePlannerEdit(other,other.revision,bundle([{op:'session_put',session:spec}]),catalogue,target),/activities in other goals/);
});
it('a confirmed goal brief enables source-preserving proposals without approving the legacy brief',()=>{
 const p=fixture(),g=p.goals[0],method=catalogue.find(m=>m.id==='delft-how-tos')!;
 g.designBrief={...emptyDesignBrief(),confirmed:true};
 const s=p.sessions[0],spec={id:s.id,goalId:g.id,week:1,title:'Scope research questions',purpose:'Form project-specific research questions',output:'Prioritized research questions',phase:'define' as const,goal:'frame' as const,participants:4,level:'bachelor' as const,minutes:90,dependsOn:[],workDependencies:[],activities:[{id:'questions',methodId:method.id,minutes:method.defaultMinutes!}]};
 const proposal=proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:spec}]),catalogue,g.id);
 assert.equal(p.sessions[0].preliminary,true);assert.equal(proposal.candidate.sessions.find(s=>s.id===spec.id)!.preliminary,false);
 assert.equal(proposal.goalId,g.id);
 assert.throws(()=>acceptPlannerEdit({...p,revision:p.revision+1},proposal,false),/changed/);
 g.designBrief.confirmed=false;assert.throws(()=>proposePlannerEdit(p,p.revision,proposal.bundle,catalogue,g.id),/Confirm/);
});
it('scoped session changes respect total meeting availability and goal labour budgets',()=>{
 const p=fixture(),g=p.goals[0],s=p.sessions[0];
 const spec={id:s.id,goalId:g.id,week:1,title:s.title,purpose:'Evidence review',output:'Findings',phase:s.intake.phase,goal:s.intake.goal,participants:4,level:'bachelor' as const,minutes:100,dependsOn:[],workDependencies:[],activities:s.plan!.activities.map(a=>({id:a.instanceId,methodId:a.methodId,minutes:5}))};
 assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:spec}]),catalogue,g.id),/session availability/);
 g.designBrief={...emptyDesignBrief(),confirmed:true,weeklyPersonHours:[6,6]};
 assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'task_put',task:{id:'extra',goalId:g.id,week:1,title:'Analysis',kind:'analysis',owner:'Team',personHours:2,elapsedNote:'',output:'Evidence',dependsOn:[]}}]),catalogue,g.id),/person-hours/);
});
it('goal briefs and workflow states survive export/import without changing existing agendas',()=>{
 const p=fixture(),g=p.goals[0];g.designBrief={...briefForGoal(p,g),confirmed:true};g.tailoring={status:'awaiting_confirmation',fingerprint:tailoringFingerprint(p,g),message:'Review facts'};
 const imported=importProject(exportProject(p));assert.deepEqual(imported.goals[0].designBrief,g.designBrief);assert.deepEqual(imported.goals[0].tailoring,g.tailoring);assert.deepEqual(imported.sessions,p.sessions);
});
it('a preliminary agenda cannot finish through the runner even with a corrupt approved flag',async()=>{
 const p=fixture();p.workspace={boardId:'abcdefghijklmnopqrstuv'};p.sessions[0].status='approved';
 const old=globalThis.window;Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>JSON.stringify({version:2,projects:[p]})}}});
 try{await assert.rejects(completeRunnerSession({storageScope:'test',projectId:p.id,sessionId:p.sessions[0].id,boardId:p.workspace.boardId}),/Confirm and save/);}finally{Object.defineProperty(globalThis,'window',{configurable:true,value:old});}
});
