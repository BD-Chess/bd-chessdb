// Shared provider transport. Settings match the existing Guide; retries remain off.
export const providerEnv=key=>globalThis.Netlify?.env?.get(key)??process.env[key];
export function providerModel(provider){return provider==='claude'?providerEnv('MDLXDCC_GUIDE_CLAUDE_MODEL')||'claude-sonnet-5-5':providerEnv('MDLXDCC_GUIDE_MODEL')||'gpt-6-luna';}
export async function createProviderClient(provider){
 if(provider==='claude'){const {default:Anthropic}=await import('@anthropic-ai/sdk');return new Anthropic({apiKey:providerEnv('ANTHROPIC_API_KEY'),maxRetries:0,timeout:45000});}
 const {default:OpenAI}=await import('openai');return new OpenAI({maxRetries:0,timeout:45000});
}
export async function providerRound({provider,model,client,system,input,tools,budget,signal,onText=()=>{},tourComment=false}){
 const claude=provider==='claude';let held=null,response,text='';
 try{
  if(claude){
   const payload={model,system,messages:input,max_tokens:tourComment?800:2400,service_tier:'standard_only',
    ...(!tourComment?{tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters})),tool_choice:{type:'auto',disable_parallel_tool_use:true}}:{}),
    output_config:{effort:'low'},...(!tourComment&&model==='claude-sonnet-5-5'?{thinking:{type:'between_tools'}}:{})};
   held=await budget.reserve(payload);const stream=client.messages.stream(payload,{signal});
   for await(const e of stream){if(e.type==='content_block_delta'&&e.delta.type==='text_delta'){text+=e.delta.text;onText(e.delta.text);}if(e.type==='error')throw Error('PROVIDER_ERROR');}
   response=await stream.finalMessage();
  }else{
   const payload={model,instructions:system,input,tools,...(tourComment?{tool_choice:'none'}:{}),parallel_tool_calls:false,service_tier:'default',reasoning:{effort:'low'},max_output_tokens:tourComment?800:2400,store:false,include:['reasoning.encrypted_content'],stream:true};
   held=await budget.reserve(payload);const stream=await client.responses.create(payload,{signal});
   for await(const e of stream){if(e.type==='response.output_text.delta'){text+=e.delta;onText(e.delta);}if(['response.completed','response.incomplete'].includes(e.type))response=e.response;if(['response.failed','error'].includes(e.type))throw Error('PROVIDER_ERROR');}
  }
  if(!response)throw Error('PROVIDER_ERROR');await budget.settle(held,response.usage);held=null;
  const calls=claude?(response.content||[]).filter(o=>o.type==='tool_use').map(o=>({name:o.name,arguments:o.input,call_id:o.id})):(response.output||[]).filter(o=>o.type==='function_call');
  return {response,text,calls};
 }catch(e){if(held)try{await budget.settle(held,null,[400,401,403,404,422,429].includes(e?.status));}catch{}throw e;}
}
export function appendAssistant(input,provider,response){if(provider==='claude')input.push({role:'assistant',content:response.content});else input.push(...response.output);}
export function appendTool(input,provider,call,result){if(provider==='claude')input.push({role:'user',content:[{type:'tool_result',tool_use_id:call.call_id,content:JSON.stringify(result),...(result.error?{is_error:true}:{})}]});else input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});}
