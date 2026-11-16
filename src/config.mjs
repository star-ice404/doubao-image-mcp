import os from 'node:os';
import path from 'node:path';
export function egoStatePath(env=process.env,platform=process.platform,home=os.homedir()) {
  if(env.DOUBAO_BROWSER_STATE)return env.DOUBAO_BROWSER_STATE;
  const base=platform==='win32'?(env.LOCALAPPDATA??path.join(home,'AppData','Local')):(env.XDG_STATE_HOME??path.join(home,'.local','state'));
  return path.join(base,'ego-lite-linux','browser.json');
}
