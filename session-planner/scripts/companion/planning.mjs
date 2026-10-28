import {z} from 'zod';
import {questionSchema} from './service.mjs';
import {companionError} from '../../lib/companion-errors.mjs';

const requestSchema=z.object({requestId:z.string().min(1).max(200),goalId:z.string().min(1).max(200),fingerprint:z.string().min(1).max(200),message:z.string().min(1).max(12000),context:z.record(z.unknown()),force:z.boolean().optional()});
const liveStates=new Set(['queued','running','awaiting_apply','awaiting_input','awaiting_confirmation']);
export class PlanningCoordinator{
 constructor(service){this.service=service;this.active=null;this.closed=false;}
 get jobs(){return this.service.state.planningJobs??(this.service.state.planningJobs=[]);}
 async initialize(){
  await this.service.load();if(this.initialized)return;this.initialized=true;
  // A restarted process cannot replay an uncertain in-flight turn.
  for(const job of this.jobs)if(['running','queued'].includes(job.state)){job.state='failed';job.error=companionError('Planning was interrupted by a restart. Retry using the current project.');}
 }
 snapshot(job){const {context,message,requestIds,...publicJob}=job;return structuredClone({...publicJob,result:['awaiting_apply','awaiting_input'].includes(job.state)?publicJob.result:null});}
 async list(){await this.initialize();return this.jobs.map(job=>this.snapshot(job));}
 async start(value){
  await this.initialize();const input=requestSchema.parse(value);
  const context=questionSchema.shape.context.parse(input.context),planner=context.planner;
  if(!planner||!planner.goals?.some(g=>g.id===input.goalId))throw new Error('Open the intended project and goal first.');
  const key=planner.projectId+':'+input.goalId;
  const prior=this.jobs.find(j=>j.key===key&&j.fingerprint===input.fingerprint&&liveStates.has(j.state));
  if(prior){if(!prior.requestIds.includes(input.requestId))prior.requestIds.push(input.requestId);await this.service.persist();return this.snapshot(prior);}
  const replay=this.jobs.find(j=>j.requestIds.includes(input.requestId));if(replay)return this.snapshot(replay);
  for(const old of this.jobs.filter(j=>j.key===key&&liveStates.has(j.state)))await this.cancel(old.id);
  const job={id:crypto.randomUUID(),key,projectId:planner.projectId,goalId:input.goalId,fingerprint:input.fingerprint,revision:planner.revision,requestIds:[input.requestId],message:input.message,context:{...context,planner:{...planner,goalId:input.goalId,targetGoalId:input.goalId}},state:'queued',sequence:0,operations:[],progress:'Planning queued',result:null,error:null,createdAt:new Date().toISOString()};
  this.jobs.push(job);while(this.jobs.length>20){const index=this.jobs.findIndex(j=>!liveStates.has(j.state));if(index<0)break;this.jobs.splice(index,1);}
  await this.service.persist();this.schedule();return this.snapshot(job);
 }
 schedule(){if(this.closed||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;void this.pump().catch(()=>{});},100);this.timer.unref?.();}
 async pump(){
  if(this.closed||this.active)return;
  if(this.service.busy){this.schedule();return;}
  const job=this.jobs.find(j=>j.state==='queued');if(!job)return;
  this.active=job.id;job.state='running';job.sequence++;job.error=null;
  const sequence=job.sequence;
  try{
   await this.service.persist();
   let feedback='';
   for(let step=0;step<8;step++){
    if(this.closed||job.state==='cancelled'||job.sequence!==sequence)return;
    const result=await this.service.ask({message:job.message,context:job.context,...(step?{automation:{step,feedback}}:{})},{onProgress:message=>{job.progress=message;this.operation(job,message);}});
    if(job.state==='cancelled'||job.sequence!==sequence)return;
    if(result.sourceReview){feedback='Read the supplied source scans and continue the ORIGINAL planning request. Do not repeat completed inspection.';this.operation(job,'Reviewed source entries: '+(result.sourceNames??[]).join(', '));continue;}
    if(result.actions?.some(a=>!['plan_edit','brief_update'].includes(a.kind)))throw new Error('Planning requires a validated brief or plan proposal. Review the brief and retry.');
    const waiting=result.waitingForInput??/\?/.test(result.answer);if(!result.actions?.length&&!waiting){feedback='An acknowledgement is not a planning result. Continue the original request with a source inspection, brief_update or plan_edit. If a consequential fact is missing, ask its concrete question and set waitingForInput=true.';this.operation(job,'Continuing the planning request');continue;}
    job.result=result;job.resultVersion=(job.resultVersion??0)+1;
    job.state=result.actions?.length?'awaiting_apply':'awaiting_input';
    job.progress=result.actions?.length?'Preparing the result for the project':result.answer;
    if(!result.actions?.length)this.operation(job,'Waiting for your answer');
    delete job.context;await this.service.persist();return;
   }
   throw new Error('Source review reached its limit. Narrow the goal and retry planning.');
  }catch(error){if(job.state!=='cancelled'){job.state='failed';job.error=companionError(error);job.progress=job.error.message;await this.service.persist();}}
  finally{this.active=null;this.schedule();}
 }
 operation(job,label){
  if(job.operations.at(-1)?.label===label)return;
  job.operations.push({id:crypto.randomUUID(),label,at:new Date().toISOString()});job.operations=job.operations.slice(-30);
 }
 async answer({jobId,message,context,requestId}){
  await this.initialize();const job=this.jobs.find(j=>j.id===jobId);
  if(!job||job.state!=='awaiting_input')return null;
  if(job.requestIds.includes(requestId))return this.snapshot(job);
  const checked=questionSchema.parse({message,context}),planner=checked.context.planner;
  if(!planner||planner.projectId!==job.projectId||!planner.goals?.some(g=>g.id===job.goalId))throw new Error('Open the intended project and goal before answering.');
  if(this.service.state.messages.at(-1)?.role!=='user'||this.service.state.messages.at(-1)?.text!==checked.message)this.service.state.messages.push({role:'user',text:checked.message,id:requestId});
  job.requestIds.push(requestId);job.message+='\n\nANSWER TO THE PREVIOUS CLARIFICATION: '+checked.message+'\nContinue the original planning workflow. Ask only for remaining consequential unknowns; otherwise produce a brief draft or source-reviewed proposal.';
  job.message=job.message.slice(-12000);job.context={...checked.context,planner:{...planner,goalId:job.goalId,targetGoalId:job.goalId}};
  job.revision=planner.revision;job.result=null;job.state='queued';job.progress='Answer received. Continuing planning…';
  await this.service.persist();this.schedule();return this.snapshot(job);
 }
 async answerFromVoice(message,context,requestId){
  await this.initialize();const planner=context.planner;
  const job=[...this.jobs].reverse().find(j=>j.projectId===planner?.projectId&&j.goalId===planner?.goalId&&j.state==='awaiting_input');
  return job?this.answer({jobId:job.id,message,context,requestId}):null;
 }
 async acknowledge({jobId,resultVersion,ok,message,code}){
  await this.initialize();const job=this.jobs.find(j=>j.id===jobId);
  if(!job||job.state!=='awaiting_apply'||job.resultVersion!==resultVersion)return job?this.snapshot(job):null;
  if(!ok){job.state=code==='OPEN_GOAL'?'awaiting_apply':'failed';job.error=companionError({code,message});}
  else{job.state=job.result.actions[0]?.kind==='brief_update'?'awaiting_confirmation':'proposal_ready';job.error=null;job.progress=message;this.operation(job,message);}
  await this.service.persist();return this.snapshot(job);
 }
 async complete(id,message){await this.initialize();const job=this.jobs.find(j=>j.id===id);if(!job||job.state!=='proposal_ready')return;job.state='completed';job.progress=message||'Review complete';job.result=null;delete job.context;await this.service.persist();return this.snapshot(job);}
 async cancel(id){
  await this.initialize();const job=this.jobs.find(j=>j.id===id);if(!job)return;
  const ownsTurn=this.active===id;
  job.state='cancelled';delete job.context;job.sequence++;job.progress='Stopped. Your saved plan is unchanged.';job.result=null;
  if(ownsTurn)await this.service.cancel();
  await this.service.persist();return this.snapshot(job);
 }
 stop(){this.closed=true;clearTimeout(this.timer);}
}
