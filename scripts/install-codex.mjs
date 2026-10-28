import {existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {localRoot,run,supportedCodex,capture} from '../session-planner/scripts/local-runtime.mjs';
try{
 const npm=process.env.npm_execpath||process.env.SESSION_STUDIO_NPM_CLI;
 if(!npm||!existsSync(npm))throw new Error('Run npm run setup:codex.');
 const target=path.join(localRoot,'codex');mkdirSync(target,{recursive:true});
 run(process.execPath,[npm,'install','--prefix',target,'--no-audit','--no-fund','--include=optional',`@openai/codex@${supportedCodex}`]);
 const cli=path.join(target,'node_modules/@openai/codex/bin/codex.js');
 console.log(capture(cli,['--version']).stdout.trim());
 console.log('Installed the pinned Codex for this checkout only. Run npm run doctor. If needed, sign in using:');
 console.log(`node "${cli}" login`);
 console.log('Use your own ChatGPT account. No API key or shared credentials.');
}catch(error){console.error(error.message);process.exitCode=1;}
