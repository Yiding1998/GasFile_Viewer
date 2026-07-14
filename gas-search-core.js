(function(global){
'use strict';

const ATM_PA=101325;
const PRESSURE_FACTORS={atm:ATM_PA,bar:100000,mbar:100,Pa:1,kPa:1000,Torr:ATM_PA/760};
const finite=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value));

function temperatureToK(value,unit){
  if(!finite(value))return null;
  const number=Number(value);
  if(unit==='C')return number+273.15;
  if(unit==='F')return (number-32)*5/9+273.15;
  return number;
}

function pressureToPa(value,unit){
  if(!finite(value)||Number(value)<=0)return null;
  return Number(value)*(PRESSURE_FACTORS[unit]||1);
}

function fileComponentMap(file){
  const map=new Map();
  (file.components||[]).forEach(item=>map.set(item.name,item.fraction));
  return map;
}

function evaluate(file,query){
  if(query.text){
    const terms=String(query.text).toLowerCase().split(/[\s,;+]+/).filter(Boolean);
    const hay=String(file.search_text||'').toLowerCase();
    if(!terms.every(term=>hay.includes(term)))return null;
  }
  if(query.quality==='ready'&&!file.match_ready)return null;
  if(query.quality==='warning'&&file.data_quality!=='warning')return null;

  const names=file.component_names||[];
  if((query.components||[]).some(item=>!names.includes(item.name)))return null;
  if(query.exactSet&&query.components.length&&names.length!==query.components.length)return null;

  const map=fileComponentMap(file);
  const fractionTargets=query.components.filter(item=>finite(item.fraction));
  const componentDiffs=[];
  for(const target of fractionTargets){
    const actual=map.get(target.name);
    if(!finite(actual))return null;
    componentDiffs.push({
      name:target.name,
      signed:Number(actual)-Number(target.fraction),
      absolute:Math.abs(Number(actual)-Number(target.fraction)),
      tolerance:Number(target.tolerance)
    });
  }

  let compositionDelta=null;
  if(componentDiffs.length){
    const sumAbs=componentDiffs.reduce((sum,item)=>sum+item.absolute,0);
    const complete=query.exactSet&&fractionTargets.length===query.components.length;
    compositionDelta=complete?sumAbs/2:sumAbs/componentDiffs.length;
  }

  let temperatureSigned=null;
  if(finite(query.temperature)){
    if(!finite(file.temperature_k))return null;
    temperatureSigned=Number(file.temperature_k)-Number(query.temperature);
  }

  let pressureSignedPct=null;
  if(finite(query.pressure)){
    if(!finite(file.pressure_pa)||Number(file.pressure_pa)<=0)return null;
    pressureSignedPct=(Number(file.pressure_pa)-Number(query.pressure))/Number(query.pressure)*100;
  }

  if(query.mode==='range'){
    if(componentDiffs.some(item=>item.absolute>item.tolerance+1e-9))return null;
    if(finite(temperatureSigned)&&Math.abs(temperatureSigned)>Number(query.temperatureTolerance)+1e-9)return null;
    if(finite(pressureSignedPct)&&Math.abs(pressureSignedPct)>Number(query.pressureTolerance)+1e-9)return null;
  }
  if(query.mode==='exact'){
    if(componentDiffs.some(item=>item.absolute>1e-6))return null;
    if(finite(temperatureSigned)&&Math.abs(temperatureSigned)>1e-6)return null;
    if(finite(pressureSignedPct)&&Math.abs(pressureSignedPct)>1e-6)return null;
  }

  const scoreParts=[];
  if(finite(compositionDelta)){
    const scale=componentDiffs.reduce((sum,item)=>sum+Math.max(Number(item.tolerance),.01),0)/componentDiffs.length;
    scoreParts.push({value:compositionDelta/scale,weight:2});
  }
  if(finite(temperatureSigned))scoreParts.push({value:Math.abs(temperatureSigned)/Math.max(Number(query.temperatureTolerance),.01),weight:1});
  if(finite(pressureSignedPct))scoreParts.push({value:Math.abs(pressureSignedPct)/Math.max(Number(query.pressureTolerance),.01),weight:1});
  const weight=scoreParts.reduce((sum,item)=>sum+item.weight,0);
  const score=weight?scoreParts.reduce((sum,item)=>sum+item.value*item.weight,0)/weight:0;

  return {
    score,
    compositionDelta,
    componentDiffs,
    temperatureSigned,
    pressureSignedPct,
    extraComponents:Math.max(0,names.length-query.components.length)
  };
}

function metricValue(result,key){
  const metrics=result.metrics;
  if(key==='composition')return finite(metrics.compositionDelta)?Number(metrics.compositionDelta):Infinity;
  if(key==='temperature')return finite(metrics.temperatureSigned)?Math.abs(Number(metrics.temperatureSigned)):Infinity;
  if(key==='pressure')return finite(metrics.pressureSignedPct)?Math.abs(Number(metrics.pressureSignedPct)):Infinity;
  if(key==='overall')return Number(metrics.score);
  return result.file.path||'';
}

function sortResults(results,query){
  results.sort((a,b)=>{
    if(query.sort==='path')return (a.file.path||'').localeCompare(b.file.path||'',undefined,{numeric:true});
    const primary=metricValue(a,query.sort)-metricValue(b,query.sort);
    if(Number.isFinite(primary)&&Math.abs(primary)>1e-12)return primary;
    if(!Number.isFinite(primary)){
      const av=metricValue(a,query.sort),bv=metricValue(b,query.sort);
      if(av!==bv)return av===Infinity?1:-1;
    }
    const overall=Number(a.metrics.score)-Number(b.metrics.score);
    if(Math.abs(overall)>1e-12)return overall;
    return (a.file.path||'').localeCompare(b.file.path||'',undefined,{numeric:true});
  });
  return results;
}

global.GasSearchCore=Object.freeze({
  ATM_PA,
  PRESSURE_FACTORS,
  finite,
  temperatureToK,
  pressureToPa,
  evaluate,
  sortResults
});
})(window);
