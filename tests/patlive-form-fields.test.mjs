import test from 'node:test';
import assert from 'node:assert/strict';
import {patchForms} from '../scripts/patlive-form-fields.mjs';
const fields=[{name:'Campaign ID',value:'SYNTHETIC-ONLY'},{name:'Time Zone',value:'TEST-ZONE'}];
test('metadata becomes actual form inputs without changing subject or other forms',()=>{
 const html='<form name="donationForm" method="POST"><input name="subject" value="keep subject"><input name="phone"></form><form name="boatPhotoUpload"><input name="upload"></form>';
 const result=patchForms(html,fields);assert.equal(result.count,1);
 assert.match(result.html,/<input type="hidden" name="Campaign ID" value="SYNTHETIC-ONLY">/);
 assert.match(result.html,/<input type="hidden" name="Time Zone" value="TEST-ZONE">/);
 assert.ok(result.html.endsWith('<form name="boatPhotoUpload"><input name="upload"></form>'));
 assert.match(result.html,/name="subject" value="keep subject"/);
 assert.equal(patchForms(result.html,fields).html,result.html);
 assert.throws(()=>patchForms(result.html,[{...fields[0],value:'CONFLICT'},fields[1]]),/already exists/);
});
test('missing configuration fails rather than deploying guessed routing values',()=>{
 assert.throws(()=>patchForms('',[]));assert.throws(()=>patchForms('',[fields[0],{name:'Time Zone',value:''}]));
 assert.throws(()=>patchForms('',[{name:'subject',value:'bad'},fields[1]]));
});
