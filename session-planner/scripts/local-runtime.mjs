import {accessSync,constants,existsSync,readdirSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

export const appRoot=fileURLToPath(new URL('../',import.meta.url));
export const checkoutId=createHash('sha256').update(realpathSync(appRoot)).digest('hex').slice(0,12);
// Windows native SQLite paths can exceed MAX_PATH in a long extracted ZIP folder.
// This is still a separate, private runtime for each checkout, never shared state.
export const localRoot=path.resolve(process.env.SESSION_STUDIO_LOCAL_DIR || (process.platform==='win32'
 ? path.join(process.env.LOCALAPPDATA||os.tmpdir(),'SessionStudio',checkoutId)
 : path.join(appRoot,'.local')));
export const venvPython=path.join(localRoot,'python',process.platform==='win32'?'Scripts/python.exe':'bin/python');
export const supportedCodex='0.165.0-alpha.1.2';
export function checkNode(version=process.versions.node){
 const [major,minor]=version.split('.').map(Number);
 if(major<22||(major===22&&minor<13))throw new Error('Node.js 22.13 or newer is required. Install Node.js LTS from https://nodejs.org/en/download, then reopen the terminal.');
}
export function commandSpec(command,args=[]){return /\.[cm]?js$/i.test(command)?{command:process.execPath,args:[command,...args]}:{command,args};}
export function run(command,args=[],options={}){
 const spec=commandSpec(command,args),result=spawnSync(spec.command,spec.args,{cwd:appRoot,windowsHide:true,stdio:'inherit',...options});
 if(result.error)throw new Error(`Could not run ${path.basename(command)}: ${result.error.message}`);
 if(result.status!==0)throw new Error(`${path.basename(command)} failed (${result.status??result.signal}). See the message above; source changes are not needed.`);
 return result;
}
export function capture(command,args=[],options={}){const spec=commandSpec(command,args);return spawnSync(spec.command,spec.args,{cwd:appRoot,windowsHide:true,encoding:'utf8',timeout:15000,...options});}
export function pathCommand(name,{env=process.env,platform=process.platform}={}){
 for(const folder of (env.PATH||env.Path||'').split(path.delimiter)){
  if(!folder)continue;
  for(const ext of platform==='win32'?['.exe','']:['']){
   const file=path.join(folder,name+ext);
   if(platform==='win32'&&/WindowsApps/i.test(file))continue; // Store execution aliases are not installed interpreters.
   try{accessSync(file,constants.X_OK);return realpathSync(file);}catch{}
  }
  if(platform==='win32'&&name==='codex'){
   const js=path.join(folder,'node_modules/@openai/codex/bin/codex.js');if(existsSync(js))return js;
  }
 }
 return null;
}
export function pythonCandidates(){
 if(process.env.COMPANION_PYTHON)return [process.env.COMPANION_PYTHON];
 const choices=[venvPython,pathCommand('python3'),pathCommand('python')];
 if(process.platform==='win32'){
  const launcher=pathCommand('py');if(launcher){const p=capture(launcher,['-3','-c','import sys;print(sys.executable)']);if(p.status===0)choices.push(p.stdout.trim());}
  for(const root of [path.join(process.env.LOCALAPPDATA||'','Programs/Python'), 'C:/Program Files']){
   try{for(const entry of readdirSync(root).filter(n=>/^Python3/i.test(n)).sort().reverse())choices.push(path.join(root,entry,'python.exe'));}catch{}
  }
 }
 return [...new Set(choices.filter(Boolean))];
}
export function findPython(){
 for(const command of pythonCandidates()){
  const probe=capture(command,['-c','import sys; assert sys.version_info >= (3,11); print(sys.executable)']);
  if(probe.status===0)return probe.stdout.trim();
 }
 throw new Error('Python 3.11 or newer was not found. Install Python from https://www.python.org/downloads/ (include pip and venv), then rerun setup. COMPANION_PYTHON can name your interpreter.');
}
export function findCodex(){
 if(process.env.COMPANION_CODEX_BIN){const file=process.env.COMPANION_CODEX_BIN;if(capture(file,['--version']).status===0)return file;throw new Error('COMPANION_CODEX_BIN does not start. Correct this override or unset it.');}
 const choices=[path.join(localRoot,'codex/node_modules/@openai/codex/bin/codex.js'),pathCommand('codex')];
 if(process.platform==='win32'){
  const root=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/bin');
  try{for(const name of readdirSync(root).reverse())choices.push(path.join(root,name,'codex.exe'));}catch{}
  choices.push(path.join(process.env.LOCALAPPDATA||'','Programs/OpenAI/Codex/bin/codex.exe'));
 }else{
  choices.push(path.join(os.homedir(),'.local/bin/codex'),'/opt/homebrew/bin/codex','/usr/local/bin/codex',
   '/Applications/ChatGPT.app/Contents/Resources/codex','/Applications/Codex.app/Contents/Resources/codex');
 }
 for(const file of choices.filter(Boolean)){if(capture(file,['--version']).status===0)return file;}
 throw new Error(`Codex is required for Gerd. Use your existing desktop installation or install @openai/codex@${supportedCodex} following docs/SETUP.md, then sign in with YOUR ChatGPT account.`);
}
export function runtimeEnv({ai=false}={}){
 const env={...process.env,SITES_LOCAL_STATE:path.join(localRoot,'state'),SITES_RUNTIME_ROOT:path.join(localRoot,'tools')};
 delete env.SESSION_STUDIO_COMPANION_UPSTREAM;
 if(ai){env.SESSION_STUDIO_COMPANION='1';env.COMPANION_PYTHON=existsSync(venvPython)?venvPython:findPython();env.COMPANION_CODEX_BIN=findCodex();}
 else env.SESSION_STUDIO_COMPANION='0';
 return env;
}
