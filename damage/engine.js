import {reactionRows} from './reactions.js';
import {attackRate,findAgent} from './catalog.js';
import {baseAttribute,damageBonusForAttack,equipmentStats,attackAttribute} from './equipment.js';

export const baseFields = [
  ['atk','基礎攻撃力（音動機込み）',1500], ['hp','基礎HP',7673], ['cr','基礎会心率 %',5],
  ['cd','基礎会心ダメージ %',50], ['ap','基礎異常マスタリー',100], ['am','基礎異常掌握',100],
  ['diskAtk','ディスク固定攻撃力',316], ['diskHp','ディスク固定HP',2200],
  ['sheerAtk','攻撃力 → 透徹力 %',0], ['sheerHp','HP → 透徹力 %',0],
  ['ownDef','自身の基礎防御力'], ['critSeverity','鋭撃の暴傷 %',250],
];
export const mainFields = [['攻撃力 %',30],['HP %',30],['貫通率 %',24],['与ダメージ %',30],['会心率 %',24],['会心ダメージ %',48],['異常マスタリー',92],['異常掌握 %',30]];
export const subFields = [['攻撃力',19],['攻撃力 %',3],['HP',112],['HP %',3],['会心率 %',2.4],['会心ダメージ %',4.8],['貫通値',9],['異常マスタリー',9],['防御力',15],['防御力 %',4.8]];
export const buffFields = [
  ['atkPct','攻撃力 %'],['hpPct','HP %'],['atkFlat','戦闘時攻撃力 加算'],['atkCombat','戦闘時攻撃力 乗算 %'],
  ['hpFlat','戦闘時HP 加算'],['hpCombat','戦闘時HP 乗算 %'],['ap','異常マスタリー 加算'],['sheer','透徹力 加算'],
  ['cr','会心率 %'],['cd','会心ダメージ %'],['dmg','与ダメージ %'],['def','防御ダウン／無視 %'],
  ['pen','貫通率 %'],['res','耐性ダウン %'],['anomaly','異常ダメージアップ %'],['sheerDmg','透徹ダメージアップ %'],
  ['am','異常掌握 %'],['stun','ブレイク弱体倍率 加算 %'],
];
export const kinds = {
  skill:'通常スキル', anomaly:'状態異常', sheer:'透徹', sharp:'鋭撃', fixed:'手入力ダメージ', reaction:'状態異常・特殊ダメージ',
  yaoN:'耀変（参照・南宮）', turbulence:'乱流（参照・ヴェリナ）', yaoV:'耀変（参照・ヴェリナ）',
};
const zip = (fields, values) => Object.fromEntries(fields.map(([key,,fallback],i) => [key,values?.[i] ?? fallback ?? 0]));
export function agent(name, base, main = [], sub = [], buffs = []) {
  const values=zip(baseFields,base);
  if(base?.[10]===undefined)delete values.ownDef;
  return {name, base:values, main:mainFields.map((_,i)=>main[i]??0), sub:subFields.map((_,i)=>sub[i]??0), buffs:zip(buffFields,buffs)};
}
export const action = (slot=0,name='新しい行動',kind='skill',amount=100,count=1,phase='normal') => ({slot,name,kind,amount,count,phase});
export const custom = () => ({
  agents:[agent('エージェント 1'),agent('エージェント 2'),agent('エージェント 3')],
  enemy:{def:952.8,res:0,stun:150},
  actions:[],
});
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const pos = n=>Math.max(0,n);
export function stats(member,enemy,{attribute='',type='',gear,defDown=0,resDown=0}={}) {
  const {base:b,main,sub,buffs:f}=member;
  const info=findAgent(member);
  const {stats:g,counts,weapon}=gear??equipmentStats(member,info);
  const attr=baseAttribute(attribute||info?.attribute);
  const physicalDiscs=Array.isArray(member.equipment?.discs);
  const [ma,mh,mp,md,mcr,mcd,map,mam]=main.map((n,i)=>physicalDiscs?0:n*mainFields[i][1]);
  const [sa,sap,sh,shp,scr,scd,sp,sapm,sdef,sdefPct]=subFields.map(([,value],i)=>(sub[i]??0)*value);
  const bonus=key=>(f[key]??0)+(g[key]??0);
  const baseAtk=weapon&&b.weaponAtk===undefined?(info?.stats.atk??b.atk):b.atk;
  const weaponAtk=weapon?(g.weaponAtk??0):(b.weaponAtk??0);
  const atk=pos(((baseAtk+weaponAtk)*(1+(ma+sap+bonus('atkPct'))/100)+sa+
    (physicalDiscs?(g.atkFlat??0):b.diskAtk))*(1+bonus('atkCombat')/100)+(f.atkFlat??0));
  const hp=pos((b.hp*(1+(mh+shp+bonus('hpPct'))/100)+sh+
    (physicalDiscs?(g.hpFlat??0):b.diskHp))*(1+bonus('hpCombat')/100)+(f.hpFlat??0));
  const baseDef=(b.ownDef??info?.stats.ownDef??0)+(g.weaponDef??0);
  const openingDef=baseDef*(1+(sdefPct+(f.defPct??0)+(g.defPct??0))/100)+(g.defFlat??0)+sdef;
  const ownDef=pos(openingDef*(1+bonus('ownDefCombat')/100)+bonus('ownDefFlat'));
  const roseCr=counts['棘まとう薔薇']>=4?(openingDef>=1800?16:openingDef>=1000?8:0):0;
  const rawCr=(b.cr+mcr+scr+bonus('cr')+roseCr)/100;
  const cr=clamp(rawCr,0,1);
  const ap=pos(b.ap+map+sapm+bonus('ap'));
  const am=pos(b.am*(1+(mam+bonus('am'))/100)+bonus('amFlat'));
  const cd=pos((b.cd+mcd+scd+bonus('cd')+(counts['折枝の刀歌']>=4&&am>=115?30:0))/100);
  const sheer=pos(atk*b.sheerAtk/100+hp*b.sheerHp/100+bonus('sheer'));
  const effectiveDef=pos(enemy.def*(1-clamp((bonus('def')+defDown)/100,0,1))*(1-clamp((mp+bonus('pen'))/100,0,1))-sp);
  const def=794/(794+effectiveDef);
  const res=pos(1+(bonus('res')+resDown-(enemy.damageRes?.[attr]??enemy.res))/100);
  const stun=pos((enemy.stun+bonus('stun'))/100);
  const dmg=pos(1+(md+bonus('dmg')+damageBonusForAttack(g,attr,type)+(type==='basic'?bonus('basicDmg'):0))/100);
  const crit=1+cr*cd;
  const severity=pos((b.critSeverity??250)/100);
  const sharpCrit=(1+cr*(severity-1))*(1+clamp(rawCr-1,0,1)*(severity-1));
  const anomalyBonus=pos(1+bonus('anomaly')/100);
  const anomalyCore=atk*(ap/100)*2*dmg*def;
  return {atk,hp,ownDef,cr,rawCr,cd,ap,am,sheer,def,res,stun,crit,anomalyBonus,anomalyCore,
    anomalyFactor:(ap/100)*2*dmg*def*res*anomalyBonus,
    skill:atk*dmg*crit*def*res,
    anomaly:anomalyCore*res*anomalyBonus,
    sharp:ownDef*dmg*sharpCrit*def*res*pos(1+(bonus('sharpDmg')+(g['sharp:'+attr]??0))/100),
    sheerDamage:sheer*dmg*crit*res*pos(1+bonus('sheerDmg')/100)};
}
function sheetEffect(kind,[remi,nan,ver]){
  const link=1.2+remi.ap*0.0002;
  const remiBoost=remi.res*remi.stun*remi.anomalyBonus;
  const yaoFactor=link*remiBoost*3.6*(1+remi.ap*0.002)*1.12*1.16;
  if(kind==='yaoN')return nan.anomaly*yaoFactor;
  if(kind==='yaoV')return ver.anomalyCore*yaoFactor;
  return nan.anomaly*link*ver.res*remi.stun*ver.anomalyBonus*20.5*1.16;
}
function plan(scenario) {
  const {agents,actions}=scenario;
  const compatible=agents.every((actor,i)=>findAgent(actor)?.id===['1581','1511','1561'][i]);
  const linkedSlots={yaoN:1,turbulence:2,yaoV:2};
  return actions.map(a=>{
    const linked=Object.hasOwn(linkedSlots,a.kind);
    const slot=linkedSlots[a.kind]??a.slot;
    const info=findAgent(agents[slot]);
    const selected=a.catalog?attackRate(agents[slot],a):null;
    const reaction=a.reaction&&info?.id===a.reaction.agentId?reactionRows(agents,slot,a.reaction.source).find(r=>r.id===a.reaction.id):null;
    const valid=(!linked||compatible)&&(!a.catalog||selected?.amount!=null)&&(a.kind!=='reaction'||reaction?.amount!=null);
    const title=selected?.skill.title??a.name;
    const type=/終結/.test(title)?'ultimate':/ダッシュ/.test(title)?'dash':/回避反撃/.test(title)?'after':
      selected?.skill.group==='basic'?'basic':'';
    return {slot,kind:a.kind,linked,valid,stun:a.phase==='stun',count:a.count,
      amount:reaction?.amount??selected?.amount??a.amount,reaction,attribute:attackAttribute(a,info,selected?.skill),type};
  });
}
function rowDamage(row,agents,enemy,members){
  const actor=agents[row.slot];
  if(row.kind==='fixed')return row.amount;
  if(row.linked)return sheetEffect(row.kind,members)*row.amount/100;
  if(row.reaction){
    const reaction=row.reaction;
    const donor=agents[reaction.source];
    const gear=row.gearSlot===reaction.source?row.gear:undefined;
    const condition={attribute:reaction.attribute,gear};
    const source=stats(donor,enemy,{...condition,defDown:reaction.defDown,resDown:reaction.resDown});
    const caster=reaction.source===row.slot?source:stats(actor,enemy,{gear:row.gearSlot===row.slot?row.gear:undefined});
    let total=source.anomaly*reaction.amount/100;
    if(reaction.polarScale)total=total*.15+caster.ap*reaction.polarScale/100*source.anomalyFactor;
    if(reaction.scale)total*=caster[reaction.scale]/10;
    if(reaction.fionyCrit!==undefined){
      const critRate=clamp(.30+Math.max(0,caster.am-155)*.007,0,1);
      const core=[12.5,14.6,16.7,18.8,20.8,22.9,25][(actor.levels?.core??7)-1];
      const additional=agents.some((m,i)=>i!==row.slot&&findAgent(m)?.specialty==='異常')?15:0;
      total*=1+critRate*(core+additional+(actor.mindscape>=1?25:0)+reaction.fionyCrit)/100;
    }
    if(reaction.separate)total+=stats(donor,enemy,condition).anomaly*reaction.separate/100;
    return row.stun?total*source.stun*(reaction.stunBoost??1):total;
  }
  const m=stats(actor,enemy,row);
  const multiplier=row.kind==='sheer'?m.sheerDamage:m[row.kind];
  return (multiplier??0)*row.amount/100*(row.stun?m.stun:1);
}
export function calculate(scenario) {
  const {enemy,agents}=scenario;
  const members=agents.map(a=>stats(a,enemy));
  const byAgent=[0,0,0];
  const rows=plan(scenario).map(row=>{
    const each=row.valid?rowDamage(row,agents,enemy,members):null;
    const total=(each??0)*row.count;
    byAgent[row.slot]+=total;
    return {each,total,slot:row.slot};
  });
  return {members,rows,byAgent,total:byAgent.reduce((sum,damage)=>sum+damage,0)};
}
export function substatObjective(scenario,slot){
  const {enemy,agents}=scenario;
  const actor={...agents[slot]};
  const actors=agents.slice();
  actors[slot]=actor;
  const gear=equipmentStats(actor,findAgent(actor));
  const rows=plan(scenario).filter(row=>row.valid&&row.kind!=='fixed'&&row.amount>0&&row.count>0&&(row.linked||row.reaction?.source===slot||(row.slot===slot&&(!row.reaction||row.reaction.actorMastery))));
  if(!rows.length)return null;
  rows.forEach(row=>{row.gear=gear;row.gearSlot=slot;});
  const kinds=new Set(rows.filter(r=>!r.reaction).map(r=>r.kind));
  const suppliesReaction=rows.some(r=>r.reaction?.source===slot);
  const usesMastery=rows.some(r=>r.reaction?.actorMastery&&r.slot===slot);
  const linked=rows.some(r=>r.linked);
  const members=linked?agents.map(a=>stats(a,enemy)):null;
  const score=sub=>{
    actor.sub=sub;
    if(members)members[slot]=stats(actor,enemy,{gear});
    return rows.reduce((sum,row)=>sum+rowDamage(row,actors,enemy,members)*row.count,0);
  };
  const {base,buffs}=actor;
  const info=findAgent(actor);
  const baseAtk=gear.weapon?(base.weaponAtk===undefined?(info?.stats.atk??base.atk):base.atk)+(gear.stats.weaponAtk??0):
    base.atk+(base.weaponAtk??0);
  const baseDef=(base.ownDef??info?.stats.ownDef??0)+(gear.stats.weaponDef??0);
  const atkDirection=1+((buffs.atkCombat??0)+(gear.stats.atkCombat??0))/100;
  const hpDirection=1+(buffs.hpCombat??0)/100;
  const defDirection=1+(buffs.ownDefCombat??0)/100;
  const atkAxis=(baseAtk*.03>=19)===(atkDirection>=0)?1:0;
  const hpAxis=(base.hp*.03>=112)===(hpDirection>=0)?3:2;
  const defAxis=baseDef*.048>=15?9:8;
  const rose=gear.counts['棘まとう薔薇']>=4;
  const axes=[];
  if(linked||suppliesReaction||kinds.has('skill')||kinds.has('anomaly')||(kinds.has('sheer')&&base.sheerAtk!==0))axes.push(atkAxis);
  if(kinds.has('sheer')&&base.sheerHp!==0)axes.push(hpAxis);
  if(kinds.has('skill')||kinds.has('sheer')||kinds.has('sharp'))axes.push(4);
  if(kinds.has('skill')||kinds.has('sheer'))axes.push(5);
  if((suppliesReaction||[...kinds].some(kind=>kind!=='sheer'))&&enemy.def>0)axes.push(6);
  if(linked||suppliesReaction||usesMastery||kinds.has('anomaly'))axes.push(7);
  if(kinds.has('sharp')||(rose&&axes.includes(4)))axes.push(defDirection<0&&!rose?17-defAxis:defAxis);
  if(rose&&defDirection<0&&kinds.has('sharp'))axes.push(17-defAxis);
  // A decreasing critical or conversion factor disables monotone upper-bound pruning.
  const monotone=atkDirection>=0&&hpDirection>=0&&defDirection>=0&&
    base.sheerAtk>=0&&base.sheerHp>=0&&(!kinds.has('sharp')||(base.critSeverity??250)>=100);
  return {score,axes,monotone};
}

export function skillDamage(scenario,slot,skill,level){
  const actor=scenario.agents[slot];
  const action={slot,kind:skill.kind,amount:0,phase:'normal',count:1,
    catalog:{agentId:findAgent(actor)?.id,skillId:skill.id,level}};
  const row=plan({...scenario,actions:[action]})[0];
  return row.valid?[rowDamage(row,scenario.agents,scenario.enemy),rowDamage({...row,stun:true},scenario.agents,scenario.enemy)]:[null,null];
}
export function reactionDamage(scenario,slot,reaction){
  if(reaction.amount==null)return [null,null];
  const row={slot,reaction};
  return [rowDamage(row,scenario.agents,scenario.enemy),rowDamage({...row,stun:true},scenario.agents,scenario.enemy)];
}
