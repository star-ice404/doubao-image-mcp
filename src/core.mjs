import path from 'node:path';
export const MODELS = ['seedream5.5','seedream5.0fast','seedream4.5','seedream4.0','seedream5.0Pro'];
export class TaskError extends Error { constructor(code,message,details={}) { super(message); this.code=code; this.details=details; } }
export function normalizeRequest(a={}) {
  if(typeof a.prompt!=='string'||!a.prompt.trim()||a.prompt.length>12000) throw new TaskError('INVALID_ARGS','prompt 应为 1..12000 字符');
  const model=a.model??'seedream5.5';
  if(!MODELS.includes(model)) throw new TaskError('INVALID_ARGS',`model 可选 ${MODELS.join(', ')}`);
  if(model==='seedream5.0Pro'&&a.allow_pro!==true) throw new TaskError('PRO_CONFIRMATION_REQUIRED','seedream5.0Pro 需会员；明确选用时设置 allow_pro=true');
  let ratio=a.aspect_ratio??'auto';
  if(typeof ratio!=='string') throw new TaskError('INVALID_ARGS','aspect_ratio 应为 auto 或正数比例，例如 9:16、2.35:1');
  ratio=ratio.trim().replace('：',':');
  if(/^(auto|自动|自动比例)$/i.test(ratio)) ratio='auto';
  else if(!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(ratio)||ratio.split(':').some(n=>!Number.isFinite(+n)||+n<=0||+n>100000)) throw new TaskError('INVALID_ARGS','比例格式示例：9:16、21:9、2.35:1，或 auto');
  const refs=a.reference_images??[];
  if(!Array.isArray(refs)||refs.length>10||refs.some(p=>typeof p!=='string'||!path.isAbsolute(p))) throw new TaskError('INVALID_ARGS','reference_images 为最多10个本机绝对路径');
  const timeout=a.timeout_seconds??300;
  if(!Number.isInteger(timeout)||timeout<30||timeout>900) throw new TaskError('INVALID_ARGS','timeout_seconds 应为 30..900 整数');
  if(a.output_dir!==undefined&&(typeof a.output_dir!=='string'||!path.isAbsolute(a.output_dir))) throw new TaskError('INVALID_ARGS','output_dir 应为绝对路径');
  return {...a,prompt:a.prompt.trim(),model,aspect_ratio:ratio,reference_images:refs,timeout_seconds:timeout};
}
export function buildPrompt(a) { return `请使用${a.model}生成一张${a.aspect_ratio==='auto'?'自动比例':a.aspect_ratio}的图片：${a.prompt}`; }
export function imageExtension(type) { return ({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/avif':'.avif'})[type.split(';')[0]]??'.png'; }
