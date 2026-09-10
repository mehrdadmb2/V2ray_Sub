(function(){
  "use strict";
  if (window.__GPI_ATTACHED__) return;
  window.__GPI_ATTACHED__ = true;
  const cfg = window.PAGE_INSIGHTS_CONFIG || {};
  const worker = String(cfg.workerUrl || "").replace(/\/+$/, "");
  if (!worker) return;
  const sanitize = v => String(v || "").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^[-.]+|[-.]+$/g,"").slice(0,64);
  const siteId = sanitize(document.querySelector('meta[name="page-insights-site-id"]')?.content || cfg.siteId || location.hostname) || "unknown-site";
  const siteName = document.querySelector('meta[name="page-insights-site-name"]')?.content || cfg.siteName || document.title || siteId;
  const sample = Math.max(0,Math.min(1,Number(cfg.sampleRate ?? 1)));
  if (Math.random() > sample) return;
  const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const read=(s,k)=>{try{return s.getItem(k)}catch{return null}};
  const write=(s,k,v)=>{try{s.setItem(k,v)}catch{}};
  let visitorId=read(localStorage,`gpi:v5:visitor:${siteId}`); if(!visitorId){visitorId=uid();write(localStorage,`gpi:v5:visitor:${siteId}`,visitorId);}
  let session; try{session=JSON.parse(read(sessionStorage,`gpi:v5:session:${siteId}`)||"null")}catch{session=null}
  const now=Date.now(); if(!session||!session.id||now-Number(session.lastSeen||0)>30*60*1000)session={id:uid(),lastSeen:now}; session.lastSeen=now; write(sessionStorage,`gpi:v5:session:${siteId}`,JSON.stringify(session));
  const state={startedAt:now,maxScroll:0,clicks:0,outboundClicks:0,ended:false};
  const conn=()=>{const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return c?{type:c.effectiveType||c.type||"",downlink:c.downlink??null,rtt:c.rtt??null,saveData:!!c.saveData}:null};
  const tz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{return ""}};
  const payload=type=>({siteId,siteName,eventId:uid(),type,sessionId:session.id,visitorId,timestamp:new Date().toISOString(),pageUrl:location.href,path:location.pathname+location.search,title:document.title||"",referrer:document.referrer||"",language:navigator.language||"",timezone:tz(),screen:{width:screen.width||0,height:screen.height||0,devicePixelRatio:devicePixelRatio||1,colorDepth:screen.colorDepth||0},viewport:{width:innerWidth||0,height:innerHeight||0},connection:conn(),durationMs:Math.max(0,Date.now()-state.startedAt),maxScroll:state.maxScroll,clicks:state.clicks,outboundClicks:state.outboundClicks,metadata:{collector:"github-page-insights-v5",visibility:document.visibilityState,referrerPolicy:document.referrerPolicy||""}});
  function send(type,keepalive=false){if(state.ended&&type!=="pageleave")return;const body=JSON.stringify(payload(type));const url=`${worker}/collect`;if(keepalive&&navigator.sendBeacon){try{if(navigator.sendBeacon(url,new Blob([body],{type:"application/json"})))return}catch{}};fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body,mode:"cors",credentials:"omit",keepalive}).catch(()=>{});session.lastSeen=Date.now();write(sessionStorage,`gpi:v5:session:${siteId}`,JSON.stringify(session));}
  function scroll(){const doc=document.documentElement,total=Math.max(1,doc.scrollHeight-innerHeight);state.maxScroll=Math.max(state.maxScroll,Math.min(100,Math.round((scrollY/total)*100)));}
  function click(e){state.clicks++;const a=e.target?.closest?.("a[href]");if(!a)return;try{if(new URL(a.href,location.href).origin!==location.origin)state.outboundClicks++}catch{}}
  function vis(){if(document.hidden)send("visibility");else send("heartbeat")}
  function finish(){if(state.ended)return;state.ended=true;send("pageleave",true)}
  send("pageview");
  const heartbeatMs=Math.max(15000,Number(cfg.heartbeatMs||30000));
  const timer=setInterval(()=>{if(!document.hidden&&!state.ended)send("heartbeat")},heartbeatMs);
  addEventListener("scroll",scroll,{passive:true}); addEventListener("click",click,{capture:true,passive:true}); addEventListener("visibilitychange",vis); addEventListener("pagehide",finish,{capture:true}); addEventListener("beforeunload",finish,{capture:true}); addEventListener("pageshow",()=>{state.ended=false}); addEventListener("pagehide",()=>clearInterval(timer),{once:true});
})();
