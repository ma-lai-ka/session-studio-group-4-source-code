import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {appRoot,checkoutId,runtimeEnv,checkNode} from '../session-planner/scripts/local-runtime.mjs';
import {existsSync} from 'node:fs';
import {localRoot} from '../session-planner/scripts/local-runtime.mjs';
import path from 'node:path';

export async function portAvailable(port){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
export async function sameCheckout(url,id=checkoutId){try{const response=await fetch(url+'/__session-studio/health',{signal:AbortSignal.timeout(1500)});const result=await response.json();return result.application==='session-studio'&&result.checkoutId===id;}catch{return false;}}
function open(url){if(process.env.SESSION_STUDIO_NO_OPEN==='1')return;
 const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
 const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
 const child=spawn(command,args,{stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Open this URL in your browser: '+url));child.unref();
}
export async function startLocal(){
 checkNode();const port=Number(process.env.SESSION_STUDIO_PORT||5181);
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('SESSION_STUDIO_PORT must be an integer from 1024 to 65535.');
 const url='http://127.0.0.1:'+port;
 if(!await portAvailable(port)){if(await sameCheckout(url)){console.log('Session Studio is already running here: '+url);open(url);return;}throw new Error(`Port ${port} is used by another application. Close that application yourself or set SESSION_STUDIO_PORT to another free port. Nothing was stopped. Browser projects belong to their original port.`);}
 if(!existsSync(path.join(localRoot,'setup.json')))throw new Error('Run npm run setup first.');
 const ai=!process.argv.includes('--planner-only');
 const env=runtimeEnv({ai}); // Validate Codex discovery before starting a listener.
 if(ai)console.log('Gerd uses your own Codex ChatGPT account. Run npm run doctor for account and voice diagnostics.');
 console.log('Starting '+url+' — keep this terminal running; Ctrl+C stops it.');
 const child=spawn(process.execPath,['scripts/run-framework.mjs','dev','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:appRoot,env,stdio:'inherit',windowsHide:true});
 let ended=false;child.on('error',error=>{ended=true;console.error(error.message);process.exitCode=1;});child.on('exit',code=>{ended=true;process.exitCode=code??1;});
 const stop=()=>child.kill('SIGTERM');process.once('SIGINT',stop);process.once('SIGTERM',stop);
 for(let i=0;i<120&&!ended;i++){if(await sameCheckout(url)){console.log('\nREADY: '+url);open(url);return;}await delay(1000);}
 if(!ended){stop();throw new Error('The website did not become ready within two minutes. Read the startup error above; no source files were changed.');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))startLocal().catch(error=>{console.error('\nSTART NEEDS ATTENTION: '+error.message);process.exitCode=1;});
