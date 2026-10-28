import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {CompanionService} from '../scripts/companion/service.mjs';
import {publicVoiceError,voiceStartSchema} from '../scripts/companion/realtime.mjs';
import {emptyDesignBrief} from '../lib/planner-contract.mjs';
const context={phase:'define',goal:'Research presentation',hasPlan:false,approved:false,activities:[],ui:{id:crypto.randomUUID(),screen:'Home',controls:[{target:'ui-1',kind:'button',label:'Add new project',value:''}]}};
class VoiceCodex{
 listeners=new Set();requests=[];account={type:'chatgpt',planType:'plus'};limits={ordinaryUsageAllowed:true,rateLimits:{primary:{usedPercent:12},secondary:{usedPercent:4}}};
 async start(){}stop(){}
 emit(method,params={}){for(const listener of this.listeners)listener({method,params:{threadId:'voice-thread',...params}});}
 async request(method,params){this.requests.push({method,params});if(method==='account/read')return{account:this.account};if(method==='account/rateLimits/read')return this.limits;if(method==='thread/realtime/listVoices')return{voices:{v3:['cove','juniper']}};if(method==='thread/start')return{thread:{id:'voice-thread'}};if(method==='thread/realtime/start')this.emit('thread/realtime/sdp',{sdp:'answer'});return{};}
}
async function setup(t){const root=await mkdtemp(path.join(os.tmpdir(),'studio-realtime-test-'));await mkdir(path.join(root,'graduation-context'));const connection=new VoiceCodex(),service=new CompanionService({root,connection});t.after(async()=>{service.stop();if(!path.basename(root).startsWith('studio-realtime-test-'))throw Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});});return{root,connection,service};}
const startInput={action:'voice_start',sdp:'v=0\r\n'+'test-offer-'.repeat(4),voice:'cove',context};
test('voice checks subscription allowance before starting and never selects an API transport',async t=>{const {service,connection}=await setup(t);connection.account={type:'apiKey'};await assert.rejects(service.voice.start(startInput,()=>{}),/Subscription-only/);connection.account={type:'chatgpt',planType:'plus'};connection.limits.rateLimits.primary.usedPercent=100;await assert.rejects(service.voice.start(startInput,()=>{}),/exhausted/);assert.equal(connection.requests.some(r=>r.method==='thread/realtime/start'),false);assert.equal(service.voice.session,null);});
test('voice connects using WebRTC on the same Gerd thread and enforces one call owner',async t=>{const {service,connection}=await setup(t),events=[];await service.voice.start(startInput,(type,data)=>events.push({type,...data}));const request=connection.requests.find(r=>r.method==='thread/realtime/start');assert.equal(request.params.threadId,service.state.threadId);assert.equal(request.params.transport.type,'webrtc');assert.equal(request.params.clientManagedHandoffs,true);assert.equal(request.params.flushTranscriptTailOnSessionEnd,false);assert.equal(events[0].type,'voice_ready');await assert.rejects(service.voice.start(startInput,()=>{}),/another voice call/);assert.throws(()=>service.voice.owned(crypto.randomUUID()),/ended/);const id=service.voice.session.id;await service.voice.result({action:'voice_result',sessionId:id,text:'The intake was filled and verified.'});assert.equal(connection.requests.at(-2).method,'thread/realtime/appendText');assert.equal(connection.requests.at(-2).params.role,'developer');assert.equal(connection.requests.at(-1).method,'thread/realtime/appendSpeech');await service.voice.result({action:'voice_test',sessionId:id});assert.match(connection.requests.at(-1).params.text,/voice connection is ready/);await service.voice.stop(id);assert.equal(service.voice.session,null);assert.equal(service.busy,false);});
test('only completed transcripts persist; unknown control actions are refused',async t=>{const {service,root}=await setup(t),events=[];await service.voice.start(startInput,(type,data)=>events.push({type,...data}));const current=service.voice.session;const emit=(method,params)=>service.voice.event(current,{method,params:{threadId:current.threadId,...params}});await emit('thread/realtime/transcript/delta',{role:'user',delta:'Please open'});assert.equal(service.state.messages.length,0);await emit('thread/realtime/transcript/done',{role:'user',text:'Please open the intake'});await emit('thread/realtime/transcript/done',{role:'user',text:'Please open the intake'});assert.equal(service.state.messages.length,1);await emit('turn/started',{turn:{id:'turn-1'}});await emit('item/completed',{item:{type:'agentMessage',text:JSON.stringify({answer:'Opening.',actions:[{kind:'ui_click',target:'ui-999',value:''}],memory:'',needsNextStep:true})}});await emit('turn/completed',{turn:{id:'turn-1',status:'completed'}});assert.equal(events.some(e=>e.type==='voice_work'),false);assert.ok(events.some(e=>e.type==='voice_work_error'));const saved=JSON.parse(await readFile(path.join(root,'.companion/conversation.json'),'utf8'));assert.equal(saved.messages.length,1);assert.equal(service.busy,false);});
test('validated delegated website requests preserve the screen revision for the existing browser guard',async t=>{const {service}=await setup(t),events=[];await service.voice.start(startInput,(type,data)=>events.push({type,...data}));const current=service.voice.session;const emit=(method,params)=>service.voice.event(current,{method,params:{threadId:current.threadId,...params}});await emit('thread/realtime/transcript/done',{role:'user',text:'Open a new intake'});await emit('turn/started',{turn:{id:'turn-2'}});await emit('item/completed',{item:{type:'agentMessage',text:JSON.stringify({answer:'I will open the intake.',actions:[{kind:'ui_click',target:'ui-1',value:''}],memory:'',needsNextStep:true})}});await emit('turn/completed',{turn:{id:'turn-2',status:'completed'}});const work=events.find(e=>e.type==='voice_work');assert.equal(work.message,'Open a new intake');assert.equal(work.reply.uiSnapshotId,context.ui.id);assert.equal(work.reply.actions[0].target,'ui-1');});
test('voice refuses invalid offers and voices, and keeps service errors free of credentials',async t=>{assert.equal(voiceStartSchema.safeParse({...startInput,sdp:'not-an-offer'}).success,false);const {service}=await setup(t);await assert.rejects(service.voice.start({...startInput,voice:'invented'},()=>{}),/unavailable/);assert.equal(service.voice.session,null);assert.doesNotMatch(publicVoiceError(new Error('Bearer secret-token HTTP 403')),/secret-token/);});

test('startup errors are reported before the stream closes and release the call lease',async t=>{const {service,connection}=await setup(t),events=[];await service.load();const listenerCount=connection.listeners.size;const request=connection.request.bind(connection);connection.request=async(method,params)=>{if(method==='thread/realtime/start')throw new Error('HTTP 403 Bearer private-secret');return request(method,params);};await assert.rejects(service.voice.start(startInput,(type,data)=>events.push({type,...data})),/403/);assert.deepEqual(events.map(e=>e.type),['voice_error','voice_closed']);assert.doesNotMatch(events[0].message,/private-secret/);assert.equal(service.voice.session,null);assert.equal(connection.listeners.size,listenerCount);});

test('a remote transport closure is visible and removes the call listener',async t=>{const {service,connection}=await setup(t),events=[];await service.load();const listenerCount=connection.listeners.size;await service.voice.start(startInput,(type,data)=>events.push({type,...data}));const current=service.voice.session;await service.voice.event(current,{method:'thread/realtime/closed',params:{threadId:current.threadId,reason:'transport_closed'}});assert.match(events.find(e=>e.type==='voice_closed').message,/ended this connection/);assert.equal(service.voice.session,null);assert.equal(connection.listeners.size,listenerCount);});

async function delegated(service,reply,message='Review my project'){
 const current=service.voice.session;
 const emit=(method,params)=>service.voice.event(current,{method,params:{threadId:current.threadId,...params}});
 await emit('thread/realtime/transcript/done',{role:'user',text:message});
 await emit('turn/started',{turn:{id:'facilitator-turn'}});
 await emit('item/completed',{item:{type:'agentMessage',text:JSON.stringify(reply)}});
 await emit('turn/completed',{turn:{id:'facilitator-turn',status:'completed'}});
 return emit;
}
test('voice uses the Delft backing policy and cannot confirm the human brief',async t=>{
 const {service,connection}=await setup(t),events=[];
 const planner={projectId:crypto.randomUUID(),revision:7,sessions:[],brief:emptyDesignBrief(),goals:[],workItems:[],catalogue:[]};
 await service.voice.start({...startInput,context:{...context,planner}},(type,data)=>events.push({type,...data}));
 const policy=connection.requests.find(r=>r.method==='thread/start').params.developerInstructions;
 assert.match(policy,/Confirm the brief before planning/);assert.match(policy,/Thing Ethnography/);
 const prompt=connection.requests.find(r=>r.method==='thread/realtime/start').params.prompt;
 assert.match(prompt,/Delegate all method selection/);assert.doesNotMatch(prompt,/No specialist method skills/);
 const reply={answer:'Review this brief.',actions:[{kind:'brief_update',payload:JSON.stringify({...emptyDesignBrief(),confirmed:true})}],memory:''};
 const emit=await delegated(service,reply);
 const work=events.find(e=>e.type==='voice_work');
 assert.equal(JSON.parse(work.reply.actions[0].payload).confirmed,false);
 assert.equal(work.reply.projectId,planner.projectId);assert.equal(work.reply.revision,7);
 await emit('turn/completed',{turn:{id:'facilitator-turn',status:'completed'}});
 assert.equal(events.filter(e=>e.type==='voice_work').length,1);
 assert.equal(service.state.messages.filter(m=>m.role==='user').length,1);
});
test('spoken and typed structural proposals share validation and preserve revisions',async t=>{
 const {service}=await setup(t),events=[];
 const planner={projectId:crypto.randomUUID(),revision:3,sessions:[]};
 const ctx={...context,planner};
 await service.voice.start({...startInput,context:ctx},(type,data)=>events.push({type,...data}));
 const bundle={title:'Recruit participants',rationale:'Prepare evidence',alternatives:'Existing records',assumptions:[],adaptations:[],operations:[{op:'task_put',task:{id:'recruit',goalId:'goal',week:1,title:'Recruit participants',kind:'recruitment',owner:'Team',personHours:2,elapsedNote:'',output:'Confirmed participants',dependsOn:[]}}]};
 const reply={answer:'Proposed for human review; not applied.',actions:[{kind:'plan_edit',payload:JSON.stringify(bundle)}],memory:''};
 await delegated(service,structuredClone(reply));
 const spoken=events.find(e=>e.type==='voice_work').reply;
 const typed=await service.acceptReply(structuredClone(reply),{message:'Review my project',context:ctx});
 assert.deepEqual(spoken.actions,typed.actions);assert.equal(spoken.revision,typed.revision);
 events.length=0;
 bundle.operations=[{op:'session_put',session:{id:'new',goalId:'goal',week:1,title:'Session',purpose:'Scope',output:'Problem',phase:'define',goal:'frame',participants:4,level:'bachelor',minutes:90,dependsOn:[],workDependencies:[],activities:[{id:'map',methodId:'index-delft-mind-mapping',minutes:30}]}}];
 reply.actions[0].payload=JSON.stringify(bundle);
 await delegated(service,reply,'Propose a new method');
 assert.equal(events.some(e=>e.type==='voice_work'),false);
 assert.ok(events.some(e=>e.type==='voice_work_error'));
});
test('spoken source inspection renders DDG scans for the shared continuation path',async t=>{
 const {service,connection}=await setup(t),events=[];
 await service.voice.start(startInput,(type,data)=>events.push({type,...data}));
 const method=service.skill.methods.find(m=>m.id==='index-delft-mind-mapping');assert.ok(method);
 await delegated(service,{answer:'I will inspect Mind Mapping.',actions:[{kind:'inspect_methods',payload:JSON.stringify({methodIds:[method.id]})}],memory:''},'Inspect Mind Mapping');
 const work=events.find(e=>e.type==='voice_work');assert.ok(work?.reply.sourceReview);assert.equal(work.reply.needsNextStep,true);
 assert.ok(service.sourceInputs.some(input=>input.type==='localImage'));assert.ok(service.inspected.has(method.id));
 connection.request=async function(method,params){this.requests.push({method,params});if(method==='account/read')return{account:this.account};if(method==='account/rateLimits/read')return this.limits;if(method==='turn/start'){
  this.emit('turn/started',{turn:{id:'continuation'}});
  this.emit('item/completed',{item:{type:'agentMessage',text:JSON.stringify({answer:'Source reviewed. No changes proposed.',actions:[],memory:''})}});
  this.emit('turn/completed',{turn:{id:'continuation',status:'completed'}});
 }return{};};
 await service.ask({message:'Inspect Mind Mapping',context,automation:{step:1,feedback:'Read the source images.'}});
 const turn=connection.requests.find(r=>r.method==='turn/start');assert.ok(turn.params.input.some(input=>input.type==='localImage'));
 assert.equal(events.filter(e=>e.type==='voice_work').length,1,'text continuation must not be processed twice by voice');
});
test('voice freezes the completed request and keeps its lease until validation finishes',async t=>{
 const {service}=await setup(t),events=[];
 await service.voice.start(startInput,(type,data)=>events.push({type,...data}));
 const current=service.voice.session;
 const emit=(method,params)=>service.voice.event(current,{method,params:{threadId:current.threadId,...params}});
 await emit('thread/realtime/transcript/done',{role:'user',text:'Open my project'});
 await emit('turn/started',{turn:{id:'owned-turn'}});
 await emit('thread/realtime/transcript/done',{role:'user',text:'A later request'});
 await emit('item/completed',{item:{type:'agentMessage',text:JSON.stringify({answer:'Opening.',actions:[{kind:'ui_click',target:'ui-1',value:''}],memory:''})}});
 let release,started;
 const entered=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const accept=service.acceptReply.bind(service);
 service.acceptReply=async(...args)=>{started();await gate;return accept(...args);};
 const completion=emit('turn/completed',{turn:{id:'owned-turn',status:'completed'}});
 await entered;assert.equal(service.busy,true);
 await assert.rejects(service.ask({message:'Competing request',context}),/another question/);
 release();await completion;
 assert.equal(events.find(e=>e.type==='voice_work').message,'Open my project');assert.equal(service.busy,false);
 // Late events after a stop cannot apply a reply or reacquire the lease.
 await service.voice.stop(current.id);
 await emit('turn/started',{turn:{id:'late'}});
 assert.equal(service.busy,false);
});

test('native startup context is valid JSON and retains goals and sessions after large catalogues',async t=>{
 const {service,connection}=await setup(t);
 const planner={projectId:crypto.randomUUID(),revision:1,goalId:'selected',goals:[{id:'selected',title:'Specific goal'}],catalogue:Array.from({length:67},(_,id)=>({id,text:'Long catalogue reference '.repeat(30)})),sessions:[{id:crypto.randomUUID(),title:'Final session marker',minutes:90,status:'draft',activities:[]}]};
 await service.voice.start({...startInput,context:{...context,planner}},()=>{});
 const request=connection.requests.find(r=>r.method==='thread/realtime/start');
 const raw=request.params.initialItems[0].text.split('\n').slice(1).join('\n'),summary=JSON.parse(raw);
 assert.equal(summary.project.planner.sessions[0].title,'Final session marker');
 assert.equal(summary.project.planner.goalId,'selected');
 assert.equal(summary.project.planner.catalogue,undefined);
 assert.equal(service.voice.session.context.planner.catalogue.length,67);
});

test('Stop interrupts the current native work without ending the call or accepting late actions',async t=>{
 const {service,connection}=await setup(t),events=[];
 await service.voice.start(startInput,(type,data)=>events.push({type,...data}));
 const current=service.voice.session;
 await delegated(service,{answer:'Done',actions:[],memory:''});
 current.turn='pending-native';service.busy=true;
 await service.voice.result({action:'voice_interrupt',sessionId:current.id});
 assert.equal(service.voice.session,current);assert.equal(current.turn,null);assert.equal(service.busy,false);
 assert.ok(connection.requests.some(r=>r.method==='turn/interrupt'&&r.params.turnId==='pending-native'));
 assert.equal(connection.requests.some(r=>r.method==='thread/realtime/stop'),false);
 assert.ok(events.some(e=>e.type==='voice_work_stopped'));
});
test('a final spoken clarification is routed into the pending planning job without a continue prompt',async t=>{
 const {service}=await setup(t),events=[];
 const planner={projectId:crypto.randomUUID(),revision:1,goalId:'goal',goals:[{id:'goal',title:'Research',sessionIds:[]}],sessions:[]};
 await service.voice.start({...startInput,context:{...context,planner}},(type,data)=>events.push({type,...data}));
 service.state.planningJobs=[{id:'waiting',projectId:planner.projectId,goalId:'goal',key:planner.projectId+':goal',fingerprint:'brief',revision:1,state:'awaiting_input',message:'Tailor the original research goal',requestIds:[],sequence:1,operations:[]}];
 const current=service.voice.session;
 await service.voice.event(current,{method:'thread/realtime/transcript/done',params:{threadId:current.threadId,role:'user',text:'We have twelve interview summaries'}});
 service.planning.stop();
 assert.equal(service.state.planningJobs[0].state,'queued');
 assert.match(service.state.planningJobs[0].message,/twelve interview summaries/);
 assert.equal(events.filter(e=>e.type==='planning_resumed').length,1);
 assert.equal(service.state.messages.filter(m=>m.role==='user').length,1);
});
