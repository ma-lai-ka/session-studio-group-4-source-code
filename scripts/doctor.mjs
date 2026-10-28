import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {appRoot,localRoot,venvPython,checkNode,run,runtimeEnv,capture,findCodex,supportedCodex} from '../session-planner/scripts/local-runtime.mjs';

export function offlineDoctor(){
 checkNode();console.log('OK Node.js '+process.versions.node);
 for(const file of ['node_modules/vinext/package.json','node_modules/wrangler/bin/wrangler.js','../skills/lead-creative-session-facilitator/SKILL.md','../skills/lead-creative-session-facilitator/references/books/delft-design-guide.pdf'])if(!existsSync(path.join(appRoot,file)))throw new Error('Missing '+file+'. Run npm run setup from a complete checkout.');
 if(!existsSync(path.join(localRoot,'setup.json')))throw new Error('Local setup is incomplete. Run npm run setup.');
 const versions={pypdfium2:'5.14.0',Pillow:'12.3.0',pypdf:'6.10.0'};
 const result=capture(venvPython,['-c','import importlib.metadata as m,json; print(json.dumps({p:m.version(p) for p in ["pypdfium2","Pillow","pypdf"]}))']);
 if(result.status!==0||JSON.stringify(JSON.parse(result.stdout))!==JSON.stringify(versions))throw new Error('Python tools are missing or differ from the tested versions. Run npm run setup.');
 mkdirSync(path.join(localRoot,'checks'),{recursive:true});
 run(venvPython,['scripts/companion/render-source.py',path.join(appRoot,'../skills/lead-creative-session-facilitator/references/books/delft-design-guide.pdf'),path.join(localRoot,'checks'),'1']);
 console.log('OK Delft PDF and isolated Python rendering');
 // Setup creates this config. SELECT is read-only and checks actual migration results.
 const config=path.join(appRoot,'.sites-runtime/local-database.json');
 if(!existsSync(config))throw new Error('Database configuration is missing. Run npm run setup.');
 const db=capture(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',config,'--persist-to',path.join(localRoot,'state'),'--command',"SELECT name FROM sqlite_master WHERE type='table'",'--json'],{env:runtimeEnv(),timeout:60000});
 if(db.status!==0)throw new Error('Local database could not be checked. Run npm run setup.');
 const tables=JSON.parse(db.stdout).flatMap(x=>x.results??[]).map(x=>x.name);
 for(const table of ['method_metadata','board','board_template'])if(!tables.includes(table))throw new Error('Database migration missing: '+table+'. Run npm run setup.');
 console.log('OK migrated local database; existing records preserved');console.log('Local runtime: '+localRoot);
}
try{
 offlineDoctor();
 if(!process.argv.includes('--offline')){
  const command=findCodex();console.log('Codex: '+capture(command,['--version']).stdout.trim());
  console.log('Reference tested version: '+supportedCodex+'; verifying actual account/voice capabilities…');
  run(process.execPath,['scripts/companion/probe-voice.mjs'],{env:runtimeEnv({ai:true})});
  console.log('OK subscription account, included allowance and voice catalogue (no microphone/audio session or model turn started).');
 }
 console.log('Doctor passed'+(process.argv.includes('--offline')?' (AI/account checks deliberately excluded).':'.'));
}catch(error){console.error('\nDOCTOR NEEDS ATTENTION: '+error.message);process.exitCode=1;}
