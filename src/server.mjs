#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DoubaoBrowser } from './browser.mjs';
import { MODELS, normalizeRequest } from './core.mjs';
const browser=new DoubaoBrowser();
const server=new Server({name:'doubao-image-mcp',version:'1.1.0'},{capabilities:{tools:{}},instructions:'通过已登录豆包浏览器生图。先使用 doubao_status 检查状态。遇到 HUMAN_REQUIRED 提醒用户在浏览器完成人工验证，不自动重发。模型名称必须匹配网页；seedream5.0fast 对应 Seedream 5.0 Flash。seedream5.0Pro 对应 Seedream 5.0 Pro，需会员且 allow_pro=true；保持请求的模型版本。任意自定义比例以文本传入，返回图片实际宽高才是尺寸证据。reference_images 是本机绝对路径数组。生成结束后向用户展示返回的本地图片路径。'});
const generateSchema={type:'object',properties:{prompt:{type:'string',description:'图片提示词'},model:{type:'string',enum:MODELS,default:'seedream5.5'},aspect_ratio:{type:'string',default:'auto',description:'auto 或任意正数比例，例如9:16、21:9、2.35:1。实际支持程度由豆包决定。'},reference_images:{type:'array',items:{type:'string'},maxItems:10,description:'本机参考图绝对路径，支持PNG/JPEG/WebP/APNG'},timeout_seconds:{type:'integer',minimum:30,maximum:900,default:300},output_dir:{type:'string',description:'可选本机绝对输出目录'},allow_pro:{type:'boolean',default:false,description:'明确选用会员模型时设为true'}},required:['prompt'],additionalProperties:false};
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'doubao_status',description:'检查豆包浏览器、登录或验证状态，返回支持的调用模型参数。会创建独立豆包标签页。',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'doubao_generate_image',description:'通过豆包网页生成一张图片，支持参考图、Seedream模型和自动/任意文本比例。一次提交，不自动重发；返回本地图片、实际宽高、网页模型证据、对话链接和诊断。',inputSchema:generateSchema}]}));
server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
 try{
   let result;
   if(request.params.name==='doubao_status')result=await browser.status();
   else if(request.params.name==='doubao_generate_image'){
     const args=request.params.arguments??{};
     for(const k of Object.keys(args))if(!Object.hasOwn(generateSchema.properties,k))throw Object.assign(new Error(`未知参数：${k}`),{code:'INVALID_ARGS'});
     result=await browser.generate(normalizeRequest(args),{signal:extra.signal});
   }else throw Object.assign(new Error('Unknown tool'),{code:'UNKNOWN_TOOL'});
   return {content:[{type:'text',text:JSON.stringify(result,null,2)}]};
 }catch(e){return {isError:true,content:[{type:'text',text:JSON.stringify({code:e.code??'ERROR',message:e.message,...e.details},null,2)}]};}
});
server.onerror=e=>console.error('[doubao-mcp]',e.message);
await server.connect(new StdioServerTransport());
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{server.close().finally(()=>process.exit(0));});
