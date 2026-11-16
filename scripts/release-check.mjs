import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function checkRelease(){
  const files=JSON.parse(await fs.readFile(path.join(ROOT,'release-files.json'),'utf8'));
  const issues=[];
  const patterns=[[/[A-Za-z]:[\\/]Users[\\/]/i,'personal Windows path'],[/D:[\\/]sillytavern/i,'local workspace path'],[/https?:\/\/[^\s"<>]*[?&]x-signature=/i,'signed image URL'],[/\/chat\/\d{8,}/,'private conversation URL'],[/seedream5\.5Pro/,'obsolete model name'],[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,'private key']];
  for(const file of files){
    if(path.isAbsolute(file)||file.split('/').includes('..'))throw new Error('Invalid release manifest path');
    const text=await fs.readFile(path.join(ROOT,file),'utf8');
    if(/\.(png|jpe?g|webp|avif|log)$/i.test(file)||/^(outputs|node_modules|profile|dist)\//.test(file))issues.push(`${file}: excluded artifact`);
    // The checker contains its own detection patterns; exclude it from content matching only.
    if(file!=='scripts/release-check.mjs')for(const [re,label]of patterns)if(re.test(text))issues.push(`${file}: ${label}`);
  }
  if(issues.length)throw new Error(issues.join('\n'));
  return files;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const files=await checkRelease(); console.log(JSON.stringify({ok:true,allowlisted_files:files.length,note:'Deterministic pattern and allowlist checks; review any new files before publishing.'},null,2));
}
