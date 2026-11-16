import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {egoStatePath} from '../src/config.mjs';
test('explicit browser state wins',()=>assert.equal(egoStatePath({DOUBAO_BROWSER_STATE:'/custom/state.json'},'linux','/home/test'),'/custom/state.json'));
test('Linux/macOS state directory follows XDG',()=>{
 assert.equal(egoStatePath({},'linux','/home/test'),path.join('/home/test','.local','state','ego-lite-linux','browser.json'));
 assert.equal(egoStatePath({XDG_STATE_HOME:'/state'},'darwin','/home/test'),path.join('/state','ego-lite-linux','browser.json'));
});
test('Windows state directory follows LOCALAPPDATA',()=>assert.equal(egoStatePath({LOCALAPPDATA:'/appdata'},'win32','/home/test'),path.join('/appdata','ego-lite-linux','browser.json')));
