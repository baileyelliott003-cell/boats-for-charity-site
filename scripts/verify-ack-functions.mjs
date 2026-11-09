import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const names=(await fs.readdir(path.join(root,'netlify/functions'))).filter(name=>name.endsWith('.ts'));
for(const name of names)await build({entryPoints:[path.join(root,'netlify/functions',name)],bundle:true,packages:'external',platform:'node',format:'esm',write:false,logLevel:'silent'});
console.log(JSON.stringify({functionsBundled:names.length,functionNames:names,networkRequests:0,liveDatabaseRequests:0,deployment:false}));
