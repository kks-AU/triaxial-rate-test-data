import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {logFit,totalPoints,plasticPoints,fitRows,ratio,toCSV,definitions} from '../rate-math.js';
const a7=JSON.parse(fs.readFileSync(new URL('../data/rate/A7.json',import.meta.url)));
test('log slope, centred R² and minimum sample rules',()=>{
  const points=[.1,.5,2,10].map(x=>({x,y:.04*Math.log10(x)}));
  const fit=logFit(points);assert.ok(Math.abs(fit.coefficient-.04)<1e-14);assert.equal(fit.r2,1);
  assert.equal(logFit([{x:1,y:0},{x:2,y:3}]).coefficient,null);
  assert.equal(logFit([{x:.1,y:2},{x:10,y:2}]).r2,null);
  assert.equal(ratio(null,2),null);assert.equal(ratio(2,0),null);
});
test('saved A7 robust beta step coefficients reproduced',()=>{
  const rows=fitRows({LabID:'A7',TestID:'K-400-1'},a7);
  for(const [branch,beta,r2,n] of [['PrePeak',.0365573200058628,.998426514826751,9],['PostPeak',.033682590871562,.999370658241007,9]]){
    const fit=rows.find(r=>r.Plot==='beta-step'&&r.Branch===branch);
    assert.ok(Math.abs(fit.Coefficient-beta)<1e-12);assert.ok(Math.abs(fit.R2-r2)<1e-12);assert.equal(fit.NUsed,n);
  }
});
test('reference denominator, reference-rate exclusion and strain location',()=>{
  const p=totalPoints(a7.total,'beta-ref')[0],r=p.row;
  assert.equal(p.y,r.DeltaMax/r.ReferenceMetricAtMax);assert.equal(p.x,r.RateRatioToReference);
  assert.ok(totalPoints(a7.total,'beta-ref').every(p=>p.row.IsReferenceRateStage!==1));
  const q=totalPoints(a7.total,'q-strain')[0];assert.equal(q.x,q.row.epsStageStart+q.row.DeltaRateEpsMax);
  assert.equal(totalPoints([{...r,DeltaRateEpsMax:null}],'q-strain').length,0);
});
test('plastic R source retained and unavailable tests stay empty',()=>{
  const p=plasticPoints(a7,'plastic-r-rate')[0],r=a7.plastic[0];assert.equal(p.x,r.ActualRateRatio);assert.equal(p.y,r.DeltaRMax_over_R0);
  assert.deepEqual(plasticPoints({plastic:[],total:a7.total},'plastic-q-state'),[]);
  assert.equal(definitions.length,13);
});
test('CSV preserves missing values and escapes commas/quotes',()=>{
  assert.equal(toCSV([{Name:'a,"b',R2:null}]),'"Name","R2"\r\n"a,""b",""');
});
test('all 24 saved pre/post-peak beta coefficients reproduce across 12 tests',()=>{
  const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/saved-beta-step.json',import.meta.url)));
  for(const row of expected){
    const data=JSON.parse(fs.readFileSync(new URL(`../data/rate/${row.LabID}.json`,import.meta.url)));
    const fit=fitRows({LabID:row.LabID,TestID:row.LabID},data).find(f=>f.Plot==='beta-step'&&f.Branch===row.Branch);
    for(const [key,actual] of [['Beta',fit.Coefficient],['R2',fit.R2],['NUsed',fit.NUsed]]){
      const value=Number(row[key]);assert.ok(Number.isNaN(value)?actual===null:Math.abs(value-actual)<1e-10,`${row.LabID} ${row.Branch} ${key}`);
    }
  }
});
