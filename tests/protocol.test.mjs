import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
test('MCP stdio handshake, list and argument errors',async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],stderr:'pipe'});
 const client=new Client({name:'integration-test',version:'1.0.0'});
 try{
  await client.connect(transport);
  const tools=await client.listTools();assert.equal(tools.tools.length,2);
  const generate=tools.tools.find(t=>t.name==='doubao_generate_image');assert.equal(generate.inputSchema.properties.model.enum.length,5);
  for(const args of [{},{prompt:'fish',model:'unknown'},{prompt:'fish',model:'seedream5.0Pro'},{prompt:'fish',evil:true}]){
   const result=await client.callTool({name:'doubao_generate_image',arguments:args});assert.equal(result.isError,true);
  }
 }finally{await client.close();}
});
