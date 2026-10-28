import {it} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importProject,exportProject} from '../lib/local-projects';
it('the professor example imports as an explicit fictional preliminary project without author state',()=>{
 const raw=readFileSync('../examples/research-questions.json','utf8'),project=importProject(raw);
 assert.match(project.name,/Example project/);assert.equal(project.workspace,null);
 assert.equal(project.goals[0].designBrief?.confirmed,false);
 for(const s of project.sessions){assert.equal(s.preliminary,true);assert.deepEqual(s.plan?.activities.map(a=>a.methodId),['intro','closing']);}
 assert.equal(importProject(exportProject(project)).goals[0].title,project.goals[0].title);
 assert.doesNotMatch(raw,/auth\.json|threadId|esmay|access_token|refresh_token/i);
});
