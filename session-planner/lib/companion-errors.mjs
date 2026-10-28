// Recovery actions are application-owned, never commands supplied by the model.
export function companionError(problem){
 const message=String(problem?.message??problem??'The assistant could not continue.');
 let code=problem?.code??'ASSISTANT_ERROR',action='retry',label='Retry planning';
 if(/allowance|exhausted|usage limit/i.test(message)){code='ALLOWANCE';action='connection';label='Check connection & allowance';}
 else if(/reconnect|disconnect|sign.in|subscription|connection closed|not connected/i.test(message)){code='CONNECTION';action='reconnect';label='Reconnect assistant';}
 else if(/microphone|voice|audio|playback/i.test(message)){code='VOICE';action='voice_settings';label='Open voice settings';}
 else if(/confirm|brief|missing facts/i.test(message)){code='BRIEF';action='review_brief';label='Review brief';}
 else if(/project changed|goal changed|revision|stale/i.test(message)){code='STALE';action='retry';label='Request fresh proposal';}
 else if(/open.*project|open.*goal|current screen/i.test(message)){code='OPEN_GOAL';action='open_goal';label='Open goal';}
 else if(/render|Python|source pages/i.test(message)){code='SOURCE';action='source_setup';label='Show source setup';}
 if(problem?.code==='OPEN_GOAL'){code='OPEN_GOAL';action='open_goal';label='Open goal';}
 return {code,message,actions:[{action,label}]};
}
