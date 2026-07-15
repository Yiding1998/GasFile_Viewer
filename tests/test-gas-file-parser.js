'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const parser=require('../gas-file-parser.js');

const root=path.resolve(__dirname,'..');
const gasRoot=path.join(root,'GasFile');

function gasFiles(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const fullPath=path.join(directory,entry.name);
    if(entry.isDirectory())return gasFiles(fullPath);
    return ['.json','.md','.pdf'].includes(path.extname(entry.name).toLowerCase())?[]:[fullPath];
  });
}

const files=gasFiles(gasRoot);
assert.ok(files.length>0,'No gas files found for parser regression testing.');

for(const file of files){
  const gas=parser.parse(fs.readFileSync(file,'utf8'),path.basename(file));
  assert.equal(gas.records.length,gas.nE*gas.nAngles*gas.nB,file);
  assert.equal(gas.parsedValues,gas.actualRecordSize*gas.records.length,file);
  assert.equal(gas.extraValues,gas.extraValuesPerRecord*gas.records.length,file);
}

const extendedFixture=path.join(
  gasRoot,
  'RPCgas_Typical','Other_Gas_Mixtures','ic4h10_1013mbar_100-100kVcm.gas'
);
const extended=parser.parse(fs.readFileSync(extendedFixture,'utf8'),path.basename(extendedFixture));
assert.equal(extended.extraValuesPerRecord,8);
assert.equal(extended.actualRecordSize,extended.recordSize+8);
assert.equal(extended.records[0].extensionValues.length,8);
assert.equal(extended.records[1].raw.ve,0.39443913);

const regularFixture=path.join(
  gasRoot,
  'RPCgas_Typical','Different_GasFraction','c2h2f4_ic4h10_sf6_90_5_5.gas'
);
const regular=parser.parse(fs.readFileSync(regularFixture,'utf8'),path.basename(regularFixture));
assert.equal(regular.extraValuesPerRecord,0);
assert.equal(regular.actualRecordSize,regular.recordSize);

console.log(`Shared gas parser validated ${files.length} files.`);
