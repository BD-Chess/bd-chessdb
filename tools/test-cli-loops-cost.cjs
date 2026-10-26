"use strict";
const assert=require('node:assert/strict'),{estimate,format}=require('../public/AI8/cli-loops-cost.js');
assert.equal(estimate('GPT',{input_tokens:1000000,output_tokens:1000000}),12/1.1193);
assert.equal(estimate('CLAUDE',{input_tokens:1000000,output_tokens:1000000}),24/1.1193);
assert.equal(format(estimate('GPT',{input_tokens:1000000,output_tokens:0})),'1.79€');
assert.equal(format(null),'—');assert.equal(format(estimate('UNKNOWN',{input_tokens:1,output_tokens:1})),'—');
assert.equal(format(estimate('GPT',{input_tokens:-1,output_tokens:0})),'—');assert.equal(format(0),'0.00€');
assert.equal(estimate('GPT',{input_tokens:100,output_tokens:20,cached_input_tokens:100}),estimate('GPT',{input_tokens:100,output_tokens:20}));
console.log('PASS: provider weighting, USD/EUR direction, exact xx.xx€ format, unknown/invalid data, explicit uncached assumption.');
