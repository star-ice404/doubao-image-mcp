import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { egoStatePath } from './config.mjs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MODELS, TaskError, normalizeRequest, buildPrompt, imageExtension } from './core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EDITOR='.tiptap.ProseMirror[contenteditable="true"], [data-testid="chat_input_input"] textarea';
const EGO_STATE=egoStatePath();
const MODEL_LABELS={'seedream5.5':/Seedream\s*5\.5(?!\s*Pro)/i,'seedream5.0fast':/Seedream\s*5\.0\s*(Flash|Fast)/i,'seedream4.5':/Seedream\s*4\.5/i,'seedream4.0':/Seedream\s*4\.0/i,'seedream5.0Pro':/Seedream\s*5\.0\s*Pro/i};
export class DoubaoBrowser {
  constructor(){this.tail=Promise.resolve();this.page=null;this.browser=null;this.context=null;}
  async connect(){
    if(this.browser?.isConnected()) return;
    let endpoint=process.env.DOUBAO_CDP_URL;
    if(!endpoint){try { const s=JSON.parse(await fs.readFile(EGO_STATE,'utf8')); endpoint=`http://127.0.0.1:${s.port}`; } catch {throw new TaskError('BROWSER_NOT_RUNNING','请先在 Harness 打开 ego 浏览器，或运行 npm run setup；也可设置 DOUBAO_CDP_URL');}}
    const u=new URL(endpoint);
    if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)) throw new TaskError('INVALID_CONFIG','CDP 端点仅支持本机 loopback');
    try { this.browser=await chromium.connectOverCDP(endpoint,{timeout:15000}); this.context=this.browser.contexts()[0]; }
    catch(e){throw new TaskError('BROWSER_NOT_RUNNING',`连接浏览器失败：${e.message}`);}
  }
  async getPage(){
    await this.connect();
    if(this.page&&!this.page.isClosed()) return this.page;
    // Dedicated page only; never navigate a user's existing conversation.
    this.page=await this.context.newPage();
    this.page.setDefaultTimeout(15000);
    await this.page.goto('https://www.doubao.com/chat/',{waitUntil:'domcontentloaded',timeout:45000});
    await this.page.locator(EDITOR).first().waitFor({state:'visible',timeout:45000});
    return this.page;
  }
  async humanState(p){
    const frames=p.frames().map(f=>f.url());
    const challenge=frames.some(u=>/verifycenter\/captcha|captcha\/v2|recaptcha|hcaptcha/i.test(u)) || await p.locator('iframe[src*="captcha"],iframe[src*="verifycenter"]').count()>0;
    const login=await p.getByRole('button',{name:/^(登录|登录\/注册|立即登录)$/}).count();
    return {human_required:challenge?'captcha':login?'login':null};
  }
  async status(){
    const p=await this.getPage();
    const human=await this.humanState(p);
    return {connected:true,url:p.url(),...human,models:MODELS,model_note:'参数名来自调用约定；以 available_ui_models 为网页真实菜单证据，5.0fast 匹配 5.0 Flash。5.0Pro 若未在菜单出现则生成前报错。',selectors:{editor:await p.locator(EDITOR).count(),upload:await p.locator('input[type="file"]').count()},browser_state:EGO_STATE};
  }
  generate(args,{signal}={}){
    const a=normalizeRequest(args);
    const run=this.tail.then(()=>this.withLock(()=>this.perform(a,signal)));
    this.tail=run.catch(()=>{}); return run;
  }
  async withLock(fn){
    const lock=path.join(ROOT,'.browser.lock'); let h;
    try { h=await fs.open(lock,'wx'); await h.writeFile(JSON.stringify({pid:process.pid,time:Date.now()})); }
    catch(e){if(e.code==='EEXIST') throw new TaskError('BUSY','另一服务实例正在操作豆包；稍后再调用。若进程已退出，确认后删除 .browser.lock');throw e;}
    try{return await fn();}finally{await h.close();await fs.unlink(lock).catch(()=>{});}
  }
  async perform(a,signal){
    const id=randomUUID(), dir=path.join(a.output_dir??path.join(ROOT,'outputs'),id);
    await fs.mkdir(dir,{recursive:true});
    let submitted=false,p,stage='prepare'; const started=Date.now();
    const assertActive=()=>{if(signal?.aborted) throw new TaskError('CANCELLED','任务已取消',{submitted}); if(Date.now()-started>a.timeout_seconds*1000) throw new TaskError('TIMEOUT','等待生图超时；保留 conversation_url，检查网页结果后再决定下一次提交',{submitted});};
    let responseError=null;
    const responseListener=async r=>{
      if(!/www\.doubao\.com\/(samantha|api)\/.*(completion|message|chat)/i.test(r.url()))return;
      if(r.status()>=400)responseError={status:r.status(),endpoint:new URL(r.url()).pathname};
    };
    try {
      for(const file of a.reference_images){const s=await fs.stat(file).catch(()=>null);if(!s?.isFile()||!s.size||s.size>30*1024*1024||! /\.(png|jpe?g|webp|apng)$/i.test(file))throw new TaskError('INVALID_REFERENCE',`参考图应为 png/jpeg/webp/apng，大小 1..30MB：${file}`);}
      p=await this.getPage();assertActive();
      let hs=await this.humanState(p);if(hs.human_required)throw new TaskError('HUMAN_REQUIRED',`请在浏览器完成 ${hs.human_required} 后重新调用`,hs);
      // A fresh route isolates input references and output images per request.
      await p.goto('https://www.doubao.com/chat/',{waitUntil:'domcontentloaded'});
      await p.locator(EDITOR).first().waitFor({state:'visible'});
      const skill=p.locator('[data-testid="skill_bar_button_3"]');
      await skill.waitFor({state:'visible',timeout:30000});
      await skill.click();
      const modelButton=p.getByRole('button',{name:/^模型\s*Seedream/i});
      await modelButton.waitFor({state:'visible',timeout:15000});
      let available=[],selected=null;
      if(await modelButton.count()){
        await modelButton.click();const menu=p.getByRole('menuitem');await menu.first().waitFor();available=await menu.allTextContents();
        const candidate=available.find(t=>MODEL_LABELS[a.model].test(t));
        if(!candidate){await p.keyboard.press('Escape');throw new TaskError('MODEL_UNAVAILABLE',`网页菜单未提供 ${a.model}；保留原请求，不替换为其他版本`,{available_ui_models:available});}
        const item=menu.filter({hasText:MODEL_LABELS[a.model]});
        if(await item.count()!==1)throw new TaskError('UI_CHANGED','模型菜单匹配不唯一',{available_ui_models:available});
        await item.click();selected=(await modelButton.innerText()).replace(/\s+/g,' ');
      } else if(a.model==='seedream5.0Pro') throw new TaskError('MODEL_UNAVAILABLE','网页未提供可验证的 Pro 模型入口');
      stage='upload';
      if(a.reference_images.length){
        const input=p.locator('input[data-testid="upload-file-input"], input[type="file"][accept*=".jpg"]');
        if(await input.count()!==1)throw new TaskError('UI_CHANGED','参考图上传入口缺失或匹配不唯一');
        await input.setInputFiles(a.reference_images);
        await p.waitForFunction((names)=>{
          const root=document.querySelector('[data-testid="chat_input"]'); if(!root)return false;
          const t=root.innerText;
          const imgs=[...root.querySelectorAll('img')].filter(e=>e.src.startsWith('blob:')||e.naturalWidth>150||/image|preview|upload/.test(e.className));
          const failed=/上传失败|格式不支持|超过.*限制/.test(t);if(failed)throw new Error(t.slice(0,400));
          return (names.every(n=>t.includes(n))||imgs.length>=names.length)&&!root.querySelector('[role="progressbar"], [class*="loading"], [class*="uploading"]');
        },a.reference_images.map(f=>path.basename(f)),{timeout:60000});
      }
      assertActive(); hs=await this.humanState(p);if(hs.human_required)throw new TaskError('HUMAN_REQUIRED','请在浏览器完成验证',hs);
      stage='submit'; const sent=buildPrompt(a); const editor=p.locator(EDITOR).first();await editor.fill(sent);
      if((await editor.innerText()).trim()!==sent)throw new TaskError('UI_CHANGED','输入内容校验失败');
      const baseline=await this.collect(p); const baselineURLs=new Set(baseline.images.map(i=>i.url));
      p.on('response',responseListener);
      const send=p.locator('[data-testid="chat_input_send_button"]');await send.waitFor({state:'visible'});
      if(!await send.isEnabled())throw new TaskError('UPLOAD_PENDING','发送按钮尚未就绪');
      submitted=true;await send.click();stage='wait';
      let snapshot,lastKey='',stable=0;
      while(true){
        assertActive(); const human=await this.humanState(p);
        if(human.human_required)throw new TaskError('HUMAN_REQUIRED','请在浏览器完成验证；本次已提交，请先查看对话结果，不自动重发',human);
        snapshot=await this.collect(p);
        if(snapshot.failed||responseError)throw new TaskError('SUBMISSION_FAILED','网页显示发送失败；请检查浏览器中的验证、网络和账号状态',{response_error:responseError});
        const fresh=snapshot.images.filter(i=>!baselineURLs.has(i.url));
        const key=fresh.map(i=>i.url).join('|');stable=key&&key===lastKey?stable+1:0;lastKey=key;
        if(fresh.length&&stable>=2&&!snapshot.busy){snapshot.images=fresh;break;}
        if(/今日.*次数.*用完|额度不足|开通会员|购买会员|升级会员/.test(snapshot.reply)&&!fresh.length)throw new TaskError('ACCOUNT_LIMIT','网页提示会员或额度限制',{reply:snapshot.reply});
        if(snapshot.reply&&!snapshot.busy&&Date.now()-started>45000&&!fresh.length&&stable===0) {
          if(/生成失败|暂时.*生成|暂不支持|不支持.*模型/.test(snapshot.reply))throw new TaskError('GENERATION_FAILED','网页回复未生成图片',{reply:snapshot.reply});
        }
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      stage='download';const images=[];
      for(const [index,img] of snapshot.images.entries()){
        assertActive(); const response=await this.context.request.get(img.url,{timeout:30000,headers:{Referer:p.url()}});
        if(!response.ok())throw new TaskError('DOWNLOAD_FAILED',`图片下载 HTTP ${response.status()}`);
        const type=response.headers()['content-type']??'';if(!type.startsWith('image/'))throw new TaskError('DOWNLOAD_FAILED','图片地址返回了非图片内容');
        const bytes=await response.body();const file=path.join(dir,`image-${index+1}${imageExtension(type)}`);await fs.writeFile(file,bytes);
        images.push({...img,path:file,mime_type:type.split(';')[0],bytes:bytes.length});
      }
      const result={status:'completed',id,conversation_url:p.url(),requested_model:a.model,selected_ui_model:selected,available_ui_models:available,requested_aspect_ratio:a.aspect_ratio,ratio_note:'任意正数比例通过文本传入；实际尺寸以返回 width/height 为准，网页可能采用近似比例。',sent_text:sent,reference_images:a.reference_images,images,reply:snapshot.reply,elapsed_ms:Date.now()-started};
      await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2)); return result;
    }catch(e){
      const detail={status:'failed',id,code:e.code??'BROWSER_ERROR',message:e.message,stage,submitted,conversation_url:p?.url(),...e.details};
      await fs.writeFile(path.join(dir,'error.json'),JSON.stringify(detail,null,2));
      if(p&&!p.isClosed())await p.screenshot({path:path.join(dir,'error.png')}).catch(()=>{});
      throw new TaskError(detail.code,detail.message,{...detail,diagnostic_dir:dir});
    }finally{if(p)p.off('response',responseListener);}
  }
  async collect(p){
    return p.evaluate(()=>{
      const roots=[...document.querySelectorAll('[data-testid="receive_message"]')];
      const scope=roots.length?roots: [...document.querySelectorAll('[data-testid="message-block-container"]')].filter(e=>!e.querySelector('[data-testid="send_message"]')&&!e.closest('[data-testid="send_message"]'));
      const images=[],seen=new Set();
      for(const root of scope)for(const img of root.querySelectorAll('img')){
        const url=img.currentSrc||img.src;
        if(img.naturalWidth<256||img.naturalHeight<256||!/^https?:/.test(url)||/\/rc\/icon\//.test(url)||seen.has(url))continue;
        seen.add(url);images.push({url,width:img.naturalWidth,height:img.naturalHeight,alt:img.alt});
      }
      return {images,reply:scope.map(e=>e.innerText).join('\n').slice(-16000),failed:!!document.querySelector('[data-testid="message_box_failed_icon"]'),busy:!!document.querySelector('[data-testid="chat_input_stop_button"], [data-testid="stop_generate_button"]')||!![...document.querySelectorAll('button')].find(e=>/停止生成|停止回答/.test(e.getAttribute('aria-label')||e.innerText))};
    });
  }
  async close(){
    // Disconnect via process exit; browser.close() over CDP would terminate the user's browser.
    this.page=null;
  }
}
export { ROOT, EGO_STATE };
