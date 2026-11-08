import {subFields,substatObjective} from './engine.js';

export const maxSubRolls=54;

export function optimizeSubstats(scenario,slot,budget){
  if(!Number.isInteger(budget)||budget<0||budget>maxSubRolls)return null;
  const objective=substatObjective(scenario,slot);
  if(!objective)return null;
  const {score,axes,monotone}=objective;
  const counts=Array(subFields.length).fill(0);
  let best=null, bestDamage=-Infinity;
  const evaluate=()=>{
    const damage=score(counts);
    if(damage>bestDamage){
      bestDamage=damage;
      best=counts.slice();
    }
  };

  if(!axes.length)axes.push(0);
  // A dominated stat is never needed in the aggregate budget. Search the
  // remaining integer compositions, using a relaxed upper bound when safe.
  function visit(depth,remaining){
    const axis=axes[depth];
    if(depth===axes.length-1){
      counts[axis]=remaining;
      evaluate();
      counts[axis]=0;
      return;
    }
    if(monotone&&best){
      for(let i=depth;i<axes.length;i++)counts[axes[i]]=remaining;
      const bound=score(counts);
      for(let i=depth;i<axes.length;i++)counts[axes[i]]=0;
      if(bound<=bestDamage)return;
    }
    for(let n=remaining;n>=0;n--){
      counts[axis]=n;
      visit(depth+1,remaining-n);
    }
    counts[axis]=0;
  }

  // Seed the lower bound with a legal allocation before the exhaustive search.
  for(let n=0;n<budget;n++){
    let bestAxis=axes[0], bestStep=-Infinity;
    for(const axis of axes){
      counts[axis]++;
      const damage=score(counts);
      counts[axis]--;
      if(damage>bestStep){bestAxis=axis;bestStep=damage;}
    }
    counts[bestAxis]++;
  }
  evaluate();
  counts.fill(0);
  visit(0,budget);
  return best;
}
