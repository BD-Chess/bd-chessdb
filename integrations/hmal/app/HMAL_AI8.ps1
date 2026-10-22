param([Parameter(Mandatory=$true)][string]$Job,[switch]$Cancel)
$ErrorActionPreference='Stop'
$utf8=[Text.UTF8Encoding]::new($false)
function Set-HmalReasoning {
 param([string]$Key,[string]$Selection,[hashtable]$Wire)
 if(-not $Selection -or $Selection -ceq 'default'){return}
 $allowed=@{'qwen3.8'=@('off','low','medium','xhigh');'gpt-oss'=@('low','medium','high');'gemma4'=@('off','on');'gemma4-q5'=@('off','on');'mellum2.1'=@('off','on')}
 if(-not $allowed.ContainsKey($Key) -or $Selection -cnotin $allowed[$Key]){throw 'HMAL_REASONING_INVALID'}
 if(-not $Wire.ContainsKey('chat_template_kwargs')){$Wire.chat_template_kwargs=@{}}
 if($Selection -ceq 'off'){
  $Wire.reasoning_effort='none';$Wire.chat_template_kwargs.enable_thinking=$false
  $Wire.chat_template_kwargs.Remove('reasoning_effort')
 }elseif($Key -ceq 'qwen3.8'){
  $Wire.reasoning_effort=$Selection;$Wire.chat_template_kwargs.reasoning_effort=$Selection
  $Wire.chat_template_kwargs.enable_thinking=$true
 }elseif($Key -ceq 'gpt-oss'){
  $Wire.reasoning_effort=$Selection;$Wire.chat_template_kwargs.reasoning_effort=$Selection
 }else{
  $Wire.Remove('reasoning_effort');$Wire.chat_template_kwargs.enable_thinking=$true
 }
}
function Set-HmalSampling {
 param($Profile,[string]$Selection,[hashtable]$Wire)
 # Optional local recipe. Without it the existing profile remains authoritative.
 if(-not $Profile.sampling_by_reasoning){return}
 $mode=if($Selection -ceq 'off' -or (($Selection -ceq 'default' -or -not $Selection) -and $Profile.enable_thinking -eq $false)){'off'}else{'on'}
 $recipe=$Profile.sampling_by_reasoning.$mode
 if(-not $recipe){throw 'SAMPLING_RECIPE_MISSING'}
 foreach($name in @('temperature','top_p','top_k','min_p','presence_penalty','frequency_penalty','repeat_penalty')){
  if($recipe.PSObject.Properties[$name]){$Wire[$name]=$recipe.$name}
 }
}
function Set-HmalOutputBudget {
 param([hashtable]$Wire,[int]$Requested,[int]$InputTokens,[int]$Context,[string]$Policy='native',[int]$Reserve=1024)
 $available=$Context-$InputTokens-1
 if($available -lt 1){throw 'CONTEXT_LIMIT_REDUCE_INPUT_OR_OUTPUT'}
 # b11429 reads reasoning_budget_tokens (thinking_budget_tokens alias), NOT reasoning_budget.
 if($Wire.ContainsKey('reasoning_budget')){
  $Wire.reasoning_budget_tokens=[int]$Wire.reasoning_budget;$Wire.Remove('reasoning_budget')
 }
 if($Requested -eq 0){$Wire.max_tokens=$available;$Wire.reasoning_budget_tokens=-1}
 elseif($Requested -lt 0 -or $Requested -gt $available){throw 'CONTEXT_LIMIT_REDUCE_INPUT_OR_OUTPUT'}
 else{$Wire.max_tokens=$Requested}
 if($Policy -ceq 'reserve_final'){
  if($Reserve -lt 128 -or $Reserve -gt 32768 -or $Reserve -ge $Wire.max_tokens){throw 'ANSWER_RESERVE_EXCEEDS_AVAILABLE_CONTEXT'}
  $Wire.reasoning_budget_tokens=[int]$Wire.max_tokens-$Reserve
 }elseif($Policy -and $Policy -cne 'native'){throw 'COMPLETION_POLICY_INVALID'}
}
function Get-HmalEffectiveContext {
 param($Slots)
 $slotsArray=@($Slots)
 if($slotsArray.Count -ne 1 -or -not $slotsArray[0].n_ctx -or [int]$slotsArray[0].n_ctx -lt 2){throw 'EFFECTIVE_CONTEXT_UNVERIFIED'}
 if($slotsArray[0].is_processing){throw 'AI8_BUSY_ACTIVE_REQUEST_OR_LEASE'}
 return [int]$slotsArray[0].n_ctx
}
function Invoke-HmalCompletion {
 param([string]$Uri,[byte[]]$Body,[string]$Epoch,[int]$TimeoutSeconds=0)
 if($TimeoutSeconds -gt 0){return (Invoke-LocalHttp $Uri -Method POST -Body $Body -Epoch $Epoch -TimeoutSeconds $TimeoutSeconds)}
 $u=[uri]$Uri
 if($u.Scheme -cne 'http' -or $u.Host -cne '127.0.0.1'){throw 'HMAL_LOOPBACK_REQUIRED'}
 $http=[Net.HttpWebRequest]::Create($u)
 $http.Method='POST';$http.Proxy=$null;$http.AllowAutoRedirect=$false
 $http.Timeout=[Threading.Timeout]::Infinite;$http.ReadWriteTimeout=[Threading.Timeout]::Infinite
 $http.ServicePoint.Expect100Continue=$false;$http.KeepAlive=$false
 $http.ContentType='application/json; charset=utf-8';$http.ContentLength=$Body.Length
 $clock=[Diagnostics.Stopwatch]::StartNew();$response=$null
 try{
  $pending=$http.BeginGetRequestStream($null,$null)
  while(-not $pending.AsyncWaitHandle.WaitOne(100)){if(Test-Cancel $Epoch){$http.Abort();throw 'STOP_REQUESTED'}}
  if(Test-Cancel $Epoch){throw 'STOP_REQUESTED'}
  $stream=$http.EndGetRequestStream($pending)
  try{
   $pending=$stream.BeginWrite($Body,0,$Body.Length,$null,$null)
   while(-not $pending.AsyncWaitHandle.WaitOne(100)){if(Test-Cancel $Epoch){$http.Abort();throw 'STOP_REQUESTED'}}
   $stream.EndWrite($pending)
  }finally{$stream.Dispose()}
  $pending=$http.BeginGetResponse($null,$null)
  while(-not $pending.AsyncWaitHandle.WaitOne(200)){if(Test-Cancel $Epoch){$http.Abort();throw 'STOP_REQUESTED'}}
  if(Test-Cancel $Epoch){throw 'STOP_REQUESTED'}
  $response=$http.EndGetResponse($pending)
  $reader=[IO.StreamReader]::new($response.GetResponseStream(),$utf8)
  try{
   $pending=$reader.ReadToEndAsync()
   while(-not $pending.Wait(100)){if(Test-Cancel $Epoch){$http.Abort();throw 'STOP_REQUESTED'}}
   $text=$pending.Result
  }finally{$reader.Dispose()}
  return [pscustomobject]@{status=[int]$response.StatusCode;text=$text;headers=$response.Headers;seconds=$clock.Elapsed.TotalSeconds}
 }finally{if($response){$response.Dispose()};$http.Abort()}
}
function Get-HmalResponseIssue {
 param($Response,[string]$Alias)
 if($Response.model -cne $Alias){return 'RESPONSE_MODEL_IDENTITY_INVALID'}
 if(-not $Response.choices -or -not $Response.choices[0].message){return 'RESPONSE_EMPTY'}
 $choice=$Response.choices[0]
 if($choice.message.tool_calls){return 'RESPONSE_TOOL_CALLS_UNSUPPORTED'}
 if(-not [string]::IsNullOrWhiteSpace([string]$choice.message.content)){
  if($choice.finish_reason -ceq 'length'){return 'RESPONSE_TRUNCATED'}
  if($choice.finish_reason -cne 'stop'){return 'RESPONSE_FINISH_UNVERIFIED'}
  return ''
 }
 $thinking=$choice.message.reasoning_content -or $choice.message.reasoning -or $choice.message.thinking
 if($thinking -and $choice.finish_reason -ceq 'length'){return 'REASONING_BUDGET_EXHAUSTED_NO_ANSWER'}
 if($thinking){return 'REASONING_ONLY_NO_ANSWER'}
 if($choice.finish_reason -ceq 'length'){return 'OUTPUT_LIMIT_NO_ANSWER'}
 return 'RESPONSE_EMPTY'
}
$inputPath=Join-Path $Job 'input.json'
$request=[IO.File]::ReadAllText($inputPath,$utf8)|ConvertFrom-Json
if($env:COMPUTERNAME -cne 'BD'){throw 'HOME_HOST_MISMATCH'}
if((Get-FileHash -LiteralPath $request.controller_path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $request.controller_sha256){throw 'CONTROLLER_CHANGED'}
. $request.controller_path
Assert-Home
function Save-Hmal([string]$Name,$Object,[switch]$Raw){
 $target=Join-Path $Job $Name;$temp=$target+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
 $text=if($Raw){[string]$Object}else{$Object|ConvertTo-Json -Depth 40}
 [IO.File]::WriteAllText($temp,$text,$utf8)
 $handle=[IO.File]::Open($temp,'Open','ReadWrite','None');try{$handle.Flush($true)}finally{$handle.Dispose()}
 if(Test-Path -LiteralPath $target){[IO.File]::Replace($temp,$target,[NullString]::Value)}else{[IO.File]::Move($temp,$target)}
}
function Assert-HmalSlotFree {
 $prior=Read-Json (Join-Path $script:StateDir 'server.json')
 $owned=Get-OwnedProcess $prior
 if($owned){$owned.Dispose();throw 'AI8_BUSY_OTHER_RUN'}
 if(@(Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'").Count){throw 'AI8_BUSY_UNRESOLVED_PROCESS'}
 $phase=Read-Json (Join-Path $script:StateDir 'request-phase.json')
 $ledger=Read-Json (Join-Path $script:StateDir 'acceptance-ledger.json')
 if($phase.active -or $ledger.lease){throw 'AI8_BUSY_ACTIVE_REQUEST_OR_LEASE'}
 # Campaign locks also protect idle gaps between their individual model turns.
 $bench=Join-Path $script:Root 'Benchmarks\LocalLLM'
 if(Test-Path -LiteralPath $bench){
  foreach($directory in @(Get-ChildItem -LiteralPath $bench -Directory)){
   foreach($name in @('campaign-owner.lock','queue-owner.lock')){
    $path=Join-Path $directory.FullName $name
    if(Test-Path -LiteralPath $path){
     try{$handle=[IO.File]::Open($path,'Open','Read','ReadWrite');$handle.Dispose()}
     catch{throw 'AI8_CAMPAIGN_ACTIVE'}
    }
   }
  }
 }
}
function Invoke-HmalMemoryClean([string]$Name){
 $helper=Join-Path $script:Root 'Shared\Tools\AI8.CleanMemory.ps1'
 $proof=(& $helper -Mode clean | Out-String | ConvertFrom-Json)
 Save-Hmal $Name $proof
 if($proof.status -cne 'PASS' -or -not $proof.cleanup_confirmed){throw 'MEMORY_CLEANUP_PENDING'}
}
function Wait-HmalSlotFreeAfterStop {
 $clock=[Diagnostics.Stopwatch]::StartNew()
 while($true){
  try{Assert-HmalSlotFree;return}
  catch{
   # A stopped process can remain briefly in CIM. Never repeat the clean itself.
   if($_.Exception.Message -cne 'AI8_BUSY_UNRESOLVED_PROCESS' -or $clock.ElapsedMilliseconds -ge 3000){throw}
   Start-Sleep -Milliseconds 200
  }
 }
}
if($Cancel){
 $ownerPath=Join-Path $Job 'owner.json'
 if(-not(Test-Path -LiteralPath $ownerPath)){exit 0}
 $owner=[IO.File]::ReadAllText($ownerPath,$utf8)|ConvertFrom-Json
 $live=Read-Json (Join-Path $script:StateDir 'server.json')
 if($owner.job_id -ceq $request.job_id -and $owner.epoch -and $live.epoch -ceq $owner.epoch){Stop-AI8 -Internal}
 exit 0
}
$entered=$false;$state=$null;$sent=$false;$result=$null;$reply=$null;$parsed=$null;$cleanedBefore=$false
try{
 Set-HmalReasoning $request.key ([string]$request.reasoning) @{}
 if(Test-Path -LiteralPath (Join-Path $Job 'cancel')){throw 'STOP_REQUESTED'}
 Assert-HmalSlotFree
 # The cleanup helper owns/releases its own lease, before our capacity gate/lease.
 Invoke-HmalMemoryClean 'memory-before.json';$cleanedBefore=$true
 Enter-Writer;$entered=$true
 $script:OperationStopToken=Get-StopToken
 $script:HmalOriginalTestCancel=${function:Test-Cancel}
 $script:HmalOriginalOperationActive=${function:Assert-OperationActive}
 function Test-Cancel([string]$Epoch){
  if($Epoch -and -not(Test-Path -LiteralPath (Join-Path $Job 'owner.json'))){
   Save-Hmal 'owner.json' @{job_id=$request.job_id;epoch=$Epoch;key=$request.key;phase='LOADING'}
  }
  if(Test-Path -LiteralPath (Join-Path $Job 'cancel')){return $true}
  return (& $script:HmalOriginalTestCancel $Epoch)
 }
 function Assert-OperationActive {
  if(Test-Path -LiteralPath (Join-Path $Job 'cancel')){throw 'STOP_REQUESTED'}
  & $script:HmalOriginalOperationActive
 }
 # Start-AI8 normally stops its predecessor. Never enter it while another task owns a live model.
 Assert-HmalSlotFree
 $cfg=Read-Json (Join-Path $script:ConfigDir ($request.key+'.json'))
 if($cfg.sha256 -cne $request.model_sha256 -or $cfg.key -cne $request.key){throw 'MODEL_CHANGED'}
 if((Get-Sha (Join-Path $script:ConfigDir ($request.key+'.json'))) -cne $request.config_file_sha256){throw 'MODEL_CONFIGURATION_CHANGED'}
 Save-Hmal 'progress.json' @{phase='LOADING';utc=[DateTime]::UtcNow.ToString('o');job_id=$request.job_id}
 $null=Start-AI8 $request.key 'quality-chat'
 $state=Read-Json (Join-Path $script:StateDir 'server.json')
 Save-Hmal 'owner.json' @{job_id=$request.job_id;epoch=$state.epoch;pid=$state.pid;birth_ticks=$state.birth_ticks;key=$state.key}
 if(Test-Path -LiteralPath (Join-Path $Job 'cancel')){throw 'STOP_REQUESTED'}
 $cfg=Read-Json (Join-Path $script:ConfigDir ($request.key+'.json'))
 $profile=$cfg.profiles.'quality-chat'
 $wire=@{model=$cfg.alias;messages=@($request.messages);max_tokens=[int]$request.max_tokens;stream=$false}
 foreach($name in @('temperature','top_p','top_k','min_p','presence_penalty','frequency_penalty','repeat_penalty','reasoning_budget')){
  if($profile.PSObject.Properties[$name]){$wire[$name]=$profile.$name}
 }
 if($wire.ContainsKey('reasoning_budget')){$wire.reasoning_budget=[int]$wire.reasoning_budget}
 # Native reasoning families deliberately have no invented reasoning_effort value.
 if($profile.reasoning_effort -and $profile.reasoning_effort -cne 'native'){$wire.reasoning_effort=$profile.reasoning_effort}
 # Reuse the effective worker kwargs, including the explicit Qwen/LFM preserve=false.
 $templateKwargs=@{}
 $effectiveArgs=@($state.arguments)
 for($i=0;$i-lt ($effectiveArgs.Count-1);$i++){
  if($effectiveArgs[$i] -ceq '--chat-template-kwargs'){
   $effectiveKwargs=([string]$effectiveArgs[$i+1]|ConvertFrom-Json)
   foreach($property in $effectiveKwargs.PSObject.Properties){$templateKwargs[$property.Name]=$property.Value}
  }
 }
 if($templateKwargs.Count){$wire.chat_template_kwargs=$templateKwargs}
 Set-HmalReasoning $request.key ([string]$request.reasoning) $wire
 Set-HmalSampling $profile ([string]$request.reasoning) $wire
 # Validate the effective template and exact token budget before inference; no silent truncation.
 $templateRequest=@{messages=$wire.messages;add_generation_prompt=$true}
 foreach($name in @('reasoning_effort','chat_template_kwargs')){if($wire.ContainsKey($name)){$templateRequest[$name]=$wire[$name]}}
 $templateBody=$utf8.GetBytes(($templateRequest|ConvertTo-Json -Depth 30 -Compress))
 $render=Invoke-LocalHttp ('http://127.0.0.1:'+$state.port+'/apply-template') -Method POST -Body $templateBody -Epoch $state.epoch -TimeoutSeconds 15
 $prompt=[string](($render.text|ConvertFrom-Json).prompt)
 $tokenBody=$utf8.GetBytes((@{content=$prompt;add_special=$true;parse_special=$true}|ConvertTo-Json -Depth 20 -Compress))
 $tokenized=Invoke-LocalHttp ('http://127.0.0.1:'+$state.port+'/tokenize') -Method POST -Body $tokenBody -Epoch $state.epoch -TimeoutSeconds 15
 $inputTokens=@(($tokenized.text|ConvertFrom-Json).tokens).Count
 $slotsReply=Invoke-LocalHttp ('http://127.0.0.1:'+$state.port+'/slots') -Epoch $state.epoch -TimeoutSeconds 15
 $effectiveContext=Get-HmalEffectiveContext ($slotsReply.text|ConvertFrom-Json)
 Set-HmalOutputBudget $wire ([int]$request.max_tokens) $inputTokens $effectiveContext ([string]$request.completion_policy) $(if($request.answer_reserve_tokens){[int]$request.answer_reserve_tokens}else{1024})
 Save-Hmal 'progress.json' @{phase='PREFILL_AND_GENERATION';utc=[DateTime]::UtcNow.ToString('o');job_id=$request.job_id;input_tokens=$inputTokens;effective_context=$effectiveContext;configured_context=[int]$cfg.context;effective_max_tokens=[int]$wire.max_tokens;reasoning_budget_tokens=[int]$wire.reasoning_budget_tokens;completion_policy=$request.completion_policy}
 $body=$utf8.GetBytes(($wire|ConvertTo-Json -Depth 30 -Compress))
 [IO.File]::WriteAllBytes((Join-Path $Job 'wire.json'),$body)
 Write-Json (Join-Path $script:StateDir 'request-phase.json') @{epoch=$state.epoch;active=$true;request=$request.job_id}
 $sent=$true
 Save-Hmal 'dispatch.json' @{job_id=$request.job_id;state='SENT';utc=[DateTime]::UtcNow.ToString('o');epoch=$state.epoch;input_tokens=$inputTokens;wire_sha256=(Get-FileHash (Join-Path $Job 'wire.json')).Hash.ToLowerInvariant()}
 $reply=Invoke-HmalCompletion ('http://127.0.0.1:'+$state.port+'/v1/chat/completions') -Body $body -Epoch $state.epoch -TimeoutSeconds ([int]$request.timeout_seconds)
 # Preserve decoded response text before parsing or validation, including failures.
 Save-Hmal 'response.original.json' ([string]$reply.text) -Raw
 $parsed=$reply.text|ConvertFrom-Json
 $choice=$parsed.choices[0]
 $responseIssue=Get-HmalResponseIssue $parsed $cfg.alias
 if($responseIssue){throw $responseIssue}
 $result=@{state='COMPLETED';job_id=$request.job_id;dispatched=$true;alias=$cfg.alias;model_sha256=$cfg.sha256;profile='quality-chat';text=[string]$choice.message.content;response_original_text=$reply.text;finish_reason=$choice.finish_reason;usage=$parsed.usage;timings=$parsed.timings;seconds=$reply.seconds;input_tokens=$inputTokens;load_seconds=$state.load_seconds;ttft=$null;streaming=$false;epoch=$state.epoch;pid=$state.pid;birth_ticks=$state.birth_ticks;controller_sha256=$request.controller_sha256;config_before_sha256=$request.config_file_sha256;config_effective_sha256=(Get-Sha (Join-Path $script:ConfigDir ($request.key+'.json')));wire_sha256=(Get-Sha (Join-Path $Job 'wire.json'));post_cleanup_status='PENDING'}
 $result.hmal_reasoning=$(if($request.reasoning){$request.reasoning}else{'default'})
 $result.hmal_output_policy=$(if([int]$request.max_tokens -eq 0){'AVAILABLE_CONTEXT'}else{'EXPLICIT_LEGACY_LIMIT'})
 $result.effective_max_tokens=[int]$wire.max_tokens;$result.context_tokens=$effectiveContext
 $result.configured_context=[int]$cfg.context;$result.reasoning_budget_tokens=[int]$wire.reasoning_budget_tokens
 $result.completion_policy=$(if($request.completion_policy){$request.completion_policy}else{'native'})
 $result.answer_reserve_tokens=$(if($request.completion_policy -ceq 'reserve_final'){[int]$request.answer_reserve_tokens}else{0})
 $result.hmal_timeout_seconds=[int]$request.timeout_seconds
 # Preserve a received result before stop/cleanup; recovery never regenerates it.
 Save-Hmal 'result.json' $result
}catch{
 Save-Hmal 'diagnostic.local.json' @{phase=$(if($sent){'AFTER_DISPATCH'}else{'BEFORE_DISPATCH'});message=$_.Exception.Message;position=$_.ScriptStackTrace}
 $code=$_.Exception.Message
 # Do not export a provider body/headers or an arbitrary exception containing a private path.
 if($code -cnotmatch '^[A-Z][A-Z0-9_]+$'){$code='AI8_OPERATION_FAILED_SEE_LOCAL_EVIDENCE'}
 $result=@{state='FAILED';code=$code;dispatched=$sent}
 if($reply){$result.response_original_text=$reply.text;$result.seconds=$reply.seconds}
 if($parsed){$result.usage=$parsed.usage;$result.timings=$parsed.timings;if($parsed.choices){$result.finish_reason=$parsed.choices[0].finish_reason;$result.partial_text=[string]$parsed.choices[0].message.content}}
 if($wire){$result.effective_max_tokens=$wire.max_tokens;$result.reasoning_budget_tokens=$wire.reasoning_budget_tokens}
 if($effectiveContext){$result.context_tokens=$effectiveContext}
 if($inputTokens){$result.input_tokens=$inputTokens}
 $result.completion_policy=$(if($request.completion_policy){$request.completion_policy}else{'native'})
}finally{
 try{
  if($state){
   $live=Read-Json (Join-Path $script:StateDir 'server.json')
   if($live.epoch -ceq $state.epoch){
    Write-Json (Join-Path $script:StateDir 'request-phase.json') @{epoch=$state.epoch;active=$false;request=$request.job_id}
    Stop-AI8 -Internal
    $still=Get-OwnedProcess $state
    if($still){$still.Dispose();throw 'OWNED_STOP_UNCONFIRMED'}
    Save-Hmal 'stop.json' @{status='PASS';epoch=$state.epoch;pid=$state.pid;birth_ticks=$state.birth_ticks;own_process_absent=$true}
   }
  }
 }catch{
  Save-Hmal 'stop.json' @{status='UNKNOWN';code='OWNED_STOP_UNCONFIRMED'}
  if($result){$result.post_cleanup_status='OWNED_STOP_UNCONFIRMED'}
 }finally{if($entered){Exit-Writer}}
 if($cleanedBefore -and $state -and $result.post_cleanup_status -ne 'OWNED_STOP_UNCONFIRMED'){
  try{
   Wait-HmalSlotFreeAfterStop
   Invoke-HmalMemoryClean 'memory-after.json'
   $result.post_cleanup_status='PASS'
  }catch{
   $result.post_cleanup_status='MEMORY_CLEANUP_PENDING'
   Save-Hmal 'memory-after-error.local.json' @{message=$_.Exception.Message}
  }
 }
 if($result){Save-Hmal 'result.json' $result}
}
