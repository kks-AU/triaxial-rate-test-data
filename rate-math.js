// SPDX-License-Identifier: MIT
// Shared browser / Node numerical routines. Missing values are never zero.
export const finite = Number.isFinite;
export const ratio = (a,b) => finite(a) && finite(b) && b > 0 ? a/b : null;
const median = a => { const s=[...a].sort((a,b)=>a-b), n=s.length; return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; };

// Fit y=c log10(r), constrained through (r,y)=(1,0). Centred R².
export function logFit(points, robust=false) {
  const valid=points.filter(p=>finite(p.x)&&p.x>0&&finite(p.y)&&Math.abs(Math.log10(p.x))>1e-12);
  const n=valid.length;
  const empty={coefficient:null,r2:null,se:null,n,nUsed:0,nOutliers:0,used:[],accepted:false};
  if(n<2)return empty;
  const z=valid.map(p=>Math.log10(p.x)), y=valid.map(p=>p.y);
  let keep=y.map(()=>true);
  const slope=mask=>{
    const den=z.reduce((s,x,i)=>s+(mask[i]?x*x:0),0);
    return den>Number.EPSILON?z.reduce((s,x,i)=>s+(mask[i]?x*y[i]:0),0)/den:null;
  };
  if(robust)for(let iter=0;iter<10;iter++){
    const b=slope(keep); if(b===null)return empty;
    const res=y.map((v,i)=>v-b*z[i]), kept=res.filter((_,i)=>keep[i]);
    const mid=median(kept), sigma=1.4826*median(kept.map(v=>Math.abs(v-mid)));
    if(sigma<=Number.EPSILON)break;
    const next=res.map(v=>Math.abs(v-mid)<=3.5*sigma);
    if(next.filter(Boolean).length<2)break;
    const same=next.every((v,i)=>v===keep[i]); keep=next; if(same)break;
  }
  const coefficient=slope(keep); if(coefficient===null)return empty;
  const used=valid.filter((_,i)=>keep[i]), nUsed=used.length, mean=used.reduce((s,p)=>s+p.y,0)/nUsed;
  const sse=used.reduce((s,p)=>s+(p.y-coefficient*Math.log10(p.x))**2,0);
  const sst=used.reduce((s,p)=>s+(p.y-mean)**2,0);
  const den=used.reduce((s,p)=>s+Math.log10(p.x)**2,0);
  const r2=sst>Number.EPSILON?1-sse/sst:null;
  return {coefficient,r2,se:Math.sqrt(sse/(nUsed-1)/den),n,nUsed,nOutliers:n-nUsed,used,accepted:finite(r2)&&r2>=0.7};
}

export function totalPoints(rows, kind) {
  const domain=kind.startsWith('qp')?'qp':'q';
  return rows.filter(r=>r.Domain===domain).map(r=>{
    const ref=kind.includes('ref'), end=kind.includes('end');
    const strain=end?r.epsEnd:ref?r.epsMax:(finite(r.epsStageStart)&&finite(r.DeltaRateEpsMax)?r.epsStageStart+r.DeltaRateEpsMax:null);
    const branch=finite(strain)&&finite(r.DomainPeakStrain)?(strain<=r.DomainPeakStrain?'PrePeak':'PostPeak'):'Unknown';
    const rate=ref?r.RateRatioToReference:r.RateRatioAfterBefore;
    const delta=ref?(end?r.DeltaEnd:r.DeltaMax):(end?r.DeltaRateEnd:r.DeltaRateMax);
    const q0=ref?(end?r.ReferenceMetricEnd:r.ReferenceMetricAtMax):r.Metric0PreviousStage;
    let x,y;
    if(kind==='q-state'){x=ratio(r.q0PreviousStage,r.qPeak);y=ratio(r.DeltaRateMax,r.qPeak);}
    else if(kind==='q-strain'){x=strain;y=ratio(r.DeltaRateMax,r.qPeak);}
    else if(kind.startsWith('gamma-')){x=strain;y=ref?(end?r.GammaEnd:r.GammaMax):(end?r.GammaRateEnd:r.GammaRateMax);}
    else {x=rate;y=ratio(delta,q0);}
    // Reference-rate stages do not define reference sensitivity (even if
    // the measured rate differs slightly from its nominal reference rate).
    if(ref && r.IsReferenceRateStage===1)y=null;
    return {x,y,branch,stage:r.Stage,previousStage:r.PreviousStage,strain,rate,
      persistent:r.PersistentReached===1,delta,q0,qPeak:r.qPeak,row:r};
  }).filter(p=>finite(p.x)&&finite(p.y));
}
export function gammaFitPoints(rows, ref, end){
  return totalPoints(rows,`beta-${ref?'ref':'step'}${end?'-end':''}`)
    .filter(p=>!end||p.persistent).map(p=>({...p,y:ratio(p.delta,p.qPeak)}));
}
export function toCSV(rows) {
  if(!rows.length)return '';
  const fields=Object.keys(rows[0]),quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  return [fields.map(quote).join(','),...rows.map(r=>fields.map(f=>quote(r[f])).join(','))].join('\r\n');
}
export function plasticPoints(data,kind) {
  if(!data.plastic.length)return [];
  if(kind==='plastic-q-state')return totalPoints(data.total,'q-state').map(p=>({...p,plasticStrain:p.row.EstimatedPlasticStrainAtStepMax_pct}));
  return data.plastic.map(r=>({x:kind==='plastic-r-state'?r.R0:r.ActualRateRatio,
    y:kind==='plastic-r-state'?r.DeltaRMax:r.DeltaRMax_over_R0,
    stage:r.Stage,previousStage:r.PreviousStage,branch:r.PrePeakR===1?'PrePeak':'PostPeak',
    strain:r.ResponseTotalStrain_pct,plasticStrain:r.ResponsePlasticStrain_pct,rate:r.ActualRateRatio,persistent:null,row:r}));
}
export const definitions=[
  ['q-state','Step response versus initial stress','q₀ / qmax,ref','Δqstep,max / qmax,ref'],
  ['q-strain','Step response versus shear strain','Shear strain at maximum, εₛ (%)','Δqstep,max / qmax,ref'],
  ['beta-step','Step rate sensitivity','rstep = rate after / rate before','Δqstep,max / q₀','βstep',true],
  ['beta-ref','Reference rate sensitivity','rref = rate after / reference rate','Δqref,max / q₀','βref',true],
  ['gamma-step','Maximum step coefficient','Shear strain at maximum, εₛ (%)','γmax,step'],
  ['gamma-ref','Maximum reference coefficient','Shear strain at maximum, εₛ (%)','γmax,ref'],
  ['gamma-step-end','End step coefficient','Shear strain at stage end, εₛ (%)','γstep,end'],
  ['gamma-ref-end','End reference coefficient','Shear strain at stage end, εₛ (%)','γend,ref'],
  ['qp-step','Stress-ratio step sensitivity','rstep = rate after / rate before','Δ(q/p′)step,max / (q/p′)₀','γqp,step',false],
  ['qp-ref','Stress-ratio reference sensitivity','rref = rate after / reference rate','Δ(q/p′)ref,max / (q/p′)₀','γqp,ref',false],
  ['plastic-q-state','K1 · normalized q response','q₀ / qmax,ref','Δqstep,max / qmax,ref'],
  ['plastic-r-state','K1 · R response versus initial R','R₀ = σ′v,0 / σ′h,0','ΔRmax'],
  ['plastic-r-rate','K1 · normalized R rate sensitivity','rstep = rate after / rate before','ΔRmax / R₀','γR,step',false]
].map(([id,title,xLabel,yLabel,parameter,robust])=>({id,title,xLabel,yLabel,parameter,robust,plastic:id.startsWith('plastic')}));
export function fitRows(test,data,branchSelection='both') {
  const result=[],branches=branchSelection==='both'?['PrePeak','PostPeak']:[branchSelection];
  const specifications=definitions.filter(d=>d.parameter).map(d=>({...d,points:d.plastic?plasticPoints(data,d.id):totalPoints(data.total,d.id)}));
  for(const ref of [false,true])for(const end of [false,true])specifications.push({id:`gamma-${ref?'ref':'step'}${end?'-end':''}`,parameter:`γ${end?'end':'max'},${ref?'ref':'step'}`,robust:false,points:gammaFitPoints(data.total,ref,end)});
  for(const d of specifications)for(const branch of branches){
    const fit=logFit(d.points.filter(p=>p.branch===branch),d.robust);
    result.push({LabID:test.LabID,TestID:test.TestID,Parameter:d.parameter,Plot:d.id,Branch:branch,
      ReferenceBasis:'Total shear strain',Coefficient:fit.coefficient,R2:fit.r2,StandardError:fit.se,N:fit.n,NUsed:fit.nUsed,NOutliers:fit.nOutliers,
      FitAccepted:fit.accepted,FitMethod:d.robust?'Origin log10; iterative MAD 3.5':'Origin log10; OLS',
      EndPointRule:d.id.includes('end')?'Persistent endpoints only':'All valid maxima',fit});
  }
  return result;
}

// Display grouping only. Measured ratios remain unchanged in plots and fits.
export function rateGroup(rate, reference=false) {
  const values=reference?[0.2,1,2]:[0.2,0.5,10];
  const symbols=['circle','square','triangle-up'];
  const candidates=values.map((value,i)=>({value,symbol:symbols[i],distance:Math.abs(Math.log(rate/value))}))
    .filter(g=>finite(rate)&&rate>0&&Math.abs(rate-g.value)/g.value<=0.5)
    .sort((a,b)=>a.distance-b.distance);
  const match=candidates[0];
  return match?{key:String(match.value),label:`r${reference?'ref':'step'} ≈ ${match.value}`,symbol:match.symbol,value:match.value}
    :{key:'other',label:`Other r${reference?'ref':'step'}`,symbol:'diamond',value:null};
}
export const isDeltaPlot = id => !id.startsWith('gamma-');
