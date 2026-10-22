/* BD API Check. MAL provider families + the existing stateless MAL relay.
 * No keys, request headers or prompts belong in saved/exported reports.
 * Defaults are a MAL configuration snapshot, not an availability guarantee.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BDAPI = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '20261022-r2';
  const RELAY = 'https://www.mdlxdcc.org/.netlify/functions/mal-relay';
  const TYPES = ['openai_chat', 'openai_responses', 'anthropic_messages', 'gemini_generate'];
  const PROVIDERS = [
    {id:'chatgpt',name:'ChatGPT',vendor:'OpenAI',mark:'O',color:'#79d5ae',model:'gpt-5.1',type:'openai_chat',endpoint:'https://api.openai.com/v1/chat/completions',hosts:['api.openai.com'],console:'https://platform.openai.com/',keys:'https://platform.openai.com/api-keys',billing:'https://platform.openai.com/settings/organization/billing/overview',help:'https://platform.openai.com/docs/guides/error-codes',note:'API dobroimetje je ločeno od naročnine ChatGPT.'},
    {id:'claude',name:'Claude',vendor:'Anthropic',mark:'A',color:'#e8aa88',model:'claude-sonnet-5',type:'anthropic_messages',endpoint:'https://api.anthropic.com/v1/messages',hosts:['api.anthropic.com'],console:'https://console.anthropic.com/',keys:'https://console.anthropic.com/settings/keys',billing:'https://console.anthropic.com/settings/billing',help:'https://docs.anthropic.com/en/api/errors',note:'API uporablja svoj račun za porabo, ločen od naročnine Claude.'},
    {id:'qwen',name:'Qwen',vendor:'Alibaba Model Studio',mark:'Q',color:'#b8a0fa',model:'qwen3.7-max',type:'openai_responses',endpoint:'https://ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/responses',hosts:['ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com','dashscope-intl.aliyuncs.com'],console:'https://modelstudio.console.alibabacloud.com/',keys:'https://www.alibabacloud.com/help/en/model-studio/get-api-key',billing:'https://billing.console.alibabacloud.com/',help:'https://www.alibabacloud.com/help/en/model-studio/error-code',note:'Ključ, regija, workspace in naslov API morajo pripadati istemu okolju. Uvozi svoj MAL Config.'},
    {id:'gemini',name:'Gemini',vendor:'Google',mark:'G',color:'#92b8ff',model:'gemini-3.5-flash',type:'gemini_generate',endpoint:'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',hosts:['generativelanguage.googleapis.com'],console:'https://aistudio.google.com/',keys:'https://aistudio.google.com/apikey',billing:'https://ai.google.dev/gemini-api/docs/billing',help:'https://ai.google.dev/gemini-api/docs/troubleshooting',note:'Kvota in obračunavanje sta vezana na projekt. Preveri projekt izbranega ključa.'},
    {id:'grok',name:'Grok',vendor:'xAI',mark:'X',color:'#d2dae2',model:'grok-4.3',type:'openai_chat',endpoint:'https://api.x.ai/v1/chat/completions',hosts:['api.x.ai'],console:'https://console.x.ai/',keys:'https://console.x.ai/',billing:'https://console.x.ai/',help:'https://docs.x.ai/developers/quickstart',note:'V konzoli izberi pravo ekipo, nato API keys oziroma Billing.'},
    {id:'glm',name:'GLM',vendor:'Z.ai',mark:'Z',color:'#a8c6ff',model:'glm-4.6',type:'openai_chat',endpoint:'https://api.z.ai/api/paas/v4/chat/completions',hosts:['api.z.ai'],console:'https://z.ai/manage-apikey/',keys:'https://z.ai/manage-apikey/apikey-list',billing:'https://z.ai/manage-apikey/billing',help:'https://docs.z.ai/help/faq',note:'Splošni API in Coding Plan lahko uporabljata različne naslove in pravice.'},
    {id:'minimax',name:'MiniMax',vendor:'MiniMax',mark:'M',color:'#ef9cc7',model:'MiniMax-M3',type:'openai_chat',endpoint:'https://api.minimax.io/v1/chat/completions',hosts:['api.minimax.io'],console:'https://platform.minimax.io/',keys:'https://platform.minimax.io/',billing:'https://platform.minimax.io/console/recharge-records',help:'https://platform.minimax.io/docs/pricing/overview',note:'Preveri PAYG oziroma naročniški ključ. Tudi HTTP 200 lahko vsebuje napako v base_resp.'},
    {id:'mistral',name:'Mistral',vendor:'Mistral AI',mark:'▥',color:'#f4be74',model:'mistral-medium-3-5',type:'openai_chat',endpoint:'https://api.mistral.ai/v1/chat/completions',hosts:['api.mistral.ai'],console:'https://console.mistral.ai/',keys:'https://console.mistral.ai/api-keys/',billing:'https://admin.mistral.ai/organization/billing',help:'https://docs.mistral.ai/',note:'V Admin Panel preveri Organization → Billing, dobroimetje in omejitve porabe; za ključe izberi pravi workspace.'},
    {id:'kimi',name:'Kimi',vendor:'Moonshot AI',mark:'K',color:'#96d1de',model:'kimi-k2.6',type:'openai_chat',endpoint:'https://api.moonshot.ai/v1/chat/completions',hosts:['api.moonshot.ai'],console:'https://platform.moonshot.ai/console',keys:'https://platform.moonshot.ai/console',billing:'https://platform.moonshot.ai/console',help:'https://platform.moonshot.ai/docs/api/balance',note:'Mednarodno in kitajsko okolje imata ločene ključe in dobroimetje.'},
    {id:'deepseek',name:'DeepSeek',vendor:'DeepSeek',mark:'D',color:'#94aaff',model:'deepseek-v4-pro',type:'openai_chat',endpoint:'https://api.deepseek.com/chat/completions',hosts:['api.deepseek.com'],console:'https://platform.deepseek.com/',keys:'https://platform.deepseek.com/api_keys',billing:'https://platform.deepseek.com/top_up',help:'https://api-docs.deepseek.com/quick_start/error_codes/',note:'HTTP 402 pomeni premalo dobroimetja; HTTP 429 pomeni omejitev hitrosti.'}
  ];
  const aliases = {openai:'chatgpt',anthropic:'claude',google:'gemini',googleai:'gemini',xai:'grok',zai:'glm',bigmodel:'glm',moonshot:'kimi',moonshotai:'kimi',dashscope:'qwen',alibaba:'qwen'};
  function providerFor(value) {
    let name = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    name = aliases[name] || name;
    return PROVIDERS.find(p => p.id === name) || null;
  }
  function configFor(p) { return {id:p.id,model:p.model,type:p.type,endpoint:p.endpoint}; }
  function validate(config, key) {
    const p = providerFor(config.id);
    if (!p) throw new Error('Neznan ponudnik.');
    if (!String(key || '').trim()) throw new Error('Najprej vnesi API ključ.');
    if (/[\r\n]/.test(key) || key.length > 8192) throw new Error('Ključ mora biti v eni vrstici.');
    if (!String(config.model || '').trim() || config.model.length > 200) throw new Error('Vnesi ID modela iz ponudnikove konzole ali MAL Config.');
    if (!TYPES.includes(config.type)) throw new Error('Izberi podprt API format.');
    if ((p.id === 'claude') !== (config.type === 'anthropic_messages') || (p.id === 'gemini') !== (config.type === 'gemini_generate')) throw new Error('API format ne ustreza ponudniku.');
    let url;
    try { url = new URL(config.endpoint.replace('{model}', encodeURIComponent(config.model))); } catch (_) { throw new Error('Naslov API ni veljaven.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !p.hosts.includes(url.hostname)) throw new Error('Uporabi HTTPS naslov tega ponudnika, brez gesla ali parametrov v URL.');
    const path = decodeURIComponent(url.pathname);
    if (config.type === 'openai_chat' && !path.endsWith('/chat/completions')) throw new Error('Chat Completions potrebuje naslov, ki se konča z /chat/completions.');
    if (config.type === 'openai_responses' && !path.endsWith('/responses')) throw new Error('Responses potrebuje naslov, ki se konča z /responses.');
    if (config.type === 'anthropic_messages' && !path.endsWith('/messages')) throw new Error('Anthropic potrebuje naslov /messages.');
    if (config.type === 'gemini_generate' && !path.endsWith('/models/' + config.model + ':generateContent')) throw new Error('Gemini naslov mora vsebovati /models/{model}:generateContent.');
    return url.href;
  }
  function buildRequest(config, key, nonce, maxTokens, direct) {
    const url = validate(config, key);
    const cap = Number(maxTokens);
    if (![128,256,512,1024].includes(cap)) throw new Error('Neveljavna omejitev izhoda.');
    const prompt = 'Reply with exactly this one line and nothing else: ' + nonce;
    const headers = {'content-type':'application/json'};
    let body;
    if (config.type === 'anthropic_messages') {
      headers['x-api-key'] = key.trim(); headers['anthropic-version'] = '2023-06-01';
      if (direct) headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = {model:config.model,max_tokens:cap,messages:[{role:'user',content:prompt}]};
    } else if (config.type === 'gemini_generate') {
      headers['x-goog-api-key'] = key.trim();
      body = {contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:cap}};
    } else {
      headers.authorization = 'Bearer ' + key.trim();
      if (config.type === 'openai_responses') body = {model:config.model,input:prompt,max_output_tokens:cap,store:false};
      else {
        body = {model:config.model,messages:[{role:'user',content:prompt}],stream:false};
        body[config.id === 'chatgpt' && /^(gpt-5|o[134])/.test(config.model) ? 'max_completion_tokens' : 'max_tokens'] = cap;
      }
    }
    return {url,method:'POST',headers,body};
  }
  const number = n => Number.isFinite(n) && n >= 0 ? n : null;
  const array = a => Array.isArray(a) ? a : [];
  function normalize(data, type) {
    const d = data && typeof data === 'object' ? data : {};
    let text = '', finish = '', actual = d.model || d.modelVersion || '', input = null, output = null, total = null, reasoning = null;
    if (type === 'anthropic_messages') {
      text = array(d.content).filter(b => b?.type === 'text').map(b => b.text || '').join('\n');
      finish = d.stop_reason || ''; input = number(d.usage?.input_tokens); output = number(d.usage?.output_tokens);
    } else if (type === 'gemini_generate') {
      const candidate = d.candidates?.[0];
      text = array(candidate?.content?.parts).filter(p => p && !p.thought).map(p => p.text || '').join('\n');
      finish = candidate?.finishReason || d.promptFeedback?.blockReason || '';
      input = number(d.usageMetadata?.promptTokenCount); output = number(d.usageMetadata?.candidatesTokenCount); total = number(d.usageMetadata?.totalTokenCount); reasoning = number(d.usageMetadata?.thoughtsTokenCount);
    } else if (type === 'openai_responses') {
      text = typeof d.output_text === 'string' ? d.output_text : array(d.output).filter(o => o?.type === 'message').flatMap(o => array(o.content)).filter(c => c?.type === 'output_text').map(c => c.text || '').join('\n');
      finish = d.incomplete_details?.reason || d.status || '';
      input = number(d.usage?.input_tokens); output = number(d.usage?.output_tokens); total = number(d.usage?.total_tokens); reasoning = number(d.usage?.output_tokens_details?.reasoning_tokens);
    } else {
      const c = d.choices?.[0], content = c?.message?.content;
      text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(b => b?.text || '').join('\n') : '';
      finish = c?.finish_reason || ''; input = number(d.usage?.prompt_tokens); output = number(d.usage?.completion_tokens); total = number(d.usage?.total_tokens); reasoning = number(d.usage?.completion_tokens_details?.reasoning_tokens);
    }
    if (total === null && input !== null && output !== null && (type !== 'gemini_generate' || reasoning === null)) total = input + output;
    return {text:String(text),finish:String(finish),actual_model:String(actual),usage:{input,output,total,reasoning}};
  }
  function classify(status, data, type, nonce) {
    const d = data && typeof data === 'object' ? data : {};
    const base = d.base_resp;
    const semanticError = !!d.error || (!!base && Number(base.status_code) !== 0);
    const error = d.error || (semanticError ? {code:base.status_code,message:base.status_msg} : {});
    const code = String(error.code || error.type || d.code || '');
    const message = String(typeof error === 'string' ? error : error.message || d.message || d.raw || '');
    const hint = (code + ' ' + message + ' ' + JSON.stringify(error.details || '')).toLowerCase();
    const out = {http_status:status,provider_code:code,provider_message:message.slice(0,4000),state:'error',category:'provider',title:'Ponudnik je vrnil napako',detail:'Preveri podrobnosti odgovora ponudnika.',next:'Odpri konzolo in preveri model ter nastavitve API.',authentication:'unknown',model_access:'unknown',balance:'unknown'};
    // Vendor codes count even when the HTTP envelope is 200 (notably MiniMax).
    if (status === 401 || /invalid_api_key|api_key_invalid|api key (not valid|invalid|expired)|authentication_error|incorrect api key|invalid api key|unauthorized/.test(hint) || (semanticError && code === '1004')) {
      return {...out,category:'authentication',title:'Ključ ni bil sprejet',authentication:'rejected',detail:'Preveri kopiranje ključa, račun, projekt, regijo in vrsto paketa.',next:'Odpri API ključe. Po potrebi ustvari nov ključ za ta endpoint.'};
    }
    if (status === 402 || /insufficient[_ ](quota|balance|funds|credit)|credit balance.*(low|insufficient)|balance.*not enough|exceeded.*current.*quota/.test(hint) || (semanticError && code === '1008')) {
      return {...out,category:'billing',title:'Dobroimetje ali obračunska kvota',detail:'Ponudnik poroča o dobroimetju oziroma obračunski omejitvi. Točen znesek ni razviden iz tega testa.',next:'Odpri porabo / plačila in preveri dobroimetje, projekt ter omejitev porabe.'};
    }
    if (status === 429 || (semanticError && code === '1002')) return {...out,category:'rate_limit',title:'Omejitev zahtev ali kvote',detail:'HTTP 429 sam po sebi ne potrjuje praznega računa. Lahko gre za hitrost, dnevno kvoto ali omejitev projekta.',next:'Preveri kvote in porabo v konzoli. Nato test ročno ponovi; stran ga ne bo ponovila sama.'};
    if (semanticError && ['1000','1001','1024','1033'].includes(code)) return {...out,state:'unknown',category:'provider_unavailable',title:'Ponudnik ni zaključil testa',detail:'Ponudnik poroča o začasni napaki ali časovni meji. Stanje ključa ostaja nepotrjeno.',next:'Preveri porabo in stanje ponudnika pred ročno ponovitvijo.'};
    if (status === 403) return {...out,category:'permission',title:'Dostop je zavrnjen',detail:'Preveri dovoljenja ključa, projekt, regijo in dostop do tega modela.',next:'Odpri konzolo ponudnika. Dokup tokenov ni nujno rešitev.'};
    if (status === 404 || /model_not_found|model.*(not exist|not found|not available)/.test(hint)) return {...out,category:'model',title:'Model ali naslov ni dosegljiv',detail:'To ne dokazuje, da je ključ neveljaven. ID modela ali naslov API je lahko napačen.',next:'Primerjaj ID modela in endpoint s svojim MAL Config ter ponudnikovo konzolo.'};
    if (status >= 500) return {...out,state:'unknown',category:'provider_unavailable',title:'Ponudnik trenutno ni dosegljiv',detail:'Napaka strežnika ne potrjuje stanja ključa. Zahteva je morda že ustvarila porabo.',next:'Preveri stanje ponudnika in porabo. Ponovitev sproži ročno.'};
    if (status === 400 || status === 422 || semanticError) return {...out,category:'request',title:'Zahteva potrebuje popravek',detail:'Model morda zahteva drug API format ali ne podpira izbranega parametra.',next:'Preveri API format, ID modela, izhodno omejitev in besedilo napake. Ključa še ne označi za neveljavnega.'};
    if (status < 200 || status >= 300) return out;
    const n = normalize(d,type);
    const recognized = type === 'anthropic_messages' ? Array.isArray(d.content) : type === 'gemini_generate' ? Array.isArray(d.candidates) : type === 'openai_responses' ? Array.isArray(d.output) || typeof d.output_text === 'string' : Array.isArray(d.choices);
    const limited = /length|max_tokens|max_output_tokens|MAX_TOKENS|incomplete|in_progress|queued|failed|cancelled|SAFETY|RECITATION|content_filter/.test(n.finish);
    const passed = recognized && n.text.trim() === nonce && !limited;
    return {...out,...n,provider_code:'',provider_message:'',state:passed?'pass':'attention',category:passed?'ready':limited?'output_limit':'output',title:passed?'API deluje':limited?'API odgovarja, izhod je omejen':'Odgovor potrebuje pregled',authentication:recognized?'accepted':'unknown',model_access:recognized?'response_received':'unknown',detail:passed?'Izbrana pot je vrnila pravilen enkratni kontrolni niz.':'Prejet je bil HTTP odgovor, pričakovani kontrolni niz pa ni potrjen.',next:passed?'Pripravljeno za naslednji korak. Test velja za prikazan model, endpoint in trenutek.':limited?'Preveri razlog zaključka. Thinking model lahko porabi izhodno omejitev za razmišljanje; po potrebi jo povečaj in test ročno ponovi.':'Poglej odgovor in nastavitve. HTTP 200 sam zase še ni uspešen smoke test.'};
  }
  function redact(value, secrets) {
    const sensitive = /^(authorization|proxy-authorization|x-api-key|x-goog-api-key|api[_-]?key|key|token|secret|headers|request_body)$/i;
    const keys = [...new Set((secrets || []).filter(Boolean).flatMap(k => [String(k),encodeURIComponent(String(k))]))].sort((a,b) => b.length-a.length);
    function walk(v) {
      if (typeof v === 'string') {
        for (const k of keys) v = v.split(k).join('[SKRITO]');
        return v.replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [SKRITO]')
          .replace(/(https?:\/\/)[^/\s@]+@/gi,'$1[SKRITO]@')
          .replace(/([?&](?:key|api[_-]?key|access_token|token)=)[^&#\s]+/gi,'$1[SKRITO]');
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [walk(k),sensitive.test(k)?'[SKRITO]':walk(x)]));
      return v;
    }
    return walk(value);
  }
  function importMAL(text, filename) {
    if (typeof text !== 'string' || text.length > 250000) throw new Error('Datoteka je prevelika (največ 250 kB).');
    const entries = [];
    function add(name, raw) {
      const p = providerFor(name); if (!p) return;
      const r = typeof raw === 'string' ? {API_KEY:raw} : raw;
      if (!r || typeof r !== 'object' || Array.isArray(r)) return;
      const lower = Object.fromEntries(Object.entries(r).map(([k,v]) => [k.toLowerCase(),v]));
      const record = {id:p.id};
      const keyName = Object.keys(lower).find(k => /(^|_)api_key$/.test(k) || ['key','token'].includes(k));
      if (keyName && typeof lower[keyName] === 'string' && lower[keyName].trim()) record.key = lower[keyName].trim();
      if (typeof lower.model === 'string' && lower.model.trim()) record.model = lower.model.trim();
      if (typeof lower.endpoint === 'string' && lower.endpoint.trim()) record.endpoint = lower.endpoint.trim();
      const type = lower.api_type || lower.type;
      if (typeof type === 'string') record.type = type === 'anthropic' ? 'anthropic_messages' : type === 'gemini' ? 'gemini_generate' : type;
      if (Object.keys(record).length > 1) entries.push(record);
    }
    const trimmed = text.replace(/^\uFEFF/,'').trim();
    if (/^\{/.test(trimmed) || (/^\[/.test(trimmed) && !/^\[[A-Za-z][A-Za-z0-9 ._-]*\][ \t]*(?:\r?\n|$)/.test(trimmed))) {
      let obj; try { obj = JSON.parse(trimmed); } catch (_) { throw new Error('JSON ni veljaven.'); }
      if (Array.isArray(obj)) obj.forEach(r => add(r?.name || r?.provider || r?.id,r));
      else {
        if (obj.provider || obj.name || obj.id) add(obj.provider || obj.name || obj.id,obj);
        if (Array.isArray(obj.providers)) obj.providers.forEach(r => add(r.name || r.provider || r.id,r));
        for (const source of [obj,obj.keys,obj.providers]) if (source && !Array.isArray(source)) Object.entries(source).forEach(([name,r]) => add(name,r));
      }
    } else {
      const name = String(filename || '').replace(/\.(txt|conf|env)$/i,'').replace(/[-_](API|Config)$/i,'');
      let current = providerFor(name)?.id || '', fields = {};
      function flush() { if (current) add(current,fields); fields = {}; }
      for (let line of trimmed.split(/\r?\n/)) {
        line = line.trim(); if (!line || /^[#;]/.test(line)) continue;
        const section = line.match(/^\[([^\]]+)\]$/);
        if (section) { flush(); current = providerFor(section[1])?.id || ''; continue; }
        const pair = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (pair) {
          const field = pair[1], val = pair[2].trim().replace(/^(['"])(.*)\1$/,'$2');
          if (/^(PROVIDER|NAME)$/i.test(field)) current = providerFor(val)?.id || current;
          fields[field] = val;
          const prefix = field.replace(/_API_KEY$/i,'');
          if (/_API_KEY$/i.test(field) && providerFor(prefix)) add(prefix,{API_KEY:val});
        } else if (current && !Object.keys(fields).length) fields.API_KEY = line.replace(/^(['"])(.*)\1$/,'$2');
      }
      flush();
    }
    // Merge key and config files in the caller; never retain unrelated fields.
    return entries;
  }
  function exportReport(results, secrets, meta) {
    const allowed = ['id','provider','requested_model','endpoint','api_type','transport','started_at','finished_at','latency_ms','http_status','provider_code','provider_message','state','category','title','detail','next','authentication','model_access','balance','text','finish','actual_model','usage','request_id','diagnostic'];
    const rows = results.map(row => Object.fromEntries(allowed.filter(k => row[k] !== undefined).map(k => [k,row[k]])));
    return redact({schema:'BD_API_SMOKE_REPORT_V1',version:VERSION,created_at:new Date().toISOString(),contains_api_keys:false,scope:'One short smoke request per selected provider. Not a benchmark, balance query or identity attestation.',requests_issued:meta.requests_issued,results:rows},secrets);
  }
  async function perform(config, key, options, fetcher) {
    const direct = options.transport === 'direct';
    const request = buildRequest(config,key,options.nonce,options.cap,direct);
    const started = Date.now();
    try {
      // One dispatch only. Never fall back or retry after an ambiguous failure.
      const response = await fetcher(direct ? request.url : RELAY,{
        method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:options.signal,
        headers:direct ? request.headers : {'content-type':'application/json'},
        body:JSON.stringify(direct ? request.body : {...request,timeout_ms:55000})
      });
      const text = await response.text();
      let payload; try { payload = JSON.parse(text); } catch (_) { payload = {raw:text.slice(0,8000)}; }
      let data = payload, status = response.status;
      if (!direct) {
        if (!Number.isInteger(payload.status) || typeof payload.ok !== 'boolean' || !('data' in payload)) return {state:'unknown',category:'transport',title:'Posrednik ni potrdil odgovora API',detail:'Stanje ključa ni znano. Zahteva je morda že dosegla ponudnika.',next:'Preveri povezavo, dosegljivost posrednika in porabo pri ponudniku. Ponovi ročno.',http_status:response.status,authentication:'unknown',balance:'unknown',provider_message:String(payload.error || payload.raw || 'Nepričakovan odgovor posrednika.').slice(0,4000),diagnostic:payload,latency_ms:Date.now()-started};
        data = payload.data; status = payload.status;
      }
      return {...classify(status,data,config.type,options.nonce),diagnostic:data,request_id:String(data?.id || (direct ? response.headers?.get('x-request-id') || response.headers?.get('request-id') : '') || ''),latency_ms:Date.now()-started};
    } catch (error) {
      const aborted = options.signal?.aborted;
      return {state:'unknown',category:aborted?'interrupted':'network',title:aborted?'Test je bil prekinjen':'Povezava ni potrjena',detail:direct?'Možen je CORS, mrežna napaka ali prekinitev. To ne dokazuje, da je ključ neveljaven.':'Odgovora posrednika ni bilo mogoče prebrati. Stanje ključa ni znano.',next:'Zahteva je morda že ustvarila porabo. Preveri konzolo pred ročno ponovitvijo.',authentication:'unknown',balance:'unknown',provider_message:String(error?.message || 'Mrežna napaka.').slice(0,4000),latency_ms:Date.now()-started};
    }
  }
  return {VERSION,RELAY,TYPES,PROVIDERS,providerFor,configFor,validate,buildRequest,normalize,classify,redact,importMAL,exportReport,perform};
});
