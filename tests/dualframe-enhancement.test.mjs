import test from 'node:test';
import assert from 'node:assert/strict';
import {ENHANCEMENT_CONTRACT,normalizeEnhancementRecipe,enhancementPrompt,compositionFromMasterPrompt,masterGeometry,enhancementOutputGeometry,enhancementPlan} from '../functions/lib/dualframe/enhancement.mjs';

test('strict recipes retain candidate defaults and reject unrecognized authority or schemas',()=>{
 const recipe={kind:'natural'};
 assert.deepEqual(normalizeEnhancementRecipe(recipe),{schema:ENHANCEMENT_CONTRACT,kind:'natural',strength:'natural',background:'keep'});
 assert.deepEqual(recipe,{kind:'natural'});
 for(const input of [null,[],new Date()])assert.throws(()=>normalizeEnhancementRecipe(input),/ENHANCEMENT_RECIPE_REQUIRED/);
 assert.throws(()=>normalizeEnhancementRecipe({kind:'natural',owner:'another-owner'}),/ENHANCEMENT_RECIPE_INVALID/);
 assert.throws(()=>normalizeEnhancementRecipe({kind:'natural',schema:'future'}),/ENHANCEMENT_SCHEMA_INVALID/);
 assert.throws(()=>normalizeEnhancementRecipe({kind:'natural',strength:'extreme'}),/ENHANCEMENT_STRENGTH_INVALID/);
});

test('background selection is exclusive; artistic replaces conflicting natural directions',()=>{
 for(const background of ['keep','cleanup','replace','studio'])assert.equal(normalizeEnhancementRecipe({kind:'natural',background}).background,background);
 assert.equal(normalizeEnhancementRecipe({kind:'artistic'}).background,'free');
 for(const [kind,background] of [['natural','free'],['artistic','keep'],['natural',['keep','studio']]])assert.throws(()=>normalizeEnhancementRecipe({kind,background}),/ENHANCEMENT_BACKGROUND_INVALID/);
 const artistic=enhancementPrompt({kind:'artistic'});
 assert.match(artistic,/Freely change pose, outfit/);
 assert.match(artistic,/exact number of people/);
 assert.match(artistic,/not a claim about historical events/);
 assert.doesNotMatch(artistic,/Keep the existing location/);
});

test('both prompt stages retain identity and anatomy rules without silently truncating',()=>{
 for(const background of ['keep','cleanup','replace','studio']){
  const text=enhancementPrompt({kind:'natural',background});
  assert.match(text,/apparent age/);assert.match(text,/plastic beauty filter/);
  assert.match(text,/exact number of people/);assert.match(text,/Do not crop away original context/);
  assert.ok(text.length<=1500);
 }
 for(const target of ['landscape','portrait']){
  const text=compositionFromMasterPrompt(target,'Keep the full group visible');
  assert.match(text,/SAME scene/);assert.match(text,/Do not retouch faces again/);
  assert.match(text,/full group visible/);assert.ok(text.length<=1500);
 }
 const baseline=enhancementPrompt({kind:'natural'});
 assert.equal(enhancementPrompt({kind:'natural'},'',{maxLength:baseline.length}),baseline);
 assert.throws(()=>enhancementPrompt({kind:'natural'},'',{maxLength:baseline.length-1}),/ENHANCEMENT_PROMPT_TOO_LONG/);
 assert.throws(()=>enhancementPrompt({kind:'natural'},'z'.repeat(451)),/ENHANCEMENT_DIRECTION_INVALID/);
 assert.throws(()=>enhancementPrompt({kind:'natural'},'\u202ehidden'),/ENHANCEMENT_DIRECTION_INVALID/);
 assert.throws(()=>compositionFromMasterPrompt('square'),/TARGET_INVALID/);
 assert.throws(()=>compositionFromMasterPrompt('portrait','',{maxLength:10}),/ENHANCEMENT_PROMPT_TOO_LONG/);
 assert.match(enhancementPrompt({kind:'natural'},'cafe\u0301'),/café/);
});

test('master geometry preserves source framing for square, 4:3 and portrait sources',()=>{
 for(const [width,height] of [[1600,1200],[1200,1200],[1200,1600]]){
  const p=masterGeometry(width,height);
  assert.equal(p.width,width);assert.equal(p.height,height);
  assert.equal(p.fit,'contain');assert.equal(p.no_crop,true);assert.equal(p.padding,false);
  assert.equal(p.source_is_resampled,false);
 }
 const p=masterGeometry(4033,3025,{maxEdge:1536,multiple:16});
 assert.ok(p.width<=1536&&p.height<=1536);
 assert.equal(p.width%16,0);assert.equal(p.height%16,0);
 assert.ok(p.x>=0&&p.y>=0&&p.x+p.content_width<=p.width&&p.y+p.content_height<=p.height);
 assert.ok(Math.abs(p.content_width/p.content_height-4033/3025)<.003);
 assert.equal(p.no_crop,true);assert.equal(p.source_is_resampled,true);
});

test('invalid or impossible raster bounds fail before a provider call can be planned',()=>{
 for(const [w,h] of [[0,20],[1.5,20],[5000,5000],[Infinity,100]])assert.throws(()=>masterGeometry(w,h),/ENHANCEMENT_GEOMETRY_INVALID/);
 assert.throws(()=>masterGeometry(1000,1000,{maxEdge:15,multiple:16}),/ENHANCEMENT_GEOMETRY_LIMIT_INVALID/);
 assert.throws(()=>masterGeometry(1000,1,{maxEdge:1024,multiple:16,maxPixels:10}),/ENHANCEMENT_GEOMETRY_UNSUPPORTED/);
 assert.deepEqual(enhancementOutputGeometry('portrait','4k'),{width:2160,height:3840});
 assert.deepEqual(enhancementOutputGeometry('landscape','hd'),{width:1920,height:1080});
});

test('call plans disclose extra nonstandard-ratio composition and optional contain alternative',()=>{
 const input={source:{width:1920,height:1080},recipe:{kind:'natural'}};
 const exact=enhancementPlan(input);
 assert.equal(exact.maximum_model_calls,2);
 assert.deepEqual(exact.frames.map(f=>f.operation),['derive','expand']);
 assert.equal(exact.master.accept_before_frames,true);
 const square=enhancementPlan({...input,source:{width:1200,height:1200}});
 assert.equal(square.maximum_model_calls,3);
 assert.deepEqual(square.frames.map(f=>f.operation),['expand','expand']);
 const contained=enhancementPlan({...input,source:{width:1600,height:1200},sameOrientationFit:'contain'});
 assert.equal(contained.maximum_model_calls,2);
 assert.equal(contained.frames[0].fit,'contain');assert.equal(contained.frames[0].disclosed_padding,true);
 const portrait=enhancementPlan({...input,source:{width:1080,height:1920}});
 assert.equal(portrait.maximum_model_calls,2);assert.equal(portrait.frames[0].target,'portrait');
});

test('enhance-only, HD derivation and Free disclosures never grant payment or native-pixel authority',()=>{
 const input={source:{width:1920,height:1080,sha256:'a'.repeat(64)},recipe:{kind:'artistic'},quality:'4k',includeHD:true};
 const only=enhancementPlan({...input,enhanceOnly:true});
 assert.equal(only.maximum_model_calls,1);assert.deepEqual(only.frames,[]);assert.deepEqual(only.hd_copy_targets,[]);assert.equal(only.include_hd_copy,false);
 const pair=enhancementPlan(input);
 assert.equal(pair.maximum_model_calls,2);assert.equal(pair.hd_copy_model_calls,0);
 assert.deepEqual(pair.hd_copy_targets,['landscape','portrait']);
 assert.equal(pair.service_tier,'free');assert.equal(pair.paid_fallback,false);
 assert.equal(pair.estimated_cost,null);assert.equal(pair.authorized,false);
 assert.equal(pair.native_resolution_verified,false);assert.equal(pair.provider_capability_verified,false);
 assert.equal(pair.master.role,'artistic-master');
 assert.throws(()=>enhancementPlan({...input,serviceTier:'admin'}),/ENHANCEMENT_PLAN_INVALID/);
 assert.throws(()=>enhancementPlan({...input,source:{width:100,height:100,sha256:'fake'}}),/ENHANCEMENT_SOURCE_HASH_INVALID/);
});
