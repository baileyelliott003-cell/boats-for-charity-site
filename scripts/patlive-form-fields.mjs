// Add PATLive-approved metadata to the actual Netlify form payload.
// Values and labels must come from PATLive; this script has no guessed defaults.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function patchForms(html,fields){
 if(!Array.isArray(fields)||fields.length!==2||new Set(fields.map(f=>f.name)).size!==2)throw Error('Two distinct approved fields required');
 for(const f of fields)if(!/^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(f.name)||['subject','form-name','bot-field'].includes(f.name)||typeof f.value!=='string'||!f.value.trim()||/[\r\n\x00]/.test(f.value))throw Error('Approved field name and nonempty single-line value required');
 let count=0;
 const output=html.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi,form=>{
  if(!/^<form\b[^>]*\bname=["']donationForm["']/i.test(form))return form;
  count++;
  if(fields.every(f=>form.includes('<input type="hidden" name="'+escape(f.name)+'" value="'+escape(f.value)+'">')))return form;
  for(const f of fields){
   const name=f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(new RegExp('\\bname=["\']'+name+'["\']','i').test(form))throw Error('Field already exists: '+f.name);
  }
  return form.replace(/(<form\b[^>]*>)/i,'$1\n'+fields.map(f=>'          <input type="hidden" name="'+escape(f.name)+'" value="'+escape(f.value)+'">').join('\n'));
 });
 return {html:output,count};
}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(['.git','node_modules'].includes(e.name)?[]:files(join(dir,e.name))):e.name.endsWith('.html')?[join(dir,e.name)]:[]);}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [root,configFile,...flags]=process.argv.slice(2);
 if(!root||!configFile)throw Error('Usage: node scripts/patlive-form-fields.mjs ROOT APPROVED_CONFIG.json [--apply]');
 const fields=JSON.parse(readFileSync(configFile,'utf8'));
 // Validate every page before writing any page.
 const changes=files(root).map(path=>({path,...patchForms(readFileSync(path,'utf8'),fields)})).filter(x=>x.count);
 if(!changes.length)throw Error('No donation forms found');
 if(flags.includes('--apply'))for(const change of changes)writeFileSync(change.path,change.html);
 console.log(JSON.stringify({forms:changes.reduce((n,c)=>n+c.count,0),pages:changes.length,applied:flags.includes('--apply')}));
}
