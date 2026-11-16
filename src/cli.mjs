import { DoubaoBrowser, EGO_STATE } from './browser.mjs';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const cmd=process.argv[2]??'status';
try {
 if(cmd==='setup'){
   // Reuse the installed ego runtime, which owns the existing persistent login profile.
   const candidates=[process.env.DOUBAO_EGO_CLI,path.join(process.env.DSH_HOME??path.join(os.homedir(),'.dsh'),'profiles','desktop','node_modules','dsh-ego-browser','runtime','ego-linux','bin','ego-browser.mjs')].filter(Boolean);
   let cli;for(const p of candidates){try{await fs.access(p);cli=p;break;}catch{}}
   if(!cli)throw new Error('未找到 ego-browser runtime；在 Harness 调用 ego_status 启动浏览器，或设置 DOUBAO_EGO_CLI');
   const child=spawn(process.execPath,[cli,'--status'],{stdio:'inherit'});
   const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});if(exit!==0)throw new Error(`ego-browser exit ${exit}`);
   console.log(JSON.stringify({browser_state:EGO_STATE,next:'运行 npm run status，在浏览器完成豆包登录。'}));
 }else{
   const browser=new DoubaoBrowser();let result;
   if(cmd==='status')result=await browser.status();
   else if(cmd==='generate'){
     const input=process.argv[3];if(!input)throw new Error('用法：node src/cli.mjs generate request.json');
     result=await browser.generate(JSON.parse(await fs.readFile(path.resolve(input),'utf8')));
   }else throw new Error('命令：setup | status | generate request.json');
   console.log(JSON.stringify(result,null,2));
 }
 process.exit(0);
}catch(e){console.error(JSON.stringify({code:e.code??'ERROR',message:e.message,...e.details},null,2));process.exit(1);}
