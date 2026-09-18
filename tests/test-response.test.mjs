import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(`../${p}`,import.meta.url)));
const catalogue=read('data/preview/catalogue.json');
test('q/p prime uses processed stresses and preserves missing segment separators',()=>{
  for(const t of catalogue.tests){
    const d=read(`data/preview/${t.LabID}.json`);
    assert.equal(d.fields[9],'q_over_p');
    for(const r of d.shear){
      if(r===null)continue;
      assert.ok(Number.isFinite(r[9]),t.LabID);
      assert.ok(Math.abs(r[9]-r[1]/r[2])<1e-12,t.LabID);
    }
  }
});
test('reference curves respect their support and include the saved reference peak',()=>{
  for(const t of catalogue.tests){
    const d=read(`data/preview/${t.LabID}.json`),rows=read(`data/rate/${t.LabID}.json`).total;
    if(t.LabID==='A9'){assert.equal(t.HasReferenceCurve,false);assert.deepEqual(d.reference.q,[]);assert.equal(t.ReferenceRateSource,'configured');continue;}
    assert.equal(t.HasReferenceCurve,true);
    for(const [key,field] of [['q','qPeak'],['qp','qpPeak']]){
      const curve=d.reference[key];assert.equal(curve.strain.length,curve.values.length);
      assert.equal(curve.strain[0],curve.minStrain);assert.equal(curve.strain.at(-1),curve.maxStrain);
      assert.ok(curve.strain.every((x,i)=>i===0||x>curve.strain[i-1]));
      assert.ok(curve.values.every(Number.isFinite));
      assert.ok(Math.abs(Math.max(...curve.values)-rows[0][field])<1e-8,`${t.LabID} ${key}`);
    }
  }
});
test('table rates and sequence agree with the saved analysis',()=>{
  for(const t of catalogue.tests){
    assert.ok(t.RateSequence.length>0);
    const rows=read(`data/rate/${t.LabID}.json`).total.filter(r=>r.Domain==='q');
    for(const r of rows){
      assert.equal(t.ReferenceRate_pct_min,r.ReferenceRate);
      const after=t.RateSequence.find(s=>s.stage===r.Stage),before=t.RateSequence.find(s=>s.stage===r.PreviousStage);
      assert.ok(Math.abs(after.rate-r.RateAfter)<1e-10);
      assert.ok(Math.abs(before.rate-r.RateBefore)<1e-10);
    }
  }
});
