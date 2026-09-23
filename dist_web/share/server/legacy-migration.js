import {RAW_EQUIPMENT} from '../../game/src/content.data.js';
import {freshProfile,grade} from '../../game/src/rework-core.js';
const defs=Object.fromEntries(RAW_EQUIPMENT.map(x=>[x.id,x]));
const setMap={ESET01:'seed',ESET02:'wind',ESET03:'water',ESET04:'seed',ESET05:'wind',ESET06:'water',ESET07:'seed',ESET08:'wind'};
const slotMap={WPN:'WPN',ARM:'ARM',BTS:'BTS',NCK:'WPN',NECK:'WPN',GLV:'WPN',GLOVE:'WPN',BLT:'ARM',BELT:'ARM',ARMOR:'ARM',BOOTS:'BTS'};
const petMap={PT01:'otter',PT02:'otter',PT03:'turtle',PT04:'sparrow',PT05:'seal',PT06:'seal',PT07:'cat',PT08:'sparrow',PT09:'seal',PT10:'deer',PT11:'sparrow',PT12:'otter'};
const num=(n,max=1e9)=>Math.max(0,Math.min(max,Math.floor(Number(n)||0)));
export function migrateLegacy(legacy={}){
  // Historic conversion remains v1; getProfile performs and snapshots the v2 conversion afterward.
  const p={...freshProfile(legacy),version:1,migratedAtVersion:1,gear:{},equipped:{WPN:null,ARM:null,BTS:null},levels:{WPN:1,ARM:1,BTS:1},giftCounts:{gear:0,pet:0},starter:'S01'},ledger={version:1,originalRetained:true,gold:num(legacy.currencies?.GOLD),upgradeRefund:0,overflowCoins:0,gearMapped:0,petsMapped:0,archivedCurrencies:{...legacy.currencies},archivedSystems:['talents','parts','collectibles','chars','chests','pity','missions','achievements']};
  for(const key of ['training','parts','equippedParts','weaponMode','weaponElement','skillUsage','fusionUsage'])delete p[key];
  p.coins=ledger.gold;
  const inv=Array.isArray(legacy.inv)?legacy.inv:Object.entries(legacy.equipment||{}).map(([id,v])=>({id,...v}));
  const grouped={};
  for(const item of inv.slice(0,10000)){
    const d=defs[item.id];if(!d)continue;
    const slot=slotMap[d.slot],set=setMap[d.setId];if(!slot||!set)continue;
    const g=num(item.grade,5),copies=g>=4?7:g>=2?3:1,key=`${set}_${slot}`;
    grouped[key]=(grouped[key]||0)+copies;ledger.gearMapped++;
    // Refund the exact historical upgrade formula instead of erasing invested gold.
    for(let lv=0;lv<num(item.lv,100);lv++)ledger.upgradeRefund+=Math.round(8*(g+1)*Math.pow(lv+1,1.2));
  }
  for(const [key,copies] of Object.entries(grouped)){p.gear[key]=Math.min(7,copies);ledger.overflowCoins+=Math.max(0,copies-7)*60;}
  for(const slot of Object.keys(p.equipped)){
    const owned=Object.keys(p.gear).filter(id=>id.endsWith('_'+slot));owned.sort((a,b)=>grade(p.gear[b])-grade(p.gear[a])||a.localeCompare(b));p.equipped[slot]=owned[0]||null;
  }
  p.coins+=ledger.upgradeRefund+ledger.overflowCoins;
  let petLevel=1;
  for(const [old,v] of Object.entries(legacy.pets||{})){const id=petMap[old];if(!id)continue;if(!p.pets.includes(id))p.pets.push(id);petLevel=Math.max(petLevel,num(v.lv,5));ledger.petsMapped++;}
  p.activePet=petMap[legacy.activePet]&&p.pets.includes(petMap[legacy.activePet])?petMap[legacy.activePet]:(p.pets[0]||null);
  p.friendship=[0,0,3,8,16,28][petLevel];p.runs=num(legacy.stats?.runs);p.wins=num(legacy.stats?.clears);
  if(p.stages.CH05?.cleared&&!p.gear.seed_WPN){p.gear.seed_WPN=1;p.equipped.WPN ||= 'seed_WPN';}
  if(Object.keys(legacy).length)p.migration=ledger;
  return p;
}
