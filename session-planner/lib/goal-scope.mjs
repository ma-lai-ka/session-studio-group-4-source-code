// Shared by the local bridge and browser: automatic tailoring cannot spill into other goals.
export function assertGoalScope(planner,bundle,goalId){
 if(!goalId)return;
 const goal=planner.goals?.find(g=>g.id===goalId);
 if(!goal)throw new Error('The target goal no longer exists.');
 const sessionGoal=id=>planner.goals.find(g=>g.sessionIds.includes(id))?.id;
 const taskGoal=id=>planner.workItems?.find(t=>t.id===id)?.goalId;
 for(const op of bundle.operations){
  if(op.op==='session_put'&&(op.session.goalId!==goalId||(sessionGoal(op.session.id)&&sessionGoal(op.session.id)!==goalId)))throw new Error('Tailoring must preserve sessions in other goals.');
  if(op.op==='session_remove'&&sessionGoal(op.id)!==goalId)throw new Error('Tailoring must preserve sessions in other goals.');
  if(op.op==='session_order'&&op.goalId!==goalId)throw new Error('Tailoring must preserve other goals.');
  if(op.op==='task_put'&&(op.task.goalId!==goalId||(taskGoal(op.task.id)&&taskGoal(op.task.id)!==goalId)))throw new Error('Tailoring must preserve work in other goals.');
  if(op.op==='task_remove'&&taskGoal(op.id)!==goalId)throw new Error('Tailoring must preserve work in other goals.');
  if(op.op==='task_order'){
   const other=(planner.workItems??[]).filter(t=>t.goalId!==goalId).map(t=>t.id);
   if(JSON.stringify(op.ids.filter(id=>other.includes(id)))!==JSON.stringify(other))throw new Error('Tailoring must preserve the order of other goals’ work.');
  }
  // Moving an existing activity from another goal is also a cross-goal edit.
  if(op.op==='session_put')for(const activity of op.session.activities){
   const owner=planner.sessions.find(s=>(s.activities??s.plan?.activities??[]).some(a=>(a.id??a.instanceId)===activity.id));
   if(owner&&sessionGoal(owner.id)!==goalId)throw new Error('Tailoring must preserve activities in other goals.');
  }
 }
}
