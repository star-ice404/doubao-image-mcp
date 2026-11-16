import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const client=new Client({name:'doubao-mcp-probe',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],stderr:'inherit'});
try {
  await client.connect(transport);
  const {tools}=await client.listTools();
  console.log(JSON.stringify({ok:true,toolNames:tools.map(t=>t.name),models:tools.find(t=>t.name==='doubao_generate_image').inputSchema.properties.model.enum},null,2));
}finally{await client.close();}
