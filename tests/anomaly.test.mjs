import test from 'node:test';
import assert from 'node:assert/strict';
import {ANOMALY_RULES,inspectRun} from '../server/src/anomaly.js';
import {STAGES} from '../game/src/rework-core.js';
test('all stage rules, exact bounds and strictly over double holds',()=>{
  for(const s of STAGES){const r=ANOMALY_RULES[s.id];
    assert.ok(r.kills>1000);
    const base={kills:r.kills,litter:r.litter,seconds:300,hpFraction:1,bossSeconds:60,cleared:true};
    assert.equal(inspectRun(s.id,base,240).flags.length,0);
    for(const k of ['kills','litter','seconds','hpFraction','bossSeconds']){
      const limit=r[k];
      assert.equal(inspectRun(s.id,{...base,[k]:limit*2},240).held,false,k);
      assert.equal(inspectRun(s.id,{...base,[k]:limit*2+1},240).held,true,k);
    }
  }
});
test('missing boss phase, invalid fractions and contradictory perf only flag',()=>{
 assert.equal(inspectRun('CH05',{cleared:true,seconds:240},240).flags[0].code,'bossSeconds_required');
 assert.equal(inspectRun('CH05',{cleared:false,seconds:0},240).flags.length,0);
 assert.equal(inspectRun('CH03',{hpFraction:-1,kills:ANOMALY_RULES.CH03.kills,perf:{fps:0}},300).flags.length,2);
 assert.equal(inspectRun('CH03',{kills:1.5},300).flags[0].code,'kills_integer');
});
