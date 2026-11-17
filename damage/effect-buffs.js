import {findAgent} from './catalog.js';
import {corePassiveValues} from './core-passives.js';
import {equippedSetCounts,setByName,weaponByName,baseAttribute,fourPieceConditions} from './equipment.js';

// The source list is also the ledger shown next to the editable buff totals.
// Unrecognized conditional effects stay visible without inventing a damage formula.
const statForLabel=(label,unit)=>{
  const s=label.replace(/\s+/g,'');
  if(/状態異常蓄積|ブレイク値|回復|シールド|被ダメージ|最大値|倍率|上限|獲得|生成量/.test(s))return null;
  if(/メンバー全員/.test(s))return /攻撃力/.test(s)?(unit==='Pt'?'atkFlat':'atkPct'):/与ダメージ/.test(s)?'dmg':null;
  if(/防御力ダウン|防御力無視/.test(s))return 'def';
  if(/耐性ダウン|耐性無視/.test(s))return 'res';
  if(/会心率/.test(s))return 'cr';
  if(/会心ダメージ/.test(s))return 'cd';
  if(/異常マスタリー/.test(s))return 'ap';
  if(/異常掌握/.test(s))return 'am';
  if(/透徹力/.test(s))return 'sheer';
  if(/透徹ダメージ/.test(s))return 'sheerDmg';
  if(/鋭撃ダメージ/.test(s))return 'sharpDmg';
  if(/(物理|炎|氷|電気|エーテル|風|流明)属性.*ダメージ/.test(s))return 'element:'+s.match(/(物理|炎|氷|電気|エーテル|風|流明)属性/)[1];
  if(/攻撃力/.test(s))return unit==='Pt'?'atkFlat':'atkPct';
  if(/HP/.test(s))return 'hpPct';
  if(/防御力/.test(s))return 'defPct';
  if(/与ダメージ|与えるダメージ/.test(s))return 'dmg';
  return null;
};
const four={
  '混沌のヘヴィメタル':[['cd',20]],'パファー・エレクトロ':[['ultimate',20]],
  '極地のヘヴィメタル':[['basic',20],['dash',20]],
  'ケイオス・ジャズ':[['element:炎',15],['element:電気',15]],
  '暁に咲く花':[['basic',20]],'棘まとう薔薇':[['dmg',15]],
};
const weaponEffects={
  '恥じらう悪面':{0:'element:氷'},'ディープシー・ビジター':{0:'element:氷'},
  'あられ落つ星殿':{0:'cd'},'複合コンパイラ':{0:'atkCombat'},
  '深紅の渇望':{0:'cr',1:'element:電気',2:'sharp:電気'},
  '転生の炎翼':{0:'ap',1:'element:炎'},
};
const entry=(id,label,key,value,targets='self')=>({id,label,key,value,targets});
export function effectOptions(member){
  const info=findAgent(member), config=member.equipment??{}, options=[];
  if(info){
    const level=member.levels?.core??7;
    (corePassiveValues[info.id]??[]).forEach(([label,unit,values],i)=>{
      const value=values[level-1];
      if(value!=null)options.push(entry('core:'+i,'コア · '+label,statForLabel(label,unit),value,
        /メンバー全員/.test(label)?'team':'self'));
    });
  }
  const weapon=weaponByName.get(config.weapon);
  if(weapon&&info?.specialty===weapon.role){
    weapon.passives.forEach(([label,values],i)=>{
      const value=values[(config.refine??1)-1];
      if(value!=null)options.push(entry('weapon:'+i,'音動機 · '+label,
        weaponEffects[weapon.name]?.[i]??statForLabel(label,'%'),value,
        /メンバー全員/.test(label)?'team':'self'));
    });
  }
  for(const [name,count] of Object.entries(equippedSetCounts(config))){
    if(count<2)continue;
    const [,key,value]=setByName.get(name);
    options.push(entry('disc:'+name+':2',name+' · 2セット',key,value));
    if(count<4)continue;
    for(const [stat,bonus] of four[name]??[])options.push(entry('disc:'+name+':4:'+stat,name+' · 4セット',stat,bonus));
    if(name==='夜明けの紀行'&&baseAttribute(info?.attribute)==='エーテル')
      options.push(entry('disc:'+name+':4:cd',name+' · 4セット','cd',30));
    if(name==='棘まとう薔薇')options.push(entry('disc:'+name+':4:cr',name+' · 4セット（防御力条件）','cr',
      member.effectValues?.['disc:'+name+':4:cr']??0));
    if(name==='折枝の刀歌')options.push(entry('disc:'+name+':4:cd',name+' · 4セット（異常掌握条件）','cd',
      member.effectValues?.['disc:'+name+':4:cd']??0));
    if(fourPieceConditions[name]&&!options.some(effect=>effect.id.startsWith('disc:'+name+':4')))
      options.push(entry('disc:'+name+':4',name+' · 4セット（条件付き）',null,0,
        /チーム|全員/.test(fourPieceConditions[name])?'team':'self'));
  }
  for(let m=1;m<=(member.mindscape??0);m++)options.push(entry('mindscape:'+m,'M'+m+' · 凸効果',null,0));
  return options.map(effect=>({...effect,
    key:member.effectKeys?.[effect.id]??effect.key,
    value:member.effectValues?.[effect.id]??effect.value}));
}
export function resolvedBuffs(agents,slot){
  const buffs={...(agents[slot]?.buffs??{})};
  agents.forEach((source,i)=>{
    for(const effect of effectOptions(source)){
      if(!source.enabledEffects?.[effect.id]||!effect.key||effect.targets==='self'&&i!==slot)continue;
      buffs[effect.key]=(buffs[effect.key]??0)+effect.value;
    }
  });
  return buffs;
}
export function resolveAgents(agents){
  return agents.map((member,i)=>({...member,resolvedBuffs:resolvedBuffs(agents,i)}));
}
