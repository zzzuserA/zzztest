import {catalog} from './catalog-data.js';

export {catalog};
export const skillGroups = {
  basic:'通常攻撃', dodge:'回避', assist:'支援スキル', special:'特殊スキル', chain:'連携・終結', core:'コアスキル',
};
const agentsById = new Map(catalog.map(agent=>[agent.id,agent]));
const aliases = {'南宮':'1511','シード':'1461'};
export const findAgent = a => agentsById.get(a.agentId ?? aliases[a.name])
  ?? (a.agentId===undefined?catalog.find(entry=>entry.name===a.name):undefined);

export const mindscapeBonus = n => n>=5?4:n>=3?2:0;
export function effectiveLevel(a,skill) {
  if(skill.group==='core') return a.levels?.core??7;
  return (a.levels?.[skill.group]??12)+mindscapeBonus(a.mindscape??0);
}
export const skillName=row=>row.title+(row.label==='ダメージ倍率'?'':' / '+row.label);
export function attackRate(agent,action) {
  const info=findAgent(agent);
  if(info?.id!==action.catalog.agentId) return null;
  const skill=info.skills.find(row=>row.id===action.catalog.skillId)??info.skills.find(row=>skillName(row)===action.name);
  if(!skill) return null;
  const level=action.catalog.level||effectiveLevel(agent,skill);
  return {skill,level,amount:skill.rates[level-1]??null};
}
export const levelLabel=(group,level)=>group==='core'?(level===1?'未強化':'ABCDEF'[level-2]):'Lv. '+level;
