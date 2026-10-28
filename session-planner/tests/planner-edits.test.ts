import { it } from 'node:test';
import assert from 'node:assert/strict';
import { allSourceMethods,withFacilitatorEstimates } from '../lib/catalogue';
import { blankProject,newSession,type Project } from '../lib/projects';
import { createLocalProject,exportProject,importProject } from '../lib/local-projects';
import { fromSessionStep,fromMethod,activityMinutes } from '../lib/engine';
import { emptyDesignBrief } from '../lib/planner-contract.mjs';
import { proposePlannerEdit,acceptPlannerEdit,workIssues,sessionWeeks,type PlanBundle } from '../lib/planner-edits';
const catalogue=withFacilitatorEstimates(allSourceMethods);
function fixture(){const p=createLocalProject(blankProject('Disposable planner test'));const first=p.sessions[0],second=newSession('Session 2');p.goals[0].diamonds=[{id:'cycle',phases:['define','develop']}];p.goals[0].weeks=2;p.goals[0].weekSessionCounts=[1,1];p.goals[0].sessionIds.push(second.id);p.sessions.push(second);for(const s of p.sessions){s.intake={...s.intake,phase:'define',goal:'frame',minutes:90};s.phaseCycleId='cycle';s.plan={id:crypto.randomUUID(),version:1,intake:s.intake,demo:false,generatedAt:new Date().toISOString(),acceptedWarnings:[],activities:[fromSessionStep('intro'),fromSessionStep('break')]};}p.designBrief={...emptyDesignBrief(),endpoint:'Shared problem scope',evidence:'Existing interviews',team:'Four students',access:'Existing records',timeBudget:'20 total team hours each week',constraints:'No new fieldwork',weeklyPersonHours:[20,20],confirmed:true};return p;}
function spec(p:Project,index=0){const s=p.sessions[index];return{id:s.id,goalId:p.goals[0].id,week:sessionWeeks(p).get(s.id)!,title:s.title,purpose:'Understand existing evidence',output:'Shared scope',phase:s.intake.phase,goal:s.intake.goal,participants:s.intake.participants,level:s.intake.level,minutes:s.intake.minutes,dependsOn:s.dependsOn,workDependencies:s.workDependencies??[],activities:s.plan!.activities.map(a=>({id:a.instanceId,methodId:a.methodId,minutes:activityMinutes(a)}))};}
function bundle(operations:PlanBundle['operations']):PlanBundle{return {title:'Requested changes',rationale:'User requested these edits',alternatives:'Retain existing work outside this bundle',assumptions:[],adaptations:[],operations};}
it('adds, removes and reorders activities without changing source or unrelated sessions',()=>{
 const p=fixture(),s=spec(p);s.activities=[s.activities[1],{id:'new-closing',methodId:'closing',minutes:5}];
 const proposal=proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue);
 assert.deepEqual(p.sessions[0].plan!.activities.map(a=>a.methodId),['intro','break']);
 assert.deepEqual(proposal.candidate.sessions[0].plan!.activities.map(a=>a.methodId),['break','closing']);
 assert.deepEqual(proposal.candidate.sessions[1],p.sessions[1]);assert.deepEqual(proposal.candidate.goals[0].sessionIds,p.goals[0].sessionIds);
});
it('adds a session, changes phase/type and reorders sessions in one atomic proposal',()=>{
 const p=fixture(),newSpec={...spec(p),id:'new-session',title:'New ideation',phase:'develop' as const,goal:'fluency' as const,activities:[{id:'new-intro',methodId:'intro',minutes:5}]};
 const proposal=proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:newSpec},{op:'session_order',goalId:p.goals[0].id,ids:['new-session',p.sessions[0].id,p.sessions[1].id]}]),catalogue);
 assert.equal(proposal.candidate.sessions.length,3);assert.equal(proposal.candidate.sessions[0].title,'New ideation');assert.equal(proposal.candidate.sessions[0].intake.phase,'develop');
 assert.deepEqual(proposal.candidate.goals[0].weekSessionCounts,[2,1]);assert.equal(p.sessions.length,2);
});
it('moves an activity across sessions preserving its identity and permits session removal',()=>{
 const p=fixture(),a=spec(p),b=spec(p,1),moved=a.activities.pop()!;b.activities.push(moved);
 const result=proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:a},{op:'session_put',session:b}]),catalogue).candidate;
 assert.equal(result.sessions[1].plan!.activities.at(-1)!.instanceId,moved.id);
 const remove=proposePlannerEdit(result,result.revision,bundle([{op:'session_remove',id:result.sessions[0].id}]),catalogue).candidate;assert.equal(remove.sessions.length,1);assert.deepEqual(remove.goals[0].weekSessionCounts,[0,1]);
});
it('creates, edits, orders and exports work outside sessions with dependencies',()=>{
 const p=fixture(),task={id:'prep',goalId:p.goals[0].id,week:1,title:'Read transcripts',kind:'analysis' as const,owner:'Team',personHours:2,elapsedNote:'Before meeting',output:'Evidence notes',dependsOn:[]};
 const s=spec(p);s.workDependencies=['prep'];const candidate=proposePlannerEdit(p,p.revision,bundle([{op:'task_put',task},{op:'task_put',task:{...task,id:'wait',kind:'waiting',personHours:0,elapsedNote:'Two days',dependsOn:['prep']}},{op:'session_put',session:s},{op:'task_order',ids:['wait','prep']}]),catalogue).candidate;
 assert.equal(candidate.workItems![0].id,'wait');assert.deepEqual(importProject(exportProject(candidate)).workItems,candidate.workItems);assert.deepEqual(workIssues(candidate),[]);
 const updated=proposePlannerEdit(candidate,candidate.revision,bundle([{op:'task_put',task:{...task,title:'Review coded evidence'}},{op:'task_remove',id:'wait'}]),catalogue).candidate;assert.equal(updated.workItems!.length,1);assert.equal(updated.workItems![0].title,'Review coded evidence');
});
it('rejects stale previews and requires assumptions/core approval before acceptance',()=>{
 const p=fixture(),b=bundle([{op:'session_remove',id:p.sessions[1].id}]);b.assumptions=['Meeting room available'];const proposal=proposePlannerEdit(p,p.revision,b,catalogue);
 assert.throws(()=>acceptPlannerEdit(p,proposal,false),/Approve/);assert.throws(()=>acceptPlannerEdit({...p,revision:2},proposal,true),/changed/);
 assert.equal(acceptPlannerEdit(p,proposal,true).sessions.length,1);assert.equal(p.sessions.length,2);
});
it('protects completed content and rejects malformed ordering, cycles, missing prerequisites and overruns',()=>{
 const p=fixture();p.sessions[1].status='completed';p.sessions[1].completion={outcomes:'Done',decisions:'Done',questions:'',completedAt:new Date().toISOString()};
 assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_remove',id:p.sessions[1].id}]),catalogue),/unfinished/);
 assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_order',goalId:p.goals[0].id,ids:[p.sessions[0].id]}]),catalogue),/exactly once/);
 const s=spec(p);s.workDependencies=['missing'];assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue),/missing/);
 s.workDependencies=[s.id];assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue),/cycle/);
 s.workDependencies=[];s.minutes=10;s.activities[0].minutes=15;assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue),/exceed/);
});
it('new methods require confirmed brief and preserve canonical instructions; team budgets count all attendees',()=>{
 const p=fixture(),method=catalogue.find(m=>m.name==='Mind Mapping')!,s=spec(p);s.activities=[{id:'mapping',methodId:method.id,minutes:method.defaultMinutes!}];
 p.designBrief!.confirmed=false;assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue),/Confirm/);
 p.designBrief!.confirmed=true;const candidate=proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue).candidate;
 assert.deepEqual(candidate.sessions[0].plan!.activities[0].steps,fromMethod(method).steps);
 p.designBrief!.weeklyPersonHours=[1,1];assert.throws(()=>proposePlannerEdit(p,p.revision,bundle([{op:'session_put',session:s}]),catalogue),/person-hours/);
});
