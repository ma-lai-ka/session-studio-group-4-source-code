import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlanningCoordinator} from '../scripts/companion/planning.mjs';
import {companionError} from '../lib/companion-errors.mjs';
const goalId='goal-a',projectId=crypto.randomUUID();
const context={phase:'define',goal:'Understand evidence',hasPlan:true,approved:false,activities:[],planner:{projectId,revision:4,goalId,goals:[{id:goalId,title:'Understand evidence',sessionIds:[]}],sessions:[]}};
const request=(extra={})=>({requestId:crypto.randomUUID(),goalId,fingerprint:'confirmed-brief-1',message:'Tailor the original evidence goal',context,...extra});
function setup(t,replies=[]){
 const service={state:{messages:[]},busy:false,calls:[],persisted:[],async load(){},async persist(){this.persisted.push(JSON.parse(JSON.stringify(this.state)));},async cancel(){this.cancelled=true;},async ask(value,callbacks){this.calls.push(value);callbacks.onProgress('Thinking…');const next=replies.shift();return typeof next==='function'?next():next;}};
 const manager=new PlanningCoordinator(service);t.after(()=>manager.stop());return{service,manager};
}
const brief={answer:'Review the brief',actions:[{kind:'brief_update',payload:'{}'}],projectId,revision:4};
test('repeated confirmed starts acknowledge the existing job without resetting or duplicating it',async t=>{
 const {manager,service}=setup(t,[brief]);
 const first=await manager.start(request()),second=await manager.start(request());
 assert.equal(first.id,second.id);await manager.pump();assert.equal(service.calls.length,1);
 assert.equal((await manager.list())[0].state,'awaiting_apply');
 await manager.acknowledge({jobId:first.id,resultVersion:1,ok:true,message:'Brief saved'});
 assert.equal((await manager.start(request())).state,'awaiting_confirmation');
 assert.equal(service.calls.length,1);
 const confirmed=await manager.start(request({fingerprint:'confirmed-brief-2'}));assert.notEqual(confirmed.id,first.id);
});
test('source inspection continues server-side without another browser message',async t=>{
 const {manager,service}=setup(t,[{answer:'Inspecting',actions:[],sourceReview:true,sourceNames:['Problem Definition']},brief]);
 const job=await manager.start(request());await manager.pump();
 assert.equal(service.calls.length,2);assert.equal(service.calls[1].automation.step,1);
 assert.match(service.calls[1].automation.feedback,/supplied source/);
 assert.equal((await manager.list()).find(j=>j.id===job.id).state,'awaiting_apply');
});
test('clarification answers resume the original goal and repeated delivery is idempotent',async t=>{
 const {manager,service}=setup(t,[{answer:'Which evidence is available?',actions:[]},brief]);
 const job=await manager.start(request());await manager.pump();
 assert.equal((await manager.list())[0].state,'awaiting_input');
 const answer={jobId:job.id,message:'Twelve existing interviews',context,requestId:'answer-1'};
 await manager.answer(answer);await manager.answer(answer);await manager.pump();
 assert.equal(service.calls.length,2);assert.match(service.calls[1].message,/original evidence goal/);assert.match(service.calls[1].message,/Twelve existing interviews/);
 assert.equal(service.state.messages.filter(m=>m.text===answer.message).length,1);
});
test('a speaking display cannot block planning; only the execution lease serializes work',async t=>{
 const {manager,service}=setup(t,[brief]);service.voice={phase:'speaking'};
 await manager.start(request());service.busy=true;await manager.pump();assert.equal(service.calls.length,0);
 service.busy=false;await manager.pump();assert.equal(service.calls.length,1);
});
test('explicit Stop ignores a late model result without disconnecting the voice connection',async t=>{
 let finish;const gate=new Promise(resolve=>{finish=resolve;});
 const {manager,service}=setup(t,[()=>gate]);service.voice={connected:true};
 const job=await manager.start(request()),running=manager.pump();
 while(!service.calls.length)await new Promise(resolve=>setImmediate(resolve));
 await manager.cancel(job.id);finish(brief);await running;
 const saved=(await manager.list())[0];assert.equal(saved.state,'cancelled');assert.equal(saved.result,null);assert.equal(service.voice.connected,true);assert.equal(service.cancelled,true);
});
test('jobs retain results while the original goal is not visible and acknowledge them once',async t=>{
 const {manager}=setup(t,[brief]);const job=await manager.start(request());await manager.pump();
 await manager.acknowledge({jobId:job.id,resultVersion:1,ok:false,code:'OPEN_GOAL',message:'Open the original project and goal'});
 const paused=(await manager.list())[0];assert.equal(paused.state,'awaiting_apply');assert.ok(paused.result);assert.equal(paused.error.actions[0].action,'open_goal');
 await manager.acknowledge({jobId:job.id,resultVersion:1,ok:true,message:'Brief saved'});
 await manager.acknowledge({jobId:job.id,resultVersion:1,ok:true,message:'Duplicate'});
 assert.equal((await manager.list())[0].state,'awaiting_confirmation');assert.equal((await manager.list())[0].progress,'Brief saved');
});
test('restart exposes interrupted work for explicit retry without replaying uncertain actions',async t=>{
 const {manager,service}=setup(t);service.state.planningJobs=[{id:'saved',key:projectId+':'+goalId,state:'running',progress:'Thinking',requestIds:[],operations:[]}];
 assert.equal((await manager.list())[0].state,'failed');assert.equal(service.calls.length,0);
});
test('recovery actions are fixed application actions and never arbitrary commands',()=>{
 for(const [message,action] of [['Reconnect the assistant','reconnect'],['Microphone permission denied','voice_settings'],['Confirm the brief','review_brief'],['The project changed during planning','retry'],['Open the original goal','open_goal']])assert.equal(companionError(message).actions[0].action,action);
 assert.equal(companionError({code:'OPEN_GOAL',message:'Result waiting'}).actions[0].action,'open_goal');
});
test('a conversational acknowledgement continues rather than falsely waiting for the user',async t=>{
 const {manager,service}=setup(t,[{answer:'Understood, I will continue.',actions:[],waitingForInput:false},brief]);
 await manager.start(request());await manager.pump();assert.equal(service.calls.length,2);
 assert.match(service.calls[1].automation.feedback,/acknowledgement is not a planning result/);
 assert.equal((await manager.list())[0].state,'awaiting_apply');
});
