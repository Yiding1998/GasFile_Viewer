(function(){
'use strict';

const core=window.GasSearchCore;
const bridge=window.GarfieldWorkbenchBridge;
if(!core||!bridge)return;

const zh=document.documentElement.lang.toLowerCase().startsWith('zh');
const text=zh?{
  launch:'搜索仓库气体文件',title:'仓库气体文件检索',close:'关闭',mode:'匹配模式',
  nearest:'最接近',range:'容差范围内',exact:'精确匹配',exactSet:'成分集合完全一致',
  composition:'目标气体成分',addComponent:'添加成分',gas:'气体',fraction:'比例 %',tolerance:'容差 pp',
  conditions:'温度与压强',temperature:'温度',temperatureTol:'温度容差 K',pressure:'压强',
  pressureTol:'相对压强容差 %',filters:'其他筛选',keywords:'关键字、别名或路径',
  quality:'数据质量',all:'全部文件',ready:'可完整数值匹配',warning:'存在数据警告',
  sort:'排序',overall:'综合最接近',mixSort:'比例最接近',tempSort:'温度最接近',
  pressureSort:'压强最接近',pathSort:'路径',refresh:'刷新索引',fullSearch:'打开完整检索页面',
  selectTop3:'选择前 3 个',selectTop5:'选择前 5 个',clearSelection:'清除选择',
  addSelected:'添加选中文件',cancel:'取消加载',loadingIndex:'正在读取气体索引…',
  indexUnavailable:'无法读取在线索引。请使用 GitHub Pages 或从仓库根目录启动本地网页服务器。',
  noResults:'没有符合条件的气体文件。',selected:'已选择',results:'个结果',showing:'当前显示前',
  add:'添加',loaded:'已载入',size:'大小',coverage:'覆盖范围',unknown:'未知',
  progress:'正在加载',complete:'添加完成',failed:'失败',skipped:'跳过重复',
  noSelection:'请至少选择一个气体文件。',invalidPath:'索引包含不安全的文件路径。',
  tooLarge:'所选文件总大小超过 200 MB，请减少选择数量。',hashMismatch:'SHA-256 校验失败',
  localOnly:'在线检索不可用于 file:// 地址；原有本地文件载入功能仍可正常使用。',
  indexVersion:'索引',generated:'生成时间',remove:'移除成分',closeTitle:'关闭检索面板'
}:{
  launch:'Search repository gas files',title:'Repository gas file search',close:'Close',mode:'Match mode',
  nearest:'Nearest',range:'Within range',exact:'Exact',exactSet:'Exact component set',
  composition:'Target composition',addComponent:'Add component',gas:'Gas',fraction:'Fraction %',tolerance:'Tolerance pp',
  conditions:'Temperature and pressure',temperature:'Temperature',temperatureTol:'Temperature tolerance K',pressure:'Pressure',
  pressureTol:'Relative pressure tolerance %',filters:'Additional filters',keywords:'Keyword, alias, or path',
  quality:'Data quality',all:'All files',ready:'Ready for numeric matching',warning:'Has data warning',
  sort:'Sort',overall:'Overall closest',mixSort:'Composition closest',tempSort:'Temperature closest',
  pressureSort:'Pressure closest',pathSort:'Path',refresh:'Refresh index',fullSearch:'Open full search page',
  selectTop3:'Select top 3',selectTop5:'Select top 5',clearSelection:'Clear selection',
  addSelected:'Add selected files',cancel:'Cancel loading',loadingIndex:'Loading gas index…',
  indexUnavailable:'Cannot load the online index. Use GitHub Pages or start a local web server from the repository root.',
  noResults:'No matching gas files.',selected:'selected',results:'results',showing:'showing first',
  add:'Add',loaded:'Loaded',size:'Size',coverage:'Coverage',unknown:'Unknown',
  progress:'Loading',complete:'Files added',failed:'failed',skipped:'duplicates skipped',
  noSelection:'Select at least one gas file.',invalidPath:'The index contains an unsafe file path.',
  tooLarge:'The selected files exceed 200 MB. Reduce the selection.',hashMismatch:'SHA-256 verification failed',
  localOnly:'Online search is unavailable from a file:// address. Existing local file loading still works.',
  indexVersion:'Index',generated:'generated',remove:'Remove component',closeTitle:'Close search panel'
};

const state={files:[],components:[],results:[],selected:new Set(),summary:null,controller:null,indexLoaded:false};
const node=(tag,attrs={},html='')=>{
  const element=document.createElement(tag);
  Object.entries(attrs).forEach(([key,value])=>{
    if(key==='class')element.className=value;
    else if(key==='dataset')Object.assign(element.dataset,value);
    else element.setAttribute(key,value);
  });
  element.innerHTML=html;
  return element;
};
const esc=value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const attr=value=>esc(value).replace(/'/g,'&#39;');
const fmt=(value,digits=4)=>core.finite(value)?Number(Number(value).toFixed(digits)).toString():'—';
const basename=path=>String(path||'').split('/').pop()||'gas-file.gas';
const humanSize=value=>{
  if(!core.finite(value))return text.unknown;
  const units=['B','KB','MB','GB'];let number=Number(value),i=0;
  while(number>=1024&&i<units.length-1){number/=1024;i++;}
  return number.toFixed(i?1:0)+' '+units[i];
};

const style=node('style',{},`
.gas-library-launch{margin-top:10px}
.gas-library-dialog{width:min(1500px,96vw);height:min(900px,94vh);padding:0;border:1px solid #aebdca;border-radius:8px;background:#fff;color:#172033}
.gas-library-dialog::backdrop{background:rgba(13,24,39,.62)}
.gas-library-shell{height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto}
.gas-library-head,.gas-library-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #dbe3ef}
.gas-library-head h2{margin:0;font-size:18px}
.gas-library-close{width:36px;min-height:36px;padding:0;font-size:24px;line-height:1}
.gas-library-query{padding:12px 16px;border-bottom:1px solid #dbe3ef;background:#f8faff;display:grid;gap:10px}
.gas-library-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px}
.gas-library-group{display:grid;gap:7px;align-content:start}
.gas-library-group h3{margin:0;font-size:12px;text-transform:uppercase;color:#59677e}
.gas-library-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.gas-library-field{display:grid;gap:4px;font-size:11px;color:#59677e;font-weight:700}
.gas-library-field input,.gas-library-field select{min-width:0;width:100%}
.gas-library-components{display:grid;gap:6px}
.gas-library-component{display:grid;grid-template-columns:minmax(120px,1fr) 88px 88px 36px;gap:6px}
.gas-library-tools,.gas-library-select-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.gas-library-status{font-size:12px;color:#59677e;min-height:18px}
.gas-library-results{overflow:auto}
.gas-library-results table{min-width:1040px}
.gas-library-results th:first-child,.gas-library-results td:first-child{width:46px;text-align:center}
.gas-library-results tr.loaded{opacity:.62}
.gas-library-file{font-weight:700;word-break:break-all}
.gas-library-path{font:11px "SFMono-Regular",Consolas,monospace;color:#637087;word-break:break-all}
.gas-library-meta{font-size:11px;color:#59677e;line-height:1.55}
.gas-library-foot{border-top:1px solid #dbe3ef;border-bottom:0;flex-wrap:wrap}
.gas-library-foot .primary{min-width:150px}
@media(max-width:900px){.gas-library-grid{grid-template-columns:1fr}.gas-library-dialog{width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0}.gas-library-component{grid-template-columns:minmax(110px,1fr) 78px 78px 36px}}
`);
document.head.appendChild(style);

const dialog=node('dialog',{class:'gas-library-dialog'});
dialog.innerHTML=`
<div class="gas-library-shell">
  <header class="gas-library-head">
    <div><h2>${esc(text.title)}</h2><div id="gasLibraryIndexStatus" class="gas-library-status"></div></div>
    <button type="button" class="gas-library-close" aria-label="${attr(text.closeTitle)}" title="${attr(text.closeTitle)}">×</button>
  </header>
  <section class="gas-library-query">
    <div class="gas-library-tools">
      <label class="gas-library-field">${esc(text.mode)}<select id="gasLibraryMode"><option value="nearest">${esc(text.nearest)}</option><option value="range">${esc(text.range)}</option><option value="exact">${esc(text.exact)}</option></select></label>
      <label class="check"><input id="gasLibraryExactSet" type="checkbox"> ${esc(text.exactSet)}</label>
      <label class="gas-library-field">${esc(text.sort)}<select id="gasLibrarySort"><option value="overall">${esc(text.overall)}</option><option value="composition">${esc(text.mixSort)}</option><option value="temperature">${esc(text.tempSort)}</option><option value="pressure">${esc(text.pressureSort)}</option><option value="path">${esc(text.pathSort)}</option></select></label>
      <button id="gasLibraryRefresh" type="button">${esc(text.refresh)}</button>
      <a href="gas_file_search.html" target="_blank" rel="noopener">${esc(text.fullSearch)}</a>
    </div>
    <div class="gas-library-grid">
      <div class="gas-library-group">
        <h3>${esc(text.composition)}</h3>
        <div id="gasLibraryComponents" class="gas-library-components"></div>
        <div><button id="gasLibraryAddComponent" type="button">${esc(text.addComponent)}</button></div>
      </div>
      <div class="gas-library-group">
        <h3>${esc(text.conditions)}</h3>
        <div class="gas-library-fields">
          <label class="gas-library-field">${esc(text.temperature)}<div class="input-unit"><input id="gasLibraryTemperature" type="number" step="any"><select id="gasLibraryTemperatureUnit"><option>K</option><option>C</option><option>F</option></select></div></label>
          <label class="gas-library-field">${esc(text.temperatureTol)}<input id="gasLibraryTemperatureTolerance" type="number" min="0" step="any" value="5"></label>
          <label class="gas-library-field">${esc(text.pressure)}<div class="input-unit"><input id="gasLibraryPressure" type="number" min="0" step="any"><select id="gasLibraryPressureUnit"><option>atm</option><option>bar</option><option>mbar</option><option>Pa</option><option>kPa</option><option>Torr</option></select></div></label>
          <label class="gas-library-field">${esc(text.pressureTol)}<input id="gasLibraryPressureTolerance" type="number" min="0" step="any" value="10"></label>
        </div>
      </div>
      <div class="gas-library-group">
        <h3>${esc(text.filters)}</h3>
        <label class="gas-library-field">${esc(text.keywords)}<input id="gasLibraryText" type="search"></label>
        <label class="gas-library-field">${esc(text.quality)}<select id="gasLibraryQuality"><option value="">${esc(text.all)}</option><option value="ready">${esc(text.ready)}</option><option value="warning">${esc(text.warning)}</option></select></label>
      </div>
    </div>
    <div id="gasLibraryQueryStatus" class="gas-library-status"></div>
  </section>
  <section class="gas-library-results">
    <table>
      <thead><tr><th></th><th>${esc(text.composition)}</th><th>${esc(text.conditions)}</th><th>${esc(text.coverage)}</th><th>${esc(text.size)}</th><th>${esc(text.add)}</th></tr></thead>
      <tbody id="gasLibraryBody"></tbody>
    </table>
  </section>
  <footer class="gas-library-foot">
    <div>
      <div class="gas-library-select-tools">
        <button id="gasLibraryTop3" type="button">${esc(text.selectTop3)}</button>
        <button id="gasLibraryTop5" type="button">${esc(text.selectTop5)}</button>
        <button id="gasLibraryClear" type="button">${esc(text.clearSelection)}</button>
      </div>
      <div id="gasLibraryProgress" class="gas-library-status"></div>
    </div>
    <div class="gas-library-tools">
      <button id="gasLibraryCancel" type="button" class="hidden">${esc(text.cancel)}</button>
      <button id="gasLibraryAddSelected" type="button" class="primary">${esc(text.addSelected)}</button>
    </div>
  </footer>
</div>`;
document.body.appendChild(dialog);

const byId=id=>document.getElementById(id);
const componentsBox=byId('gasLibraryComponents');
const body=byId('gasLibraryBody');
const queryStatus=byId('gasLibraryQueryStatus');
const progress=byId('gasLibraryProgress');

function launchButton(){
  const button=node('button',{type:'button',class:'primary gas-library-launch'},esc(text.launch));
  button.addEventListener('click',openDialog);
  return button;
}
const firstPanel=document.querySelector('main > .panel');
if(firstPanel){
  const row=node('div',{class:'toolbar'});
  row.appendChild(launchButton());
  firstPanel.insertBefore(row,document.getElementById('status'));
}
const addFiles=document.getElementById('addFiles');
if(addFiles)addFiles.insertAdjacentElement('afterend',launchButton());

function componentOptions(selected=''){
  return '<option value="">'+esc(text.gas)+'</option>'+state.components.map(name=>'<option value="'+attr(name)+'"'+(name===selected?' selected':'')+'>'+esc(name)+'</option>').join('');
}

function addComponentRow(value={}){
  const row=node('div',{class:'gas-library-component'});
  row.innerHTML='<select class="gas-library-component-name" aria-label="'+attr(text.gas)+'">'+componentOptions(value.name)+'</select>'+
    '<input class="gas-library-fraction" type="number" min="0" max="100" step="any" placeholder="'+attr(text.fraction)+'" value="'+attr(value.fraction??'')+'">'+
    '<input class="gas-library-tolerance" type="number" min="0" max="100" step="any" placeholder="'+attr(text.tolerance)+'" value="'+attr(value.tolerance??5)+'">'+
    '<button type="button" class="gas-library-remove" title="'+attr(text.remove)+'" aria-label="'+attr(text.remove)+'">×</button>';
  componentsBox.appendChild(row);
}

function refreshComponentOptions(){
  componentsBox.querySelectorAll('.gas-library-component-name').forEach(select=>{
    const value=select.value;
    select.innerHTML=componentOptions(value);
    select.value=value;
  });
}

function numberValue(id){
  const value=byId(id).value.trim();
  return value===''?null:Number(value);
}

function readQuery(){
  const mode=byId('gasLibraryMode').value;
  const components=[...componentsBox.querySelectorAll('.gas-library-component')].map(row=>({
    name:row.querySelector('.gas-library-component-name').value,
    fraction:numberValueFrom(row.querySelector('.gas-library-fraction')),
    tolerance:Math.max(0,numberValueFrom(row.querySelector('.gas-library-tolerance'))??5)
  })).filter(item=>item.name);
  return {
    mode,
    components,
    exactSet:byId('gasLibraryExactSet').checked||mode==='exact',
    temperature:core.temperatureToK(numberValue('gasLibraryTemperature'),byId('gasLibraryTemperatureUnit').value),
    temperatureTolerance:Math.max(0,numberValue('gasLibraryTemperatureTolerance')??5),
    pressure:core.pressureToPa(numberValue('gasLibraryPressure'),byId('gasLibraryPressureUnit').value),
    pressureTolerance:Math.max(0,numberValue('gasLibraryPressureTolerance')??10),
    text:byId('gasLibraryText').value.trim().toLowerCase(),
    quality:byId('gasLibraryQuality').value,
    sort:byId('gasLibrarySort').value
  };
}
function numberValueFrom(input){return input.value.trim()===''?null:Number(input.value);}

function validateQuery(query){
  const names=query.components.map(item=>item.name);
  if(new Set(names).size!==names.length)return zh?'同一种气体只能选择一次。':'Each gas can be selected only once.';
  if(query.components.some(item=>core.finite(item.fraction)&&(item.fraction<0||item.fraction>100)))return zh?'气体比例必须在 0% 到 100% 之间。':'Gas fractions must be between 0% and 100%.';
  const complete=query.components.length&&query.components.every(item=>core.finite(item.fraction));
  const sum=query.components.reduce((value,item)=>value+(core.finite(item.fraction)?Number(item.fraction):0),0);
  if(query.exactSet&&complete&&Math.abs(sum-100)>.05)return (zh?'完整成分比例总和必须为 100%，当前为 ':'Exact fractions must total 100%; current total: ')+fmt(sum)+'%.';
  return '';
}

function coverageMarkup(file){
  const coverage=file.coverage||{},dims=coverage.dimensions||{};
  const ep=coverage.e_over_p_v_cm_torr||{},b=coverage.magnetic_field_t||{},angle=coverage.angle_rad||{};
  const lines=[];
  if(coverage.format_version)lines.push('Garfield v'+coverage.format_version+(coverage.gasok_bits?' · GASOK '+[...coverage.gasok_bits].filter(bit=>bit==='T').length+'/'+coverage.gasok_bits.length:''));
  if(core.finite(ep.min)&&core.finite(ep.max))lines.push('E/p '+fmt(ep.min)+'–'+fmt(ep.max));
  if(core.finite(b.min)&&core.finite(b.max))lines.push('B '+fmt(b.min)+'–'+fmt(b.max)+' T');
  if(core.finite(angle.min)&&core.finite(angle.max))lines.push('θ '+fmt(angle.min)+'–'+fmt(angle.max)+' rad');
  if(dims.electric_field_count)lines.push(dims.electric_field_count+'E × '+dims.magnetic_field_count+'B × '+dims.angle_count+'θ');
  return lines.join('<br>')||text.unknown;
}

function loadedKeys(){
  const sources=bridge.getLoadedSources?bridge.getLoadedSources():[];
  return new Set(sources.flatMap(item=>[item.sha256&&'sha:'+item.sha256,item.path&&'path:'+item.path].filter(Boolean)));
}
function isLoaded(file){
  const keys=loadedKeys();
  return !!((file.sha256&&keys.has('sha:'+file.sha256))||(file.path&&keys.has('path:'+file.path)));
}

function applySearch(){
  if(!state.indexLoaded)return;
  const query=readQuery(),error=validateQuery(query);
  queryStatus.textContent=error;
  if(error){state.results=[];renderResults();return;}
  state.results=state.files.map(file=>{
    const metrics=core.evaluate(file,query);
    return metrics?{file,metrics}:null;
  }).filter(Boolean);
  core.sortResults(state.results,query);
  renderResults();
}

function renderResults(){
  const visible=state.results.slice(0,100);
  const loaded=loadedKeys();
  body.innerHTML=visible.map((result,index)=>{
    const file=result.file,already=(file.sha256&&loaded.has('sha:'+file.sha256))||(file.path&&loaded.has('path:'+file.path));
    const checked=state.selected.has(file.path);
    const mix=(file.components||[]).map(item=>esc(item.name)+' '+(core.finite(item.fraction)?fmt(item.fraction)+'%':'?')).join(' / ')||text.unknown;
    const condition=(file.temperature?'T='+esc(file.temperature):'T ?')+'<br>'+(file.pressure?'p='+esc(file.pressure):'p ?');
    return '<tr class="'+(already?'loaded':'')+'">'+
      '<td><input type="checkbox" data-library-select="'+attr(file.path)+'" '+(checked?'checked ':'')+(already?'disabled ':'')+'aria-label="'+attr(text.add)+'"></td>'+
      '<td><div class="gas-library-file">'+mix+'</div><div class="gas-library-path">'+esc(file.path)+'</div></td>'+
      '<td class="gas-library-meta">'+condition+'</td>'+
      '<td class="gas-library-meta">'+coverageMarkup(file)+'</td>'+
      '<td class="gas-library-meta">'+humanSize(file.size_bytes)+'</td>'+
      '<td class="gas-library-meta">'+(already?esc(text.loaded):'#'+(index+1))+'</td>'+
      '</tr>';
  }).join('');
  if(!visible.length)body.innerHTML='<tr><td colspan="6">'+esc(text.noResults)+'</td></tr>';
  progress.textContent=state.selected.size+' '+text.selected+' · '+state.results.length+' '+text.results+(state.results.length>100?' · '+text.showing+' 100':'');
}

async function loadIndex(force=false){
  if(state.indexLoaded&&!force)return;
  byId('gasLibraryIndexStatus').textContent=text.loadingIndex;
  const response=await fetch('GasFile/gas_index.json?refresh='+(force?Date.now():'current'),{cache:force?'no-store':'default'});
  if(!response.ok)throw new Error(response.status+' '+response.statusText);
  const data=await response.json();
  if((data.schema_version||0)<2)throw new Error('schema v2 or newer required');
  state.files=data.files||[];state.summary=data.summary||{};state.indexLoaded=true;
  state.components=Object.keys(state.summary.component_counts||{}).sort((a,b)=>a.localeCompare(b));
  refreshComponentOptions();
  byId('gasLibraryIndexStatus').textContent=text.indexVersion+' v'+data.schema_version+' · '+state.files.length+' files · '+text.generated+' '+(state.summary.generated_at_utc||text.unknown);
  applySearch();
}

async function openDialog(){
  if(!dialog.open)dialog.showModal();
  if(location.protocol==='file:'){
    queryStatus.textContent=text.localOnly;
    return;
  }
  try{await loadIndex(false);}catch(error){queryStatus.textContent=text.indexUnavailable+' '+error.message;}
}

function safeFile(file){
  if(!file||typeof file.path!=='string'||!file.path.startsWith('GasFile/')||file.path.includes('..')||file.path.includes('\\')||/[?#]/.test(file.path))throw new Error(text.invalidPath);
  const url=new URL(file.path,document.baseURI);
  if(/^https?:$/.test(location.protocol)&&url.origin!==location.origin)throw new Error(text.invalidPath);
  return url;
}

async function sha256(bytes){
  if(!crypto?.subtle)return null;
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function addSelected(){
  const files=[...state.selected].map(path=>state.files.find(file=>file.path===path)).filter(Boolean).filter(file=>!isLoaded(file));
  if(!files.length){progress.textContent=text.noSelection;return;}
  const total=files.reduce((sum,file)=>sum+(Number(file.size_bytes)||0),0);
  if(total>200*1024*1024){progress.textContent=text.tooLarge;return;}
  state.controller=new AbortController();
  byId('gasLibraryCancel').classList.remove('hidden');
  byId('gasLibraryAddSelected').disabled=true;
  const entries=[],failures=[];let cursor=0,done=0;
  const worker=async()=>{
    while(cursor<files.length){
      const file=files[cursor++];
      try{
        const url=safeFile(file);
        const response=await fetch(url,{signal:state.controller.signal});
        if(!response.ok)throw new Error(response.status+' '+response.statusText);
        const bytes=await response.arrayBuffer();
        const digest=await sha256(bytes);
        const rawText=new TextDecoder().decode(bytes);
        if(file.sha256&&digest&&digest!==file.sha256)throw new Error(text.hashMismatch);
        entries.push({
          fileName:file.file_name||basename(file.path),
          rawText,
          sourceType:'repository',
          sourcePath:file.path,
          sourceSha256:file.sha256||digest||'',
          indexGeneratedAt:state.summary?.generated_at_utc||'',
          indexedMetadata:{
            components:file.components||[],
            temperatureK:file.temperature_k,
            pressurePa:file.pressure_pa,
            coverage:file.coverage||null
          }
        });
      }catch(error){
        if(error.name!=='AbortError')failures.push(file.path+': '+error.message);
      }finally{
        done++;progress.textContent=text.progress+' '+done+'/'+files.length+(failures.length?' · '+text.failed+' '+failures.length:'');
      }
    }
  };
  await Promise.all(Array.from({length:Math.min(3,files.length)},worker));
  let result={ok:0,skipped:0,failures:[]};
  if(entries.length)result=await bridge.addGasTexts(entries);
  state.controller=null;
  byId('gasLibraryCancel').classList.add('hidden');
  byId('gasLibraryAddSelected').disabled=false;
  state.selected.clear();
  applySearch();
  progress.textContent=text.complete+': '+result.ok+' · '+text.skipped+': '+result.skipped+' · '+text.failed+': '+(failures.length+(result.failures?.length||0));
}

function selectTop(count){
  state.selected.clear();
  state.results.filter(result=>!isLoaded(result.file)).slice(0,count).forEach(result=>state.selected.add(result.file.path));
  renderResults();
}

dialog.querySelector('.gas-library-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('cancel',event=>{if(state.controller){event.preventDefault();state.controller.abort();}else dialog.close();});
byId('gasLibraryAddComponent').addEventListener('click',()=>{addComponentRow();});
componentsBox.addEventListener('click',event=>{const button=event.target.closest('.gas-library-remove');if(button){button.closest('.gas-library-component').remove();if(!componentsBox.children.length)addComponentRow();applySearch();}});
dialog.querySelector('.gas-library-query').addEventListener('input',()=>{clearTimeout(applySearch.timer);applySearch.timer=setTimeout(applySearch,80);});
body.addEventListener('change',event=>{const input=event.target.closest('[data-library-select]');if(!input)return;input.checked?state.selected.add(input.dataset.librarySelect):state.selected.delete(input.dataset.librarySelect);renderResults();});
byId('gasLibraryRefresh').addEventListener('click',async()=>{try{await loadIndex(true);}catch(error){queryStatus.textContent=text.indexUnavailable+' '+error.message;}});
byId('gasLibraryTop3').addEventListener('click',()=>selectTop(3));
byId('gasLibraryTop5').addEventListener('click',()=>selectTop(5));
byId('gasLibraryClear').addEventListener('click',()=>{state.selected.clear();renderResults();});
byId('gasLibraryAddSelected').addEventListener('click',addSelected);
byId('gasLibraryCancel').addEventListener('click',()=>state.controller?.abort());

addComponentRow();
addComponentRow();

async function openFromQuery(){
  const paths=new URL(location.href).searchParams.getAll('gas').filter(Boolean);
  if(!paths.length)return;
  await openDialog();
  if(!state.indexLoaded)return;
  paths.filter(path=>state.files.some(file=>file.path===path)).forEach(path=>state.selected.add(path));
  renderResults();
  if(state.selected.size)await addSelected();
}
openFromQuery().catch(error=>{queryStatus.textContent=error.message;});
})();
