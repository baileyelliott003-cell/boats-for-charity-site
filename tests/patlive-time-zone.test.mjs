import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=readFileSync(new URL('../patlive-fields.v1.js',import.meta.url),'utf8');
test('each donor device supplies its own time zone on native and AJAX submission',()=>{
 for(const zone of ['America/Los_Angeles','America/New_York','America/Phoenix','Europe/London']){
  const fields={campaign_id:{value:''},time_zone:{value:''}},listeners={};
  const form={querySelector:s=>fields[s.match(/name="([^"]+)"/)[1]],addEventListener:(name,fn)=>listeners[name]=fn};
  vm.runInNewContext(script,{Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})})},document:{readyState:'complete',querySelectorAll:()=>[form]}});
  assert.equal(fields.campaign_id.value,'YQHYVVOD');assert.equal(fields.time_zone.value,zone);
  fields.time_zone.value='wrong';listeners.submit();assert.equal(fields.time_zone.value,zone);
  const data=new Map();listeners.formdata({formData:data});assert.equal(data.get('time_zone'),zone);assert.equal(data.get('campaign_id'),'YQHYVVOD');
 }
});
test('unavailable device detection is explicit and never invents a donor location',()=>{
 const fields={campaign_id:{},time_zone:{}};
 vm.runInNewContext(script,{Intl:{DateTimeFormat:()=>{throw Error('unavailable')}},document:{readyState:'complete',querySelectorAll:()=>[{querySelector:s=>fields[s.match(/name="([^"]+)"/)[1]],addEventListener(){}}]}});
 assert.equal(fields.time_zone.value,'Not detected');
});
test('all static donation forms declare notification fields and load the detector',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(['.git','node_modules'].includes(e.name)?[]:walk(join(p,e.name))):e.name.endsWith('.html')?[join(p,e.name)]:[]);
 let count=0;
 for(const path of walk(root)){const html=readFileSync(path,'utf8');for(const form of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi))if(/^<form\b[^>]*\bname=["']donationForm["']/i.test(form[0])){
  count++;assert.match(form[0],/name="campaign_id" value="YQHYVVOD"/,path);assert.match(form[0],/name="time_zone" value="Not detected"/,path);assert.match(html,/src="\/patlive-fields.v1.js"/,path);
 }}assert.equal(count,53);
});
