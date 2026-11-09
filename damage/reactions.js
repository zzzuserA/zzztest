import {findAgent,effectiveLevel} from './catalog.js';
import {baseAttribute} from './equipment.js';

// Standard status damage, disorder bounds, and wind-first turbulence.
const conditions={
  物理:['強撃',713,450,525,875,713],
  炎:['熱傷（1回）',50,450,1450,1900,0],
  氷:['砕氷',500,450,525,1375,500],
  霜烈:['砕氷（霜烈）',500,600,1350,1500,500],
  電気:['感電（1回）',125,450,1700,1900,0],
  エーテル:['侵蝕（1回）',62.5,450,1700,1900,0],
  風:['風化',1250],
};
const ariaRates={
  エーテル:[13.8,16,18.3,20.6,22.9,25.2,27.5],
  電気:[7.2,8.3,9.5,10.7,11.9,13.1,14.3],
  炎:[17.9,20.8,23.8,26.8,29.8,32.7,35.7],
  物理:[1.25,1.46,1.67,1.88,2.08,2.29,2.5],
  氷:[1.8,2.1,2.4,2.7,3,3.3,3.6],
  風:[.7,.8,.9,1.1,1.2,1.3,1.4],
};
const sourceAttribute=actor=>{
  const attr=findAgent(actor)?.attribute??'';
  return attr.startsWith('霜烈')?'霜烈':baseAttribute(attr);
};
const rate=(actor,test)=>{
  const skill=findAgent(actor)?.skills.find(test);
  return skill?.rates[effectiveLevel(actor,skill)-1]??null;
};
const coreLevel=actor=>actor.levels?.core??7;
const fionyRate=(actor,group,start,step)=>{
  const n=effectiveLevel(actor,{group});
  return n<=12?start+(n-1)*step:null;
};

// Released Remielle skill tables. Levels 13–16 continue the same increments.
const luminizeSkills=[
  ['luminize-rainbow','虹が立つ','basic',5],
  ['luminize-foam','泡沫に舞う','basic',10],
  ['luminize-assist','花と翼のロンド','assist',10],
  ['luminize-ultimate','繚乱のフィナーレ','chain',10.5],
];

export function voidflareAttribute(agents,slot,source){
  const member=agents[source];
  const attribute=member&&source!==slot?sourceAttribute(member):'';
  return conditions[attribute]?baseAttribute(attribute):'';
}

export function luminizeRows(agents,slot,voidflares){
  const actor=agents[slot];
  if(findAgent(actor)?.id!=='1581')return [];
  const sources=voidflares.map(source=>{
    const attribute=voidflareAttribute(agents,slot,source);
    return attribute?{slot:source,attribute}:null;
  });
  const ready=sources.length>0&&sources.length<=3&&sources.every(Boolean);
  const mindscape=actor.mindscape??0;
  const refringe=(agents.every(member=>findAgent(member)?.specialty==='異常')?.10:0)+(mindscape>=2?.20:0);
  const masteryRate=[.10,.12,.14,.15,.16,.18,.20][coreLevel(actor)-1];
  return luminizeSkills.map(([id,title,group,step])=>{
    const level=effectiveLevel(actor,{group});
    const baseRate=(20+level)*step;
    return {id,name:'耀変・'+title,amount:ready?baseRate:null,baseRate,level,actorMastery:true,
      luminize:{sources,refringe,masteryRate,mindscape,hits:mindscape>=6&&group==='basic'?2:1}};
  });
}

export function reactionRows(agents,slot,source){
  const actor=agents[slot], donor=agents[source];
  const info=findAgent(actor);
  const own=conditions[sourceAttribute(actor)], attr=sourceAttribute(donor);
  const base=conditions[attr];
  if(info?.specialty!=='異常')return [];
  const rows=[];
  const add=(id,name,amount,ref=source,extra={})=>{
    rows.push({id,name,amount,source:ref,attribute:baseAttribute(sourceAttribute(agents[ref])),...extra});
  };
  const verinaBonus=info.id==='1561'&&agents.some((m,i)=>i!==slot&&(findAgent(m)?.specialty==='異常'||sourceAttribute(m)==='風'))?1.1+(actor.mindscape>=2?.15:0):1;
  if(own)add('status',own[0],own[1]*verinaBonus,slot,{resDown:info.id==='1561'&&actor.mindscape>=1?20:0});
  if(info.id==='1401')add('polar-assault','極性強撃',713,slot);
  if(!base)return rows;
  if(base[2]!=null){
    const yanagiBonus=info.id==='1221'?rate(actor,s=>s.group==='core'&&s.label.includes('「混沌」効果'))??0:0;
    for(const [suffix,label,value] of [['min','基本倍率',base[2]],['max','残存分が最大',base[3]]]){
      const disorder={fixed:base[2],remaining:value-base[2],bonus:yanagiBonus};
      add('disorder-'+suffix,'混沌（'+label+'）',value+yanagiBonus,source,{disorder});
      if(info.id==='1221'){
        for(const [group,skillName] of [['special','強化特殊'],['chain','終結']]){
          const scale=rate(actor,s=>s.group===group&&s.label.includes('追加ダメージ倍率'));
          add('polar-'+group+'-'+suffix,'極性混沌・'+skillName+'（'+label+'）',scale===null?null:value+yanagiBonus,source,
            {polarScale:scale,actorMastery:true,disorder});
        }
      }
    }
  }
  if(info.id==='1561'){
    if(base[4]!=null&&source!==slot){
      const core=rate(actor,s=>s.label.includes('「乱流」ダメージ倍率'))??0;
      const extras={separate:base[5],resDown:actor.mindscape>=1?20:0};
      add('turbulence','乱流（風化が先）',base[4]*verinaBonus,source,extras);
      add('turbulence-tornado','乱流（風食2重消費）',(base[4]+core)*verinaBonus,source,extras);
    }
    add('wind-bloom-swirl','狂咲・旋風',[85,95,105,115,125,135,145][coreLevel(actor)-1],slot);
    add('wind-bloom-tornado','狂咲・竜巻',[135,155,175,195,215,235,255][coreLevel(actor)-1],slot);
    add('wind-bloom-ultimate','狂咲・終結',680,slot);
  }
  if(info.id==='1331'){
    const value=rate(actor,s=>s.label.startsWith(baseAttribute(attr)+'属性状態異常追加'));
    add('vivian-bloom','狂咲・花咲き羽落つ',value===null?null:base[1]*value/100,source,{actorMastery:true,scale:'ap'});
  }
  if(info.id==='1501'){
    const value=ariaRates[baseAttribute(attr)]?.[coreLevel(actor)-1];
    add('aria-bloom','狂咲・絶対音感',value==null?null:base[1]*value/100,source,{scale:'am',stunBoost:1.5});
  }
  if(info.id==='1541'){
    const extraActive=agents.some((m,i)=>i!==slot&&['異常','支援'].includes(findAgent(m)?.specialty));
    add('promeia-bloom','狂咲・処刑式、裁決は下った',rate(actor,s=>s.group==='core'&&s.label.includes('ダメージ倍率')),source,
      {defDown:extraActive?(actor.mindscape>=1?60:40):0});
  }
  if(info.id==='1641'){
    add('fiony-bloom-basic','狂咲・炎で処す',fionyRate(actor,'basic',225,20),source,{fionyCrit:40});
    add('fiony-bloom-ultimate','狂咲・魂狩る燼火',fionyRate(actor,'chain',300,27),source,{fionyCrit:0});
    if(actor.mindscape>=4)add('fiony-bloom-m4','狂咲・心象映画04の追加分',600,source,{fionyCrit:0});
  }
  return rows;
}
