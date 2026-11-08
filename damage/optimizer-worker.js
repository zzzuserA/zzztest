import {optimizeSubstats} from './optimizer.js';

self.addEventListener('message',event=>{
  const {scenario,slot,budget}=event.data;
  self.postMessage(optimizeSubstats(scenario,slot,budget));
});
