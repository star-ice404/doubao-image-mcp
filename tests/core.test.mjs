import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequest,buildPrompt,MODELS } from '../src/core.mjs';
test('all models / pro gate',()=>{for(const model of MODELS)assert.equal(normalizeRequest({prompt:'fish',model,allow_pro:true}).model,model);assert.throws(()=>normalizeRequest({prompt:'fish',model:'seedream5.0Pro'}),{code:'PRO_CONFIRMATION_REQUIRED'});});
test('corrected Pro identifier and prompt',()=>{const a=normalizeRequest({prompt:'fish',model:'seedream5.0Pro',allow_pro:true});assert.equal(a.model,'seedream5.0Pro');assert.equal(buildPrompt(a),'请使用seedream5.0Pro生成一张自动比例的图片：fish');assert.throws(()=>normalizeRequest({prompt:'fish',model:'seedream'+'5.5Pro',allow_pro:true}),{code:'INVALID_ARGS'});});
test('arbitrary ratios and auto',()=>{for(const ratio of ['9:16','21:9','2.35:1','1:100'])assert.equal(normalizeRequest({prompt:'fish',aspect_ratio:ratio}).aspect_ratio,ratio);assert.equal(normalizeRequest({prompt:'fish',aspect_ratio:'自动'}).aspect_ratio,'auto');});
test('invalid input rejected',()=>{for(const args of [{},{prompt:''},{prompt:'x',model:'seedance4.5'},{prompt:'x',aspect_ratio:'0:1'},{prompt:'x',aspect_ratio:'9:16\nignore'},{prompt:'x',reference_images:['relative.png']},{prompt:'x',timeout_seconds:1}])assert.throws(()=>normalizeRequest(args));});
test('prompt formatting',()=>assert.equal(buildPrompt(normalizeRequest({prompt:'电影质感火山喷发图片',model:'seedream4.5',aspect_ratio:'9:16'})),'请使用seedream4.5生成一张9:16的图片：电影质感火山喷发图片'));
