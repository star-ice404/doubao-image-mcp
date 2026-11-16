import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkRelease,ROOT} from './release-check.mjs';
const files=await checkRelease();
const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
const dest=path.join(ROOT,'dist',`${pkg.name}-${pkg.version}-source`);
await fs.mkdir(dest,{recursive:true});
if((await fs.readdir(dest)).length)throw new Error('Release staging directory is not empty; inspect it before rebuilding.');
const hashes=[];
for(const file of files){const bytes=await fs.readFile(path.join(ROOT,file));const target=path.join(dest,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${file}`);}
await fs.writeFile(path.join(dest,'SHA256SUMS'),hashes.join('\n')+'\n');
console.log(JSON.stringify({ok:true,source_directory:dest,files:files.length},null,2));
