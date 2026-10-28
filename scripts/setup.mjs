import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {appRoot,localRoot,venvPython,checkNode,findPython,run,runtimeEnv} from '../session-planner/scripts/local-runtime.mjs';

try{
 checkNode();mkdirSync(localRoot,{recursive:true});
 const npm=process.env.npm_execpath||process.env.SESSION_STUDIO_NPM_CLI;
 if(!npm||!existsSync(npm))throw new Error('Run setup with npm run setup. A normal Node.js installation includes npm.');
 console.log('1/4 Installing the locked website dependencies (no dependency upgrades)…');
 run(process.execPath,[npm,'ci','--prefix',appRoot,'--workspaces=false','--include=dev','--include=optional','--no-audit','--no-fund']);
 console.log('2/4 Preparing this checkout’s isolated Python tools…');
 if(!existsSync(venvPython))run(findPython(),['-m','venv',path.dirname(path.dirname(venvPython))]);
 run(venvPython,['-m','pip','install','--disable-pip-version-check','--only-binary=:all:','-r',path.join(appRoot,'requirements-local.txt')]);
 console.log('3/4 Applying outstanding local database migrations…');
 run(process.execPath,['scripts/migrate-local.mjs'],{env:runtimeEnv()});
 const requirements=readFileSync(path.join(appRoot,'requirements-local.txt'),'utf8');
 writeFileSync(path.join(localRoot,'setup.json'),JSON.stringify({completedAt:new Date().toISOString(),requirements},null,2));
 console.log('4/4 Verifying local prerequisites…');
 run(process.execPath,[path.resolve(import.meta.dirname,'doctor.mjs'),'--offline']);
 console.log('\nSetup complete. Next: npm run doctor, then npm run start:local. Gerd uses your own ChatGPT/Codex sign-in.');
}catch(error){console.error('\nSETUP NEEDS ATTENTION: '+error.message);process.exitCode=1;}
