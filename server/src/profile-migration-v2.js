import {freshProfile,PARTS} from '../../game/src/rework-core.js';

export const GEAR_PART_MAP={water_WPN:'PART_W1',water_ARM:'PART_W2',water_BTS:'PART_W3',wind_WPN:'PART_V1',wind_ARM:'PART_V2',wind_BTS:'PART_V3',seed_WPN:'PART_E1',seed_ARM:'PART_E2',seed_BTS:'PART_E3'};
const level=n=>Math.max(1,Math.min(20,Math.floor(Number(n)||1)));
// Pure conversion. The caller stores the exact prior JSON in the same transaction.
export function migrateProfileV2(previous){
 if(previous.version===2)return structuredClone(previous);
 if(previous.version!==1)throw new Error('지원하지 않는 저장 버전이에요.');
 const p={...freshProfile(),...structuredClone(previous),version:2,migratedAtVersion:2};
 p.training={attack:level(previous.levels?.WPN),hp:level(previous.levels?.ARM),speed:level(previous.levels?.BTS)};
 p.parts={};
 for(const [old,id] of Object.entries(GEAR_PART_MAP))if(previous.gear?.[old]>0)p.parts[id]={copies:Math.min(7,Math.floor(previous.gear[old])),level:1};
 p.equippedParts=[...new Set(Object.values(previous.equipped||{}).map(id=>GEAR_PART_MAP[id]).filter(id=>PARTS[id]&&p.parts[id]))].slice(0,3);
 p.giftCounts={part:previous.giftCounts?.gear||0,pet:previous.giftCounts?.pet||0};
 p.weaponMode='melee';p.weaponElement='neutral';p.skillUsage={};p.fusionUsage={};
 delete p.gear;delete p.equipped;delete p.levels;delete p.starter;
 return p;
}
