import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

export const root = resolve('tmp/regression-tests');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function until(fn, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await sleep(25); }
  throw new Error('Condition timed out');
}
export async function fixture(name) {
  const dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  const envFile = resolve(dir, 'isolated.env');
  writeFileSync(envFile, '');
  const png = await sharp({create:{width:2048,height:2048,channels:3,background:'#456abc'}}).png().toBuffer();
  const pending = [];
  let hold = false;
  let responseStatus = 200;
  const requests = [];
  const upstream = createServer(async(req,res) => {
    let raw=''; for await (const chunk of req) raw += chunk;
    requests.push({url:req.url,body:raw});
    const reply = () => { res.writeHead(responseStatus, {'Content-Type':'application/json'}); res.end(JSON.stringify({data:[{b64_json:png.toString('base64')}]})); };
    if (hold) pending.push(reply); else reply();
  });
  upstream.listen(0,'127.0.0.1'); await once(upstream,'listening');
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  const probe = createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port; await new Promise(r=>probe.close(r));
  let proc, logs='';
  const api = `http://127.0.0.1:${port}`;
  const env = {...process.env, HOST:'127.0.0.1', PORT:String(port), IMAGE2_ENV_FILE:envFile,
    IMAGE2_DATA_DIR:dir, IMAGE2_API_KEY:'review-placeholder', NOWCODING_API_KEY:'review-placeholder',
    IMAGE2_ADMIN_KEY:'review-admin-placeholder', IMAGE2_ADMIN_OPEN:'false', IMAGE2_SECURE_COOKIES:'false',
    IMAGE2_SHOW_DEV_CODES:'true', IMAGE2_SIGNUP_CREDITS:'5', IMAGE2_GENERATION_COST_CREDITS:'0.05',
    IMAGE2_ACTIVE_PROVIDER_ID:'review', IMAGE2_PROVIDERS_JSON:JSON.stringify([{id:'review',label:'review',enabled:true,apiUrl:upstreamUrl,apiKey:'review-placeholder',apiFormat:'ai-pixel',model:'gpt-image-2.5-flare'}])};
  async function start() {
    logs='';
    proc=spawn(process.execPath,['scripts/dev-api.mjs'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    proc.stdout.on('data',d=>logs+=d); proc.stderr.on('data',d=>logs+=d);
    await until(async()=> {if(proc.exitCode!==null) throw new Error(logs); try{return (await fetch(api+'/api/auth/me')).ok;}catch{return false;} });
  }
  async function stop() { if(proc && proc.exitCode===null) {proc.kill(); await once(proc,'exit');} }
  async function request(path, {cookie,admin=false,method='GET',body}={}) {
    const headers={}; if(cookie) headers.Cookie=cookie; if(admin) headers.Authorization='Bearer review-admin-placeholder';
    if(body!==undefined) headers['Content-Type']='application/json';
    const response=await fetch(api+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function login(email='review@example.invalid') {
    const sent=await request('/api/auth/request-code',{method:'POST',body:{email}});
    return request('/api/auth/verify-code',{method:'POST',body:{email,code:sent.body.devCode}});
  }
  await start();
  return {api,dir,request,login,start,stop,png,requests,setResponseStatus:value=>{responseStatus=value;},get proc(){return proc;},get logs(){return logs;},
    data:()=>JSON.parse(readFileSync(resolve(dir,'image2-data.json'),'utf8')),
    hold:()=>{hold=true;},pending,release:()=>{hold=false; pending.splice(0).forEach(r=>r());},
    async close(){await stop(); upstream.closeAllConnections(); await new Promise(r=>upstream.close(r));}};
}
