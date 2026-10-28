import { it } from 'node:test';
import assert from 'node:assert/strict';
import { blankProject } from '../lib/projects';
import { allSourceMethods,withFacilitatorEstimates } from '../lib/catalogue';
import { createLocalProject,planLocalProgramme,readLocalProjects } from '../lib/local-projects';
import { completeRunnerSession } from '../lib/runner-completion';
import { emptyDesignBrief } from '../lib/planner-contract.mjs';
import { exportProject,importProjectFile } from '../lib/local-projects';
const catalogue=withFacilitatorEstimates(allSourceMethods);
it('explicit runner completion saves a workspace snapshot and is idempotent',async()=>{
 const project=planLocalProgramme(createLocalProject(blankProject('Finish')),catalogue);project.workspace={boardId:'abcdefghijklmnopqrstuv'};project.sessions[0].status='approved';
 project.designBrief={...emptyDesignBrief(),endpoint:'Evidence for design decisions',confirmed:true};
 project.workItems=[{id:'prepare',goalId:project.goals[0].id,week:1,title:'Prepare',kind:'preparation',owner:'Team',personHours:2,elapsedNote:'',output:'Evidence',dependsOn:[]}];
 project.facilitatorReview={title:'Review',rationale:'Evidence first',alternatives:'Other methods',assumptions:[],adaptations:[],acceptedAt:'2026-10-28'};
 let raw=JSON.stringify({version:2,projects:[project]}),requests=0;
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}}}});
 globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({board:{},items:[],templates:[]}));};
 try{const input={storageScope:'test',projectId:project.id,sessionId:project.sessions[0].id,boardId:project.workspace.boardId};const result=await completeRunnerSession(input);const saved=readLocalProjects(raw)[0];assert.equal(saved.sessions[0].status,'completed');assert.equal(saved.revision,project.revision+1);assert.equal(saved.sessions[0].completion?.workspace?.boardId,input.boardId);assert.deepEqual(await completeRunnerSession(input),result);assert.equal(requests,1);}
 finally{
  Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});globalThis.fetch=oldFetch;
  const saved=readLocalProjects(raw)[0];
  assert.deepEqual(saved.designBrief,project.designBrief);assert.deepEqual(saved.workItems,project.workItems);assert.deepEqual(saved.facilitatorReview,project.facilitatorReview);
  const imported=importProjectFile(exportProject(saved))[0];
  assert.deepEqual(imported.designBrief,saved.designBrief);assert.deepEqual(imported.workItems,saved.workItems);assert.deepEqual(imported.facilitatorReview,saved.facilitatorReview);
 }
});
it('runner completion refuses concurrent storage changes and failed snapshots',async()=>{
 const project=planLocalProgramme(createLocalProject(blankProject('Finish safely')),catalogue);project.workspace={boardId:'abcdefghijklmnopqrstuv'};project.sessions[0].status='approved';
 const original=JSON.stringify({version:2,projects:[project]});let raw=original,writes=0;
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>raw,setItem:(_key:string,value:string)=>{writes++;raw=value;}}}});
 const input={storageScope:'test',projectId:project.id,sessionId:project.sessions[0].id,boardId:project.workspace.boardId};
 try{
  globalThis.fetch=async()=>{raw=original+' ';return new Response(JSON.stringify({board:{},items:[],templates:[]}));};await assert.rejects(completeRunnerSession(input),/another tab/);assert.equal(writes,0);
  raw=original;globalThis.fetch=async()=>{throw new Error('offline');};await assert.rejects(completeRunnerSession(input),/offline/);assert.equal(writes,0);assert.equal(readLocalProjects(raw)[0].sessions[0].status,'approved');
  await assert.rejects(completeRunnerSession({...input,boardId:'different'}),/saved project/);
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});globalThis.fetch=oldFetch;}
});

it('runner completion rejects wrong account scope, draft plans, and failed storage',async()=>{
 const project=planLocalProgramme(createLocalProject(blankProject('Save safely')),catalogue);project.workspace={boardId:'abcdefghijklmnopqrstuv'};project.sessions[0].status='approved';
 let raw=JSON.stringify({version:2,projects:[project]}),failSave=false;
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(key:string)=>key.endsWith(':owner')?raw:null,setItem:(_key:string,value:string)=>{if(failSave)throw new Error('Storage full');raw=value;}}}});
 globalThis.fetch=async()=>new Response(JSON.stringify({board:{},items:[],templates:[]}));
 const input={storageScope:'owner',projectId:project.id,sessionId:project.sessions[0].id,boardId:project.workspace.boardId};
 try{
  await assert.rejects(completeRunnerSession({...input,storageScope:'someone-else'}),/saved project/);
  failSave=true;await assert.rejects(completeRunnerSession(input),/Storage full/);assert.equal(readLocalProjects(raw)[0].sessions[0].status,'approved');
  failSave=false;project.sessions[0].status='draft';raw=JSON.stringify({version:2,projects:[project]});await assert.rejects(completeRunnerSession(input),/Confirm and save/);
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});globalThis.fetch=oldFetch;}
});
