// Maintainer-only fixture generation. Does not call Gerd or consume AI allowance.
import {build} from '../session-planner/node_modules/esbuild/lib/main.js';
import {mkdirSync} from 'node:fs';
import {appRoot,run} from '../session-planner/scripts/local-runtime.mjs';
import path from 'node:path';
mkdirSync(path.join(appRoot,'.test-output'),{recursive:true});
mkdirSync(new URL('../examples/',import.meta.url),{recursive:true});
await build({stdin:{contents:`import {createProgrammeProject} from './lib/programme';
import {createLocalProject,exportProject} from './lib/local-projects';
import {allSourceMethods,withFacilitatorEstimates} from './lib/catalogue';
import {emptyDesignBrief} from './lib/planner-contract.mjs';
import {writeFileSync} from 'node:fs';
const goal='Frame actionable design questions from existing interview notes';
const input={goal,diamonds:[{id:'problem',phases:['define']}],participants:4,level:'bachelor',hours:1.5,timeMode:'total',weeks:1,sessionsPerWeek:1,sessionCount:1,countMode:'manual'};
const project=createLocalProject(createProgrammeProject('Example project — library study-space onboarding','Fictional evaluation fixture; no personal research or live AI output.',input,withFacilitatorEstimates(allSourceMethods)));
project.goals[0].designBrief={...emptyDesignBrief(),endpoint:goal,evidence:'Six fictional interview summaries, supplied by the evaluator',team:'Four bachelor design students',access:'Existing notes only; no new participant access',timeBudget:'One 90-minute meeting with four attendees. Any additional preparation/analysis budget must be clarified.',constraints:'No new recruitment or fieldwork',confirmed:false};
writeFileSync('../examples/research-questions.json',exportProject(project));`,resolveDir:appRoot,loader:'ts'},outfile:path.join(appRoot,'.test-output/example-builder.mjs'),bundle:true,platform:'node',format:'esm'});
run(process.execPath,['.test-output/example-builder.mjs']);
