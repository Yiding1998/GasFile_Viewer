(function(root, factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GarfieldGasParser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const FLOAT_RE=/[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[EeDd][+-]?\d+)?/g;
  const DEFAULT_MESSAGES={
    missingMarker:'The “The gas tables follow” marker was not found.',
    missingFooter:'The “H Extr” footer was not found.',
    missingDimension:'Could not parse the Dimension line.',
    incompleteGrid:'Grid data are incomplete.',
    insufficientValues:({actual,expected})=>`Insufficient gas-table values: ${actual}/${expected}`,
    unevenRecordValues:({actual,count,expected})=>`Gas-table values cannot be divided into ${count} records: ${actual} values, expected at least ${expected}.`
  };

  function numbers(text){
    return (text.match(FLOAT_RE)||[]).map(value=>Number(value.replace(/[Dd]/,'E')));
  }

  function first(text,pattern,fallback=''){
    const match=text.match(pattern);
    return match?match[1].trim():fallback;
  }

  function section(text,startPattern,endPattern){
    startPattern.lastIndex=0;
    const start=startPattern.exec(text);
    if(!start)return'';
    const rest=text.slice(start.index+start[0].length);
    endPattern.lastIndex=0;
    const end=endPattern.exec(rest);
    return end?rest.slice(0,end.index):rest;
  }

  function parseLevels(header,kind){
    const pattern=kind==='exc'
      ?/^\s*Excitation\s+(\d+)\s*:\s*"([^"]*)"\s*(.*)$/gmi
      :/^\s*Ionisation\s+(\d+)\s*:\s*"([^"]*)"\s*(.*)$/gmi;
    const levels=[];
    let match;
    while((match=pattern.exec(header))){
      const values=numbers(match[3]);
      levels.push(kind==='exc'?{
        index:+match[1],
        label:match[2].trim(),
        energy:values[0]??NaN,
        penningProbability:values[1]??0,
        penningRms:values[2]??0,
        decayTime:values[3]??0
      }:{
        index:+match[1],
        label:match[2].trim(),
        energy:values[0]??NaN
      });
    }
    return levels;
  }

  function message(messages,key,details){
    const value=messages[key];
    return typeof value==='function'?value(details):value;
  }

  function parse(text,fileName,options={}){
    const messages={...DEFAULT_MESSAGES,...(options.messages||{})};
    const marker=/\s*The gas tables follow:\s*/i.exec(text);
    if(!marker)throw Error(message(messages,'missingMarker'));

    const header=text.slice(0,marker.index);
    const footerStart=text.search(/^\s*H\s+Extr\s*:/mi);
    if(footerStart<0)throw Error(message(messages,'missingFooter'));
    const tableText=text.slice(marker.index+marker[0].length,footerStart);
    const footer=text.slice(footerStart);

    const version=+first(header,/Version\s*:\s*(\d+)/i,'0');
    const gasBits=first(header,/GASOK\s+bits\s*:\s*([TF]+)/i,'');
    const identifier=first(
      header,
      /Identifier\s*:\s*([^\r\n]*)/i,
      options.identifierFallback||''
    );
    const dimension=header.match(
      /Dimension\s*:\s*([TF])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i
    );
    if(!dimension)throw Error(message(messages,'missingDimension'));

    const map2d=dimension[1].toUpperCase()==='T';
    const nE=+dimension[2];
    const nAngles=+dimension[3];
    const nB=+dimension[4];
    const nExc=+dimension[5];
    const nIon=+dimension[6];
    const eOverP=numbers(section(header,/E\s+fields\s*/ig,/E-B\s+angles/ig)).slice(0,nE);
    const angles=numbers(section(header,/E-B\s+angles\s*/ig,/B\s+fields/ig)).slice(0,nAngles);
    const bRaw=numbers(section(header,/B\s+fields\s*/ig,/Mixture\s*:/ig)).slice(0,nB);
    const mixture=numbers(section(
      header,
      /Mixture\s*:\s*/ig,
      /(?:^\s*Excitation\s+\d+\s*:|^\s*Ionisation\s+\d+\s*:|The gas tables follow:)/gmi
    )).slice(0,60);
    if(eOverP.length!==nE||angles.length!==nAngles||bRaw.length!==nB){
      throw Error(message(messages,'incompleteGrid'));
    }

    const pressure=Number(first(footer,/PGAS\s*=\s*([+\-\d.EeDd]+)/i,'760').replace(/[Dd]/,'E'));
    const temperature=Number(first(footer,/TGAS\s*=\s*([+\-\d.EeDd]+)/i,'293.15').replace(/[Dd]/,'E'));
    const numberDensity=pressure*133.32236842105263/(1.380649e-23*temperature);
    const excitationLevels=parseLevels(header,'exc');
    const ionisationLevels=parseLevels(header,'ion');
    const values=numbers(tableText);
    const recordSize=map2d?17+nExc+nIon:33+2*(nExc+nIon);
    const recordCount=nE*nAngles*nB;
    const expected=recordSize*recordCount;
    if(values.length<expected){
      throw Error(message(messages,'insufficientValues',{actual:values.length,expected}));
    }

    const extraValues=values.length-expected;
    if(recordCount===0||extraValues%recordCount!==0){
      throw Error(message(messages,'unevenRecordValues',{
        actual:values.length,
        count:recordCount,
        expected
      }));
    }
    const extraValuesPerRecord=extraValues/recordCount;
    const actualRecordSize=recordSize+extraValuesPerRecord;
    const records=[];
    let q=0;

    for(let ie=0;ie<nE;ie++)for(let ia=0;ia<nAngles;ia++)for(let ib=0;ib<nB;ib++){
      const recordStart=q;
      const take=()=>values[q++];
      const pair=()=>({value:take(),error:take()});
      let raw;
      if(map2d){
        raw={
          ve:take(),vb:take(),vexb:take(),dl:take(),dt:take(),alpha:take(),alpha0:take(),eta:take(),
          mu:take(),lorentz:take(),dissociation:take(),tensor:Array.from({length:6},take),
          excitationRates:Array.from({length:nExc},take),ionisationRates:Array.from({length:nIon},take),
          errors:null
        };
      }else{
        const ve=pair(),vb=pair(),vexb=pair(),dl=pair(),dt=pair(),alpha=pair();
        const alpha0=take(),eta=pair(),mu=pair(),lorentz=pair(),dissociation=pair();
        const tensorPairs=Array.from({length:6},pair);
        const excitationPairs=Array.from({length:nExc},pair);
        const ionisationPairs=Array.from({length:nIon},pair);
        raw={
          ve:ve.value,vb:vb.value,vexb:vexb.value,dl:dl.value,dt:dt.value,
          alpha:alpha.value,alpha0,eta:eta.value,mu:mu.value,lorentz:lorentz.value,
          dissociation:dissociation.value,tensor:tensorPairs.map(item=>item.value),
          excitationRates:excitationPairs.map(item=>item.value),
          ionisationRates:ionisationPairs.map(item=>item.value),
          errors:{
            ve:ve.error,vb:vb.error,vexb:vexb.error,dl:dl.error,dt:dt.error,
            alpha:alpha.error,eta:eta.error,mu:mu.error,lorentz:lorentz.error,
            dissociation:dissociation.error,tensor:tensorPairs.map(item=>item.error),
            excitationRates:excitationPairs.map(item=>item.error),
            ionisationRates:ionisationPairs.map(item=>item.error)
          }
        };
      }

      const extensionValues=values.slice(recordStart+recordSize,recordStart+actualRecordSize);
      q=recordStart+actualRecordSize;
      const E=eOverP[ie]*pressure;
      const EoverN=E*100/numberDensity/1e-21;
      const safeExp=value=>value<-745?0:Math.exp(value);
      const alphaReduced=safeExp(raw.alpha);
      const alpha0Reduced=safeExp(raw.alpha0);
      const etaReduced=safeExp(raw.eta);
      const alpha=pressure*alphaReduced;
      const alpha0=pressure*alpha0Reduced;
      const eta=pressure*etaReduced;
      const sqrtPressure=Math.sqrt(pressure);
      const dl=raw.dl/sqrtPressure;
      const dt=raw.dt/sqrtPressure;
      records.push({
        ie,ia,ib,raw,extensionValues,
        EoverP:eOverP[ie],E,EoverN,
        angleRad:angles[ia],angleDeg:angles[ia]*180/Math.PI,
        Braw:bRaw[ib],BTesla:bRaw[ib]/100,
        veCmUs:raw.ve,veCmNs:raw.ve*1e-3,vbCmNs:raw.vb*1e-3,vexbCmNs:raw.vexb*1e-3,
        dlSqrtCm:dl,dtSqrtCm:dt,dlUmSqrtCm:dl*1e4,dtUmSqrtCm:dt*1e4,
        alpha,alpha0,eta,alphaEff:alpha-eta,
        alphaReduced,alpha0Reduced,etaReduced,alphaEffReduced:alphaReduced-etaReduced,
        alphaOverN:alpha/(numberDensity/1e6),etaOverN:eta/(numberDensity/1e6),
        alphaEffOverN:(alpha-eta)/(numberDensity/1e6),
        electronMobility:E?raw.ve*1e6/E:NaN,
        dlOverV:raw.ve?dl/(raw.ve*1e-3):NaN,
        dtOverV:raw.ve?dt/(raw.ve*1e-3):NaN,
        ionMobilityCm2Vs:raw.mu*1e6,
        lorentz:raw.lorentz,
        ionDissociation:pressure*safeExp(raw.dissociation),
        tensor:raw.tensor.map(value=>value/pressure),
        excitationTotal:raw.excitationRates.reduce((sum,value)=>sum+value,0),
        ionisationTotal:raw.ionisationRates.reduce((sum,value)=>sum+value,0)
      });
    }

    return{
      fileName,rawText:text,header,footer,version,gasBits,identifier,map2d,
      nE,nAngles,nB,nExc,nIon,pressure,temperature,numberDensity,eOverP,angles,bRaw,mixture,
      excitationLevels,ionisationLevels,records,recordSize,actualRecordSize,
      expectedValues:expected,parsedValues:values.length,extraValues,extraValuesPerRecord
    };
  }

  return Object.freeze({parse,parseLevels,numbers});
});
