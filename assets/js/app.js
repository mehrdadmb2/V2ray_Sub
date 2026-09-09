(() => {
  'use strict';

  const DATA_SOURCES = [
    { id: 'mix', name: 'Mix', file: 'Mix.txt', icon: 'fa-layer-group', cls: 'mix' },
    { id: 'irancell', name: 'Irancell', file: 'Irancell.txt', icon: 'fa-signal', cls: 'irancell' },
    { id: 'mci', name: 'MCI', file: 'Mci.txt', icon: 'fa-tower-cell', cls: 'mci' }
  ];
  const BASE = new URL('.', location.href).href;
  const RAW_BASE = 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/main/';
  const CLIENTS = [
    {
      id: 'v2rayng', name: 'V2rayNG', platform: 'Android', icon: '../Pic/iconv2rayng.jpg', altIcon: './Pic/iconv2rayng.jpg', accent: 'purple',
      repo: 'https://github.com/2dust/v2rayNG/releases',
      desc: 'کلاینت محبوب اندروید برای V2Ray/Xray با مسیر ساده برای افزودن Subscription و به‌روزرسانی کانفیگ‌ها.',
      features: ['Android', 'VLESS', 'VMess', 'Trojan', 'Reality'],
      steps: [
        { title: 'برنامه را باز کن', desc: 'V2rayNG را اجرا کن و وارد صفحه اصلی برنامه شو.', image: './Pic/Screenshot_2025-02-27-14-41-55-096_com.v2ray.ang-edit.jpg' },
        { title: 'منوی Subscription را باز کن', desc: 'از منوی مربوط به Subscription Group / تنظیمات اشتراک وارد بخش مدیریت اشتراک‌ها شو.', image: './Pic/Screenshot_2025-02-27-14-42-51-665_com.v2ray.ang-edit.jpg' },
        { title: 'افزودن Subscription', desc: 'گزینه افزودن Subscription جدید را انتخاب کن.', image: './Pic/Screenshot_2025-02-27-14-43-25-782_com.v2ray.ang-edit.jpg' },
        { title: 'نام و URL را وارد کن', desc: 'یک نام دلخواه بنویس، لینک اشتراک را Paste کن و در صورت وجود Auto Update را فعال نگه دار.', image: './Pic/Screenshot_2025-02-27-14-44-08-341_com.v2ray.ang-edit.jpg' },
        { title: 'به‌روزرسانی را اجرا کن', desc: 'Subscription را Refresh / Update کن تا کانفیگ‌ها از لینک دریافت شوند.', image: './Pic/Screenshot_2025-02-27-14-46-29-900_com.v2ray.ang-edit.jpg' },
        { title: 'Ping / تست و استفاده', desc: 'پس از دریافت، سرورهای موردنظر را بررسی و Ping کن و در نهایت کانفیگ مناسب را انتخاب کن.', image: './Pic/Screenshot_2025-02-27-14-46-54-915_com.v2ray.ang.jpg' }
      ]
    },
    {
      id: 'npv', name: 'NPV Tunnel', platform: 'Mobile', icon: './Pic/NPV%20tunnel/icon.jpg', accent: 'cyan',
      repo: 'https://apps.apple.com/us/app/npv-tunnel/id1629465476',
      desc: 'راهنمای اختصاصی NPV Tunnel بر اساس پنج تصویر مرحله‌ای موجود در خود ریپو.',
      features: ['Subscription', 'VLESS', 'VMess', 'Trojan', 'Step-by-step'],
      steps: [
        { title: 'برنامه را باز کن و وارد Config شو', desc: 'NPV Tunnel را باز کن و از نوار پایین وارد بخش Configs شو.', image: './Pic/NPV%20tunnel/1.jpg' },
        { title: 'دکمه + را بزن', desc: 'در پایین صفحه روی دکمه + برای افزودن تنظیم جدید بزن.', image: './Pic/NPV%20tunnel/2.jpg' },
        { title: 'Add Subscription را انتخاب کن', desc: 'از گزینه‌های نمایش‌داده‌شده، Add Subscription را انتخاب کن.', image: './Pic/NPV%20tunnel/3.jpg' },
        { title: 'نام و لینک Subscription را وارد کن', desc: 'نام دلخواه برای Subscription را وارد کن و لینک URL اشتراک را Paste کن.', image: './Pic/NPV%20tunnel/4.jpg' },
        { title: 'تأیید، Refresh و Ping', desc: 'ذخیره/تأیید کن، سپس Subscription را Refresh کن، Ping بگیر و بعد سرور مناسب را انتخاب کن.', image: './Pic/NPV%20tunnel/5.jpg' }
      ]
    }
  ];

  const state = {
    configs: [], filtered: [], favorites: new Set(loadJson('v2ray_sub_favorites', [])), customSources: loadJson('v2ray_sub_custom', []), sourceResults: {},
    page: 1, pageSize: Number(localStorage.getItem('v2ray_sub_page_size') || 25), currentGuide: null, guideStep: 0, motion: loadJson('v2ray_sub_motion', true),
    autoRefresh: loadJson('v2ray_sub_auto_refresh', true), compact: loadJson('v2ray_sub_compact', false), refreshMinutes: Number(localStorage.getItem('v2ray_sub_refresh_minutes') || 15), refreshTimer: null, lastFetchMs: 0
  };

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const sourceUrl = src => RAW_BASE + src.file;
  function loadJson(key, fallback){ try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function saveJson(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function toast(message, type='info'){ const host=$('#toastStack'); const el=document.createElement('div'); el.className=`toast ${type}`; el.innerHTML=`<i class="fa-solid ${type==='ok'?'fa-circle-check':type==='err'?'fa-triangle-exclamation':'fa-circle-info'}"></i><span>${esc(message)}</span>`; host.appendChild(el); setTimeout(()=>el.remove(),3200); }
  async function copyText(text, success='کپی شد'){ try{ await navigator.clipboard.writeText(text); toast(success,'ok'); }catch{ const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(success,'ok'); } }
  function downloadText(filename, content, mime='text/plain;charset=utf-8'){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:mime})); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }

  function detectOS(){
    const ua=navigator.userAgent;
    let name='Desktop', icon='fa-desktop', client='V2rayN / Hiddify', href='https://github.com/2dust/v2rayN/releases#';
    if(/Android/i.test(ua)){ name='Android'; icon='fa-android'; client='V2rayNG'; href='https://github.com/2dust/v2rayNG/releases'; }
    else if(/iPhone|iPad|iPod/i.test(ua)){ name='iOS / iPadOS'; icon='fa-apple'; client='NPV Tunnel'; href='https://apps.apple.com/us/app/npv-tunnel/id1629465476'; }
    else if(/Windows/i.test(ua)){ name='Windows'; icon='fa-windows'; client='v2rayN'; href='https://github.com/2dust/v2rayN/releases'; }
    else if(/Macintosh|Mac OS/i.test(ua)){ name='macOS'; icon='fa-apple'; client='Hiddify'; href='https://github.com/hiddify/hiddify-app/releases'; }
    else if(/Linux/i.test(ua)){ name='Linux'; icon='fa-linux'; client='Hiddify'; href='https://github.com/hiddify/hiddify-app/releases'; }
    $('#osName').textContent=name; $('#osIcon').innerHTML=`<i class="fa-brands ${icon}"></i>`; const link=$('#osClient'); link.textContent=client; link.href=href;
  }

  function setMotion(on){ state.motion=!!on; document.body.classList.toggle('motion-off',!state.motion); saveJson('v2ray_sub_motion',state.motion); $('#motionToggle').checked=state.motion; }
  function switchSection(id){
    const target=`section-${id}`; $$('.content-section').forEach(s=>s.classList.toggle('active',s.id===target)); $$('.rail-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===id)); $$('.chip').forEach(b=>b.classList.toggle('active',b.dataset.section===id)); window.scrollTo({top:0,behavior:'smooth'});
  }
  function parseFlag(name){ const m=String(name||'').match(/^([\u{1F1E6}-\u{1F1FF}]{2})/u); return m?m[1]:'🏳️'; }
  function countryFromFlag(flag){ if(!flag || flag==='🏳️') return 'Unknown'; const a=flag.codePointAt(0)-0x1F1E6,b=flag.codePointAt(2)-0x1F1E6; const chars=String.fromCharCode(65+a,65+b); const map={US:'United States',DE:'Germany',FR:'France',NL:'Netherlands',TR:'Turkey',IR:'Iran',AE:'UAE',SG:'Singapore',JP:'Japan',KR:'South Korea',GB:'United Kingdom',RU:'Russia',CA:'Canada',HK:'Hong Kong',AT:'Austria',FI:'Finland',SE:'Sweden',CH:'Switzerland',IT:'Italy',ES:'Spain',RO:'Romania',PL:'Poland',ID:'Indonesia',BR:'Brazil',IN:'India',UA:'Ukraine',CN:'China'}; return map[chars] || chars; }
  function safeDecode(s){ try{return decodeURIComponent(s)}catch{return s} }
  function parseConfigLine(raw, source=''){ const line=String(raw).trim(); if(!line || line.startsWith('#') || line.startsWith('//')) return null; let u=line, protocol='other',host='',port='',security='',transport='',name=''; try{
      const lower=line.toLowerCase(); protocol=lower.startsWith('vless://')?'vless':lower.startsWith('vmess://')?'vmess':lower.startsWith('trojan://')?'trojan':lower.startsWith('ss://')?'shadowsocks':lower.startsWith('socks://')?'socks':lower.startsWith('http://')?'http':lower.startsWith('https://')?'http':'other';
      const hash=line.indexOf('#'); if(hash>=0) name=safeDecode(line.slice(hash+1));
      if(protocol==='vmess'){ try{ const b=line.slice(8).split('#')[0]; const obj=JSON.parse(atob(b.replace(/-/g,'+').replace(/_/g,'/'))); host=obj.add||''; port=obj.port||''; name=name||obj.ps||''; security=obj.tls||''; transport=obj.net||''; }catch{} }
      else { const parsed=new URL(line); host=parsed.hostname||''; port=parsed.port||''; const p=parsed.searchParams; security=p.get('security')||''; transport=p.get('type')||p.get('network')||''; if(!name) name=safeDecode(parsed.hash.replace(/^#/,'')||''); }
    }catch{ const m=line.match(/@([^:/?#]+)(?::(\d+))?/); if(m){host=m[1];port=m[2]||'';} }
    if(!name) name=host||'Unnamed config'; security=security.toLowerCase(); transport=transport.toLowerCase(); if(security.includes('reality')) security='Reality'; else if(security.includes('tls')) security='TLS'; else if(!security) security='None'; if(!transport) transport=protocol==='http'?'http':'tcp'; const flag=parseFlag(name); return {raw:line,source,protocol,host,port,name,country:countryFromFlag(flag),flag,security,transport}; }
  function protocolClass(p){ return ['vless','vmess','trojan','shadowsocks'].includes(p)?`proto-${p}`:'proto-other'; }
  function uniqueByRaw(arr){ const seen=new Set(); return arr.filter(x=>{ if(seen.has(x.raw)) return false; seen.add(x.raw); return true; }); }

  async function fetchSource(src){
    const start=performance.now(); const res=await fetch(sourceUrl(src),{cache:'no-store'}); const text=await res.text(); const ms=Math.round(performance.now()-start); if(!res.ok) throw new Error(`HTTP ${res.status}`); const lines=text.split(/\r?\n/); const configs=lines.map(l=>parseConfigLine(l,src.id)).filter(Boolean); return {configs,ms,bytes:new Blob([text]).size,lines:lines.length};
  }
  async function loadAll(){
    const start=performance.now(); renderSourceCardsLoading(); const all=[]; for(const src of DATA_SOURCES){ try{ const result=await fetchSource(src); state.sourceResults[src.id]={ok:true,...result}; all.push(...result.configs); }catch(err){ state.sourceResults[src.id]={ok:false,error:err.message,configs:[],ms:0,bytes:0}; toast(`${src.name}: دریافت داده ناموفق بود`,'err'); } }
    for(const custom of state.customSources){ try{ const result=await fetch(custom.url,{cache:'no-store'}); const text=await result.text(); const configs=text.split(/\r?\n/).map(l=>parseConfigLine(l,custom.name)).filter(Boolean); all.push(...configs); }catch{} }
    state.configs=uniqueByRaw(all); state.lastFetchMs=Math.round(performance.now()-start); state.page=1; applyFilters(); renderDashboard(); renderSubscriptions(); renderSavedCustom(); renderDiagnostics(); $('#lastUpdated').textContent=`آخرین دریافت ${new Date().toLocaleTimeString('fa-IR')}`; $('#liveLabel').textContent='Live data'; toast(`داده‌ها دریافت شد: ${fmt(state.configs.length)} کانفیگ`,'ok'); if(state.autoRefresh) scheduleRefresh();
    return state.configs;
  }
  function scheduleRefresh(){ clearTimeout(state.refreshTimer); state.refreshTimer=setTimeout(()=>loadAll(), state.refreshMinutes*60000); }

  function renderSourceCardsLoading(){ $('#sourceHealthGrid').innerHTML=DATA_SOURCES.map(s=>`<div class="source-card"><div class="source-top"><span class="source-name">${s.name}</span><span class="status-badge loading">Loading</span></div><div class="source-url">${esc(sourceUrl(s))}</div><div class="source-meta"><span>دریافت…</span><span>— ms</span></div></div>`).join(''); }
  function renderDashboard(){
    const configs=state.configs; const countries=new Set(configs.map(c=>c.country).filter(Boolean)); const protocols=[...new Set(configs.map(c=>c.protocol))]; const bytes=DATA_SOURCES.reduce((a,s)=>a+(state.sourceResults[s.id]?.bytes||0),0); $('#statConfigs').textContent=fmt(configs.length); $('#statConfigsSub').textContent=`${fmt(configs.filter(c=>c.protocol==='vless').length)} VLESS`; $('#statCountries').textContent=fmt(countries.size); $('#statProtocols').textContent=fmt(protocols.length); $('#statProtocolsSub').textContent=protocols.map(p=>p.toUpperCase()).join(' · ')||'—'; $('#statFetch').textContent=fmt(state.lastFetchMs); $('#statSize').textContent=bytes>1024*1024?(bytes/1024/1024).toFixed(2)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';
    $('#sourceHealthGrid').innerHTML=DATA_SOURCES.map(s=>{const r=state.sourceResults[s.id]||{}; return `<div class="source-card"><div class="source-top"><span class="source-name">${s.name}</span><span class="status-badge ${r.ok?'ok':'err'}">${r.ok?'ONLINE':'ERROR'}</span></div><div class="source-url">${esc(sourceUrl(s))}</div><div class="source-meta"><span>${r.ok?fmt(r.configs?.length||0)+' configs':'غیرقابل دریافت'}</span><span>${r.ok?fmt(r.ms)+' ms':esc(r.error||'')}</span></div></div>`}).join('');
    const counts={}; configs.forEach(c=>counts[c.protocol]=(counts[c.protocol]||0)+1); const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]); const colors=['#9b7cff','#4ad8ff','#ff70c9','#47e6a0','#ffc35a','#5aa7ff']; let acc=0; const total=configs.length||1; const stops=[]; entries.forEach(([,v],i)=>{stops.push(`${colors[i%colors.length]} ${acc/total*100}% ${(acc+v)/total*100}%`); acc+=v;}); $('#protocolDonut').style.background=`conic-gradient(${stops.join(',')||'#222 0 100%'})`; $('#donutTotal').textContent=fmt(configs.length); $('#protocolLegend').innerHTML=entries.slice(0,6).map((e,i)=>`<div class="legend-row"><span class="legend-label"><i class="legend-dot" style="background:${colors[i%colors.length]}"></i>${e[0].toUpperCase()}</span><strong>${fmt(e[1])}</strong></div>`).join('')||'<div class="legend-row">داده‌ای وجود ندارد</div>';
    const cc={}; configs.forEach(c=>cc[c.country]=(cc[c.country]||0)+1); const topCountries=Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,10); const max=topCountries[0]?.[1]||1; $('#countryBars').innerHTML=topCountries.map(([name,n])=>`<div class="bar-row"><span class="bar-label">${esc(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,n/max*100)}%"></div></div><strong>${fmt(n)}</strong></div>`).join('')||'<div class="bar-row">—</div>';
    renderSourceCardsLoadingIfEmpty(); renderQuickSubscriptions(); bindTilt();
  }
  function renderSourceCardsLoadingIfEmpty(){ if(!state.configs.length && !Object.keys(state.sourceResults).length) renderSourceCardsLoading(); }

  function renderSubscriptions(){
    const customCount=state.customSources.length; $('#statSources').textContent=fmt(DATA_SOURCES.length+customCount);
    const cards=DATA_SOURCES.map(s=>{const r=state.sourceResults[s.id]||{}; const count=r.configs?.length||0; return `<article class="sub-card"><div class="sub-head"><div class="sub-title-wrap"><div class="sub-logo ${s.cls}"><i class="fa-solid ${s.icon}"></i></div><div><span class="sub-name">${s.name}</span><span class="sub-caption">Official repository source</span></div></div><span class="sub-status ${r.ok?'ok':r.error?'err':'loading'}">${r.ok?'READY':r.error?'ERROR':'SYNCING'}</span></div><div class="sub-url-box">${esc(sourceUrl(s))}</div><div class="sub-stats"><div class="sub-stat"><strong>${fmt(count)}</strong><span>Configs</span></div><div class="sub-stat"><strong>${fmt(r.bytes||0)}</strong><span>Bytes</span></div><div class="sub-stat"><strong>${fmt(r.ms||0)}</strong><span>Fetch ms</span></div></div><div class="sub-actions"><button class="action-btn secondary copy-source" data-url="${esc(sourceUrl(s))}"><i class="fa-regular fa-copy"></i> کپی لینک</button><a class="action-btn ghost" href="${esc(sourceUrl(s))}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> باز کردن</a></div></article>`}).join(''); $('#subscriptionGrid').innerHTML=cards;
    $$('.copy-source').forEach(b=>b.addEventListener('click',()=>copyText(b.dataset.url,'لینک اشتراک کپی شد')));
  }
  function renderSavedCustom(){ $('#savedCustomList').innerHTML=state.customSources.map((s,i)=>`<div class="saved-custom-card"><div class="sub-logo mix"><i class="fa-solid fa-link"></i></div><div style="min-width:0"><strong>${esc(s.name)}</strong><div class="url">${esc(s.url)}</div></div><button class="row-action" data-remove-custom="${i}" title="حذف"><i class="fa-solid fa-trash"></i></button><button class="row-action" data-copy-custom="${i}" title="کپی"><i class="fa-regular fa-copy"></i></button></div>`).join('');
    $$('[data-remove-custom]').forEach(b=>b.addEventListener('click',()=>{state.customSources.splice(Number(b.dataset.removeCustom),1);saveJson('v2ray_sub_custom',state.customSources);toast('منبع محلی حذف شد','ok');loadAll();})); $$('[data-copy-custom]').forEach(b=>b.addEventListener('click',()=>copyText(state.customSources[Number(b.dataset.copyCustom)].url,'لینک کپی شد')));
  }

  function applyFilters(){
    const q=($('#searchInput')?.value||'').trim().toLowerCase(); const field=$('#searchField')?.value||'all'; const pf=$('#protocolFilter')?.value||'all'; const sf=$('#securityFilter')?.value||'all'; const cf=$('#countryFilter')?.value||'all'; const fav=$('#favoritesOnly')?.checked||false; const sort=$('#sortSelect')?.value||'index';
    const fields=c=>({name:c.name,host:c.host,country:c.country,protocol:c.protocol,port:String(c.port),security:c.security,raw:c.raw});
    let arr=state.configs.filter(c=>{ if(fav&&!state.favorites.has(c.raw)) return false; if(pf!=='all'&&c.protocol!==pf) return false; if(sf!=='all'){ if(sf==='tls'&&c.security!=='TLS')return false; if(sf==='reality'&&c.security!=='Reality')return false; if(sf==='none'&&['TLS','Reality'].includes(c.security))return false; } if(cf!=='all'&&c.country!==cf) return false; if(!q)return true; const f=fields(c); return field==='all'?Object.values(f).some(v=>String(v).toLowerCase().includes(q)):String(f[field]||'').toLowerCase().includes(q); });
    if(sort==='name') arr.sort((a,b)=>a.name.localeCompare(b.name)); else if(sort==='protocol') arr.sort((a,b)=>a.protocol.localeCompare(b.protocol)); else if(sort==='country') arr.sort((a,b)=>a.country.localeCompare(b.country)); else if(sort==='port') arr.sort((a,b)=>Number(a.port||0)-Number(b.port||0));
    state.filtered=arr; state.page=1; populateCountryFilter(); renderTable(); $('#filteredCount').textContent=`${fmt(arr.length)} مورد از ${fmt(state.configs.length)}`; $('#dataHealth').textContent=state.configs.length?`Deduplicated · ${fmt(state.configs.length)} total`:'در انتظار داده';
  }
  function populateCountryFilter(){ const select=$('#countryFilter'); const current=select.value; const countries=[...new Set(state.configs.map(c=>c.country).filter(Boolean))].sort(); select.innerHTML='<option value="all">همه کشورها</option>'+countries.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); if(countries.includes(current)) select.value=current; }
  function renderTable(){
    const pageSize=state.pageSize; const totalPages=Math.max(1,Math.ceil(state.filtered.length/pageSize)); if(state.page>totalPages) state.page=totalPages; const start=(state.page-1)*pageSize; const page=state.filtered.slice(start,start+pageSize); $('#pageLabel').textContent=`${state.page} / ${totalPages}`; $('#tableRange').textContent=state.filtered.length?`${start+1}–${Math.min(start+pageSize,state.filtered.length)}`:'0–0'; $('#pageSize').value=String(pageSize);
    if(!page.length){ $('#configTableBody').innerHTML='<tr><td colspan="8" class="empty-row"><i class="fa-regular fa-face-frown"></i> موردی پیدا نشد.</td></tr>'; return; }
    $('#configTableBody').innerHTML=page.map((c,i)=>`<tr><td>${start+i+1}</td><td><span class="proto-pill ${protocolClass(c.protocol)}">${esc(c.protocol.toUpperCase())}</span></td><td><div style="max-width:340px"><strong>${esc(c.name)}</strong><div class="mono" style="color:#67748e;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.host||'-')}</div></div></td><td class="mono">${esc(c.port||'-')}</td><td><span class="flag">${esc(c.flag)}</span> ${esc(c.country)}</td><td><span class="security-pill">${esc(c.security)}</span></td><td><span class="security-pill">${esc(c.transport)}</span></td><td><div class="row-actions"><button class="row-action ${state.favorites.has(c.raw)?'fav':''}" data-fav="${escAttr(c.raw)}" title="علاقه‌مندی"><i class="fa-solid fa-star"></i></button><button class="row-action" data-copy-config="${escAttr(c.raw)}" title="کپی کانفیگ"><i class="fa-regular fa-copy"></i></button><button class="row-action" data-more-config="${escAttr(c.raw)}" title="کپی نام + کانفیگ"><i class="fa-solid fa-terminal"></i></button></div></td></tr>`).join('');
    $$('[data-fav]').forEach(b=>b.addEventListener('click',()=>{const raw=unescAttr(b.dataset.fav); state.favorites.has(raw)?state.favorites.delete(raw):state.favorites.add(raw);saveJson('v2ray_sub_favorites',[...state.favorites]);renderTable();}));
    $$('[data-copy-config]').forEach(b=>b.addEventListener('click',()=>copyText(unescAttr(b.dataset.copyConfig),'کانفیگ کپی شد')));
    $$('[data-more-config]').forEach(b=>b.addEventListener('click',()=>{const c=state.configs.find(x=>x.raw===unescAttr(b.dataset.moreConfig));if(c)copyText(`${c.name}\n${c.raw}`,'نام و کانفیگ کپی شد');}));
  }
  function escAttr(s){return encodeURIComponent(s)} function unescAttr(s){try{return decodeURIComponent(s)}catch{return s}}

  function clientIcon(client){ if(client.id==='npv') return `<img src="${client.icon}" alt="${esc(client.name)} icon" loading="lazy">`; return `<img src="${client.altIcon}" alt="${esc(client.name)} icon" loading="lazy">`; }
  function renderClients(){
    $('#clientGrid').innerHTML=CLIENTS.map(c=>`<article class="client-card glass" data-tilt data-tilt-strength="2">
      <button class="client-icon" data-guide="${c.id}" title="باز کردن راهنمای ${esc(c.name)}">${clientIcon(c)}</button>
      <div>
        <h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p>
        <div class="feature-tags">${c.features.map(x=>`<span class="feature-tag">${esc(x)}</span>`).join('')}</div>
      </div>
      <button class="client-open" data-guide="${c.id}"><i class="fa-solid fa-book-open"></i> راهنما</button>
    </article>`).join('');
    $$('#clientGrid [data-guide]').forEach(b=>b.addEventListener('click',()=>openGuide(b.dataset.guide)));
    bindTilt($('#clientGrid'));
  }

  function openGuide(id){ const client=CLIENTS.find(c=>c.id===id); if(!client)return; state.currentGuide=client; state.guideStep=0; $('#modalAppIcon').innerHTML=client.id==='npv'?`<img src="${client.icon}" alt="">`:`<img src="${client.altIcon}" alt="">`; $('#modalAppPlatform').textContent=client.platform.toUpperCase(); $('#modalAppTitle').textContent=client.name; $('#modalAppDesc').textContent=client.desc; buildStepList(); updateGuide(); $('#guideModal').showModal(); }
  function buildStepList(){ const steps=state.currentGuide.steps; $('#stepList').innerHTML=steps.map((s,i)=>`<button class="step-button ${i===state.guideStep?'active':''}" data-step="${i}">STEP ${i+1}<small>${esc(s.title)}</small></button>`).join(''); $$('#stepList [data-step]').forEach(b=>b.addEventListener('click',()=>{state.guideStep=Number(b.dataset.step);updateGuide();})); }
  function updateGuide(){ const c=state.currentGuide,s=c.steps[state.guideStep]; if(!s)return; $$('.step-button').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===state.guideStep)); $('#stepImage').src=s.image; $('#stepImage').alt=s.title; $('#stepCounter').textContent=`Step ${state.guideStep+1} / ${c.steps.length}`; $('#stepTitle').textContent=s.title; $('#stepDescription').textContent=s.desc; $('#prevStep').disabled=state.guideStep===0; $('#nextStep').textContent=state.guideStep===c.steps.length-1?'تمام شد ✓':'بعدی '; $('#nextStep').innerHTML=state.guideStep===c.steps.length-1?'تمام شد ✓':'بعدی <i class="fa-solid fa-chevron-left"></i>'; $('#guideProgressText').textContent=`${state.guideStep+1} / ${c.steps.length}`; $('#guideProgressBar').style.width=`${(state.guideStep+1)/c.steps.length*100}%`; $('#stepImage').onload=()=>$('#imageShimmer').style.display='none'; $('#stepImage').onerror=()=>{$('#imageShimmer').style.display='none';}; }
  function nextStep(){ if(state.guideStep<state.currentGuide.steps.length-1){state.guideStep++;updateGuide();} else {toast('راهنما کامل شد','ok');} } function prevStep(){if(state.guideStep>0){state.guideStep--;updateGuide();}}

  function renderDiagnostics(){ const bad=state.configs.filter(c=>c.protocol==='other').length; const duplicateRaw=state.configs.length-(new Set(state.configs.map(c=>c.raw)).size); const missingHost=state.configs.filter(c=>!c.host).length; const total=state.configs.length; $('#diagnosticList').innerHTML=`<div class="diagnostic-line"><span>کل کانفیگ</span><span>${fmt(total)}</span></div><div class="diagnostic-line"><span>بدون Host</span><span>${fmt(missingHost)}</span></div><div class="diagnostic-line"><span>Unknown protocol</span><span>${fmt(bad)}</span></div><div class="diagnostic-line"><span>Duplicate removed</span><span>${fmt(duplicateRaw)}</span></div><div class="diagnostic-line"><span>Last fetch</span><span>${fmt(state.lastFetchMs)} ms</span></div>`; }

  function exportCurrent(type){ if(!state.filtered.length){toast('داده‌ای برای خروجی وجود ندارد','err');return;} if(type==='txt'){downloadText('v2ray-sub-filtered.txt',state.filtered.map(c=>c.raw).join('\n'));return;} if(type==='json'){downloadText('v2ray-sub-configs.json',JSON.stringify(state.filtered,null,2),'application/json;charset=utf-8');return;} const headers=['protocol','name','host','port','country','security','transport','source','raw']; const csv=[headers.join(','),...state.filtered.map(c=>headers.map(h=>csvCell(c[h])).join(','))].join('\n'); downloadText('v2ray-sub-configs.csv','\ufeff'+csv,'text/csv;charset=utf-8'); }
  function csvCell(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`;}

  function setupQR(){ $('#makeQrBtn').addEventListener('click',async()=>{const value=$('#qrUrl').value.trim(); if(!value){toast('اول لینک را وارد کن','err');return;} const box=$('#qrResult'); box.innerHTML=''; try{ await ensureQrLib(); const canvas=document.createElement('canvas'); QRCode.toCanvas(canvas,value,{width:140,margin:1,color:{dark:'#0b0d16',light:'#ffffff'}},err=>{if(err)throw err;}); box.appendChild(canvas); }catch{ box.innerHTML='<span>کتابخانه QR در دسترس نیست؛ لینک را با Copy استفاده کن.</span>'; } }); }
  let qrLoading; function ensureQrLib(){ if(window.QRCode)return Promise.resolve(); if(qrLoading)return qrLoading; qrLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);}); return qrLoading; }
  function setupLocalFile(){ $('#localFileInput').addEventListener('change',async e=>{const f=e.target.files?.[0]; if(!f)return; const t=await f.text(); const cfg=t.split(/\r?\n/).map(x=>parseConfigLine(x,'local-file')).filter(Boolean); $('#localFileResult').textContent=`${f.name} → ${fmt(cfg.length)} کانفیگ شناسایی شد. پروتکل‌ها: ${[...new Set(cfg.map(c=>c.protocol).filter(Boolean))].join(', ')||'—'}`; toast(`فایل محلی تحلیل شد: ${fmt(cfg.length)} کانفیگ`,'ok');}); }
  function setupClipboardParser(){ $('#parseClipboardBtn').addEventListener('click',()=>{const t=$('#clipboardParserInput').value.trim(); const cfg=t.split(/\r?\n/).map(x=>parseConfigLine(x,'clipboard')).filter(Boolean); $('#parseResult').innerHTML=cfg.length?cfg.slice(0,12).map(c=>`<div class="diagnostic-line"><span>${esc(c.protocol.toUpperCase())} · ${esc(c.name)}</span><span>${esc(c.host||'—')}:${esc(c.port||'—')}</span></div>`).join(''):'متنی برای تحلیل پیدا نشد.';}); }
  function renderQuickSubscriptions(){
    const items=DATA_SOURCES.map(s=>{const r=state.sourceResults[s.id]||{};return `<div class="quick-sub-item" data-tilt data-tilt-strength="1.2">
      <div class="quick-sub-logo"><i class="fa-solid ${s.icon}"></i></div>
      <div><strong>${esc(s.name)}</strong><small>${r.ok?fmt(r.configs?.length||0)+' configs':'برای دریافت آماده'}</small></div>
      <button class="quick-copy" data-quick-copy="${esc(sourceUrl(s))}" title="کپی لینک ${esc(s.name)}"><i class="fa-regular fa-copy"></i></button>
    </div>`}).join('');
    $('#quickSubscriptionGrid').innerHTML=items;
    $$('#quickSubscriptionGrid [data-quick-copy]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();copyText(b.dataset.quickCopy,'لینک اشتراک کپی شد؛ حالا راهنمای برنامه را باز کن.');}));
    bindTilt($('#quickSubscriptionGrid'));
  }

  function bindTilt(root=document){
    if(!window.matchMedia('(pointer:fine)').matches) return;
    $$('.glass, [data-tilt]',root).forEach(el=>{
      if(el.dataset.tiltBound==='1') return; el.dataset.tiltBound='1';
      el.addEventListener('pointermove',e=>{
        const r=el.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width-.5; const y=(e.clientY-r.top)/r.height-.5;
        const strength=Number(el.dataset.tiltStrength||1.1);
        el.style.setProperty('--card-px',(x*strength).toFixed(2)); el.style.setProperty('--card-py',(y*strength).toFixed(2));
        el.style.setProperty('--mx',`${Math.round((e.clientX-r.left)/r.width*100)}%`); el.style.setProperty('--my',`${Math.round((e.clientY-r.top)/r.height*100)}%`);
      });
      el.addEventListener('pointerleave',()=>{el.style.setProperty('--card-px','0');el.style.setProperty('--card-py','0');el.style.setProperty('--mx','50%');el.style.setProperty('--my','50%');});
    });
  }

  function setupPointerScene(){
    if(!window.matchMedia('(pointer:fine)').matches) return;
    window.addEventListener('pointermove',e=>{const x=e.clientX/window.innerWidth-.5,y=e.clientY/window.innerHeight-.5;document.documentElement.style.setProperty('--mx',`${e.clientX}px`);document.documentElement.style.setProperty('--my',`${e.clientY}px`);document.documentElement.style.setProperty('--px',x.toFixed(3));document.documentElement.style.setProperty('--py',y.toFixed(3));},{passive:true});
  }

  function openDetectedGuide(){
    const id=/iPhone|iPad|iPod/i.test(navigator.userAgent)?'npv':'v2rayng';
    switchSection('guides'); setTimeout(()=>openGuide(id),120);
  }

  function setupKeyboard(){
    document.addEventListener('keydown',e=>{
      if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if(e.key==='/'){e.preventDefault();switchSection('configs');setTimeout(()=>$('#searchInput')?.focus(),120);}
      else if(e.key.toLowerCase()==='g') openDetectedGuide();
      else if(e.key.toLowerCase()==='r'){e.preventDefault();loadAll();}
      else if(e.key.toLowerCase()==='c'){const first=DATA_SOURCES[0];copyText(sourceUrl(first),'لینک Mix کپی شد.');}
    });
  }

  function setupNavigation(){
    $$('.rail-btn,.chip,[data-section]').forEach(b=>{b.addEventListener('click',()=>{const id=b.dataset.section;if(id)switchSection(id);});});
    $('#brandHome').addEventListener('click',()=>switchSection('dashboard'));
    $('#backTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    $('#quickCopyStep')?.addEventListener('click',()=>copyText(sourceUrl(DATA_SOURCES[0]),'لینک Mix کپی شد.'));
    $('#openDetectedGuide')?.addEventListener('click',openDetectedGuide);
    $('#dismissHints')?.addEventListener('click',()=>{document.querySelector('.keyboard-hints')?.remove();localStorage.setItem('v2ray_sub_hints','1');});
  }
  function setupModals(){ $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close())); ['guideModal','settingsModal'].forEach(id=>$(id).addEventListener('click',e=>{if(e.target.id===id)e.target.close();})); $('#prevStep').addEventListener('click',prevStep); $('#nextStep').addEventListener('click',nextStep); $('#openSettingsBtn').addEventListener('click',()=>$('#settingsModal').showModal()); }
  function setupFilters(){ ['searchInput','searchField','protocolFilter','securityFilter','countryFilter','sortSelect','favoritesOnly'].forEach(id=>{const el=$('#'+id); if(el)el.addEventListener('input',applyFilters)}); $('#clearSearch').addEventListener('click',()=>{$('#searchInput').value='';applyFilters();}); $('#resetFilters').addEventListener('click',()=>{$('#searchInput').value='';$('#searchField').value='all';$('#protocolFilter').value='all';$('#securityFilter').value='all';$('#countryFilter').value='all';$('#sortSelect').value='index';$('#favoritesOnly').checked=false;applyFilters();}); $('#prevPage').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderTable();}); $('#nextPage').addEventListener('click',()=>{const p=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));state.page=Math.min(p,state.page+1);renderTable();}); $('#pageSize').addEventListener('change',e=>{state.pageSize=Number(e.target.value);localStorage.setItem('v2ray_sub_page_size',state.pageSize);state.page=1;renderTable();}); }
  function setupSettings(){ $('#themeMotionBtn').addEventListener('click',()=>setMotion(!state.motion)); $('#motionToggle').addEventListener('change',e=>setMotion(e.target.checked)); $('#compactTableToggle').addEventListener('change',e=>{state.compact=e.target.checked;document.body.classList.toggle('compact-table',state.compact);saveJson('v2ray_sub_compact',state.compact);}); $('#autoRefreshToggle').addEventListener('change',e=>{state.autoRefresh=e.target.checked;saveJson('v2ray_sub_auto_refresh',state.autoRefresh);if(state.autoRefresh)scheduleRefresh();else clearTimeout(state.refreshTimer);}); $('#refreshMinutes').addEventListener('input',()=>$('#refreshMinutesOut').textContent=$('#refreshMinutes').value); $('#saveRefreshPolicyBtn').addEventListener('click',()=>{state.refreshMinutes=Number($('#refreshMinutes').value);localStorage.setItem('v2ray_sub_refresh_minutes',state.refreshMinutes);if(state.autoRefresh)scheduleRefresh();toast('سیاست Refresh ذخیره شد','ok');}); }
  function setupSubscriptions(){ $('#addCustomSubBtn').addEventListener('click',()=>{const name=$('#customSubName').value.trim()||'Custom';const url=$('#customSubUrl').value.trim();try{new URL(url);}catch{toast('URL معتبر نیست','err');return;}state.customSources.push({name,url});saveJson('v2ray_sub_custom',state.customSources);$('#customSubName').value='';$('#customSubUrl').value='';renderSavedCustom();loadAll();}); $('#copyAllLinksBtn').addEventListener('click',()=>copyText(DATA_SOURCES.map(sourceUrl).concat(state.customSources.map(x=>x.url)).join('\n'),'همه لینک‌ها کپی شدند')); $('#downloadLinksBtn').addEventListener('click',()=>downloadText('v2ray-subscription-links.txt',DATA_SOURCES.map(s=>`${s.name}: ${sourceUrl(s)}`).concat(state.customSources.map(x=>`${x.name}: ${x.url}`)).join('\n'))); $('#refreshAllBtn').addEventListener('click',loadAll); $('#probeSourcesBtn').addEventListener('click',loadAll); }
  function setupTools(){setupQR();setupLocalFile();setupClipboardParser();$('#runDiagnosticsBtn').addEventListener('click',()=>{renderDiagnostics();toast('Diagnostics کامل شد','ok');}); $('#exportJsonBtn').addEventListener('click',()=>exportCurrent('json')); $('#exportCsvBtn').addEventListener('click',()=>exportCurrent('csv')); $('#downloadFilteredBtn').addEventListener('click',()=>exportCurrent('txt')); $('#backupLocalBtn').addEventListener('click',()=>{const backup={createdAt:new Date().toISOString(),favorites:[...state.favorites],customSources:state.customSources,motion:state.motion,autoRefresh:state.autoRefresh,compact:state.compact,refreshMinutes:state.refreshMinutes};downloadText('v2ray-sub-local-backup.json',JSON.stringify(backup,null,2),'application/json;charset=utf-8');}); $('#clearLocalBtn').addEventListener('click',()=>{if(!confirm('داده‌های محلی این سایت پاک شود؟'))return;['v2ray_sub_favorites','v2ray_sub_custom','v2ray_sub_motion','v2ray_sub_auto_refresh','v2ray_sub_compact','v2ray_sub_refresh_minutes'].forEach(k=>localStorage.removeItem(k));location.reload();}); }

  async function init(){
    detectOS(); setMotion(state.motion); setupPointerScene(); setupKeyboard(); document.body.classList.toggle('compact-table',state.compact); $('#motionToggle').checked=state.motion; $('#compactTableToggle').checked=state.compact; $('#autoRefreshToggle').checked=state.autoRefresh; $('#refreshMinutes').value=state.refreshMinutes; $('#refreshMinutesOut').textContent=state.refreshMinutes; setupNavigation();setupModals();setupFilters();setupSettings();setupSubscriptions();setupTools();renderClients();renderSavedCustom();renderDashboard();
    try{ if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{}); }catch{}
    await loadAll();
  }

  init();
})();
