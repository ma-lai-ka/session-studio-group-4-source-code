import {startLocal} from '../../scripts/start-local.mjs';
startLocal().catch(error=>{console.error(error.message);process.exitCode=1;});
