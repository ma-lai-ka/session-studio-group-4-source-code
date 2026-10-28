export type Recovery={code:string;message:string;actions:{action:string;label:string}[]};
export type PlanningJob={id:string;projectId:string;goalId:string;fingerprint:string;revision:number;state:string;sequence:number;progress:string;resultVersion?:number;result?:any;error?:Recovery|null;operations:{id:string;label:string;at:string}[]};
export function activityLabel(input:{connecting:boolean;sending:boolean;jobs:PlanningJob[];voicePhase:string;nativeSpeaking:boolean;legacySpeaking:boolean;muted:boolean;error:boolean}){
 if(input.connecting)return 'Connecting';
 if(input.error)return 'Needs attention';
 if(input.nativeSpeaking||input.legacySpeaking)return 'Speaking';
 const job=input.jobs.find(j=>['running','queued'].includes(j.state));
 if(job)return /source|Delft.*entr|inspect/i.test(job.progress)?'Reviewing sources':job.state==='queued'?'Planning queued':'Thinking';
 if(input.sending||input.voicePhase==='thinking')return 'Thinking';
 if(input.jobs.some(j=>j.state==='awaiting_apply'))return 'Updating plan';
 if(input.jobs.some(j=>j.state==='awaiting_input'||j.state==='awaiting_confirmation'))return 'Waiting for you';
 if(input.jobs.some(j=>j.state==='proposal_ready'))return 'Ready for review';
 if(input.voicePhase==='listening'&&!input.muted)return 'Listening';
 return input.muted?'Ready · Mic muted':'Ready';
}
