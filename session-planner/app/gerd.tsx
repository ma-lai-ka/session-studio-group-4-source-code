'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Minus, Plus, Send, Settings2, Volume2, VolumeX, X, Square, RefreshCw, LoaderCircle } from 'lucide-react';
import { useRealtimeVoice } from './use-realtime-voice';
import { useCompanionPosition } from './use-companion-position';
import { CompanionMicrophone } from './companion-microphone';
import { CompanionPet } from './companion-pet';
import { captureUi, runUiActions, type UiAction, type UiSnapshot } from '@/lib/companion-ui';
import { localEnglishAvailable, microphoneConstraints, preferredVoice, releaseRecognition, speechError } from '@/lib/companion-voice';
import type { CompanionPlanner, CompanionEdit, CompanionChangeRequest } from '@/lib/companion';
import { tailoringMessage,type TailoringRequest,type TailoringState } from '@/lib/goal-tailoring';
import {companionError} from '@/lib/companion-errors.mjs';
import {activityLabel,type PlanningJob} from '@/lib/companion-state';
import './gerd.css';

export type GerdContext={projectName?:string;phase:string;goal:string;hasPlan:boolean;approved:boolean;activities:string[];planner?:CompanionPlanner;ui?:UiSnapshot};
type Message={kind?:'operation';role:'assistant'|'user';text:string;id?:string};
type RecognitionResult=ArrayLike<{transcript:string}>&{isFinal:boolean};
type Recognition={continuous:boolean;interimResults:boolean;lang:string;processLocally?:boolean;start:(track?:MediaStreamTrack)=>void;stop:()=>void;abort?:()=>void;onresult:((event:{results:ArrayLike<RecognitionResult>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null};
type RecognitionConstructor={new():Recognition;available?:(options:{langs:string[];processLocally:boolean})=>Promise<string>};
type Connection={local?:boolean;configured:boolean;token?:string;error?:string;folder?:string;resumeCommand?:string;threadId?:string;skills?:{name:string;version:string;scope:string}[];files?:{name:string;status:string}[];messages?:Message[];jobs?:PlanningJob[]};
type FacilitatorAction={kind:'plan_edit'|'brief_update'|'inspect_methods';payload:string};
type Reply={goalId?:string;targetGoalId?:string;sourceReview?:boolean;sourceNames?:string[];answer:string;error?:string;actions?:(CompanionEdit|UiAction|FacilitatorAction)[];memorySaved?:boolean;projectId?:string;revision?:number;threadId?:string;uiSnapshotId?:string;needsNextStep?:boolean};
const emptyContext:GerdContext={phase:'',goal:'',hasPlan:false,approved:false,activities:[]};
const greeting='Hi, I’m your graduation companion. Tell me what you’re working on. You can ask me to open pages, fill in forms, or adjust your plan. The Delft facilitator skill is connected. I can propose changes to sessions, activities and work outside sessions for your review.';

export function GerdAssistant({context}:{context?:GerdContext}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[sending,setSending]=useState(false),[listening,setListening]=useState(false),[speaking,setSpeaking]=useState(false),[voiceEnabled,setVoiceEnabled]=useState(false),[error,setError]=useState('');
 const [messages,setMessages]=useState<Message[]>([{role:'assistant',text:'Open the local companion to connect with Gerd.'}]);
 const [dialogHost,setDialogHost]=useState<HTMLElement|null>(null),[connection,setConnection]=useState<Connection>({configured:false}),[connecting,setConnecting]=useState(true);
 const [notice,setNotice]=useState(''),[progress,setProgress]=useState(''),[partial,setPartial]=useState(''),[undo,setUndo]=useState<{projectId:string;revision:number}|null>(null);
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[voiceURI,setVoiceURI]=useState(''),[autoSend,setAutoSend]=useState(true),[micSupported,setMicSupported]=useState(false);
 const [microphoneId,setMicrophoneId]=useState(''),[audioSettings,setAudioSettings]=useState(false);
 const microphoneStream=useRef<MediaStream|null>(null);
 const [voiceFallback,setVoiceFallback]=useState(false),[preparingMic,setPreparingMic]=useState(false);
 const audioToggle=useRef<HTMLButtonElement>(null);
 const input=useRef<HTMLInputElement>(null),launcher=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null),recognition=useRef<Recognition|null>(null),pending=useRef<AbortController|null>(null),mounted=useRef(true),inFlight=useRef(false),followChat=useRef(true);
 const contextRef=useRef(context);contextRef.current=context;
 const connectionRef=useRef(connection);connectionRef.current=connection;
 const cancelling=useRef(false);
 const tailoringQueue=useRef<TailoringRequest[]>([]),seenTailoring=useRef(new Set<string>()),flushTailoring=useRef(()=>{});
 const [jobs,setJobs]=useState<PlanningJob[]>([]),[errorScope,setErrorScope]=useState<{projectId?:string;goalId?:string}>({});
 const jobsRef=useRef<PlanningJob[]>([]),jobHandlers=useRef(new Map<string,TailoringRequest>()),handledResults=useRef(new Set<string>()),applying=useRef(new Set<string>()),seenJobErrors=useRef(new Set<string>()),pausedJobs=useRef(new Set<string>()),pollJobs=useRef(()=>{});
 const sendRef=useRef<(text:string)=>void>(()=>{});
 const position=useCompanionPosition(dialogHost);
 const voice=useRealtimeVoice({token:connection.token,configured:connection.local===true&&connection.configured,microphone:microphoneId,getContext:()=>({...contextRef.current??emptyContext,ui:captureUi()}),onTranscript:(role,text)=>{followChat.current=true;setMessages(items=>[...items,{role,text}]);},onWork:(reply,message)=>{void send(message,reply as Reply);},onError:setError});
 function cleanupMic(){const listener=recognition.current;recognition.current=null;releaseRecognition(listener);microphoneStream.current?.getTracks().forEach(track=>track.stop());microphoneStream.current=null;if(mounted.current)setPreparingMic(false);}
 function windowsVoiceTyping(){cleanupMic();setListening(false);setError('');setNotice('Press Win + H now, speak in English, then press Send when your words appear. This uses Windows voice typing; the website does not launch or control it.');input.current?.focus({preventScroll:true});}
 function stopSpeech(){window.speechSynthesis?.cancel();setSpeaking(false);}
 function speak(text:string){
  if(!window.speechSynthesis){setError('Spoken replies are unavailable in this browser.');return;}
  stopSpeech();const selected=preferredVoice(window.speechSynthesis.getVoices(),voiceURI);const utterance=new SpeechSynthesisUtterance(text);if(!selected){setError(voiceURI?'Your selected reply voice is unavailable. Choose an installed voice in Voice & controls; I have not switched to a robotic default.':'No English reply voice is available in this browser. Choose or install an English system voice, or use text replies.');return;}utterance.voice=selected;utterance.lang=selected.lang;utterance.rate=1;utterance.pitch=1;
  utterance.onstart=()=>{if(mounted.current)setSpeaking(true);};utterance.onend=()=>{if(mounted.current)setSpeaking(false);};utterance.onerror=event=>{if(mounted.current){setSpeaking(false);if(!['canceled','interrupted'].includes(event.error))setError('The selected voice could not speak. Choose another browser voice or test it in Chrome.');}};window.speechSynthesis.speak(utterance);
 }
 async function refresh(reconnect=false){setConnecting(true);setError('');try{if(reconnect){cleanupMic();setListening(false);await voice.stop();}const response=await fetch('/api/gerd',{cache:'no-store',signal:AbortSignal.timeout(35000)});const data=await response.json() as Connection;if(!response.ok)throw new Error(data.error||'The companion connection could not be checked. Start the local companion, then try Reconnect assistant.');if(!mounted.current)return;setConnection(data);if(data.jobs){jobsRef.current=data.jobs;setJobs(data.jobs);}if(data.local){setMessages(data.messages?.length?data.messages:[{role:'assistant',text:greeting}]);setError(data.error||'');if(reconnect&&data.configured)setNotice('Gerd is connected. Your conversation and draft are preserved.');}else{setConnection({configured:false});setError('Gerd is disconnected in this preview. Start the local companion, then choose Reconnect assistant.');}}catch(e){if(mounted.current){setConnection({configured:false});setError((e as Error).message);}}finally{if(mounted.current)setConnecting(false);}}
 useEffect(()=>{
  mounted.current=true;void refresh();
  const update=()=>setDialogHost(document.querySelector<HTMLElement>('dialog.programme-dialog[open] .programme-dialog-shell'));
  const observer=new MutationObserver(update);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});update();
  const browser=window as typeof window&{SpeechRecognition?:unknown;webkitSpeechRecognition?:unknown};setMicSupported(!!(browser.SpeechRecognition||browser.webkitSpeechRecognition));
  const loadVoices=()=>setVoices(window.speechSynthesis?.getVoices()??[]);loadVoices();window.speechSynthesis?.addEventListener('voiceschanged',loadVoices);
  try{setVoiceURI(localStorage.getItem('studio-companion-voice')||'');setMicrophoneId(localStorage.getItem('studio-companion-microphone')||'');}catch{}
  return()=>{mounted.current=false;observer.disconnect();cleanupMic();pending.current?.abort();window.speechSynthesis?.removeEventListener('voiceschanged',loadVoices);window.speechSynthesis?.cancel();};
 },[]);
 useEffect(()=>{if(open)input.current?.focus({preventScroll:true});},[open,dialogHost]);
 useEffect(()=>{if(followChat.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,partial,progress,open,position.down]);
 async function stopReply(){const token=connectionRef.current.token;cancelling.current=true;pending.current?.abort();for(const request of tailoringQueue.current.splice(0)){request.done('failed','Stopped. Your saved plan is unchanged.');request.ack?.({ok:false,message:'Planning stopped.'});}for(const job of jobsRef.current.filter(j=>['queued','running','awaiting_apply','awaiting_input','awaiting_confirmation'].includes(j.state)))void postPlanning({action:'planning_cancel',jobId:job.id}).catch(()=>{});void voice.interruptReply();stopSpeech();setPartial('');setProgress('');try{if(token)await fetch('/api/gerd',{method:'POST',headers:{'Content-Type':'application/json','X-Companion-Token':token},body:JSON.stringify({action:'cancel'}),signal:AbortSignal.timeout(3000)});}catch{}finally{cancelling.current=false;}setNotice('Reply stopped. No further website actions will be performed.');}

 function close(){setOpen(false);launcher.current?.focus({preventScroll:true});}

 function applyEdits(actions:CompanionEdit[],projectId:string,revision:number,isUndo=false){return new Promise<{ok:boolean;message:string;revision?:number}>(resolve=>{const timeout=setTimeout(()=>resolve({ok:false,message:'Open the same project in the planner to apply this edit.'}),1500);const detail:CompanionChangeRequest={actions,projectId,revision,undo:isUndo,done:result=>{clearTimeout(timeout);resolve(result);}};window.dispatchEvent(new CustomEvent('session-studio:companion-edit',{detail}));});}
 async function undoEdit(){if(!undo)return;const result=await applyEdits([],undo.projectId,undo.revision,true);setNotice(result.message);setUndo(null);}
 async function receive(response:Response):Promise<Reply>{
  if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||'The companion could not respond.');}
  if(!response.headers.get('Content-Type')?.includes('application/x-ndjson'))return response.json();
  const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',result:Reply|undefined;
  function event(line:string){if(!line.trim())return;const data=JSON.parse(line) as {type:string;message?:string;text?:string;result?:Reply};if(data.type==='progress')setProgress(data.message||'Thinking…');if(data.type==='delta')setPartial(data.text||'');if(data.type==='error')throw new Error(data.message||'Reply interrupted.');if(data.type==='result')result=data.result;}
  while(true){const part=await reader.read();buffer+=decoder.decode(part.value,{stream:!part.done});let end;while((end=buffer.indexOf('\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(part.done)break;}
  event(buffer);if(!result?.answer)throw new Error('The connection closed before the reply finished.');return result;
 }
 async function send(value=draft,voiceReply?:Reply,task?:TailoringRequest){
  const text=value.trim(),activeConnection=connectionRef.current;if(!text||inFlight.current||cancelling.current)return;if(!activeConnection.local||!activeConnection.configured){setError('Open the local companion and check its connection first.');return;}
  if(!voiceReply)voice.beginRequest();
  const waiting=!voiceReply&&!task?jobsRef.current.find(j=>j.projectId===contextRef.current?.planner?.projectId&&j.goalId===contextRef.current?.planner?.goalId&&j.state==='awaiting_input'):undefined;
  if(waiting){setMessages(items=>[...items,{role:'user',text}]);setDraft('');try{await postPlanning({action:'planning_answer',request:{jobId:waiting.id,message:text,context:{...contextRef.current,ui:captureUi()},requestId:crypto.randomUUID()}});voice.pauseForWork();setError('');}catch(problem){setError((problem as Error).message);}return;}
  inFlight.current=true;cleanupMic();setListening(false);stopSpeech();if(!voiceReply)setMessages(items=>[...items,{role:'user',text:task?'Tailor this goal: '+(contextRef.current?.planner?.goals?.find(g=>g.id===task.goalId)?.title??'Selected goal'):text}]);if(!task)setDraft('');setSending(true);setError('');setNotice('');setProgress('Sending…');followChat.current=true;
  const taskRevision=task?contextRef.current?.planner?.revision:undefined;
  const controller=new AbortController();pending.current=controller;let feedback='',lastAnswer='',taskStatus:TailoringState='failed',taskMessage='Tailoring was interrupted. Your saved plan is unchanged; retry when ready.';
  if(task)voice.pauseForWork();
  try{for(let step=0;step<10;step++){
   if(controller.signal.aborted)break;setPartial('');
   const selected=contextRef.current??emptyContext;
   if(task&&(!selected.planner||selected.planner.projectId!==task.projectId||!selected.planner.goals?.some(g=>g.id===task.goalId)))throw new Error('The selected project or goal changed. Open the intended project and retry tailoring.');
   const target=task?selected.planner?.goals?.find(g=>g.id===task.goalId):undefined;
   if(task&&(target?.tailoring?.fingerprint!==task.fingerprint||selected.planner?.revision!==taskRevision))throw new Error('The goal or project changed during tailoring. Saved edits are preserved; request a fresh proposal.');
   const payload=step===0&&voiceReply?selected:{...selected,ui:captureUi(),...(task&&selected.planner?{goal:target!.title,phase:[...new Set(target!.diamonds.flatMap(d=>d.phases))].join(', '),planner:{...selected.planner,goalId:task.goalId,targetGoalId:task.goalId,brief:target!.designBrief}}:{})};
   const data=step===0&&voiceReply?voiceReply:await receive(await fetch('/api/gerd',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson',...(activeConnection.token?{'X-Companion-Token':activeConnection.token}:{})},body:JSON.stringify({message:text,context:payload,...(step?{automation:{step,feedback}}:{})}),signal:controller.signal}));if(!mounted.current||controller.signal.aborted)return;lastAnswer=data.answer;setPartial('');setMessages(items=>[...items,{role:'assistant',text:data.answer,kind:data.sourceReview?'operation':undefined}]);
   if(data.threadId)setConnection(v=>({...v,threadId:data.threadId,resumeCommand:`codex resume ${data.threadId}`}));
   const actions=data.actions??[];
   if(data.sourceReview){feedback='Source images loaded for '+(data.sourceNames??[]).join(', ')+'. Read the actual entries, compare fit, then continue the original request.';setProgress('Reviewing Delft source entries…');if(step===9)throw new Error('Source review reached its limit. Narrow the request and try again.');continue;}
   if(actions.length&&['plan_edit','brief_update'].includes(actions[0].kind)){
    if(!data.projectId||data.revision===undefined)throw new Error('Open the intended project first.');
    const action=actions[0] as FacilitatorAction;
    const result=await new Promise<{ok:boolean;message:string}>(resolve=>{const timeout=setTimeout(()=>resolve({ok:false,message:'Open the intended project before reviewing changes.'}),2000);window.dispatchEvent(new CustomEvent('session-studio:planner-proposal',{detail:{projectId:data.projectId,revision:data.revision,payload:action.payload,kind:action.kind,goalId:data.goalId,targetGoalId:data.targetGoalId,done:(value:{ok:boolean;message:string})=>{clearTimeout(timeout);resolve(value);}}}));});setNotice(result.message);lastAnswer=result.message;taskStatus=result.ok?(action.kind==='brief_update'?'awaiting_confirmation':'proposal_ready'):'failed';taskMessage=result.message;if(!result.ok)setError(result.message);break;
   }
   if(actions.length&&actions[0].kind.startsWith('ui_')){setProgress('Working on the website…');feedback=await runUiActions(actions as UiAction[],data.uiSnapshotId||'');lastAnswer=feedback;setNotice(feedback);}
   else if(actions.length&&data.projectId&&data.revision!==undefined){const result=await applyEdits(actions as CompanionEdit[],data.projectId,data.revision);lastAnswer=result.message;setNotice(result.message);setUndo(result.ok&&result.revision!==undefined?{projectId:data.projectId,revision:result.revision}:null);feedback=result.message;if(!result.ok)break;}
   if(data.memorySaved)setNotice(previous=>(previous?previous+' ':'')+'Note saved in graduation-context.');
   if(!actions.length||(!actions[0].kind.startsWith('ui_')&&!data.needsNextStep)){taskStatus='needs_details';taskMessage=lastAnswer;break;}
   if(step===9){setNotice('I reached the limit for this command. Review the current page and ask me to continue if needed.');break;}
   await new Promise(resolve=>setTimeout(resolve,400));
  }if((voiceReply||task&&voice.active)&&!controller.signal.aborted)await voice.reportResult(lastAnswer);else if(voiceEnabled&&lastAnswer&&!controller.signal.aborted)speak(lastAnswer);
  }catch(problem){if(mounted.current&&!controller.signal.aborted){const message=problem instanceof Error?problem.message:'The companion could not respond.';taskMessage=message;setError(message);if(voiceReply||task&&voice.active)void voice.reportResult(message+' No further actions were performed.');}}
  finally{if(task)task.done(taskStatus,taskMessage);if(pending.current===controller){pending.current=null;inFlight.current=false;if(mounted.current){setSending(false);setPartial('');setProgress('');if(open)requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));}}}
 }
 async function postPlanning(body:unknown){const response=await fetch('/api/gerd',{method:'POST',headers:{'Content-Type':'application/json','X-Companion-Token':connectionRef.current.token??''},body:JSON.stringify(body)});const value=await response.json() as {error?:string;job:PlanningJob;jobs:PlanningJob[]};if(!response.ok)throw new Error(value.error??'The planning connection failed.');return value;}
 flushTailoring.current=()=>{
  if(!tailoringQueue.current.length||inFlight.current||cancelling.current||connecting)return;
  const request=tailoringQueue.current.shift()!,planner=contextRef.current?.planner,target=planner?.goals?.find(g=>g.id===request.goalId);
  if(!planner||planner.projectId!==request.projectId||!target){request.done('stale','Open the intended project and retry planning.');request.ack?.({ok:false,message:'The selected goal changed.'});return;}
  if(!connectionRef.current.local||!connectionRef.current.configured){const message='Brief saved, but Gerd is disconnected. Reconnect the assistant to start planning.';request.done('failed',message);request.ack?.({ok:false,message});setError(message);return;}
  voice.beginRequest();voice.pauseForWork();
  void postPlanning({action:'planning_start',request:{requestId:request.id,goalId:request.goalId,fingerprint:request.fingerprint,message:tailoringMessage(target),force:request.force,context:{...contextRef.current,planner:{...planner,goalId:request.goalId,targetGoalId:request.goalId,brief:target.designBrief}}}}).then(({job})=>{jobHandlers.current.set(job.id,request);request.ack?.({ok:true,jobId:job.id,message:'Planning queued. Gerd will continue automatically.'});pollJobs.current();}).catch(problem=>{request.done('failed',problem.message);request.ack?.({ok:false,message:problem.message});setError(problem.message);});
 };
 async function applyJob(job:PlanningJob){
  const key=job.id+':'+job.resultVersion;if(!job.result||handledResults.current.has(key)||applying.current.has(key))return;
  const result=job.result as Reply;
  if(job.state==='awaiting_input'){handledResults.current.add(key);setMessages(items=>items.some(m=>m.id===(result as any).messageId)?items:[...items,{role:'assistant',text:result.answer,id:(result as any).messageId}]);if(voice.active)await voice.reportResult(result.answer);return;}
  if(job.state!=='awaiting_apply')return;
  const planner=contextRef.current?.planner;
  if(!planner||planner.projectId!==job.projectId){if(!pausedJobs.current.has(key)){pausedJobs.current.add(key);setErrorScope(job);setError('Your planning result is ready. Open the original project and goal to review it.');await postPlanning({action:'planning_ack',request:{jobId:job.id,resultVersion:job.resultVersion,ok:false,code:'OPEN_GOAL',message:'Open the original project and goal to review the planning result.'}});}return;}
  applying.current.add(key);
  try{
   const action=result.actions?.[0] as FacilitatorAction|undefined;if(!action)throw new Error('The planning proposal is missing. Retry planning.');
   const outcome=await new Promise<{ok:boolean;message:string}>(resolve=>{const timer=setTimeout(()=>resolve({ok:false,message:'Open the intended project and goal to review this result.'}),2000);window.dispatchEvent(new CustomEvent('session-studio:planner-proposal',{detail:{projectId:result.projectId,revision:result.revision,payload:action.payload,kind:action.kind,goalId:job.goalId,targetGoalId:job.goalId,done:(value:{ok:boolean;message:string})=>{clearTimeout(timer);resolve(value);}}}));});
   const recovery=companionError(outcome.message);await postPlanning({action:'planning_ack',request:{jobId:job.id,resultVersion:job.resultVersion,...outcome,code:recovery.code}});
   if(outcome.ok){handledResults.current.add(key);setMessages(items=>items.some(m=>m.id===(result as any).messageId)?items:[...items,{role:'assistant',text:result.answer,id:(result as any).messageId}]);setNotice(outcome.message);if(voice.active)await voice.reportResult(outcome.message);}
   else{if(recovery.code!=='OPEN_GOAL')handledResults.current.add(key);setErrorScope(job);setError(outcome.message);}
  }catch(problem){setErrorScope(job);setError((problem as Error).message);}finally{applying.current.delete(key);}
 }
 const polling=useRef(false),planningLease=useRef(false);
 pollJobs.current=()=>{if(polling.current||!connectionRef.current.local||!connectionRef.current.configured)return;polling.current=true;void postPlanning({action:'planning_status'}).then(async({jobs:next})=>{
  if(!mounted.current)return;jobsRef.current=next;setJobs(next);
  for(const job of next as PlanningJob[]){window.dispatchEvent(new CustomEvent('session-studio:planning-status',{detail:job}));const handler=jobHandlers.current.get(job.id);if(['failed','cancelled','awaiting_input','awaiting_confirmation','proposal_ready'].includes(job.state)){handler?.done(({failed:'failed',cancelled:'failed',awaiting_input:'needs_details',awaiting_confirmation:'awaiting_confirmation',proposal_ready:'proposal_ready'} as const)[job.state as 'failed'],job.error?.message??job.progress);}
   const errorKey=job.id+':'+job.sequence+':'+job.error?.code;if(job.error&&!seenJobErrors.current.has(errorKey)){seenJobErrors.current.add(errorKey);setErrorScope(job);setError(job.error.message);}
   if(['failed','cancelled'].includes(job.state)&&!handledResults.current.has('ended:'+job.id+':'+job.sequence)){handledResults.current.add('ended:'+job.id+':'+job.sequence);if(!next.some((j:PlanningJob)=>['queued','running'].includes(j.state))&&!inFlight.current)voice.finishWork();}await applyJob(job);
  }
   if(next.some((job:PlanningJob)=>['queued','running'].includes(job.state))){planningLease.current=true;voice.pauseForWork();}else if(planningLease.current&&!inFlight.current){planningLease.current=false;voice.finishWork();}
 }).catch(()=>{}).finally(()=>{polling.current=false;});};
 useEffect(()=>{
  const enqueue=(event:Event)=>{const request=(event as CustomEvent<TailoringRequest>).detail;if(!request?.id)return;request.claimed=true;if(seenTailoring.current.has(request.id))return;seenTailoring.current.add(request.id);tailoringQueue.current.push(request);};
  const reconnect=()=>void refresh(true);const complete=(event:Event)=>{const {jobId,message}=(event as CustomEvent).detail??{};if(jobId)void postPlanning({action:'planning_complete',jobId,message}).catch(()=>{});};
  window.addEventListener('session-studio:planning-complete',complete);window.addEventListener('session-studio:tailor-goal',enqueue);window.addEventListener('session-studio:reconnect-assistant',reconnect);
  const timer=setInterval(()=>{flushTailoring.current();pollJobs.current();},800);
  return()=>{clearInterval(timer);window.removeEventListener('session-studio:planning-complete',complete);window.removeEventListener('session-studio:tailor-goal',enqueue);window.removeEventListener('session-studio:reconnect-assistant',reconnect);};
 },[]);
 function recover(action:string){
  const planner=contextRef.current?.planner,scope={projectId:errorScope.projectId??planner?.projectId,goalId:errorScope.goalId??planner?.goalId};
  if(action==='reconnect'){void refresh(true);return;}
  if(action==='voice_settings'){setOpen(true);setAudioSettings(true);return;}
  if(action==='connection'){setOpen(true);setNotice('Check your Codex ChatGPT sign-in and included allowance, then reconnect.');return;}
  if(action==='source_setup'){setNotice('Source scans need Python with pypdfium2 and Pillow. Check the companion setup guide, then use Retry planning.');return;}
  window.dispatchEvent(new CustomEvent(action==='retry'?'session-studio:retry-tailoring':'session-studio:open-goal',{detail:{...scope,reviewBrief:action==='review_brief'}}));setError('');
 }
 sendRef.current=text=>void send(text);
 async function toggleListening(){
  if(listening){try{recognition.current?.stop();}catch{}return;}
  const browser=window as typeof window&{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor},Constructor=browser.SpeechRecognition??browser.webkitSpeechRecognition;
  if(!Constructor){setError('This embedded browser does not offer speech recognition. Open http://127.0.0.1:5181/ in regular Chrome, or click the message field and use Windows voice typing (Win + H).');return;}
  stopSpeech();cleanupMic();const listener=new Constructor();recognition.current=listener;listener.continuous=false;listener.interimResults=true;listener.lang='en-US';let finalText='',failed=false;
  setPreparingMic(true);const useLocal='processLocally' in listener&&await localEnglishAvailable(Constructor);if(mounted.current)setPreparingMic(false);if(!mounted.current||recognition.current!==listener)return;
  if(useLocal)listener.processLocally=true;
  listener.onresult=event=>{if(!mounted.current||recognition.current!==listener)return;const results=Array.from(event.results);finalText=results.filter(r=>r.isFinal).map(r=>r[0]?.transcript??'').join(' ').trim();setDraft(results.map(r=>r[0]?.transcript??'').join(' ').trim());};
  listener.onerror=event=>{if(!mounted.current||recognition.current!==listener)return;failed=true;cleanupMic();if(event.error!=='aborted')setError(speechError(event.error));if(['network','service-not-allowed','language-not-supported'].includes(event.error))setVoiceFallback(true);setListening(false);};
  listener.onend=()=>{if(!mounted.current||recognition.current!==listener)return;recognition.current=null;microphoneStream.current?.getTracks().forEach(track=>track.stop());microphoneStream.current=null;setListening(false);if(!failed&&finalText&&autoSend)sendRef.current(finalText);else if(!failed&&!finalText)setError('No final speech was received. Try again, or use Win + H in the message field.');};
  setError('');try{let track:MediaStreamTrack|undefined;if(microphoneId){setPreparingMic(true);const stream=await navigator.mediaDevices.getUserMedia({audio:microphoneConstraints(microphoneId)});if(!mounted.current||recognition.current!==listener){stream.getTracks().forEach(t=>t.stop());return;}microphoneStream.current=stream;track=stream.getAudioTracks()[0];}listener.start(track);setPreparingMic(false);setListening(true);setNotice(useLocal?'Using on-device English speech recognition.':'Using the browser speech service. If it fails in this preview, use Windows voice typing.');}catch{cleanupMic();setPreparingMic(false);setError('The selected microphone could not start. Refresh devices and test it in Voice & controls. Audio-track recognition is not supported by every browser.');}
 }
 function submit(event:FormEvent){event.preventDefault();void send();}
 const selectedVoice=preferredVoice(voices,voiceURI);
 const planningBusy=jobs.some(j=>['queued','running','awaiting_apply'].includes(j.state));
 const statusLabel=activityLabel({connecting,sending,jobs,voicePhase:voice.phase,nativeSpeaking:voice.nativeSpeaking,legacySpeaking:speaking,muted:voice.muted,error:!!error});
 const mood=error?'error':statusLabel==='Speaking'?'speaking':['Thinking','Reviewing sources','Updating plan','Planning queued'].includes(statusLabel)?'thinking':statusLabel==='Listening'?'listening':'idle';
 const recovery=error?companionError(error):null;
 const panelContent=<>
   <header><div className="gerd-heading"><CompanionPet mood={mood} small/><div><h2 id="gerd-title">Gerd</h2><p>{connecting?'Connecting…':connection.local?(connection.configured?'ChatGPT subscription only':'Connection needs attention'):'Local companion is not enabled here'}</p></div></div><div className="gerd-header-actions"><button type="button" className="icon-button" aria-label="Reconnect assistant" title="Reconnect assistant" disabled={connecting} onClick={()=>void refresh(true)}><RefreshCw size={17}/></button><button ref={audioToggle} type="button" className="button small gerd-audio-toggle" aria-label="Microphone & voice" aria-expanded={audioSettings} onClick={()=>{setAudioSettings(v=>!v);if(!audioSettings)void voice.loadOptions().catch(e=>setError(e.message));}}><Settings2 size={17}/><span>Microphone & voice</span></button><div className="gerd-window-controls"><button type="button" className="icon-button" aria-label="Make chat smaller" onClick={()=>position.scalePanel(-80)}><Minus size={17}/></button><button type="button" className="icon-button" aria-label="Make chat larger" onClick={()=>position.scalePanel(80)}><Plus size={17}/></button><button type="button" className="icon-button" aria-label="Hide Gerd" title="Hide chat; work continues" onClick={close}><X size={19}/></button></div></div></header>
   <div className="gerd-activity" role="status" aria-live="polite"><span className={'gerd-status-dot '+(planningBusy||sending?'working':'')}/><strong>{statusLabel}</strong>{voice.active?<small>{voice.muted?'Mic muted':'Mic on'}{voice.outputMuted?' · Speaker muted':''}</small>:null}{planningBusy?<span className="gerd-step">{jobs.find(j=>j.state==='running')?.progress??'Preparing your plan…'}</span>:null}</div>
   {connection.local?<details className="companion-context"><summary>Project context & connection</summary><code>{connection.folder}</code><p>Documents and visible website controls are shared with Codex when you send a command. The Session Studio workflow handoff is loaded automatically. The Delft facilitator skill and full selection index are loaded; shortlisted methods can be inspected in the source scan.</p><ul>{connection.skills?.map(skill=><li key={skill.name}>{skill.name}<small>{skill.scope} · {skill.version.slice(0,12)}</small></li>)}</ul><ul>{connection.files?.map(file=><li key={file.name}>{file.name}<small>{file.status==='ready'?'Readable':file.status}</small></li>)}</ul>{connection.resumeCommand?<code>{connection.resumeCommand}</code>:null}<button type="button" className="button small" disabled={sending||connecting} onClick={()=>void refresh()}>{connecting?'Checking…':'Refresh context & conversation'}</button></details>:null}
   <div ref={log} className="gerd-messages" role="log" aria-live="polite" onScroll={()=>{if(log.current)followChat.current=log.current.scrollHeight-log.current.scrollTop-log.current.clientHeight<50;}}>{messages.filter(item=>item.kind!=='operation').map((item,index)=><p className={'gerd-message '+item.role} key={item.id??index}>{item.text}</p>)}{partial?<p className="gerd-message assistant">{partial}</p>:null}</div>
   <details className="gerd-operations"><summary>Agent operations <small>{planningBusy||sending?'Running':jobs.some(j=>j.state==='failed')?'Needs attention':'Activity log'}</small></summary>{sending?<p>{progress}</p>:null}{messages.filter(item=>item.kind==='operation').slice(-12).map((item,index)=><p key={item.id??index}>{item.text}</p>)}{jobs.slice(-5).map(job=><div key={job.id}><strong>{job.state.replaceAll('_',' ')}</strong><ol>{job.operations.map(op=><li key={op.id}>{op.label}</li>)}</ol></div>)}{notice?<p>{notice}</p>:null}{undo?<button type="button" disabled={sending} onClick={()=>void undoEdit()}>Undo timing edit</button>:null}</details>
   {voiceFallback?<div className="companion-voice-fallback" role="status"><strong>Preview speech service unavailable</strong><p>Your microphone and speech recognition are separate. Use Windows voice typing here, or open http://127.0.0.1:5181/ directly in Chrome.</p><button type="button" className="button small" disabled={sending} onClick={windowsVoiceTyping}>Use Windows voice typing (Win + H)</button><button type="button" className="text-button" onClick={()=>{setVoiceFallback(false);setError('');}}>Try browser microphone again</button></div>:null}
   {listening?<p className="companion-listening" role="status">Listening in English…{autoSend?' Pause to send.':' Your words will appear in the message field.'}</p>:null}
   {recovery?<div className="gerd-error" role="alert"><p>{recovery.message}</p><div className="gerd-error-actions">{recovery.actions.map(action=><button type="button" className="button small" key={action.action} onClick={()=>recover(action.action)}>{action.label}</button>)}<button type="button" className="text-button" onClick={()=>setError('')}>Dismiss</button></div></div>:null}
   {audioSettings?<section id="companion-audio-settings" className="companion-audio-settings" aria-label="Microphone and voice settings" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setAudioSettings(false);audioToggle.current?.focus();}}}><div className="companion-audio-heading"><strong>Microphone &amp; voice</strong><button type="button" className="icon-button" aria-label="Close microphone settings" onClick={()=>{setAudioSettings(false);audioToggle.current?.focus();}}><X size={17}/></button></div><CompanionMicrophone selected={microphoneId} onSelect={setMicrophoneId} disabled={sending||voice.active||listening||preparingMic}/><label>Conversation voice<select aria-label="Conversation voice" value={voice.voice} disabled={voice.active} onChange={e=>voice.selectVoice(e.target.value)}>{!voice.voices.length?<option value="">Check voice access to load voices</option>:null}{voice.voice&&!voice.voices.includes(voice.voice)?<option value={voice.voice}>Saved voice unavailable</option>:null}{voice.voices.map(name=><option value={name} key={name}>{name.charAt(0).toUpperCase()+name.slice(1)}</option>)}</select></label><p>The selected microphone feeds the call directly. Voice uses the experimental native Codex connection. Conversational voices use your Codex sign-in; browser read-aloud voices are separate.</p><button className="button small" type="button" disabled={voice.active||sending} onClick={()=>{setError('');void voice.start({connectionTest:true});}}>Test voice connection without microphone</button><button type="button" className="button small" disabled={!voice.active} onClick={()=>void voice.stop()}>End voice conversation</button><details className="legacy-voice-settings"><summary>Optional browser dictation</summary><button className="button small" type="button" disabled={sending||planningBusy} onClick={windowsVoiceTyping}>Use Windows voice typing (Win + H)</button><button type="button" className="button small" disabled={voice.active||sending||planningBusy} onClick={()=>void toggleListening()}>Browser dictation</button><label><input type="checkbox" checked={autoSend} onChange={e=>setAutoSend(e.target.checked)}/>Send when I finish speaking</label><label>Browser read-aloud voice<select value={voiceURI} onChange={e=>setVoiceURI(e.target.value)}><option value="">Automatic English voice</option>{voices.map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name}</option>)}</select></label><label><input type="checkbox" checked={voiceEnabled} onChange={e=>setVoiceEnabled(e.target.checked)}/>Read text replies aloud</label></details></section>:null}
   {voice.liveText?<p className="companion-live-transcript" role="status">{voice.liveText}</p>:null}
   <form onSubmit={submit}><label className="gerd-input-label" htmlFor="gerd-question">Message or website command</label><input id="gerd-question" ref={input} value={draft} maxLength={4000} onChange={event=>setDraft(event.target.value)} placeholder="Ask, or answer Gerd’s question…" disabled={sending||planningBusy}/><button type="button" className={'icon-button '+(voice.active&&!voice.muted?'active':'')} aria-label={voice.active?(voice.muted?'Unmute microphone':'Mute microphone'):'Start voice conversation'} aria-pressed={voice.active&&!voice.muted} disabled={!voice.active&&(sending||planningBusy||connecting||!connection.configured)} onClick={()=>{cleanupMic();setListening(false);setError('');if(voice.active)voice.toggleMute();else void voice.start();}}>{voice.muted?<MicOff size={18}/>:<Mic size={18}/>}</button><button type="button" className={'icon-button '+(!voice.outputMuted?'active':'')} aria-label={voice.outputMuted?'Enable voice replies':'Mute voice replies'} aria-pressed={!voice.outputMuted} disabled={!voice.active} onClick={voice.toggleOutput}>{voice.outputMuted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><button type="button" className="icon-button" aria-label="Stop current reply and actions" title="Stop current reply and actions; keep voice connected" disabled={!sending&&!speaking&&!voice.active&&!jobs.some(j=>['queued','running','awaiting_apply','awaiting_input'].includes(j.state))} onClick={()=>void stopReply()}><Square size={17}/></button><button type="submit" className="icon-button gerd-send" aria-label="Send question" disabled={!draft.trim()||sending||planningBusy||connecting||!connection.configured}><Send size={18}/></button></form>

 </>;
 const content=<aside className={`gerd is-positioned ${position.down?'opens-down':'opens-up'} ${position.dragging?'is-dragging':''} ${dialogHost?'is-in-dialog':''}`} style={position.style} aria-label="Gerd, design assistant" data-companion-root>
  {open?<div className={`gerd-panel-frame ${position.resizing?'is-resizing':''}`}><section id="gerd-panel" className="gerd-panel" role="dialog" aria-modal="false" aria-labelledby="gerd-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.preventDefault();close();}}}>
{panelContent}
  </section>{(['nw','ne','sw','se'] as const).map(corner=><button key={corner} type="button" className={`gerd-resize-handle ${corner}`} aria-label={`Resize chat from ${ {nw:'top left',ne:'top right',sw:'bottom left',se:'bottom right'}[corner]}`} title="Drag to resize chat. Arrow keys also work; Shift moves farther." onPointerDown={event=>position.resizeStart(event,corner)} onPointerMove={position.resizeMove} onPointerUp={position.resizeEnd} onPointerCancel={position.resizeEnd} onKeyDown={event=>position.resizeKey(event,corner)}/> )}</div>:null}
  <button ref={launcher} className="gerd-launcher pet-launcher" aria-label={open?'Close Gerd companion':'Open Gerd companion'} aria-expanded={open} aria-controls={open?'gerd-panel':undefined} title="Drag to move Gerd. Use arrow keys while focused; Shift moves farther." onPointerDown={position.onPointerDown} onPointerMove={position.onPointerMove} onPointerUp={position.onPointerUp} onPointerCancel={position.onPointerCancel} onKeyDown={position.onKeyDown} onClick={()=>{if(!position.consumeClick()){if(open)close();else setOpen(true);}}}><CompanionPet mood={mood}/><span className="pet-caption">{statusLabel==='Ready'?'Ask Gerd':statusLabel}{voice.active?<small>{voice.muted?' · Mic muted':' · Mic on'}</small>:null}</span></button>
 </aside>;
 return dialogHost?createPortal(content,dialogHost):content;
}
