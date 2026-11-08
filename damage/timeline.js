import {baseAttribute,equippedSetCounts,weaponByName} from './equipment.js';
import {findAgent} from './catalog.js';

export const timedStats={
  atkPct:'攻撃力 %（基礎側）',atkCombat:'戦闘時攻撃力 %',atkFlat:'攻撃力 Pt',
  hpCombat:'戦闘時HP %',hpFlat:'HP Pt',ownDefCombat:'戦闘時防御力 %',ownDefFlat:'防御力 Pt',
  cr:'会心率 %',cd:'会心ダメージ %',dmg:'与ダメージ %',basicDmg:'通常攻撃ダメージ %',elementDmg:'指定属性の与ダメージ %',
  def:'敵の防御ダウン／無視 %',res:'敵の耐性ダウン %',pen:'貫通率 %',
  ap:'異常マスタリー Pt',anomaly:'異常ダメージ %',am:'異常掌握 %',amFlat:'異常掌握 Pt',
  sheer:'透徹力 Pt',sheerDmg:'透徹ダメージ %',sharpDmg:'鋭撃ダメージ %',stun:'ブレイク弱体倍率 加算 %',
};

export const blankEffect=()=>({name:'',stat:'dmg',amount:0,target:'self',duration:10,delay:0,stacks:1,
  cooldown:0,mode:'refresh',attribute:'',timing:'after'});

const ms=value=>Math.round(Math.max(0,value??0)*1000);
const targetSlot=(target,owner)=>target==='self'?owner:target==='team'?null:Number(target);
const effectValue=(rule,agent)=>{
  const info=findAgent(agent);
  if(rule.agentId&&info?.id!==rule.agentId)return null;
  if(rule.set&&!(equippedSetCounts(agent.equipment)[rule.set]>=4))return null;
  if(rule.weapon){
    if(agent.equipment?.weapon!==rule.weapon)return null;
    const weapon=weaponByName.get(rule.weapon);
    if(weapon?.role!==info?.specialty)return null;
    return weapon?.passives[rule.weaponRow]?.[1][(agent.equipment.refine??1)-1]??null;
  }
  return rule.amount;
};

export function resolveTimeline(actions,agents,onHit,aggregate=false){
  const active=new Map(), lastApplied=new Map(), pending=[];
  const events=[];
  for(const [index,action] of actions.entries()){
    const start=ms(action.time), gap=ms(action.interval);
    const count=Math.max(0,Math.trunc(action.count));
    if(aggregate&&!gap&&count>0)events.push({index,hit:0,t:start,action,multiplicity:count});
    else for(let hit=0;hit<count;hit++)events.push({index,hit,t:start+hit*gap,action});
  }
  events.sort((a,b)=>a.t-b.t||a.index-b.index||a.hit-b.hit);

  function apply(rule,owner,t,amount){
    const slot=targetSlot(rule.target,owner);
    const key=JSON.stringify([rule.name,rule.stat,slot,rule.attribute,rule.weapon??rule.agentId??null]);
    const last=lastApplied.get(key);
    if(last!==undefined&&t-last<ms(rule.cooldown))return false;
    lastApplied.set(key,t);
    const old=active.get(key)?.entries.filter(entry=>entry.until>t)??[];
    const until=t+ms(rule.duration);
    const entries=[...old,{until,amount}].slice(-Math.max(1,rule.stacks));
    if(rule.mode==='refresh')entries.forEach(entry=>{entry.until=until;});
    active.set(key,{rule,slot,entries});
  }
  function activate({rule,owner,start,amount,triggers}){
    if(apply(rule,owner,start,amount)===false)return;
    triggers.push({name:rule.name||timedStats[rule.stat],start:start/1000,until:(start+ms(rule.duration))/1000});
  }
  function enqueue(rules,owner,t,timing,triggers){
    for(const rule of rules){
      if(rule.timing!==timing||!Object.hasOwn(timedStats,rule.stat)||!(rule.duration>0))continue;
      const amount=effectValue(rule,agents[owner]);
      if(!Number.isFinite(amount))continue;
      const start=t+ms(rule.delay);
      const item={rule,owner,start,amount,triggers};
      if(start===t)activate(item);
      else pending.push(item);
    }
  }
  function advance(t){
    pending.sort((a,b)=>a.start-b.start);
    while(pending[0]?.start<=t)activate(pending.shift());
  }
  for(const event of events){
    const {t,action}=event;
    advance(t);
    const rules=action.effects??[];
    const owner=action.slot;
    const triggers=[];
    event.triggers=triggers;
    enqueue(rules,owner,t,'before',triggers);
    const modifiers=(slot,attribute)=>{
      const values={}, names=[];
      for(const [key,effect] of active){
        const alive=effect.entries.filter(entry=>entry.until>t);
        if(!alive.length){active.delete(key);continue;}
        const {rule}=effect;
        if(effect.slot!==null&&effect.slot!==slot)continue;
        if(rule.attribute&&baseAttribute(rule.attribute)!==baseAttribute(attribute))continue;
        const stat=rule.stat==='elementDmg'?'dmg':rule.stat;
        const value=alive.reduce((sum,x)=>sum+x.amount,0);
        values[stat]=(values[stat]??0)+value;
        names.push({name:rule.name||timedStats[rule.stat],value,stacks:alive.length,until:Math.max(...alive.map(x=>x.until))/1000});
      }
      return {values,names};
    };
    onHit(event,modifiers);
    enqueue(rules,owner,t,'after',triggers);
  }
  advance(Infinity);
}
