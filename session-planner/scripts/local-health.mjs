import {checkoutId} from './local-runtime.mjs';
export function localHealth(){return {name:'session-studio-local-health',apply:'serve',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url!=='/__session-studio/health'||req.method!=='GET')return next();
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({application:'session-studio',checkoutId}));
});}};}
