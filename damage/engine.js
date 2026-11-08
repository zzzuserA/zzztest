import {attackRate,findAgent} from './catalog.js';
import {attributes,baseAttribute,damageBonusForAttack,equipmentStats,attackAttribute} from './equipment.js';
import {resolveTimeline} from './timeline.js';
import {automaticEffects} from './effect-presets.js';

export const baseFields = [
  ['atk','基礎攻撃力（音動機込み）',1500], ['hp','基礎HP',7673], ['cr','基礎会心率 %',5],
  ['cd','基礎会心ダメージ %',50], ['ap','基礎異常マスタリー',100], ['am','基礎異常掌握',100],
  ['diskAtk','ディスク固定攻撃力',316], ['diskHp','ディスク固定HP',2200],
  ['sheerAtk','攻撃力 → 透徹力 %',0], ['sheerHp','HP → 透徹力 %',0],
  ['ownDef','自身の基礎防御力'], ['critSeverity','鋭撃の暴傷 %',250],
];
export const mainFields = [['攻撃力 %',30],['HP %',30],['貫通率 %',24],['与ダメージ %',30],['会心率 %',24],['会心ダメージ %',48],['異常マスタリー',92],['異常掌握 %',30]];
export const subFields = [['攻撃力',19],['攻撃力 %',3],['HP',112],['HP %',3],['会心率 %',2.4],['会心ダメージ %',4.8],['貫通値',9],['異常マスタリー',9]];
export const buffFields = [
  ['atkPct','攻撃力 %'],['hpPct','HP %'],['atkFlat','戦闘時攻撃力 加算'],['atkCombat','戦闘時攻撃力 乗算 %'],
  ['hpFlat','戦闘時HP 加算'],['hpCombat','戦闘時HP 乗算 %'],['ap','異常マスタリー 加算'],['sheer','透徹力 加算'],
  ['cr','会心率 %'],['cd','会心ダメージ %'],['dmg','与ダメージ %'],['def','防御ダウン／無視 %'],
  ['pen','貫通率 %'],['res','耐性ダウン %'],['anomaly','異常ダメージアップ %'],['sheerDmg','透徹ダメージアップ %'],
  ['am','異常掌握 %'],['stun','ブレイク弱体倍率 加算 %'],
];
export const kinds = {
  skill:'通常スキル', anomaly:'状態異常', sheer:'透徹', sharp:'鋭撃', fixed:'手入力ダメージ',
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
  enemy:{def:952.8,res:0,stun:150,seconds:30},
  actions:[],
});
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const pos = n=>Math.max(0,n);
export function stats(member,enemy,{attribute='',type='',timed={}}={}) {
  const {base:b,main,sub,buffs:f}=member;
  const info=findAgent(member);
  const {stats:g,counts,weapon}=equipmentStats(member,info);
  const attr=baseAttribute(attribute||info?.attribute);
  const physicalDiscs=Array.isArray(member.equipment?.discs);
  const [ma,mh,mp,md,mcr,mcd,map,mam]=main.map((n,i)=>physicalDiscs?0:n*mainFields[i][1]);
  const [sa,sap,sh,shp,scr,scd,sp,sapm]=sub.map((n,i)=>n*subFields[i][1]);
  const bonus=key=>(f[key]??0)+(g[key]??0)+(timed[key]??0);
  const baseAtk=weapon&&b.weaponAtk===undefined?(info?.stats.atk??b.atk):b.atk;
  const weaponAtk=weapon?(g.weaponAtk??0):(b.weaponAtk??0);
  const atk=pos(((baseAtk+weaponAtk)*(1+(ma+sap+bonus('atkPct'))/100)+sa+
    (physicalDiscs?(g.atkFlat??0):b.diskAtk))*(1+bonus('atkCombat')/100)+(f.atkFlat??0)+(timed.atkFlat??0));
  const hp=pos((b.hp*(1+(mh+shp+bonus('hpPct'))/100)+sh+
    (physicalDiscs?(g.hpFlat??0):b.diskHp))*(1+bonus('hpCombat')/100)+(f.hpFlat??0)+(timed.hpFlat??0));
  const baseDef=(b.ownDef??info?.stats.ownDef??0)+(g.weaponDef??0);
  const openingDef=baseDef*(1+((f.defPct??0)+(g.defPct??0))/100)+(g.defFlat??0);
  const ownDef=pos(openingDef*(1+bonus('ownDefCombat')/100)+bonus('ownDefFlat'));
  const roseCr=counts['棘まとう薔薇']>=4?(openingDef>=1800?16:openingDef>=1000?8:0):0;
  const rawCr=(b.cr+mcr+scr+bonus('cr')+roseCr)/100;
  const cr=clamp(rawCr,0,1);
  const ap=pos(b.ap+map+sapm+bonus('ap'));
  const am=pos(b.am*(1+(mam+bonus('am'))/100)+bonus('amFlat'));
  const cd=pos((b.cd+mcd+scd+bonus('cd')+(counts['折枝の刀歌']>=4&&am>=115?30:0))/100);
  const sheer=pos(atk*b.sheerAtk/100+hp*b.sheerHp/100+bonus('sheer'));
  const effectiveDef=pos(enemy.def*(1-clamp(bonus('def')/100,0,1))*(1-clamp((mp+bonus('pen'))/100,0,1))-sp);
  const def=794/(794+effectiveDef);
  const res=pos(1+(bonus('res')-(enemy.damageRes?.[attr]??enemy.res))/100);
  const stun=pos((enemy.stun+bonus('stun'))/100);
  const dmg=pos(1+(md+bonus('dmg')+damageBonusForAttack(g,attr,type)+(type==='basic'?bonus('basicDmg'):0))/100);
  const crit=1+cr*cd;
  const severity=pos((b.critSeverity??250)/100);
  const sharpCrit=(1+cr*(severity-1))*(1+clamp(rawCr-1,0,1)*(severity-1));
  const anomalyBonus=pos(1+bonus('anomaly')/100);
  const anomalyCore=atk*(ap/100)*2*dmg*def;
  return {atk,hp,ownDef,cr,rawCr,cd,ap,am,sheer,def,res,stun,crit,anomalyBonus,anomalyCore,
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
export function mabRows(enemy){
  const modifiers={物理:1.2,風:0.5};
  return attributes.map(attribute=>{
    const prior=clamp(enemy.anomalyCount?.[attribute]??0,0,10);
    const threshold=(enemy.mab??0)*(modifiers[attribute]??1)*(1+prior*0.02);
    const raw=enemy.gauge?.[attribute]??0;
    const effective=raw*pos(1-(enemy.anomalyRes?.[attribute]??0)/100);
    return {attribute,threshold,effective,progress:threshold>0?100*effective/threshold:null};
  });
}
export function calculate(scenario) {
  const {enemy,agents,actions}=scenario;
  const members=agents.map(a=>stats(a,enemy));
  const sampleIds=['1581','1511','1561'];
  const sampleCompatible=agents.every((agent,i)=>findAgent(agent)?.id===sampleIds[i]);
  const byAgent=[0,0,0], events=[];
  const sourceSlots={yaoN:1,turbulence:2,yaoV:2};
  const rows=actions.map(a=>{
    const sample=Object.hasOwn(sourceSlots,a.kind);
    const slot=sourceSlots[a.kind]??a.slot;
    const selected=a.catalog?attackRate(agents[slot],a):null;
    const valid=(!sample||sampleCompatible)&&(!a.catalog||selected?.amount!=null);
    const title=selected?.skill.title??a.name;
    const type=/終結/.test(title)?'ultimate':/ダッシュ/.test(title)?'dash':/回避反撃/.test(title)?'after':
      selected?.skill.group==='basic'?'basic':'';
    const attribute=attackAttribute(a,findAgent(agents[slot]),selected?.skill);
    return {each:valid?0:null,total:0,slot,attribute,type,amount:selected?.amount??a.amount,sample};
  });
  const timeline=actions.map(a=>({...a,effects:[...(a.effects??[]),...automaticEffects(a,agents[a.slot])]}));
  const withEffects=timeline.some(a=>a.effects.length);
  let eventCount=0;
  resolveTimeline(timeline,agents,(event,modifiers)=>{
    const {index,t,action:a,multiplicity=1,triggers}=event;
    const r=rows[index];
    const {slot,attribute,type,amount}=r;
    const {values,names}=modifiers(slot,attribute);
    let damage=null;
    if(r.each!==null){
      if(a.kind==='fixed')damage=amount;
      else if(r.sample){
        const snapshot=withEffects?agents.map((actor,i)=>{
          const attr=baseAttribute(findAgent(actor)?.attribute);
          return stats(actor,enemy,{attribute:attr,timed:modifiers(i,attr).values});
        }):members;
        damage=sheetEffect(a.kind,snapshot)*amount/100;
      } else {
        const m=stats(agents[slot],enemy,{attribute,type,timed:values});
        const multiplier=a.kind==='sheer'?m.sheerDamage:m[a.kind];
        damage=(multiplier??0)*amount/100*(a.phase==='stun'?m.stun:1);
      }
      r.total+=damage*multiplicity;
      byAgent[slot]+=damage*multiplicity;
    }
    eventCount+=multiplicity;
    if(events.length<150)events.push({time:t/1000,slot,damage,names,triggers,index,multiplicity});
  },!withEffects);
  for(const [index,row] of rows.entries()){
    if(row.each!==null&&actions[index].count>0)row.each=row.total/actions[index].count;
  }
  const total=byAgent.reduce((sum,damage)=>sum+damage,0);
  return {members,rows,byAgent,total,dps:enemy.seconds>0?total/enemy.seconds:null,events,eventCount};
}
