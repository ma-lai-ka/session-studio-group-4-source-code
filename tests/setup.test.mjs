import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {checkNode,commandSpec,pathCommand} from '../session-planner/scripts/local-runtime.mjs';
import {portAvailable,sameCheckout} from '../scripts/start-local.mjs';

test('the README prompt matches the standalone handoff and current documentation links resolve',()=>{
 const root=new URL('../',import.meta.url),readme=fs.readFileSync(new URL('README.md',root),'utf8').replaceAll('\r\n','\n'),prompt=fs.readFileSync(new URL('docs/PROFESSOR-PROMPT.md',root),'utf8').replaceAll('\r\n','\n');
 assert.equal(readme.split('```text\n')[1].split('\n```')[0],prompt.split('```text\n')[1].split('\n```')[0]);
 for(const file of ['README.md',...fs.readdirSync(new URL('docs/',root)).filter(x=>x.endsWith('.md')).map(x=>'docs/'+x)]){
  const content=fs.readFileSync(new URL(file,root),'utf8');
  for(const match of content.matchAll(/\]\(([^)]+)\)/g)){const href=match[1].split('#')[0];if(!href||/^https?:/.test(href))continue;assert.ok(fs.existsSync(new URL(href,new URL(file,root))),file+' has a missing link: '+href);}
 }
});

test('unsupported Node versions fail before installation',()=>{for(const v of ['18.20.0','20.19.0','22.12.0'])assert.throws(()=>checkNode(v),/22.13/);for(const v of ['22.13.0','24.0.0'])assert.doesNotThrow(()=>checkNode(v));});
test('Codex JS installation is launched without shell interpolation, including spaces',()=>{assert.deepEqual(commandSpec('C:/My Tools/codex.js',['app-server']),{command:process.execPath,args:['C:/My Tools/codex.js','app-server']});assert.deepEqual(commandSpec('/Applications/Codex.app/codex',['--version']),{command:'/Applications/Codex.app/codex',args:['--version']});});
test('PATH discovery handles spaces and does not treat Windows execution aliases as Python',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'Session Studio path '));try{const file=path.join(root,process.platform==='win32'?'codex.exe':'codex');fs.writeFileSync(file,'test');fs.chmodSync(file,0o755);assert.equal(pathCommand('codex',{env:{PATH:root}}),fs.realpathSync(file));assert.equal(pathCommand('missing',{env:{PATH:root}}),null);}finally{fs.rmSync(root,{recursive:true,force:true});}
 assert.equal(pathCommand('python',{platform:'win32',env:{PATH:'C:/Users/Example/AppData/Local/Microsoft/WindowsApps'}}),null);
});
test('an occupied port is detected without stopping its listener',async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{assert.equal(await portAvailable(port),false);assert.equal(server.listening,true);}finally{await new Promise(r=>server.close(r));}assert.equal(await portAvailable(port),true);
});
test('only the same checkout is reused; another application is never mistaken for this website',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({application:'session-studio',checkoutId:'same'}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{assert.equal(await sameCheckout(url,'same'),true);assert.equal(await sameCheckout(url,'other'),false);}finally{await new Promise(r=>server.close(r));}
});
