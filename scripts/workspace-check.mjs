import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {run} from '../session-planner/scripts/local-runtime.mjs';
import {portAvailable,sameCheckout} from './start-local.mjs';
const port=Number(process.env.SESSION_STUDIO_TEST_PORT||5192),url='http://127.0.0.1:'+port;
let child;
try{
 if(!await portAvailable(port))throw new Error('Test port '+port+' is occupied; choose SESSION_STUDIO_TEST_PORT.');
 child=spawn(process.execPath,['scripts/start-local.mjs','--planner-only'],{cwd:new URL('../',import.meta.url),env:{...process.env,SESSION_STUDIO_PORT:String(port),SESSION_STUDIO_NO_OPEN:'1'},stdio:'inherit',windowsHide:true});
 let ended=false;child.on('exit',()=>ended=true);
 let ready=false;for(let i=0;i<150&&!ended;i++){if(await sameCheckout(url)){ready=true;break;}await delay(1000);}
 if(!ready)throw new Error('Workspace test server did not become ready.');
 run(process.execPath,['tests/board-api-test.mjs'],{env:{...process.env,SESSION_STUDIO_URL:url}});
 console.log('Workspace smoke test passed against an isolated local listener.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(child?.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');}}
