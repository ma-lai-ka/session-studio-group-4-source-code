import {run,runtimeEnv} from '../session-planner/scripts/local-runtime.mjs';
const tasks={typecheck:['node_modules/typescript/bin/tsc','--noEmit'],test:['scripts/test.mjs'],build:['scripts/run-framework.mjs','build']};
const args=tasks[process.argv[2]];if(!args)throw new Error('Choose typecheck, test or build.');
try{run(process.execPath,args,{env:runtimeEnv()});}catch(error){console.error(error.message);process.exitCode=1;}
