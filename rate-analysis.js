// SPDX-License-Identifier: MIT
import {definitions,totalPoints,plasticPoints,fitRows,finite,toCSV,rateGroup,isDeltaPlot} from './rate-math.js';
const $=id=>document.getElementById(id);
const colours=['#087f8c','#c05b27','#7758a6','#3768b0','#bf4372','#658329','#be8621','#3b879d','#6b6581','#a14c39','#2f7970','#8a6634','#596fbe'];
const selected=new Set(),cache=new Map();
let catalogue,availability,revision=0,exportFits=[],exportPoints=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>finite(v)?v.toLocaleString(undefined,{maximumSignificantDigits:4}):'—';
const chosen=()=>catalogue.tests.filter(t=>selected.has(t.LabID));
const colour=t=>colours[catalogue.tests.indexOf(t)%colours.length];
const branchMatch=p=>$('branch').value==='both'||p.branch===$('branch').value;
async function json(url){const res=await fetch(url);if(!res.ok)throw Error(`Cannot load ${url} (HTTP ${res.status}).`);return res.json();}
function visible(){const term=$('search').value.trim().toLowerCase(),mat=$('material').value;return catalogue.tests.filter(t=>(!mat||t.MaterialID===mat)&&`${t.TestID} ${t.LabID}`.toLowerCase().includes(term));}
function renderChoices(){
  $('tests').replaceChildren();
  for(const t of visible()){
    const available=availability.tests.find(a=>a.LabID===t.LabID)?.totalRows>0;
    const label=document.createElement('label');label.className='test-option';
    label.innerHTML=`<input type="checkbox" ${selected.has(t.LabID)?'checked':''} ${available?'':'disabled'} aria-label="${esc(t.TestID)} (${esc(t.LabID)})"><span class="dot" style="background:${colour(t)}"></span><span><strong>${esc(t.TestID)}</strong><small>${esc(t.LabID)} · ${esc(t.MaterialID||'Metadata unavailable')}${available?'':' · No rate analysis'}</small></span>`;
    label.querySelector('input').onchange=e=>{e.target.checked?selected.add(t.LabID):selected.delete(t.LabID);update();};$('tests').append(label);
  }
  if(!visible().length)$('tests').innerHTML='<p class="empty">No matching specimens.</p>';
  $('selected-count').textContent=`${selected.size} selected`;
}
function createCards(){
  definitions.forEach((d,i)=>{
    const card=document.createElement('article');card.className='plot-card';
    card.innerHTML=`<div class="plot-heading"><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(d.title)}</h3><button data-export="${d.id}" aria-label="Download ${esc(d.title)} as SVG">↓ SVG</button></div><div class="plot rate-plot" id="${d.id}"></div><div class="ratio-key" id="${d.id}-ratios"></div><p class="fit-labels" id="${d.id}-fits"></p>`;
    $(d.plastic?'plastic-plots':'total-plots').append(card);
    card.querySelector('button').onclick=()=>Plotly.downloadImage(d.id,{format:'svg',filename:`triaxial-${d.id}`,width:1000,height:700});
  });
}
function filterGroup(){const group=$('group').value;
  for(const id of ['total-heading','total-plots'])$(id).hidden=group==='plastic';
  for(const id of ['plastic-heading','plastic-note','plastic-explanation','plastic-plots'])$(id).hidden=group==='total';
  for(const d of definitions)if($(d.id).data&&!$(d.plastic?'plastic-plots':'total-plots').hidden)Plotly.Plots.resize($(d.id));
}
function download(rows,filename){if(!rows.length)return;const url=URL.createObjectURL(new Blob(['\uFEFF'+toCSV(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fitText(f){return `${f.Parameter} = ${fmt(f.Coefficient)} · R² = ${fmt(f.R2)} · n = ${f.NUsed}${finite(f.Coefficient)&&!f.FitAccepted?' · low/undefined R²':''}`;}
async function update(){
  const current=++revision;renderChoices();$('error').hidden=true;$('status').textContent='Loading rate-analysis results…';
  $('download-fits').disabled=true;$('download-points').disabled=true;
  const tests=chosen(),url=new URL(location.href);url.searchParams.set('tests',tests.map(t=>t.LabID).join(','));url.searchParams.set('branch',$('branch').value);url.searchParams.set('group',$('group').value);history.replaceState(null,'',url);$('response-link').href=`index.html?tests=${tests.map(t=>t.LabID).join(',')}`;
  try{
    const data=await Promise.all(tests.map(t=>{if(!cache.has(t.LabID))cache.set(t.LabID,json(`data/rate/${t.LabID}.json`).catch(e=>{cache.delete(t.LabID);throw e;}));return cache.get(t.LabID);}));
    if(current!==revision)return;
    const fits=tests.flatMap((t,i)=>fitRows(t,data[i],$('branch').value));
    exportFits=fits.map(({fit,...row})=>row);exportPoints=[];
    const missing=tests.filter((t,i)=>!data[i].plastic.length).map(t=>t.LabID);
    $('availability').textContent=missing.length?`Existing K1 plastic analysis is unavailable for ${missing.join(', ')}; their total-strain results are shown. A9 has no saved rate-reference analysis.`:'A9 has no saved rate-reference analysis. All plotted values come from saved analysis summaries, not reduced preview curves.';
    for(const d of definitions){
      if(current!==revision)return;
      const traces=[],labels=[],shownTests=new Set(),groupsInPlot=new Map();
      tests.forEach((t,i)=>{
        const points=(d.plastic?plasticPoints(data[i],d.id):totalPoints(data[i].total,d.id)).filter(branchMatch);
        exportPoints.push(...points.map(p=>({LabID:t.LabID,TestID:t.TestID,Plot:d.id,Branch:p.branch,PreviousStage:p.previousStage,Stage:p.stage,X:p.x,Y:p.y,RateRatio:p.rate,RateRatioGroup:isDeltaPlot(d.id)?rateGroup(p.rate,d.id.includes('ref')).label:null,TotalShearStrain_pct:p.strain,EstimatedPlasticStrain_pct:p.plasticStrain??null,PersistentReached:p.persistent,ReferenceBasis:'Total shear strain'})));
        for(const branch of ['PrePeak','PostPeak']){
          const ps=points.filter(p=>p.branch===branch);if(!ps.length)continue;
          const fit=fits.find(f=>f.LabID===t.LabID&&f.Plot===d.id&&f.Branch===branch);
          const usedStages=new Set(fit?.fit.used.map(p=>p.stage)||[]);
          const grouped=new Map();
          for(const p of ps){
            const group=isDeltaPlot(d.id)?rateGroup(p.rate,d.id.includes('ref')):null;
            const key=group?.key??'all';
            if(!grouped.has(key))grouped.set(key,{group,points:[]});
            grouped.get(key).points.push(p);
            if(group)groupsInPlot.set(key,group);
          }
          for(const {group,points:series} of [...grouped.values()].sort((a,b)=>(a.group?.value??Infinity)-(b.group?.value??Infinity))){
            const legendKey=group?`${t.LabID}-${group.key}`:t.LabID;
            const showlegend=group?!shownTests.has(legendKey):true;
            shownTests.add(legendKey);
            const symbol=group?group.symbol+(branch==='PostPeak'?'-open':''):branch==='PrePeak'?'circle':'diamond-open';
            traces.push({type:'scatter',mode:'markers',name:group?`${t.TestID} · ${group.label}`:`${t.TestID} · ${branch==='PrePeak'?'pre':'post'}`,legendgroup:legendKey,showlegend,
              meta:{rateGroup:group?.key??null,branch,LabID:t.LabID},
              x:series.map(p=>p.x),y:series.map(p=>p.y),marker:{color:colour(t),size:9,line:{width:1.4},symbol:series.map(p=>(d.id.includes('end')&&!p.persistent)||(d.robust&&fit?.NUsed>0&&!usedStages.has(p.stage))?'x':symbol)},
              customdata:series.map(p=>[p.previousStage,p.stage,p.strain,p.plasticStrain??null,p.rate,p.persistent===false?'No':'Yes']),
              hovertemplate:`%{x:.5g}, %{y:.5g}<br>Stage %{customdata[0]} → %{customdata[1]}<br>Total εₛ %{customdata[2]:.4f}%${d.plastic?'<br>Estimated plastic εₛ %{customdata[3]:.4f}%':''}<br>Measured rate ratio %{customdata[4]:.5g}${group?`<br>Display group: ${esc(group.label)}`:''}${d.id.includes('end')?'<br>Persistent: %{customdata[5]}':''}<extra>${esc(t.TestID)} · ${branch}</extra>`});
          }
          if(d.parameter&&fit){
            labels.push(`<span style="color:${colour(t)}">${esc(t.TestID)} · ${branch==='PrePeak'?'pre':'post'}: ${esc(fitText(fit))}</span>`);
            if($('show-fits').checked&&finite(fit.Coefficient)){
              const xs=fit.fit.used.map(p=>p.x),lo=Math.log10(Math.min(1,...xs)),hi=Math.log10(Math.max(1,...xs));
              const x=Array.from({length:100},(_,j)=>10**(lo+(hi-lo)*j/99));
              traces.push({type:'scatter',mode:'lines',x,y:x.map(r=>fit.Coefficient*Math.log10(r)),name:`${t.TestID} · ${fit.Parameter}=${fmt(fit.Coefficient)}, R²=${fmt(fit.R2)}`,legendgroup:t.LabID,showlegend:false,line:{color:colour(t),width:1.5,dash:branch==='PrePeak'?'solid':'dash'},hovertemplate:`${esc(fitText(fit))}<extra>${esc(t.TestID)}</extra>`});
            }
          }
        }
      });
      const noPoints=!traces.length;
      $(d.id).style.height=isDeltaPlot(d.id)&&tests.length>2?`${370+Math.min(240,(tests.length-2)*40)}px`:"";
      await Plotly.react(d.id,traces,{margin:{l:76,r:18,t:15,b:78},font:{family:'DM Sans, Arial, sans-serif',size:11,color:'#526879'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',
        xaxis:{title:{text:d.xLabel,standoff:15},type:d.parameter?'log':'linear',gridcolor:'#edf1f4',automargin:true},yaxis:{title:{text:d.yLabel,standoff:12},gridcolor:'#edf1f4',zerolinecolor:'#c4cfd7',automargin:true},
        legend:{orientation:'h',y:-.3,font:{size:10}},hovermode:'closest',uirevision:`${d.id}-${[...selected].join(',')}-${$('branch').value}`,
        annotations:noPoints?[{text:tests.length?'No available results for this selection':'Select specimens to see their rate response',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}]:[]},
        {responsive:true,displaylogo:false,modeBarButtonsToRemove:['select2d','lasso2d'],toImageButtonOptions:{format:'svg',filename:`triaxial-${d.id}`}});
      $(d.id+'-fits').innerHTML=labels.join('<br>');
      const glyphs={circle:'●',square:'■','triangle-up':'▲',diamond:'◆'};
      $(d.id+'-ratios').innerHTML=[...groupsInPlot.values()].sort((a,b)=>(a.value??Infinity)-(b.value??Infinity))
        .map(g=>`<span><b aria-hidden="true">${glyphs[g.symbol]}</b> ${esc(g.label)}</span>`).join('')+
        (groupsInPlot.size?'<small>Filled: pre-peak · open: post-peak · ×: beta-fit outlier. Colours identify specimens.</small>':'');
    }
    if(current!==revision)return;
    $('fit-table').innerHTML=exportFits.map(f=>`<tr><td>${esc(f.TestID)}<small>${esc(f.LabID)}</small></td><td>${esc(f.Parameter)}</td><td>${f.Branch==='PrePeak'?'Pre-peak':'Post-peak'}</td><td>${fmt(f.Coefficient)}</td><td>${fmt(f.R2)}</td><td>${f.NUsed} / ${f.N}</td><td class="${f.FitAccepted?'':'fit-low'}">${!finite(f.Coefficient)?'Unavailable':f.FitAccepted?'R² ≥ 0.70':'Low / undefined R²'}</td></tr>`).join('')||'<tr><td colspan="7">Select a specimen to view its coefficients.</td></tr>';
    $('download-fits').disabled=!exportFits.length;$('download-points').disabled=!exportPoints.length;
    $('status').textContent=tests.length?`${tests.length} specimens · ${data.reduce((n,d)=>n+d.total.filter(r=>r.Domain==='q').length,0)} rate steps · ${exportFits.filter(f=>finite(f.Coefficient)).length} fits`:'Select specimens in the left panel';filterGroup();
  }catch(e){if(current!==revision)return;$('error').hidden=false;$('error').textContent=e.message+' Reselect the specimen to retry.';$('status').textContent='Analysis could not be loaded';}
}
async function init(){
  if(!window.Plotly)throw Error('The plotting library could not load. Check your connection to cdn.plot.ly and reload.');
  [catalogue,availability]=await Promise.all([json('data/preview/catalogue.json'),json('data/rate/manifest.json')]);
  createCards();
  const params=new URLSearchParams(location.search);
  for(const id of (params.get('tests')??'A7').split(','))if(availability.tests.some(t=>t.LabID===id&&t.totalRows))selected.add(id);
  if(['both','PrePeak','PostPeak'].includes(params.get('branch')))$('branch').value=params.get('branch');
  if(['all','total','plastic'].includes(params.get('group')))$('group').value=params.get('group');
  $('stats').innerHTML=`<span><strong>${availability.tests.filter(t=>t.totalRows).length}</strong> analysed tests</span><span><strong>13</strong> plots</span><span><strong>5</strong> K1 plastic analyses</span>`;
  for(const m of catalogue.materials){const option=document.createElement('option');option.value=m.SoilComposition;option.textContent=m.SoilComposition;$('material').append(option);}
  $('search').oninput=renderChoices;$('material').onchange=renderChoices;
  $('select-visible').onclick=()=>{visible().filter(t=>availability.tests.some(a=>a.LabID===t.LabID&&a.totalRows)).forEach(t=>selected.add(t.LabID));update();};$('clear').onclick=()=>{selected.clear();update();};
  for(const id of ['branch','group','show-fits'])$(id).onchange=update;
  $('reset').onclick=()=>definitions.forEach(d=>Plotly.relayout(d.id,{'xaxis.autorange':true,'yaxis.autorange':true}));
  $('download-fits').onclick=()=>download(exportFits,'triaxial-beta-gamma-fits.csv');$('download-points').onclick=()=>download(exportPoints,'triaxial-rate-stage-values.csv');
  const resize=new ResizeObserver(entries=>entries.forEach(({target})=>{if(target.data&&target.offsetWidth)Plotly.Plots.resize(target);}));definitions.forEach(d=>resize.observe($(d.id)));
  await update();
}
init().catch(e=>{$('error').hidden=false;$('error').textContent=e.message;$('status').textContent='Rate analysis unavailable';});
