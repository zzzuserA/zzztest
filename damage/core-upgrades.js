// Permanent core upgrades from each agent's コアスキル強化 table on the Japanese wiki.
// A/C/E improve the listed stat. B/D/F grant +25 base ATK unless listed below.
const alternateUpgrades=[
  ["impact",6,'1011 1071 1101 1141 1161 1251 1351 1361'],
  ["cr",4.8,'1021 1041 1051 1081 1111 1191 1201 1291 1321 1381 1391 1431 1471 1481 1531 1551 1571 1591 1621'],
  ["energyFlat",0.12,'1031 1121 1131 1151 1171 1271 1281 1301 1311 1421 1451 1521'],
  ["cd",9.6,'1061 1241 1461'],
  ["ap",30,'1091'],
  ["am",12,'1181 1221 1261 1331 1401 1411 1501 1511 1541 1641'],
  ["pen",4.8,'1211'],
  ["hpPct",6,'1341 1441'],
  ["atkPct",7,'1491'],
  ["ap",18,'1561 1581'],
];
const upgradesById=new Map(alternateUpgrades.flatMap(([stat,value,ids])=>ids.split(' ').map(id=>[id,[stat,value]])));

export function coreBonuses(info,level=7){
  const steps=Math.max(0,Math.min(6,level-1));
  if(info?.id==='1371')return {cr:4.8*Math.ceil(steps/2),hp:140*Math.floor(steps/2)};
  if(info?.id==='1611')return {cr:4.8*steps};
  const alternate=upgradesById.get(info?.id);
  if(!alternate)return {};
  const [stat,value]=alternate;
  return {[stat]:value*Math.ceil(steps/2),atk:25*Math.floor(steps/2)};
}
