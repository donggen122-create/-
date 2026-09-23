import {freshProfile,PARTS,partResetRefund} from '../../game/src/rework-core.js';

export const GEAR_PART_MAP={water_WPN:'PART_W1',water_ARM:'PART_W2',water_BTS:'PART_W2',wind_WPN:'PART_V1',wind_ARM:'PART_V2',wind_BTS:'PART_V2',seed_WPN:'PART_E1',seed_ARM:'PART_E2',seed_BTS:'PART_E2'};
export const OBSOLETE_PARTS={PART_E3:'PART_E2',PART_V3:'PART_V2',PART_W3:'PART_W2'};
export const PARTS_FIX_SNAPSHOT=2001; // Snapshot key, not the profile protocol version.
const level=n=>Math.max(1,Math.min(20,Math.floor(Number(n)||1)));
const copies=n=>Math.max(0,Math.floor(Number(n)||0));
function transfer(p,id,n){
 const old=p.parts[id]||{copies:0,level:1},room=Math.max(0,7-old.copies),added=Math.min(room,n);
 if(added)p.parts[id]={...old,copies:old.copies+added};
 const overflow=n-added;p.gifts=(p.gifts||0)+overflow;
 return overflow;
}
export function needsPartsRepair(p){return Object.keys(OBSOLETE_PARTS).some(id=>Object.hasOwn(p.parts||{},id));}
// Pure, repeatable repair. The caller snapshots and CAS-updates the exact original in one transaction.
export function repairObsoleteParts(previous){
 const p=structuredClone(previous);if(!needsPartsRepair(p))return p;
 p.milestones||={};p.parts||={};const details=[];
 for(const [oldId,id] of Object.entries(OBSOLETE_PARTS)){
  const old=p.parts[oldId];if(!old)continue;
  const n=copies(old.copies),refund=partResetRefund(old.level||1),overflow=transfer(p,id,n);
  p.coins=(p.coins||0)+refund;details.push({from:oldId,id,copies:n,refund,gifts:overflow});delete p.parts[oldId];
 }
 p.equippedParts=[...new Set((p.equippedParts||[]).map(id=>OBSOLETE_PARTS[id]||id))].filter(id=>PARTS[id]&&p.parts[id]?.copies>0).slice(0,3);
 p.milestones.partsFix1=true;p.partsRepairNotice={id:'partsFix1',details};
 return p;
}
export function migrateProfileV2(previous){
 if(previous.version===2)return structuredClone(previous);
 if(previous.version!==1)throw new Error('지원하지 않는 저장 버전이에요.');
 const p={...freshProfile(),...structuredClone(previous),version:2,migratedAtVersion:2};
 p.training={attack:level(previous.levels?.WPN),hp:level(previous.levels?.ARM),speed:level(previous.levels?.BTS)};
 p.parts={};
 for(const [old,id] of Object.entries(GEAR_PART_MAP))if(previous.gear?.[old]>0)transfer(p,id,Math.min(7,copies(previous.gear[old])));
 p.equippedParts=[...new Set(Object.values(previous.equipped||{}).map(id=>GEAR_PART_MAP[id]).filter(id=>PARTS[id]&&p.parts[id]))].slice(0,3);
 p.giftCounts={part:previous.giftCounts?.gear||0,pet:previous.giftCounts?.pet||0};
 p.weaponMode='melee';p.weaponElement='neutral';p.skillUsage={};p.fusionUsage={};
 delete p.gear;delete p.equipped;delete p.levels;delete p.starter;
 return p;
}
