// SPDX-License-Identifier: MIT
const $ = id => document.getElementById(id);
const colours = ['#087f8c','#c05b27','#7758a6','#3768b0','#bf4372','#658329','#be8621','#3b879d','#6b6581','#a14c39','#2f7970','#8a6634','#596fbe'];
const selected = new Set(), cache = new Map();
let catalogue, revision = 0;
const fmt = (v, digits=2) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString(undefined,{maximumFractionDigits:digits});
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chosen = () => catalogue.tests.filter(t => selected.has(t.LabID));
async function json(url) { const response = await fetch(url); if(!response.ok) throw Error(`Cannot load ${url} (HTTP ${response.status}).`); return response.json(); }
function colour(test) { return colours[catalogue.tests.indexOf(test) % colours.length]; }
function visible() { const term=$('search').value.trim().toLowerCase(), mat=$('material').value; return catalogue.tests.filter(t => (!mat || t.MaterialID === mat) && `${t.TestID} ${t.LabID}`.toLowerCase().includes(term)); }
function renderChoices() {
  $('tests').replaceChildren();
  for(const t of visible()) {
    const label=document.createElement('label'); label.className='test-option';
    label.innerHTML=`<input type="checkbox" ${selected.has(t.LabID)?'checked':''} aria-label="${esc(t.TestID)} (${esc(t.LabID)})"><span class="dot" style="background:${colour(t)}"></span><span><strong>${esc(t.TestID)}</strong><small>${esc(t.LabID)} · ${esc(t.MaterialID || 'Metadata unavailable')}</small></span>`;
    label.querySelector('input').addEventListener('change',e=>{e.target.checked?selected.add(t.LabID):selected.delete(t.LabID);update();});
    $('tests').append(label);
  }
  if(!visible().length) $('tests').innerHTML='<p class="empty">No matching specimens.</p>';
  $('selected-count').textContent=`${selected.size} selected`;
}
const materials = () => catalogue.materials.filter(m=>chosen().some(t=>t.MaterialID===m.SoilComposition));
function tableRows(rows, fields) { return rows.map(r=>`<tr>${fields.map(f=>`<td>${esc(r[f] === '' || r[f] === 'NaN' ? '—' : r[f])}</td>`).join('')}</tr>`).join(''); }
function renderTables() {
  $('test-table').innerHTML=chosen().map(t=>`<tr><td><strong style="color:${colour(t)}">${esc(t.TestID)}</strong><small>${esc(t.LabID)}</small></td><td>${esc(t.MaterialID || '—')}</td><td>${fmt(t.EndConsolidationPressure_kPa,1)}</td><td>${fmt(t.OCR)}</td><td>${fmt(t.InitialVoidRatioCorrected,3)}</td><td><a href="data/${encodeURI(t.ShearFile)}" download>Shear CSV ↓</a><a href="data/${encodeURI(t.CompressionFile)}" download>Compression CSV ↓</a></td></tr>`).join('') || '<tr><td colspan="6">Select a specimen to explore and download its data.</td></tr>';
  $('material-table').innerHTML=tableRows(materials(),['SoilComposition','K_pct','B_pct','SW_pct','wL_pct','Gs','CF_pct']) || '<tr><td colspan="7">No material metadata for the current selection.</td></tr>';
  $('download-materials').disabled=!materials().length;
}
function downloadCSV(rows, filename) {
  if(!rows.length)return;
  const fields=Object.keys(rows[0]);
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[fields.map(quote).join(','),...rows.map(r=>fields.map(f=>quote(r[f])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function baseLayout(x,y,id) {
  return {margin:{l:66,r:18,t:15,b:66},paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'DM Sans, Arial, sans-serif',size:11,color:'#526879'},
    xaxis:{title:{text:x,standoff:14},gridcolor:'#edf1f4',zerolinecolor:'#d7e0e7',automargin:true},
    yaxis:{title:{text:y,standoff:12},gridcolor:'#edf1f4',zerolinecolor:'#d7e0e7',automargin:true},
    legend:{orientation:'h',y:-.25,font:{size:10}},hovermode:'closest',showlegend:true,
    uirevision:`${[...selected].sort().join(',')}-${id}-${$('pore').value}-${$('scale').value}`,
    annotations:selected.size?[]:[{text:'Select a specimen to see its response',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false,font:{color:'#7a8b9a',size:13}}]};
}
function trace(t,data,xIndex,yIndex) {
  return {type:'scatter',mode:'lines',name:t.TestID,line:{color:colour(t),width:1.8},connectgaps:false,
    x:data.shear.map(r=>r?.[xIndex]??null),y:data.shear.map(r=>r?.[yIndex]??null),
    customdata:data.shear.map(r=>r?[r[6],r[7],r[8]]:[null,null,null]),
    hovertemplate:'%{x:.4g}, %{y:.4g}<br>Stage %{customdata[0]}<br>Axial rate %{customdata[1]:.4g} %/min<br>Source row %{customdata[2]}<extra>'+esc(t.TestID)+'</extra>'};
}
async function plots(tests, data, current) {
  const excess=$('pore').value==='excess';
  const definitions=[['stress','Shear strain, εₛ (%)','Deviator stress, q (kPa)',0,1],['path','Mean effective stress, p′ (kPa)','Deviator stress, q (kPa)',2,1],['water','Shear strain, εₛ (%)',excess?'Excess pore pressure, Δu (kPa)':'Pore pressure, u (kPa)',0,excess?4:3],['compression','Mean effective stress, p′ (kPa)','Void ratio, e',null,null]];
  for(const [id,x,y,xi,yi] of definitions) {
    if(current!==revision)return;
    const layout=baseLayout(x,y,id);
    const traces=tests.map((t,i)=>id==='compression'?{type:'scatter',mode:'lines+markers',name:t.TestID,line:{color:colour(t),width:1.8},marker:{size:5},x:data[i].compression.map(r=>r.p),y:data[i].compression.map(r=>r.e),customdata:data[i].compression.map(r=>[r.stage,r.type]),hovertemplate:'p′ %{x:.4g} kPa<br>e %{y:.4f}<br>Stage %{customdata[0]} · %{customdata[1]}<extra>'+esc(t.TestID)+'</extra>'}:trace(t,data[i],xi,yi));
    if(id==='compression')layout.xaxis.type=$('scale').value;
    if($('stages').checked && (id==='stress'||id==='water'))layout.shapes=tests.flatMap((t,i)=>data[i].stages.filter(s=>s.strain!==null).map(s=>({type:'line',xref:'x',yref:'paper',x0:s.strain,x1:s.strain,y0:0,y1:1,line:{color:colour(t),width:.65,dash:'dot'},opacity:.35,layer:'below'})));
    await Plotly.react(id,traces,layout,{responsive:true,displaylogo:false,scrollZoom:false,modeBarButtonsToRemove:['select2d','lasso2d'],toImageButtonOptions:{format:'svg',filename:`triaxial-${id}`}});
  }
}
async function update() {
  const current=++revision;renderChoices();renderTables();
  const tests=chosen();$('status').textContent=tests.length?'Loading selected specimens…':'No specimens selected';$('error').hidden=true;
  const url=new URL(location.href);url.searchParams.set('tests',tests.map(t=>t.LabID).join(','));history.replaceState(null,'',url);
  try {
    const data=await Promise.all(tests.map(async t=>{if(!cache.has(t.LabID))cache.set(t.LabID,json(`data/preview/${t.LabID}.json`).catch(e=>{cache.delete(t.LabID);throw e;}));return cache.get(t.LabID);}));
    if(current!==revision)return;
    await plots(tests,data,current);
    if(current!==revision)return;
    $('status').textContent=tests.length?`${tests.length} specimens · ${fmt(tests.reduce((n,t)=>n+t.ShearRows,0),0)} source measurements`:'Select specimens in the left panel';
  } catch(error) {if(current!==revision)return;$('error').hidden=false;$('error').textContent=error.message+' Check your connection and reselect the test to retry.';$('status').textContent='Selected data could not be loaded';}
}
async function init() {
  if(!window.Plotly)throw Error('The plotting library could not load. Check your connection to cdn.plot.ly and reload.');
  catalogue=await json('data/preview/catalogue.json');
  const resizeObserver = new ResizeObserver(entries => {
    for(const {target} of entries) if(target.data) Plotly.Plots.resize(target);
  });
  for(const id of ['stress','path','water','compression'])resizeObserver.observe($(id));
  $('stats').innerHTML=`<span><strong>${catalogue.tests.length}</strong> tests</span><span><strong>${catalogue.materials.length}</strong> materials</span><span><strong>${fmt(catalogue.tests.reduce((n,t)=>n+t.ShearRows,0),0)}</strong> measurements</span>`;
  for(const m of catalogue.materials){const option=document.createElement('option');option.value=m.SoilComposition;option.textContent=m.SoilComposition;$('material').append(option);}
  const requested=new URLSearchParams(location.search).get('tests');
  for(const id of (requested===null?'A7,E3':requested).split(','))if(catalogue.tests.some(t=>t.LabID===id))selected.add(id);
  $('search').addEventListener('input',renderChoices);$('material').addEventListener('change',renderChoices);
  $('select-visible').onclick=()=>{visible().forEach(t=>selected.add(t.LabID));update();};
  $('clear').onclick=()=>{selected.clear();update();};
  for(const id of ['pore','scale','stages'])$(id).onchange=update;
  $('reset').onclick=()=>{for(const id of ['stress','path','water','compression'])Plotly.relayout(id,{'xaxis.autorange':true,'yaxis.autorange':true});};
  $('download-materials').onclick=()=>downloadCSV(materials(),'selected-material-properties.csv');
  document.querySelectorAll('[data-export]').forEach(button=>button.onclick=()=>Plotly.downloadImage(button.dataset.export,{format:'svg',filename:`triaxial-${button.dataset.export}`,width:1000,height:700}));
  await update();
}
init().catch(error=>{$('error').hidden=false;$('error').textContent=error.message;$('status').textContent='Viewer unavailable';});
