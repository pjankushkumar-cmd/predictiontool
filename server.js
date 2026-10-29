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
let db;
try { db=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { db=initial(); }
function save(){const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB_FILE);}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>1e6)reject(new Error('Request too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(new Error('Invalid JSON'))}});});}
function parseRecords(data){const arrs=[data?.data?.list,data?.data?.records,data?.data?.result,data?.data?.items,data?.list,data?.records,data?.result,data?.items,data?.data,Array.isArray(data)?data:null];let a=arrs.find(x=>Array.isArray(x)&&x.length&&typeof x[0]==='object')||[];return a.map(r=>{const period=String(r.issueNumber??r.issue??r.period??r.periodNo??r.issue_no??r.drawId??r.id??'').trim();let v=r.number??r.result??r.openNumber??r.openResult??r.winningNumber??r.num??r.value;if(Array.isArray(v))v=v[0];if(typeof v==='string'){const m=v.match(/-?\d+/);v=m?m[0]:''}const n=Number(v);return {period,number:Number.isInteger(n)&&n>=0&&n<=9?n:null,raw:r}}).filter(r=>r.period&&r.number!==null);}
function bigSmall(n){return n==null?'—':n>=5?'Big':'Small';}
function nextPeriod(p){const m=String(p).match(/^(\d{8})(\d{3,6})$/);if(m)return m[1]+String(Number(m[2])+1).padStart(m[2].length,'0');if(/^\d+$/.test(String(p)))return (BigInt(p)+1n).toString();return String(p)+' + 1';}
function randInt10(){const b=crypto.randomBytes(4).readUInt32BE(0);return b%10;}
function predictionFor(period,role){if(!db.estimates[period]){let n;if(role==='vip')n=randInt10();else {const h=crypto.createHash('sha256').update('EWH-FREE|'+period).digest();let state=h.readUInt32BE(0);state=(Math.imul(state,1664525)+1013904223)>>>0;n=state%10;}db.estimates[period]={period,number:n,label:bigSmall(n),createdAt:Date.now()};save();}return db.estimates[period];}
async function fetchApi(){try{const r=await fetch(API_URL,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw new Error('Upstream HTTP '+r.status);const data=await r.json();const incoming=parseRecords(data);if(!incoming.length)throw new Error('API response fields not recognized');const previous=db.records[0]?.period;const map=new Map();for(const x of [...incoming,...db.records])if(!map.has(x.period))map.set(x.period,x);db.records=[...map.values()].sort((a,b)=>b.period.localeCompare(a.period)).slice(0,100);db.lastApiOk=true;db.lastApiMessage='Connected · '+incoming.length+' records fetched';db.lastFetch=Date.now();const latest=db.records[0];if(latest){const estimate=db.estimates[latest.period];if(estimate&&!estimate.outcomeChecked){estimate.comparison=bigSmall(latest.number)===estimate.label?'WIN':'LOSS';estimate.outcomeChecked=true;estimate.actualNumber=latest.number;estimate.checkedAt=Date.now();db.notices.unshift({period:latest.period,result:estimate.comparison,at:Date.now()});db.notices=db.notices.slice(0,50);}}save();}catch(e){db.lastApiOk=false;db.lastApiMessage=e.message;db.lastFetch=Date.now();save();}}
let fetchBusy=false;async function safeFetch(){if(fetchBusy)return;fetchBusy=true;try{await fetchApi()}finally{fetchBusy=false}}
safeFetch();setInterval(safeFetch,15000);

function auth(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';const s=db.sessions[t];if(!s||s.expires<Date.now()){if(t)delete db.sessions[t];return null;}s.lastSeen=Date.now();const u=db.usage.find(x=>x.keyId===s.keyId);if(u)u.lastSeen=Date.now();save();return s;}
function getDevice(req){return String(req.headers['x-device-id']||'').slice(0,100);}
function newToken(){return crypto.randomBytes(32).toString('hex');}
function responseState(role){const latest=db.records[0];const up=latest?nextPeriod(latest.period):null;const estimate=up?predictionFor(up,role==='vip'?'vip':'free'):null;const records=db.records.slice(0,30).map(r=>{const e=db.estimates[r.period];return {...r,estimate:e?{number:e.number,label:e.label}:null,comparison:e?.comparison||null};});const newest=db.notices[0];return {apiOk:db.lastApiOk,apiMessage:db.lastApiMessage,lastFetch:db.lastFetch,records,upcoming:estimate?{period:up,number:estimate.number,label:estimate.label}:null,newOutcome:newest||null};}
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-Device-ID'});return res.end();}
 if(u.pathname==='/api/login'&&req.method==='POST'){const b=await readBody(req);const key=String(b.key||'');let role=null,keyId=null,name='';if(key===ADMIN_PASSWORD){role='admin';name='Admin';}else if(key===FREE_KEY){role='free';keyId='default-free';name='Default Free';}else if(key===VIP_KEY){role='vip';keyId='default-vip';name='Default VIP';}else{const k=db.keys.find(x=>x.key===key&&!x.disabled);if(!k)return send(res,401,{error:'Invalid key'});const dev=getDevice(req);if(k.boundDevice&&k.boundDevice!==dev)return send(res,403,{error:'This key is already bound to another device'});if(!k.boundDevice){k.boundDevice=dev||crypto.randomUUID();k.firstSeen=Date.now();}role=k.type;keyId=k.id;name=k.name;}const token=newToken();db.sessions[token]={role,keyId,name,deviceId:getDevice(req),expires:Date.now()+30*24*3600*1000,lastSeen:Date.now()};if(keyId){let us=db.usage.find(x=>x.keyId===keyId);if(!us){us={keyId,name,type:role,deviceLabel:getDevice(req),firstSeen:Date.now(),lastSeen:Date.now()};db.usage.unshift(us)}else{us.lastSeen=Date.now();us.deviceLabel=getDevice(req)}}save();return send(res,200,{token,role,name});}
 if(u.pathname==='/api/state'&&req.method==='GET'){const s=auth(req);if(!s)return send(res,401,{error:'Login required'});return send(res,200,responseState(s.role));}
 if(u.pathname==='/api/admin/keys'&&req.method==='GET'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});return send(res,200,{keys:db.keys,usage:db.usage});}
 if(u.pathname==='/api/admin/keys'&&req.method==='POST'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});const b=await readBody(req);const type=b.type==='vip'?'vip':'free';const key='HACKII-'+type.toUpperCase()+'-'+crypto.randomBytes(7).toString('hex').toUpperCase();const k={id:crypto.randomUUID(),name:String(b.name||type.toUpperCase()+' KEY').slice(0,80),type,key,boundDevice:null,createdAt:Date.now()};db.keys.unshift(k);save();return send(res,201,k);}
 const del=u.pathname.match(/^\/api\/admin\/keys\/([a-f0-9-]+)$/i);if(del&&req.method==='DELETE'){const s=auth(req);if(!s||s.role!=='admin')return send(res,403,{error:'Admin only'});db.keys=db.keys.filter(k=>k.id!==del[1]);save();return send(res,200,{ok:true});}
 if(u.pathname.startsWith('/api/'))return send(res,404,{error:'Not found'});
 const file=u.pathname==='/'?'index.html':path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/,'');const full=path.join(__dirname,'public',file);if(!full.startsWith(path.join(__dirname,'public')))return send(res,403,{error:'Forbidden'});fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)});
 }catch(e){send(res,500,{error:e.message||'Server error'});}});
server.listen(PORT,'0.0.0.0',()=>console.log('EARN WITH HACKII listening on '+PORT));
