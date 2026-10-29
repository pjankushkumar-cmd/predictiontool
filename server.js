const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '/tmp/earn-data';
const DB_FILE = path.join(DATA_DIR, 'state.json');
const API_URL = process.env.RESULT_API_URL || 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-admin-password';
const FREE_KEY = process.env.FREE_KEY || 'HACKII FREE';
const VIP_KEY = process.env.VIP_KEY || 'Hackii#09';

fs.mkdirSync(DATA_DIR, { recursive: true });
function initial(){return {keys:[],records:[],estimates:{},sessions:{},usage:[],lastApiOk:false,lastApiMessage:'Waiting for first API fetch',lastFetch:0,notices:[]};}
function normalizeDb(){db.keys ||= [];db.records ||= [];db.estimates ||= {};db.sessions ||= {};db.usage ||= [];db.notices ||= []; for(const k of db.keys){if(typeof k.disabled!=='boolean')k.disabled=false;if(!('expiresAt' in k))k.expiresAt=null;if(!('boundDevice' in k))k.boundDevice=null;} } 
let db;
try { db=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { db=initial(); }
normalizeDb();
function save(){const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB_FILE);}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>1e6)reject(new Error('Request too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(new Error('Invalid JSON'))}});});}
function parseRecords(data){const arrs=[data?.data?.list,data?.data?.records,data?.data?.result,data?.data?.items,data?.list,data?.records,data?.result,data?.items,data?.data,Array.isArray(data)?data:null];let a=arrs.find(x=>Array.isArray(x)&&x.length&&typeof x[0]==='object')||[];return a.map(r=>{const period=String(r.issueNumber??r.issue??r.period??r.periodNo??r.issue_no??r.drawId??r.id??'').trim();let v=r.number??r.result??r.openNumber??r.openResult??r.winningNumber??r.num??r.value;if(Array.isArray(v))v=v[0];if(typeof v==='string'){const m=v.match(/-?\d+/);v=m?m[0]:''}const n=Number(v);return {period,number:Number.isInteger(n)&&n>=0&&n<=9?n:null,raw:r}}).filter(r=>r.period&&r.number!==null);}
function bigSmall(n){return n==null?'—':n>=5?'Big':'Small';}
function nextPeriod(p){const m=String(p).match(/^(\d{8})(\d{3,6})$/);if(m)return m[1]+String(Number(m[2])+1).padStart(m[2].length,'0');if(/^\d+$/.test(String(p)))return (BigInt(p)+1n).toString();return String(p)+' + 1';}
function randInt10(){const b=crypto.randomBytes(4).readUInt32BE(0);return b%10;}
function predictionFor(period,role){if(!db.estimates[period]){let n;if(role==='vip')n=randInt10();else {const h=crypto.createHash('sha256').update('EWH-FREE|'+period).digest();let state=h.readUInt32BE(0);state=(Math.imul(state,1664525)+1013904223)>>>0;n=state%10;}db.estimates[period]={period,number:n,label:bigSmall(n),createdAt:Date.now()};save();}return db.estimates[period];}
async function fetchApi(){
 try{
  // Standard browser-like headers; this may help when the upstream accepts browser requests
  // but rejects bare server-side fetches. It does not bypass provider-side access controls.
  const r=await fetch(API_URL,{
   method:'GET',
   headers:{
    'accept':'application/json, text/plain, */*',
    'accept-language':'en-US,en;q=0.9,hi;q=0.8',
    'cache-control':'no-cache',
    'pragma':'no-cache',
    'referer':'https://draw.ar-lottery01.com/',
    'origin':'https://draw.ar-lottery01.com',
    'user-agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
   },
   signal:AbortSignal.timeout(12000),cache:'no-store',redirect:'follow'
  });
  const body=await r.text();
  if(!r.ok){
   const snippet=body.replace(/\s+/g,' ').slice(0,180);
   throw new Error('Upstream HTTP '+r.status+(snippet?' · '+snippet:''));
  }
  let data;
  try{data=JSON.parse(body)}catch{throw new Error('API returned non-JSON content')}
  const incoming=parseRecords(data);
  if(!incoming.length)throw new Error('API connected, but result fields were not recognized');
  const map=new Map();
  for(const x of [...incoming,...db.records])if(!map.has(x.period))map.set(x.period,x);
  db.records=[...map.values()].sort((a,b)=>b.period.localeCompare(a.period)).slice(0,100);
  db.lastApiOk=true;db.lastApiMessage='Connected · '+incoming.length+' records fetched';db.lastFetch=Date.now();
  const latest=db.records[0];
  if(latest){const estimate=db.estimates[latest.period];if(estimate&&!estimate.outcomeChecked){estimate.comparison=bigSmall(latest.number)===estimate.label?'WIN':'LOSS';estimate.outcomeChecked=true;estimate.actualNumber=latest.number;estimate.checkedAt=Date.now();db.notices.unshift({period:latest.period,result:estimate.comparison,at:Date.now()});db.notices=db.notices.slice(0,50);}}
  save();
 }catch(e){db.lastApiOk=false;db.lastApiMessage=String(e.message||'API fetch failed').slice(0,260);db.lastFetch=Date.now();save();console.error('[API fetch]',db.lastApiMessage)}
}
let fetchBusy=false;async function safeFetch(){if(fetchBusy)return;fetchBusy=true;try{await fetchApi()}finally{fetchBusy=false}}
safeFetch();setInterval(safeFetch,3000);

function auth(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';const s=db.sessions[t];if(!s||s.expires<Date.now()){if(t)delete db.sessions[t];return null;}const now=Date.now();const k=db.keys.find(x=>x.id===s.keyId);if(k&&(k.disabled||(k.expiresAt&&k.expiresAt<=now))){delete db.sessions[t];save();return null;}const prev=s.lastSeen||now;s.onlineSeconds=(s.onlineSeconds||0)+Math.min(60,Math.max(0,(now-prev)/1000));s.lastSeen=now;const u=db.usage.find(x=>x.keyId===s.keyId&&x.deviceLabel===s.deviceId);if(u){u.onlineSeconds=(u.onlineSeconds||0)+Math.min(60,Math.max(0,(now-(u.lastSeen||now))/1000));u.lastSeen=now;u.onlineSeconds=Math.round(u.onlineSeconds);}save();return s;}
function getDevice(req){return String(req.headers['x-device-id']||'').slice(0,100);}
function newToken(){return crypto.randomBytes(32).toString('hex');}
function responseState(role){const latest=db.records[0];const up=latest?nextPeriod(latest.period):null;const estimate=up?predictionFor(up,role==='vip'?'vip':'free'):null;const records=db.records.slice(0,30).map(r=>{const e=db.estimates[r.period];return {...r,estimate:e?{number:e.number,label:e.label}:null,comparison:e?.comparison||null};});const newest=db.notices[0];return {apiOk:db.lastApiOk,apiMessage:db.lastApiMessage,lastFetch:db.lastFetch,records,upcoming:estimate?{period:up,number:estimate.number,label:estimate.label}:null,newOutcome:newest||null};}
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-Device-ID'});return res.end();}
 if(u.pathname==='/api/login'&&req.method==='POST'){const b=await readBody(req);const key=String(b.key||'');let role=null,keyId=null,name='';if(key===ADMIN_PASSWORD){role='admin';name='Admin';}else if(key===FREE_KEY){role='free';keyId='default-free';name='Default Free';}else if(key===VIP_KEY){role='vip';keyId='default-vip';name='Default VIP';}else{const k=db.keys.find(x=>x.key===key);if(!k)return send(res,401,{error:'Invalid key'});if(k.disabled)return send(res,403,{error:'This key is blocked by admin'});if(k.expiresAt&&k.expiresAt<=Date.now())return send(res,403,{error:'This key has expired'});const dev=getDevice(req); if(k.boundDevice&&k.boundDevice!==dev)return send(res,403,{error:'This key is already bound to another device'});if(!k.boundDevice){k.boundDevice=dev||crypto.randomUUID();k.firstSeen=Date.now();}role=k.type;keyId=k.id;name=k.name;}const token=newToken();db.sessions[token]={role,keyId,name,deviceId:getDevice(req),expires:Date.now()+30*24*3600*1000,lastSeen:Date.now(),onlineSeconds:0};if(keyId){const devLabel=getDevice(req)||'unknown-device';let us=db.usage.find(x=>x.keyId===keyId&&x.deviceLabel===devLabel);if(!us){us={keyId,name,type:role,deviceLabel:devLabel,firstSeen:Date.now(),lastSeen:Date.now(),onlineSeconds:0,logins:0};db.usage.unshift(us)}us.lastSeen=Date.now();us.deviceLabel=getDevice(req);us.logins=(us.logins||0)+1;us.name=name;us.type=role;}save();return send(res,200,{token,role,name});}
 if(u.pathname==='/api/client-results'&&req.method==='POST'){
  const s=auth(req); if(!s)return send(res,401,{error:'Login required'});
  const b=await readBody(req); const incoming=parseRecords(b.data);
  if(!incoming.length)return send(res,400,{error:'No valid result records found in browser response'});
  const map=new Map();
  for(const x of [...incoming,...db.records])if(!map.has(x.period))map.set(x.period,x);
  db.records=[...map.values()].sort((a,b)=>b.period.localeCompare(a.period)).slice(0,100);
  db.lastApiOk=true; db.lastApiMessage='Connected via browser fallback · '+incoming.length+' records'; db.lastFetch=Date.now();
  const latest=db.records[0]; if(latest){const estimate=db.estimates[latest.period];if(estimate&&!estimate.outcomeChecked){estimate.comparison=bigSmall(latest.number)===estimate.label?'WIN':'LOSS';estimate.outcomeChecked=true;estimate.actualNumber=latest.number;estimate.checkedAt=Date.now();db.notices.unshift({period:latest.period,result:estimate.comparison,at:Date.now()});db.notices=db.notices.slice(0,50);}}
  save(); return send(res,200,{ok:true,count:incoming.length});
 }
 if(u.pathname==='/api/state'&&req.method==='GET'){const s=auth(req);if(!s)return send(res,401,{error:'Login required'});return send(res,200,responseState(s.role));}
 if(u.pathname==='/api/admin/keys'&&req.method==='GET'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});const now=Date.now();const usage=db.usage.map(x=>({...x,online:now-(x.lastSeen||0)<90000})).sort((a,b)=>(b.onlineSeconds||0)-(a.onlineSeconds||0));return send(res,200,{keys:db.keys.map(k=>({...k,expired:!!(k.expiresAt&&k.expiresAt<=now)})),usage,stats:{online:usage.filter(x=>x.online).length,offline:usage.filter(x=>!x.online).length,total:usage.length,topUser:usage[0]||null}});}
 if(u.pathname==='/api/admin/keys'&&req.method==='POST'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});const b=await readBody(req);const type=b.type==='vip'?'vip':'free';const key='HACKII-'+type.toUpperCase()+'-'+crypto.randomBytes(7).toString('hex').toUpperCase();const hours=Math.max(0,Math.min(87600,Number(b.durationHours)||0));const k={id:crypto.randomUUID(),name:String(b.name||type.toUpperCase()+' KEY').slice(0,80),type,key,boundDevice:null,createdAt:Date.now(),expiresAt:hours?Date.now()+hours*3600000:null,disabled:false};db.keys.unshift(k);save();return send(res,201,k);}
 const action=u.pathname.match(/^\/api\/admin\/keys\/([a-f0-9-]+)$/i);if(action&&req.method==='PATCH'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});const k=db.keys.find(x=>x.id===action[1]);if(!k)return send(res,404,{error:'Key not found'});const b=await readBody(req);if(b.action==='block')k.disabled=true;else if(b.action==='unblock')k.disabled=false;else if(b.action==='reset-device')k.boundDevice=null;else if(b.action==='set-duration'){const hours=Math.max(0,Math.min(87600,Number(b.durationHours)||0));k.expiresAt=hours?Date.now()+hours*3600000:null;}else return send(res,400,{error:'Unknown action'});save();return send(res,200,{ok:true,key:k});}
 const del=u.pathname.match(/^\/api\/admin\/keys\/([a-f0-9-]+)$/i);if(del&&req.method==='DELETE'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});db.keys=db.keys.filter(k=>k.id!==del[1]);save();return send(res,200,{ok:true});}
 if(u.pathname.startsWith('/api/'))return send(res,404,{error:'Not found'});
 const file=u.pathname==='/'?'index.html':path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/,'');const full=path.join(__dirname,'public',file);if(!full.startsWith(path.join(__dirname,'public')))return send(res,403,{error:'Forbidden'});fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)});
 }catch(e){send(res,500,{error:e.message||'Server error'});}});
server.listen(PORT,'0.0.0.0',()=>console.log('EARN WITH HACKII listening on '+PORT));
