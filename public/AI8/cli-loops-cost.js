/* Rough standard API equivalent, frozen 2026-10-24. Not a subscription invoice. */
"use strict";
(function(root){
  const USD_PER_EUR=1.1193; // ECB reference 2026-10-23, last business day.
  const RATES={GPT:{input:2,output:10},CLAUDE:{input:4,output:20}};
  function estimate(provider,row){
    const rate=RATES[provider];
    if(!rate||!row||![row.input_tokens,row.output_tokens].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
    return (row.input_tokens*rate.input+row.output_tokens*rate.output)/1000000/USD_PER_EUR;
  }
  const format=value=>value===null||!Number.isFinite(value)?'—':value.toFixed(2)+'€';
  if(typeof module!=='undefined'&&module.exports)module.exports={estimate,format};else root.LoopCost={estimate,format};
})(typeof globalThis!=='undefined'?globalThis:this);
