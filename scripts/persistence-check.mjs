import {run,localRoot,runtimeEnv} from '../session-planner/scripts/local-runtime.mjs';
import path from 'node:path';
const sql=process.argv[2]==='write'?"INSERT OR REPLACE INTO method_metadata (method_id,metadata,revision,updated_at) VALUES ('handoff-setup-sentinel','{}',1,'2026-10-28')":"SELECT CASE WHEN EXISTS(SELECT 1 FROM method_metadata WHERE method_id='handoff-setup-sentinel') THEN 1 ELSE json_extract('bad-json','$') END AS persisted";
run(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','.sites-runtime/local-database.json','--persist-to',path.join(localRoot,'state'),'--command',sql],{env:runtimeEnv()});
