// Card Ledger Beta: same Supabase project, tables and login as the classic app in the folder above.
// PSA data rules (PSA API licence): only verified, verified_at, name, year, set, grade and cert are
// kept, only in cards.psa_data; each cert is looked up at most once and the stored result reused;
// psa_data never goes into CSV exports or the backup zip.
'use strict';
const SUPABASE_URL='https://drqialhskknzigrkquli.supabase.co',SUPABASE_KEY='sb_publishable_SCAc5QwrIRwUITNx1Ha9Kw_EDY_iE_X';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

// ---------- helpers ----------
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=encodeURIComponent,N=v=>+v||0,r2=v=>Math.round(v*100)/100,pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),today=()=>ymd(new Date());
const money=n=>(N(n)<0?'-':'')+'$'+Math.abs(N(n)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money0=n=>(N(n)<0?'-':'')+'$'+Math.abs(N(n)).toLocaleString('en-US',{maximumFractionDigits:0});
const pc=v=>`<span class="${v>=0?'pos':'neg'}">${v>0?'+':''}${money(v)}</span>`;
const pl=(n,w)=>n+' '+w+(n===1?'':'s');
const parseDay=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],m[2]-1,+m[3]):null};
const daysBetween=(a,b)=>{const x=parseDay(a),y=parseDay(b)||new Date();return x?Math.max(0,Math.round((new Date(y.getFullYear(),y.getMonth(),y.getDate())-x)/864e5)):null};
const fmtDate=s=>{const d=parseDay(s);return d?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'};
const csvq=v=>'"'+String(v??'').replace(/"/g,'""')+'"',toCsv=(h,rows)=>[h.join(','),...rows.map(r=>r.map(csvq).join(','))].join('\n');
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000)}
const tc=s=>String(s||'').toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g,(m,a,b)=>a+b.toUpperCase());
const gradeNum=g=>{const m=String(g||'').match(/(\d+(?:\.\d+)?)\s*$/);return m?m[1]:String(g||'').trim()};
function gnorm(g){const s=String(g||'').toUpperCase().replace(/[^A-Z]/g,'');return s.startsWith('PSA')?'PSA':s.startsWith('CGC')?'CGC':/^(BGS|BECKETT|BVG|BCCG)/.test(s)?'BGS':s.startsWith('SGC')?'SGC':s}
let toastT;function toast(t,ms=2200){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);if(ms)toastT=setTimeout(()=>el.hidden=true,ms)}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}}

// ---------- icons (inline SVG, stroke) ----------
const P={search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
 back:'<path d="M15 18 9 12l6-6"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8.5" y="7" width="7" height="10" rx="1.5"/>',
 slab:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 6.5h6M9 10h6v8H9z"/>',tag:'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
 receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',swap:'<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
 camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
 verified:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',ext:'<path d="M7 17 17 7M9 7h8v8"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',download:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',logout:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',home:'<path d="M4 11 12 4l8 7v9H4z"/>',chev:'<path d="m9 6 6 6-6 6"/>'};
const icon=(n,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
const fillIcons=root=>root.querySelectorAll('i.ic[data-i]').forEach(e=>{if(!e.firstChild)e.innerHTML=icon(e.dataset.i)});
fillIcons(document);

// ---------- navigation ----------
// Every screen change is a browser history entry, so Android's back gesture (and the in-app back buttons, which
// call history.back()) step through screens instead of closing the app. History looks like:
//   [0] exit guard (root)  [1] Inventory  [2..] screens opened since
// Backing into [0] from Inventory shows "Swipe back again to exit"; a second back within 2 seconds leaves.
const TABS=['inv','sold','exp','trades'];let cur='inv',idx=1,pendingHome=null,exitWarnAt=0;
function render(v){$$('.view').forEach(s=>s.hidden=s.dataset.view!==v);cur=v;const tab=TABS.includes(v);$('#tabbar').hidden=!tab;
  if(tab)$$('#tabbar [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===v));scrollTo(0,0)}
// data: what to reopen if the user comes back to this entry (a card or trade id)
function show(v,{push=true,data=null,replace=false}={}){
  if(push&&v!==cur){if(cur==='loading'||replace)history.replaceState({v,idx,data},'');// a loading screen is replaced, not kept
    else{idx++;history.pushState({v,idx,data},'')}}
  else if(v===cur)history.replaceState({v,idx,data},'');
  render(v)}
const back=()=>history.back();
// Finish a flow: go back to entry [1] (dropping the finished screens), then open the tab.
function home(tab){return new Promise(res=>{if(idx<=1){show(tab);res();return}pendingHome={tab,res};history.go(-(idx-1))})}
function initHistory(){idx=1;history.replaceState({v:'inv',idx:0,root:true},'');history.pushState({v:'inv',idx:1},'');render('inv')}
addEventListener('popstate',e=>{const s=e.state;if(!s||typeof s.idx!=='number')return;closeSheet();
  if(s.root){// back pressed on Inventory
    if(Date.now()-exitWarnAt<2000){idx=0;history.back();return}
    exitWarnAt=Date.now();toast('Swipe back again to exit',2000);idx=1;history.pushState({v:'inv',idx:1},'');render('inv');return}
  if(pendingHome){if(s.idx!==1)return;const p=pendingHome;pendingHome=null;idx=1;render('inv');if(p.tab!=='inv')show(p.tab);p.res();return}
  // leaving a trade in progress by gesture: ask first, and stay if they say no
  if(cur==='trade'&&s.idx<idx&&T&&(T.out.length||T.in.length)){
    if(!confirm('Discard this trade?')){idx=s.idx+1;history.pushState({v:'trade',idx},'');return}
    T.in.forEach(c=>c.url&&URL.revokeObjectURL(c.url));T=null}
  idx=s.idx;
  if(s.v==='card'&&s.data)return openCard(s.data,{push:false});
  if(s.v==='tview'&&s.data)return openTrade(s.data,{push:false});
  if(s.v==='edit'&&s.data)return openEdit(s.data,{push:false});
  render(s.v)});
document.addEventListener('click',e=>{if(e.target.closest('[data-back]'))back()});
$$('#tabbar [data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));

// bottom sheet
function sheet(title,items){const s=$('#sheet');s.innerHTML='<div class="grab"></div>'+(title?`<h3>${esc(title)}</h3>`:'')+items.map((it,i)=>it.href
   ?`<a class="si" href="${esc(it.href)}" data-si="${i}"><i class="ic" data-i="${it.icon}"></i>${esc(it.label)}</a>`
   :`<button class="si" data-si="${i}"><i class="ic" data-i="${it.icon}"></i>${esc(it.label)}</button>`).join('')+'<button class="link" data-si="x">Cancel</button>';
  fillIcons(s);s.hidden=$('#scrim').hidden=false;
  s.onclick=e=>{const b=e.target.closest('[data-si]');if(!b)return;closeSheet();const it=items[b.dataset.si];if(it&&it.fn)it.fn()}}
function closeSheet(){$('#sheet').hidden=$('#scrim').hidden=true}
$('#scrim').onclick=closeSheet;

// photo picking: one camera input and one library input shared by every flow
let onPhoto=null;
function pickPhoto(title,fn){sheet(title,[{label:'Take photo',icon:'camera',fn:()=>{onPhoto=fn;$('#camIn').click()}},{label:'Choose from photos',icon:'image',fn:()=>{onPhoto=fn;$('#libIn').click()}}])}
['#camIn','#libIn'].forEach(id=>$(id).onchange=e=>{const f=e.target.files[0];e.target.value='';if(f&&onPhoto)onPhoto(f)});
async function shrink(file){const img=await createImageBitmap(file),k=Math.min(1,1280/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',.85))}
const b64=blob=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(blob)});
async function readSlab(blob){const{data,error}=await sb.functions.invoke('read-slab',{body:{image:await b64(blob)}});if(error)throw error;return data||{}}
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);

// pill groups (single choice; tap the chosen pill again to clear it)
function pills(el,opts){el.innerHTML=opts.map(o=>{const[v,l]=Array.isArray(o)?o:[o,o];return`<button type="button" class="pill sm" data-v="${esc(v)}">${esc(l)}</button>`}).join('');
  el.onclick=e=>{const b=e.target.closest('[data-v]');if(!b||b.disabled)return;const was=b.classList.contains('on');if(was&&el.dataset.required)return;
    el.querySelectorAll('.pill').forEach(x=>x.classList.remove('on'));if(!was)b.classList.add('on');el.dispatchEvent(new Event('change'))}}
const pget=el=>el.querySelector('.pill.on')?.dataset.v||null,pset=(el,v)=>el.querySelectorAll('.pill').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
const BOUGHT=['eBay','Card show','Local shop','Other'],SOLDON=['eBay','Card show','Local','Other'];
pills($('#addFrom'),BOUGHT);pills($('#eFrom'),BOUGHT);pills($('#sellOn'),SOLDON);pills($('#ePlat'),SOLDON);
pills($('#eStatus'),[['inventory','In stock'],['sold','Sold']]);$('#eStatus').dataset.required='1';

// ---------- data ----------
let cards=[],trades=[],expenses=[],urls={},rurls={};
const myBasis=c=>N(c.cost)+N(c.buy_fees),taxBasis=c=>c.fmv_basis!=null?N(c.fmv_basis):myBasis(c);
const profit=c=>N(c.sold_for)-N(c.sell_fees)-myBasis(c),profitTax=c=>N(c.sold_for)-N(c.sell_fees)-taxBasis(c),tradeGainTax=c=>N(c.trade_value_out)-taxBasis(c);
// What the app shows: PSA's verified name / year+set / grade when the card has them, otherwise the card's own fields.
// The card's own columns never hold PSA data, so CSVs and backups don't either, and clearing psa_data reverts the display.
function dv(c){const p=c&&c.psa_data,v=p&&p.verified;return{...c,name:(v&&p.name?tc(p.name):c.name)||'',set_name:v&&(p.year||p.set)?joinSet(p.year,tc(p.set)):c.set_name,grade:v&&p.grade?gradeNum(p.grade):c.grade}}
const tradeOf=id=>trades.find(t=>String(t.id)===String(id)),tradeDate=id=>tradeOf(id)?.trade_date||'';
const cardById=id=>cards.find(c=>String(c.id)===String(id));
const thumb=(c,cls='th')=>urls[c.photo]?`<img class="${cls}" src="${esc(urls[c.photo])}" alt="" loading="lazy">`:`<div class="${cls} ph"><i class="ic" data-i="slab"></i></div>`;
async function load(){
  const[c,t]=await Promise.all([sb.from('cards').select('*').order('created_at',{ascending:false}),sb.from('trades').select('*')]);
  if(c.error)toast('Could not load cards: '+c.error.message,5000);
  cards=c.data||[];trades=(t.data||[]).sort((a,b)=>String(b.trade_date).localeCompare(String(a.trade_date))||String(b.created_at).localeCompare(String(a.created_at)));
  const paths=cards.map(c=>c.photo).filter(p=>p&&!urls[p]);
  if(paths.length){const{data}=await sb.storage.from('slabs').createSignedUrls(paths,86400);(data||[]).forEach(x=>{if(x.signedUrl)urls[x.path]=x.signedUrl})}
  renderAll();loadExpenses()}
function renderAll(){renderInv();renderSold();renderTrades();if(cur==='card'&&cdId)openCard(cdId,{push:false})}

// ---------- auth ----------
$('#go').onclick=async()=>{$('#lmsg').textContent='Signing in…';const{error}=await sb.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});$('#lmsg').textContent=error?error.message:''};
let booted=false;
function setSession(s){$('#login').hidden=!!s;$('#app').hidden=!s;$('#tabbar').hidden=!s||!TABS.includes(cur);if(s&&!booted){booted=true;initHistory();load()}if(!s)booted=false}
sb.auth.onAuthStateChange((_e,s)=>setSession(s));sb.auth.getSession().then(({data})=>setSession(data.session));

// ---------- install ----------
// Chrome fires beforeinstallprompt when the app can be installed; keep it and offer our own button.
let installEvt=null;const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const bannerOff=()=>{try{return localStorage.getItem('installBannerDismissed')==='1'}catch{return false}};
function updInstall(){$('#installBanner').hidden=!(installEvt&&!isStandalone()&&!bannerOff())}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;updInstall()});
addEventListener('appinstalled',()=>{installEvt=null;updInstall();toast('Card Ledger Beta installed')});
matchMedia('(display-mode: standalone)').addEventListener?.('change',updInstall);
async function installApp(){if(!installEvt)return;const e=installEvt;installEvt=null;updInstall();try{await e.prompt();await e.userChoice}catch{}}
$('#installGo').onclick=installApp;
$('#installX').onclick=()=>{try{localStorage.setItem('installBannerDismissed','1')}catch{}updInstall()};
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});

// ---------- menu ----------
$$('[data-menu]').forEach(b=>b.onclick=()=>sheet('Card Ledger',[
  ...(installEvt&&!isStandalone()?[{label:'Install app',icon:'download',fn:installApp}]:[]),
  {label:'Export cards CSV',icon:'download',fn:()=>dl(new Blob([cardsCsv(cards,null,trades)],{type:'text/csv'}),'card-ledger.csv')},
  {label:'Export trades CSV',icon:'download',fn:()=>dl(new Blob([tradesCsv([...trades].reverse(),cards)],{type:'text/csv'}),'card-ledger-trades.csv')},
  {label:'Backup everything (zip)',icon:'archive',fn:backup},
  {label:'Open classic app',icon:'home',href:'../'},
  {label:'Sign out',icon:'logout',fn:()=>sb.auth.signOut()}]));

// ---------- inventory ----------
let invFilter='all';
$('#invFilters').onclick=e=>{const b=e.target.closest('[data-f]');if(!b)return;invFilter=b.dataset.f;$$('#invFilters .pill').forEach(x=>x.classList.toggle('on',x===b));renderInv()};
$('#invSearchBtn').onclick=()=>{const p=$('#invSearch');p.hidden=!p.hidden;if(!p.hidden)$('#invQ').focus();else{$('#invQ').value='';renderInv()}};
$('#invQ').oninput=()=>renderInv();$('#invQx').onclick=()=>{$('#invQ').value='';$('#invSearch').hidden=true;renderInv()};
const matchQ=(c,q)=>{if(!q)return true;const d=dv(c);return[c.name,c.set_name,d.name,d.set_name,c.cert,c.grader,c.grade].join(' ').toLowerCase().includes(q)};
function renderInv(){const st=cards.filter(c=>c.status==='inventory'),q=$('#invQ').value.trim().toLowerCase();
  $('#invCount').textContent=st.length;$('#invValue').textContent=money0(st.reduce((a,c)=>a+myBasis(c),0));
  const list=st.filter(c=>(invFilter==='all'||gnorm(c.grader)===invFilter)&&matchQ(c,q));
  $('#invGrid').innerHTML=list.map(c=>{const d=daysBetween(c.bought_on);return`<button class="gi" data-card="${esc(c.id)}">${thumb(c,'slab')}<b>${esc(dv(c).name||'Untitled card')}</b><small>Paid ${money0(myBasis(c))}${d!=null?` · ${d}d held`:''}</small></button>`}).join('')
    ||`<div class="empty" style="grid-column:1/-1">${st.length?'No cards match.':'No cards in stock yet. Tap the gold Scan button to add one.'}</div>`;
  fillIcons($('#invGrid'))}
$('#invGrid').onclick=e=>{const b=e.target.closest('[data-card]');if(b)openCard(b.dataset.card)};

// ---------- sold ----------
let pview='my';try{if(localStorage.getItem('pview')==='tax')pview='tax'}catch{}
$('#pview').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;pview=b.dataset.v;try{localStorage.setItem('pview',pview)}catch{}renderSold()};
const outDate=c=>(c.status==='sold'?c.sold_on:tradeDate(c.disposed_trade_id))||'';
function renderSold(){const tax=pview==='tax',sold=cards.filter(c=>c.status==='sold'),td=cards.filter(c=>c.status==='traded');
  $$('#pview .pill').forEach(b=>b.classList.toggle('on',b.dataset.v===pview));
  const saleP=tax?profitTax:profit,tradeP=tax?td.reduce((a,c)=>a+tradeGainTax(c),0):trades.reduce((a,t)=>a+N(t.carryover_gain),0),net=sold.reduce((a,c)=>a+saleP(c),0)+tradeP;
  $('#soldRev').textContent=money0(sold.reduce((a,c)=>a+N(c.sold_for),0));$('#soldNet').textContent=money0(net);$('#soldNet').className=net<0?'neg':'gold';
  $('#soldNote').innerHTML=`${pl(sold.length,'card')} sold · ${td.length} traded away${tax?` · trade gains ${money(tradeP)}`:tradeP?` · cash profit on trades ${money(tradeP)}`:''}<br>`+
    (tax?'Tax view: trades count as sales and purchases at market value on the trade date.':'My view: profit counts only when a card is sold for cash.');
  const gone=[...sold,...td].sort((a,b)=>outDate(b).localeCompare(outDate(a))||String(b.created_at).localeCompare(String(a.created_at)));
  $('#soldList').innerHTML=gone.map(c=>{const isT=c.status==='traded',p=isT?(tax?tradeGainTax(c):null):saleP(c);
    return`<button class="li" data-card="${esc(c.id)}">${thumb(c)}<div class="in"><b>${esc(dv(c).name||'Untitled card')}</b><small>${isT?'Traded':'Sold'} ${fmtDate(outDate(c))}${c.sold_platform&&!isT?' · '+esc(c.sold_platform):''}</small><small>${isT?'Trade value '+money(c.trade_value_out):money(c.sold_for)}</small></div>`+
      `<div class="amt">${p==null?'<small>carried<br>over</small>':pc(p)}</div></button>`}).join('')||'<div class="empty">Nothing sold or traded yet.</div>';
  fillIcons($('#soldList'))}
$('#soldList').onclick=e=>{const b=e.target.closest('[data-card]');if(b)openCard(b.dataset.card)};

// ---------- value links ----------
function certLink(grader,cert){const g=gnorm(grader),c=enc(String(cert||'').trim());if(!c)return null;
  if(g==='PSA')return{label:'PSA',url:'https://www.psacard.com/cert/'+c};
  if(g==='CGC')return{label:'CGC',url:'https://www.cgccards.com/certlookup/'+c+'/'};
  if(g==='BGS'){const s=String(grader).toUpperCase(),t=s.startsWith('BVG')?'BVG':s.startsWith('BCCG')?'BCCG':'BGS';return{label:'BGS',url:'https://www.beckett.com/grading/card-lookup?item_id='+c+'&item_type='+t}}
  return null}
// ---- detailed search text: name, card number, set, year, variants, language, "GRADER GRADE" (PSA's details win when verified)
const VARIANTS=[['1st Edition',/\b1st\s*ed(ition|\.)?\b|\bfirst\s+edition\b/i],['Shadowless',/\bshadowless\b/i],['Reverse Holo',/\brev(erse|\.)?\s*-?\s*holo(foil)?\b/i],
  ['Holo',/\bholo(foil)?\b/i],['Unlimited',/\bunlimited\b/i],['Full Art',/\bfull\s*art\b/i],['Alt Art',/\balt(ernate)?\.?\s*art\b/i],['Secret Rare',/\bsecret\s*rare\b/i],
  ['Promo',/\bpromo\b/i],['Staff',/\bstaff\b/i],['Prerelease',/\bpre-?release\b/i],['Error',/\berror\b/i]];
const LANGS=['Japanese','Korean','Chinese','German','French','Italian','Spanish','Portuguese','Dutch','Indonesian','Thai'];
// c: {name,set,year,grader,grade,cert,psa}
function searchParts(c){const p=c.psa&&c.psa.verified&&String(c.psa.cert)===String(c.cert||'').replace(/\D/g,'')?c.psa:null;
  let name=String(p&&p.name?tc(p.name):c.name||''),set=String(p&&p.set?tc(p.set):c.set||'');
  let year=String(p&&p.year?p.year:c.year||'');const ys=set.match(/\b(19|20)\d{2}\b/);if(!year&&ys)year=ys[0];
  const all=name+' '+set,num=((all.match(/\b(\d{1,3}\s*\/\s*\d{1,3})\b/)||all.match(/#\s?([A-Z]{0,3}\d{1,4})\b/i)||[])[1]||'').replace(/\s/g,'');
  let variants=VARIANTS.filter(([,re])=>re.test(all)).map(([v])=>v);if(variants.includes('Reverse Holo'))variants=variants.filter(v=>v!=='Holo');
  const lang=LANGS.find(l=>new RegExp('\\b'+l+'\\b','i').test(all))||'';
  const strip=t=>{VARIANTS.forEach(([,re])=>t=t.replace(new RegExp(re.source,'gi'),' '));LANGS.forEach(l=>t=t.replace(new RegExp('\\b'+l+'\\b','gi'),' '));
    return t.replace(/\b(19|20)\d{2}\b/g,' ').replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g,' ').replace(/#\s?[A-Z]{0,3}\d{1,4}\b/gi,' ').replace(/[-–]+(?=\s|$)|(?<=\s|^)[-–]+/g,' ').replace(/\s{2,}/g,' ').trim()};
  name=strip(name);set=strip(set).replace(/^pokemon\s+game$/i,'Base Set').replace(/^pokemon\s+/i,'').trim();
  if(set&&name.toLowerCase().includes(set.toLowerCase()))set='';
  const g=gnorm(c.grader)||String(c.grader||'').trim(),gr=gradeNum(c.grade);
  return{name,num,set,year,variants,lang,grader:g,grade:gr,gradeLabel:g&&gr?`"${g} ${gr}"`:''}}
const searchText=sp=>[sp.name,sp.num,sp.set,sp.year,...sp.variants,sp.lang,sp.gradeLabel].filter(Boolean).join(' ').replace(/\s{2,}/g,' ').trim();
const EBAY_NOISE='-lot -proxy -custom -reprint';
// eBay writes aspect filters double-encoded in its URLs, with ( ) as %2528 / %2529
const ebayAspect=v=>enc(enc(v).replace(/\(/g,'%28').replace(/\)/g,'%29'));
const EBAY_GRADER={PSA:'Professional Sports Authenticator (PSA)',BGS:'Beckett Grading Services (BGS)'};
function ebayUrl(sp){let u='https://www.ebay.com/sch/i.html?_nkw='+enc(searchText(sp)+' '+EBAY_NOISE).replace(/%20/g,'+')+'&_sacat=183454&LH_Sold=1&LH_Complete=1';
  if(sp.grader){u+='&Graded=Yes';if(EBAY_GRADER[sp.grader])u+='&Professional%2520Grader='+ebayAspect(EBAY_GRADER[sp.grader]);if(/^\d+(\.5)?$/.test(sp.grade))u+='&Grade='+ebayAspect(sp.grade)}
  if(sp.lang)u+='&Language='+ebayAspect(sp.lang);return u}
const isAndroid=/Android/i.test(navigator.userAgent);
const CARDLADDER_APP='intent://#Intent;package=com.ladderstudios.cardladder;S.browser_fallback_url='+enc('https://www.cardladder.com')+';end';
// value links + the exact text each one searches for
function valueLinks(c){const sp=searchParts(c),text=searchText(sp),cert=String(c.cert||'').replace(/\D/g,''),altCert=cert&&(sp.grader==='PSA'||sp.grader==='BGS');
  const links=[
    {label:'Card Ladder',url:isAndroid?CARDLADDER_APP:(cert?`https://app.cardladder.com/search?cert=${cert}&grader=${enc((sp.grader||'psa').toLowerCase())}`:'https://www.cardladder.com'),
      copy:cert||text,toast:cert?'Cert copied, paste in Card Ladder':'Search text copied, paste in Card Ladder'},
    {label:'ALT',url:'https://alt.xyz/browse?query='+enc(altCert?cert:text),copy:altCert?cert:text,toast:altCert?'Cert copied, paste in ALT':'Search text copied, paste in ALT'},
    {label:'eBay',url:ebayUrl(sp)}];
  const lines=[`eBay sold: ${text} ${EBAY_NOISE}`,`ALT: ${altCert?'cert '+cert:text}`,`Card Ladder: ${cert?'cert '+cert:text}`];
  return{links,lines}}
const linkPill=l=>`<a class="pill sm" href="${esc(l.url)}" target="_blank" rel="noopener"${l.copy?` data-copy="${esc(l.copy)}" data-toast="${esc(l.toast)}"`:''}>${esc(l.label)}${icon('ext',16)}</a>`;
const queryLines=lines=>lines.map(t=>`<div>${esc(t)}</div>`).join('');
// copy first (same tap), then the link opens normally so Android can hand it to the app
document.addEventListener('click',e=>{const a=e.target.closest('a[data-copy]');if(a&&a.dataset.copy)copyText(a.dataset.copy).then(ok=>{if(ok)toast(a.dataset.toast||'Copied',3000)})},true);

// ---------- PSA verification ----------
// Only these fields are ever kept, and only in cards.psa_data.
const psaKeep=(cert,d)=>({verified:!!d.verified,verified_at:new Date().toISOString(),cert:String(d.cert||cert),
  ...(d.verified?{name:String(d.name||''),year:String(d.year||''),set:String(d.set||''),grade:String(d.grade||'')}:{})});
const psaSession=new Map();
// returns stored/known PSA data, a fresh lookup, or null when PSA could not be checked (never blocks the flow)
async function psaLookup(cert){cert=String(cert||'').replace(/\D/g,'');if(!cert)return null;
  if(psaSession.has(cert))return psaSession.get(cert);
  const known=cards.find(c=>c.psa_data&&String(c.psa_data.cert)===cert);if(known){psaSession.set(cert,known.psa_data);return known.psa_data}
  try{const{data,error}=await withTimeout(sb.functions.invoke('psa-cert',{body:{cert}}),12000);
    if(error||!data||typeof data.verified!=='boolean')return null;
    const p=psaKeep(cert,data);psaSession.set(cert,p);return p}catch{return null}}
const psaFor=(p,cert)=>p&&String(p.cert)===String(cert||'').replace(/\D/g,'')?p:null;

// ---------- scan ----------
let S=null;// {blob,url,psa,d:{grader,grade,cert,name,year,set}}
function fromRead(d){const set=String(d.set||'').trim(),y=set.match(/\b(19|20)\d{2}\b/);
  return{grader:String(d.grader||'').trim(),grade:String(d.grade??'').trim(),cert:String(d.cert??'').replace(/\s/g,''),name:String(d.name||'').trim(),
    year:y?y[0]:'',set:y?set.replace(y[0],'').replace(/\s{2,}/g,' ').trim():set}}
function withPsa(d,p){if(!p||!p.verified)return d;return{...d,grader:'PSA',cert:p.cert||d.cert,name:tc(p.name)||d.name,year:p.year||d.year,set:tc(p.set)||d.set,grade:gradeNum(p.grade)||d.grade}}
const joinSet=(year,set)=>year&&!String(set).includes(year)?`${year} ${set}`.trim():String(set||'').trim();
$('#scanBtn').onclick=()=>pickPhoto('Scan a slab',scanFile);
$('#scRescan').onclick=()=>pickPhoto('Scan a slab',scanFile);
async function scanFile(file){if(S?.url)URL.revokeObjectURL(S.url);S=null;$('#loadTxt').textContent='Reading slab…';$('#loadSub').textContent='';show('loading',{replace:cur==='scanned'});// a rescan replaces the old result
  let blob,d={grader:'',grade:'',cert:'',name:'',year:'',set:''},msg='';
  try{blob=await shrink(file)}catch{toast('Could not open that photo');back();return}
  try{d=fromRead(await readSlab(blob))}catch{msg='Could not read the slab. Fill in the details by hand.'}
  let psa=null;
  if(gnorm(d.grader)==='PSA'&&d.cert){$('#loadTxt').textContent='Checking PSA…';psa=await psaLookup(d.cert);
    if(psa&&!psa.verified)msg='PSA has no record of this cert. Check the cert number.';else if(!psa)msg='Couldn’t reach PSA, so these details are from the photo.'}
  S={blob,url:URL.createObjectURL(blob),psa,read:d,shown:withPsa(d,psa)};
  fillScanned(msg);show('scanned');fitName()}
function scanVals(){return{grader:$('#scGrader').value.trim(),grade:$('#scGrade').value.trim(),cert:$('#scCert').value.replace(/\s/g,''),name:$('#scName').value.trim(),year:$('#scYear').value.trim(),set:$('#scSet').value.trim()}}
function fillScanned(msg){const d=S.shown;$('#scImg').src=S.url;$('#scName').value=d.name;$('#scYear').value=d.year;$('#scSet').value=d.set;
  $('#scGrader').value=d.grader;$('#scGrade').value=d.grade;$('#scCert').value=d.cert;$('#scMsg').textContent=msg||'';updScanned()}
function updScanned(){const v=scanVals(),p=psaFor(S.psa,v.cert);$('#scBadge').hidden=!(p&&p.verified&&gnorm(v.grader)==='PSA');
  const cl=certLink(v.grader,v.cert);$('#scCertLink').hidden=!cl;if(cl){$('#scCertLink').href=cl.url;$('#scCertLabel').textContent='View card on '+cl.label}
  const vl=valueLinks({...v,psa:S.psa});$('#scValue').innerHTML=vl.links.map(linkPill).join('');$('#scQ').innerHTML=queryLines(vl.lines);fitName()}
function fitName(){const n=$('#scName');if(!n.offsetParent)return;n.style.height='auto';n.style.height=n.scrollHeight+'px'}
['#scName','#scYear','#scSet','#scGrader','#scGrade','#scCert'].forEach(id=>$(id).addEventListener('input',updScanned));
// a corrected PSA cert gets checked too (once per cert)
['#scCert','#scGrader'].forEach(id=>$(id).addEventListener('change',async()=>{const v=scanVals();if(gnorm(v.grader)!=='PSA'||!v.cert||psaFor(S.psa,v.cert))return;
  $('#scMsg').textContent='Checking PSA…';const p=await psaLookup(v.cert);if(!S)return;S.psa=p||S.psa;
  if(p&&p.verified){const d=withPsa(scanVals(),p);S.shown=d;$('#scName').value=d.name;$('#scYear').value=d.year;$('#scSet').value=d.set;$('#scGrade').value=d.grade;$('#scMsg').textContent=''}
  else $('#scMsg').textContent=p?'PSA has no record of this cert.':'Couldn’t reach PSA.';updScanned()}));
// Fields still showing PSA's values are saved as the photo reading instead; anything the user typed is kept.
function ownCols(v,shown,read){const o={...v};if(shown&&read)for(const k of['name','year','set','grade'])if(v[k]===shown[k]&&shown[k]!==read[k])o[k]=read[k];return o}
const sumRow=(img,name,sub)=>`${img?`<img src="${esc(img)}" alt="">`:`<div class="ph"><i class="ic" data-i="slab"></i></div>`}<div style="min-width:0"><b>${esc(name||'Untitled card')}</b><small>${esc(sub)}</small></div>`;

// ---------- add to inventory ----------
$('#scAdd').onclick=()=>{const v=scanVals();if(!v.cert){$('#scMsg').textContent='Enter the cert number first.';return}
  $('#addSum').innerHTML=sumRow(S.url,v.name,[v.grader,v.grade].filter(Boolean).join(' ')+' · #'+v.cert);fillIcons($('#addSum'));
  $('#addPrice').value='';$('#addFees').value='';$('#addDate').value=today();pset($('#addFrom'),null);$('#addDup').hidden=true;$('#addMsg').textContent='';
  show('add');setTimeout(()=>$('#addPrice').focus(),50)};
$('#addSave').onclick=async()=>{const v=scanVals();if($('#addPrice').value===''){$('#addMsg').textContent='Enter the price paid.';return}
  $('#addDup').hidden=true;$('#addSave').disabled=true;$('#addMsg').textContent='Checking for this cert…';
  const{data:dups,error}=await sb.from('cards').select('grader,grade,name,bought_on,cost,status,sold_on,sold_for,disposed_trade_id,trade_value_out').eq('cert',v.cert).order('bought_on');
  $('#addSave').disabled=false;if(error){$('#addMsg').textContent='Could not check for duplicates: '+error.message;return}
  if(!dups.length)return saveNew();
  $('#addDupMsg').textContent=dups.some(c=>c.status==='inventory')?'This cert is already in your inventory. You may have scanned it twice.':'You’ve owned this card before. Buying it back?';
  $('#addDupList').innerHTML=dups.map(c=>`<div class="kv"><span>${esc(c.name||'Card')} · ${esc(c.grader)} ${esc(c.grade)}</span><span class="v mut" style="font-size:14px">Bought ${fmtDate(c.bought_on)} ${money0(c.cost)}<br>${c.status==='sold'?`Sold ${fmtDate(c.sold_on)} ${money0(c.sold_for)}`:c.status==='traded'?`Traded ${fmtDate(tradeDate(c.disposed_trade_id))}`:'In stock'}</span></div>`).join('');
  $('#addMsg').textContent='Not saved yet.';$('#addDup').hidden=false;$('#addDup').scrollIntoView({block:'nearest',behavior:'smooth'})};
$('#addDupCancel').onclick=()=>{$('#addDup').hidden=true;$('#addMsg').textContent='Not saved.'};
$('#addDupSave').onclick=()=>{$('#addDup').hidden=true;saveNew()};
async function saveNew(){if(!S)return;const v=scanVals(),btn=$('#addSave');btn.disabled=true;$('#addMsg').textContent='Saving…';
  try{let photo=null;
    if(S.blob){const u=(await sb.auth.getUser()).data.user,path=u.id+'/'+Date.now()+'.jpg',up=await sb.storage.from('slabs').upload(path,S.blob,{contentType:'image/jpeg'});if(!up.error)photo=path}
    const p=psaFor(S.psa,v.cert),o=ownCols(v,S.shown,S.read);
    const{error}=await sb.from('cards').insert({cert:v.cert,grader:v.grader,grade:o.grade,name:o.name,set_name:joinSet(o.year,o.set),cost:N($('#addPrice').value),buy_fees:N($('#addFees').value),
      bought_on:$('#addDate').value||today(),photo,acquired_via:'purchase',bought_from:pget($('#addFrom')),...(p?{psa_data:p}:{})});
    if(error){if(photo)sb.storage.from('slabs').remove([photo]);$('#addMsg').textContent='Save failed: '+error.message;return}
    toast('Saved to inventory');S=null;await home('inv');load()}
  finally{btn.disabled=false}}

// ---------- sell ----------
let sellCard=null,sellPsa=null;
$('#scSell').onclick=()=>{const v=scanVals(),st=cards.filter(c=>c.status==='inventory'),ms=v.cert?st.filter(c=>String(c.cert).trim()===v.cert):[];
  sellPsa=psaFor(S.psa,v.cert);
  if(ms.length===1)return openSell(ms[0].id);
  openPick(ms.length?ms:st,ms.length?`${ms.length} in-stock cards have cert ${v.cert}. Pick the one you sold.`:`No in-stock card has cert ${v.cert||'?'}. Pick the card you sold.`,openSell)};
let pickList=[],pickFn=null;
function openPick(list,msg,fn){pickList=list;pickFn=fn;$('#pickMsg').textContent=msg;$('#pickQ').value='';renderPick();show('pick')}
function renderPick(){const q=$('#pickQ').value.trim().toLowerCase();
  $('#pickList').innerHTML=pickList.filter(c=>matchQ(c,q)).map(c=>`<button class="li" data-card="${esc(c.id)}">${thumb(c)}<div class="in"><b>${esc(dv(c).name||'Untitled card')}</b><small>${esc([c.grader,c.grade].filter(Boolean).join(' '))} · #${esc(c.cert)}</small><small>Paid ${money(myBasis(c))} · ${fmtDate(c.bought_on)}</small></div><i class="ic mut" data-i="chev"></i></button>`).join('')||'<div class="empty">No cards in stock.</div>';
  fillIcons($('#pickList'))}
$('#pickQ').oninput=renderPick;$('#pickList').onclick=e=>{const b=e.target.closest('[data-card]');if(b)pickFn(b.dataset.card)};
function openSell(id){const c=cardById(id);if(!c)return;sellCard=c;
  const d=dv(c);$('#sellSum').innerHTML=sumRow(urls[c.photo],d.name,[d.grader,d.grade].filter(Boolean).join(' ')+' · #'+c.cert);fillIcons($('#sellSum'));
  $('#sellPrice').value='';$('#sellFees').value='';$('#sellDate').value=today();pset($('#sellOn'),null);$('#sellMsg').textContent='';updSell();show('sell');setTimeout(()=>$('#sellPrice').focus(),50)}
function updSell(){const c=sellCard;if(!c)return;const p=N($('#sellPrice').value)-N($('#sellFees').value)-myBasis(c);
  $('#sellProfit').innerHTML=$('#sellPrice').value===''?'<span class="mut">—</span>':pc(p);$('#sellPaid').textContent=money(myBasis(c));
  const d=daysBetween(c.bought_on,$('#sellDate').value);$('#sellDays').textContent=d==null?'—':pl(d,'day')}
['#sellPrice','#sellFees','#sellDate'].forEach(id=>$(id).addEventListener('input',updSell));
$('#sellSave').onclick=async()=>{const c=sellCard;if($('#sellPrice').value===''){$('#sellMsg').textContent='Enter the price it sold for.';return}
  const btn=$('#sellSave');btn.disabled=true;$('#sellMsg').textContent='Saving…';
  try{const p=!c.psa_data&&psaFor(sellPsa,c.cert);
    const{error}=await sb.from('cards').update({status:'sold',sold_for:N($('#sellPrice').value),sell_fees:N($('#sellFees').value),sold_on:$('#sellDate').value||today(),sold_platform:pget($('#sellOn')),...(p?{psa_data:p}:{})}).eq('id',c.id);
    if(error){$('#sellMsg').textContent='Save failed: '+error.message;return}
    toast(`Sold · profit ${money(N($('#sellPrice').value)-N($('#sellFees').value)-myBasis(c))}`);sellCard=sellPsa=null;S=null;await home('sold');load()}
  finally{btn.disabled=false}};

// ---------- card detail ----------
let cdId=null;
function openCard(id,{push=true}={}){const c=cardById(id);if(!c){if(cur==='card')back();else if(!push)render('inv');return}cdId=c.id;
  const u=urls[c.photo];$('#cdImg').hidden=!u;$('#cdPh').hidden=!!u;if(u)$('#cdImg').src=u;
  const dc=dv(c);$('#cdName').textContent=dc.name||'Untitled card';$('#cdSub').textContent=[dc.set_name,[dc.grader,dc.grade].filter(Boolean).join(' '),c.cert?'#'+c.cert:''].filter(Boolean).join(' · ');
  $('#cdBadge').hidden=!(c.psa_data&&c.psa_data.verified);
  $('#cdPaid').textContent=money0(myBasis(c));const end=c.status==='sold'?c.sold_on:c.status==='traded'?tradeDate(c.disposed_trade_id):null,d=daysBetween(c.bought_on,end);
  $('#cdHeld').textContent=d==null?'—':d+'d';$('#cdSrc').textContent=c.acquired_via==='trade'?'Trade':(c.bought_from||'—');
  const ev=[];
  ev.push(c.acquired_via==='trade'?{t:'Traded in',d:tradeDate(c.acquired_trade_id),s:`Trade value ${money(c.trade_value_in)} · basis ${money(myBasis(c))}`}
    :{t:'Bought',d:c.bought_on,s:`${money(myBasis(c))}${N(c.buy_fees)?` incl. ${money(c.buy_fees)} fees`:''}${c.bought_from?' · '+c.bought_from:''}`});
  if(c.status==='sold')ev.push({t:'Sold',d:c.sold_on,s:`${money(c.sold_for)}${c.sold_platform?' · '+c.sold_platform:''} · profit ${money(profit(c))}`,d2:1});
  if(c.status==='traded')ev.push({t:'Traded away',d:tradeDate(c.disposed_trade_id),s:`Trade value ${money(c.trade_value_out)}`,d2:1});
  if(c.status==='inventory')ev.push({t:'In stock',d:'',s:d!=null?`Held ${pl(d,'day')}`:'',d2:1});
  $('#cdTl').innerHTML=ev.map(e=>`<div class="ev"><div class="dot${e.d2?' d2':''}"></div><div><b>${e.t}${e.d?' · '+fmtDate(e.d):''}</b><small>${esc(e.s)}</small></div></div>`).join('');
  const vl=valueLinks({name:c.name,set:c.set_name,year:'',grader:c.grader,grade:c.grade,cert:c.cert,psa:c.psa_data}),cl=certLink(c.grader,c.cert),lk=[...vl.links];
  if(cl)lk.push({label:cl.label+' cert',url:cl.url});$('#cdLinks').innerHTML=lk.map(linkPill).join('');$('#cdQ').innerHTML=queryLines(vl.lines);
  const act=[];if(c.status==='inventory')act.push('<div class="btns2"><button class="btn" id="cdSell">Sell</button><button class="btn dark" id="cdTrade">Trade</button></div>');
  if(c.acquired_trade_id&&tradeOf(c.acquired_trade_id))act.push(`<button class="link" data-trade="${esc(c.acquired_trade_id)}">View the trade it came from</button>`);
  if(c.disposed_trade_id&&tradeOf(c.disposed_trade_id))act.push(`<button class="link" data-trade="${esc(c.disposed_trade_id)}">View the trade it went out in</button>`);
  $('#cdActions').innerHTML=act.join('');
  if(c.status==='inventory'){$('#cdSell').onclick=()=>{sellPsa=null;openSell(c.id)};$('#cdTrade').onclick=()=>startTrade([c.id])}
  if(push||cur!=='card')show('card',{push,data:c.id})}
$('#cdActions').addEventListener('click',e=>{const b=e.target.closest('[data-trade]');if(b)openTrade(b.dataset.trade)});
$('#cdEdit').onclick=()=>openEdit(cdId);

// ---------- edit card ----------
let editing=null;
function openEdit(id,{push=true}={}){const c=cardById(id);if(!c){if(!push)render('inv');return}editing=c;
  const v={eName:c.name,eSet:c.set_name,eGrader:c.grader,eGrade:c.grade,eCert:c.cert,eCost:c.cost,eFees:c.buy_fees,eBought:c.bought_on,eSoldFor:c.sold_for,eSellFees:c.sell_fees,eSoldOn:c.sold_on||today()};
  Object.entries(v).forEach(([k,x])=>$('#'+k).value=x??'');pset($('#eFrom'),c.bought_from||null);pset($('#ePlat'),c.sold_platform||null);
  const traded=c.status==='traded';pset($('#eStatus'),traded?null:c.status);$$('#eStatus .pill').forEach(b=>b.disabled=traded);
  $('#eTradedNote').hidden=!traded;$('#eTradedNote').textContent=traded?`Traded away on ${fmtDate(tradeDate(c.disposed_trade_id))}. To put it back in stock, delete that trade.`:'';
  const pv=c.psa_data&&c.psa_data.verified,d=dv(c);$('#ePsaNote').hidden=!pv;
  if(pv)$('#ePsaNote').textContent=`Shown with PSA’s verified details: ${d.name} · ${d.set_name} · ${d.grade}. The fields below are your own copy; exports use these.`;
  $('#eSoldRows').hidden=c.status!=='sold';$('#eDel').hidden=traded;$('#eMsg').textContent='';show('edit',{push,data:c.id})}
$('#eStatus').addEventListener('change',()=>{$('#eSoldRows').hidden=pget($('#eStatus'))!=='sold'});
$('#eSave').onclick=async()=>{const c=editing,cert=$('#eCert').value.trim(),status=c.status==='traded'?'traded':pget($('#eStatus')),sold=status==='sold';
  if(!cert){$('#eMsg').textContent='Cert number is required.';return}if(sold&&$('#eSoldFor').value===''){$('#eMsg').textContent='Enter the sale price.';return}
  const{error}=await sb.from('cards').update({cert,grader:$('#eGrader').value.trim(),grade:$('#eGrade').value.trim(),name:$('#eName').value.trim(),set_name:$('#eSet').value.trim(),
    cost:N($('#eCost').value),buy_fees:N($('#eFees').value),bought_on:$('#eBought').value||null,bought_from:pget($('#eFrom')),status,
    sold_for:sold?N($('#eSoldFor').value):null,sell_fees:sold?N($('#eSellFees').value):0,sold_on:sold?($('#eSoldOn').value||null):null,sold_platform:sold?pget($('#ePlat')):null}).eq('id',c.id);
  if(error){$('#eMsg').textContent='Save failed: '+error.message;return}
  toast('Saved');back();await load()};
$('#eDel').onclick=async()=>{if(!confirm('Delete this card permanently?'))return;const c=editing;
  if(c.photo)await sb.storage.from('slabs').remove([c.photo]);const{error}=await sb.from('cards').delete().eq('id',c.id);
  if(error){$('#eMsg').textContent='Delete failed: '+error.message;return}
  toast('Card deleted');await home(c.status==='inventory'?'inv':'sold');load()};

// ---------- trades list + detail ----------
function renderTrades(){$('#tList').innerHTML=trades.map(t=>{const o=cards.filter(c=>String(c.disposed_trade_id)===String(t.id)),i=cards.filter(c=>String(c.acquired_trade_id)===String(t.id));
  const cash=[N(t.cash_paid)?'paid '+money0(t.cash_paid):'',N(t.cash_received)?'received '+money0(t.cash_received):''].filter(Boolean).join(' · ');
  return`<button class="li" data-trade="${esc(t.id)}" style="min-height:64px"><div class="in"><b>${fmtDate(t.trade_date)}${t.counterparty?' · '+esc(t.counterparty):''}</b><small>${o.length} out ${money0(o.reduce((a,c)=>a+N(c.trade_value_out),0))} → ${i.length} in ${money0(i.reduce((a,c)=>a+N(c.trade_value_in),0))}${cash?' · '+cash:''}</small></div><i class="ic mut" data-i="chev"></i></button>`}).join('')||'<div class="empty">No trades yet.</div>';
  fillIcons($('#tList'))}
$('#tList').onclick=e=>{const b=e.target.closest('[data-trade]');if(b)openTrade(b.dataset.trade)};
let tvId=null;
function openTrade(id,{push=true}={}){const t=tradeOf(id);if(!t){if(!push)render('trades');return}tvId=String(t.id);
  const o=cards.filter(c=>String(c.disposed_trade_id)===tvId),i=cards.filter(c=>String(c.acquired_trade_id)===tvId),s=(l,f)=>l.reduce((a,c)=>a+N(f(c)),0);
  const row=(c,a,b)=>`<button class="li" data-card="${esc(c.id)}">${thumb(c)}<div class="in"><b>${esc(dv(c).name||'Untitled card')}</b><small>${esc([c.grader,c.grade].filter(Boolean).join(' '))} · #${esc(c.cert)}</small><small>${b}</small></div><div class="amt">${a}</div></button>`;
  $('#tvBody').innerHTML=`<div class="tiles"><div class="tile"><small>Date</small><b style="font-size:19px">${fmtDate(t.trade_date)}</b></div><div class="tile"><small>With</small><b style="font-size:19px">${esc(t.counterparty||'—')}</b></div></div>`+
    (t.notes?`<div class="note">${esc(t.notes)}</div>`:'')+
    `<div class="sub">Cards out</div><div class="panel">${o.map(c=>row(c,money0(c.trade_value_out),`Cost ${money(myBasis(c))} · gain ${money(N(c.trade_gain))}`)).join('')||'<div class="empty">None found.</div>'}</div>`+
    `<div class="sub">Cards in</div><div class="panel">${i.map(c=>row(c,money0(c.trade_value_in),`My basis ${money(myBasis(c))} · tax basis ${money(taxBasis(c))}`)).join('')||'<div class="empty">None found.</div>'}</div>`+
    `<div class="sub">Cash and basis</div><div class="panel"><div class="kv"><span>Cash I paid</span><span class="v">${money(t.cash_paid)}</span></div><div class="kv"><span>Cash I received</span><span class="v">${money(t.cash_received)}</span></div>`+
    `<div class="kv"><span>Values out / in</span><span class="v">${money(s(o,c=>c.trade_value_out))} / ${money(s(i,c=>c.trade_value_in))}</span></div>`+
    `<div class="kv"><span>Carryover basis (my view)</span><span class="v gold">${money(s(i,myBasis))}</span></div><div class="kv"><span>Market-value basis (tax view)</span><span class="v gold">${money(s(i,taxBasis))}</span></div>`+
    (N(t.carryover_gain)?`<div class="kv"><span>Cash profit (my view)</span><span class="v">${pc(N(t.carryover_gain))}</span></div>`:'')+
    `<div class="kv"><span>Gain on cards out (tax view)</span><span class="v">${pc(s(o,tradeGainTax))}</span></div></div>`;
  fillIcons($('#tvBody'));$('#tvMsg').textContent='';show('tview',{push,data:t.id})}
$('#tvBody').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)openCard(b.dataset.card)});
$('#tvDel').onclick=async()=>{const id=tvId,o=cards.filter(c=>String(c.disposed_trade_id)===id),i=cards.filter(c=>String(c.acquired_trade_id)===id);
  if(!confirm(`Delete this trade?\n\n${pl(o.length,'card')} you traded away will go back to in stock.\n${pl(i.length,'card')} you got in the trade will be deleted, with ${i.length===1?'its photo':'their photos'}.\n\nThis can't be undone.`))return;
  const btn=$('#tvDel');btn.disabled=true;$('#tvMsg').textContent='Deleting trade…';
  try{const{data,error}=await sb.rpc('delete_trade',{p_trade_id:id});
    if(error){$('#tvMsg').textContent=error.code==='PGRST202'?'The delete_trade function isn’t set up in Supabase yet.':error.message;return}
    const ph=data?.photos||[];if(ph.length)await sb.storage.from('slabs').remove(ph);toast('Trade deleted');await home('trades');await load()}
  finally{btn.disabled=false}};

// ---------- trade flow ----------
let T=null,tkey=0;
const tn=v=>v===''||v==null?NaN:+v;
function splitBasis(basis,vals){const tot=vals.reduce((a,v)=>a+v,0),n=vals.length;let left=basis;
  return vals.map((v,i)=>{const s=i===n-1?left:Math.min(r2(tot>0?basis*v/tot:basis/n),left);left=r2(left-s);return s})}
$('#tNew').onclick=()=>startTrade([]);
function startTrade(ids){T={out:ids.map(id=>({id,value:''})),in:[],step:1};$('#trDate').value=today();['#trPaid','#trRecv','#trCp','#trNotes'].forEach(i=>$(i).value='');
  $('#trOutMsg').textContent='Add each card you’re giving up.';$('#trInMsg').textContent='Add each slab you’re getting.';renderTOut();renderTIn();show('trade');trStep(1)}
const STEP=['Cards going out','Cash','Cards coming in'];
function trStep(n){T.step=n;[1,2,3].forEach(i=>{$('#tr'+i).hidden=i!==n;$('#st'+i).classList.toggle('on',i<=n)});$('#trStep').textContent=`Step ${n} of 3 · ${STEP[n-1]}`;
  $('#trBack').textContent=n===1?'Cancel':'Back';$('#trNext').textContent=n===3?'Save trade':'Next';$('#trMsg').textContent='';renderBal();scrollTo(0,0)}
const leaveTrade=()=>{if(T&&(T.out.length||T.in.length)&&!confirm('Discard this trade?'))return false;T?.in.forEach(c=>c.url&&URL.revokeObjectURL(c.url));T=null;back();return true};
$('#trClose').onclick=leaveTrade;$('#trBack').onclick=()=>T.step===1?leaveTrade():trStep(T.step-1);
$('#trNext').onclick=()=>{const bad=checkStep(T.step);if(bad){$('#trMsg').textContent=bad;return}if(T.step<3)trStep(T.step+1);else saveTrade()};
function checkStep(n){
  if(n===1){if(!T.out.length)return'Add at least one card you’re giving up.';if(T.out.some(o=>!(tn(o.value)>=0)))return'Enter a trade value for each card going out.'}
  if(n===2){if(!$('#trDate').value)return'Enter the trade date.'}
  if(n===3){if(!T.in.length)return'Add at least one card you’re getting.';if(T.in.some(c=>c.reading))return'Wait for the slab photos to finish reading.';
    if(T.in.some(c=>!c.cert.trim()))return'Each incoming card needs a cert number.';if(T.in.some(c=>!(tn(c.value)>=0)))return'Enter a trade value for each card coming in.'}
  return''}
function tradeCalc(){const out=T.out.map(o=>({c:cardById(o.id),v:tn(o.value)})),vin=T.in.map(c=>tn(c.value)||0);
  const vo=out.reduce((a,o)=>a+(o.v||0),0),vi=vin.reduce((a,v)=>a+v,0),paid=N($('#trPaid').value),recv=N($('#trRecv').value),cost=out.reduce((a,o)=>a+(o.c?myBasis(o.c):0),0);
  let basis=r2(cost+paid-recv),gain=0;if(basis<0){gain=-basis;basis=0}return{vo,vi,paid,recv,cost,basis,gain,shares:splitBasis(basis,vin)}}
function renderBal(){if(!T)return;const k=tradeCalc(),give=k.vo+k.paid,get=k.vi+k.recv,diff=r2(give-get);$('#trBal').classList.toggle('warnp',!!diff);
  $('#trBal').innerHTML=`<div class="kv"><span>I give</span><span class="v">${money(k.vo)} cards + ${money(k.paid)} cash = <b>${money(give)}</b></span></div>`+
    `<div class="kv"><span>I get</span><span class="v">${money(k.vi)} cards + ${money(k.recv)} cash = <b>${money(get)}</b></span></div>`+
    `<div class="kv"><span>Balance</span><span class="v">${diff?`<span class="neg">Off by ${money(Math.abs(diff))}</span>`:'<span class="pos">Balanced</span>'}</span></div>`+
    `<div class="kv"><span>Basis for cards in</span><span class="v">${money(k.basis)}${k.gain?` <small class="mut">· cash profit ${money(k.gain)}</small>`:''}</span></div>`;
  T.in.forEach((c,i)=>{const el=$('#tib'+i);if(el)el.textContent=`My basis ${money(k.shares[i])} · tax basis ${isNaN(tn(c.value))?'—':money(tn(c.value))}`})}
['#trPaid','#trRecv'].forEach(i=>$(i).addEventListener('input',renderBal));
// out
function addOut(id){if(!T||T.out.some(o=>String(o.id)===String(id)))return;T.out.push({id,value:''});renderTOut();$('#trOutMsg').textContent='Added. Enter its trade value.'}
function renderTOut(){$('#trOutList').innerHTML=T.out.map((o,i)=>{const c=cardById(o.id);return`<div class="panel"><div class="li">${thumb(c)}<div class="in"><b>${esc(dv(c).name||'Untitled card')}</b><small>${esc([c.grader,c.grade].filter(Boolean).join(' '))} · #${esc(c.cert)}</small><small>Cost ${money(myBasis(c))}</small></div><button class="iconbtn" data-orm="${i}" aria-label="Remove"><i class="ic" data-i="close"></i></button></div>`+
  `<div class="kv"><span>Trade value</span><input class="v" data-ov="${i}" type="number" step="0.01" min="0" inputmode="decimal" placeholder="$0.00" value="${esc(o.value)}"></div></div>`}).join('');fillIcons($('#trOutList'));renderBal()}
$('#trOutList').oninput=e=>{const i=e.target.dataset.ov;if(i!=null){T.out[i].value=e.target.value;renderBal()}};
$('#trOutList').onclick=e=>{const b=e.target.closest('[data-orm]');if(b){T.out.splice(+b.dataset.orm,1);renderTOut()}};
$('#trOutPick').onclick=()=>{const used=new Set(T.out.map(o=>String(o.id)));openPick(cards.filter(c=>c.status==='inventory'&&!used.has(String(c.id))),'Pick a card you’re giving up.',id=>{addOut(id);back()})};
$('#trOutScan').onclick=()=>pickPhoto('Scan a slab you’re giving up',async f=>{const t=T;$('#trOutMsg').textContent='Reading slab…';
  try{const d=fromRead(await readSlab(await shrink(f)));if(T!==t)return;const used=new Set(T.out.map(o=>String(o.id))),ms=d.cert?cards.filter(c=>c.status==='inventory'&&!used.has(String(c.id))&&String(c.cert).trim()===d.cert):[];
    if(ms.length===1)addOut(ms[0].id);
    else if(ms.length>1)openPick(ms,`${ms.length} in-stock cards have cert ${d.cert}. Pick the one you’re giving up.`,id=>{addOut(id);back()});
    else $('#trOutMsg').textContent=d.cert&&cards.some(c=>used.has(String(c.id))&&String(c.cert).trim()===d.cert)?'That card is already in this trade.':`No in-stock card with cert ${d.cert||'?'}. Use From list.`}
  catch{if(T===t)$('#trOutMsg').textContent='Could not read that photo. Use From list.'}});
// in
const TIF=[['name','Name'],['set_name','Set / year'],['grader','Grader'],['grade','Grade'],['cert','Cert #']];
function newIn(){const c={key:++tkey,grader:'',grade:'',cert:'',name:'',set_name:'',value:'',blob:null,url:null,reading:false,psa:null};T.in.push(c);return c}
$('#trInHand').onclick=()=>{newIn();renderTIn()};
$('#trInScan').onclick=()=>pickPhoto('Photo of a slab you’re getting',async f=>{const t=T,c=newIn();c.reading=true;renderTIn();
  try{c.blob=await shrink(f);c.url=URL.createObjectURL(c.blob);if(T===t)renderTIn();let d=fromRead(await readSlab(c.blob));
    c.read={name:d.name,set_name:joinSet(d.year,d.set),grade:d.grade};
    if(gnorm(d.grader)==='PSA'&&d.cert){c.psa=await psaLookup(d.cert);d=withPsa(d,c.psa)}
    c.shown={name:d.name,set_name:joinSet(d.year,d.set),grade:d.grade};
    Object.assign(c,{grader:d.grader,grade:d.grade,cert:d.cert,name:d.name,set_name:joinSet(d.year,d.set)});if(T===t)$('#trInMsg').textContent='Check the details and enter a trade value.'}
  catch{if(T===t)$('#trInMsg').textContent='Could not read that photo. Fill in the card by hand.'}
  c.reading=false;if(T===t)renderTIn()});
function renderTIn(){$('#trInList').innerHTML=T.in.map((c,i)=>`<div class="panel"><div class="li">${c.url?`<img class="th" src="${esc(c.url)}" alt="">`:'<div class="th ph"><i class="ic" data-i="slab"></i></div>'}<div class="in"><b>Card ${i+1} coming in</b>${c.reading?'<small>Reading slab…</small>':''}${c.psa&&c.psa.verified&&String(c.psa.cert)===c.cert?'<small class="pos">Verified with PSA</small>':''}<small id="tib${i}"></small></div><button class="iconbtn" data-irm="${i}" aria-label="Remove"><i class="ic" data-i="close"></i></button></div>`+
  TIF.map(([k,l])=>`<div class="kv"><span>${l}</span><input class="v" data-ik="${k}" data-i="${i}" value="${esc(c[k])}"${k==='cert'?' inputmode="numeric"':''}></div>`).join('')+
  `<div class="kv"><span>Trade value</span><input class="v" data-ik="value" data-i="${i}" type="number" step="0.01" min="0" inputmode="decimal" placeholder="$0.00" value="${esc(c.value)}"></div></div>`).join('');fillIcons($('#trInList'));renderBal()}
$('#trInList').oninput=e=>{const{ik,i}=e.target.dataset;if(ik){T.in[i][ik]=e.target.value;if(ik==='value')renderBal()}};
$('#trInList').onclick=e=>{const b=e.target.closest('[data-irm]');if(b){const[c]=T.in.splice(+b.dataset.irm,1);if(c.url)URL.revokeObjectURL(c.url);renderTIn()}};
async function saveTrade(){const k=tradeCalc(),diff=r2(k.vo+k.paid-k.vi-k.recv);
  if(diff&&!confirm(`This trade is off by ${money(Math.abs(diff))}. Save it anyway?`))return;
  const btn=$('#trNext'),uploaded=[];btn.disabled=true;$('#trMsg').textContent='Saving trade…';
  try{const u=(await sb.auth.getUser()).data.user,cin=[];
    for(const[i,c]of T.in.entries()){let photo=null;
      if(c.blob){const path=u.id+'/'+Date.now()+'-'+i+'.jpg',up=await sb.storage.from('slabs').upload(path,c.blob,{contentType:'image/jpeg'});if(!up.error){photo=path;uploaded.push(path)}}
      const own=k=>c.shown&&c.read&&c[k]===c.shown[k]&&c.shown[k]!==c.read[k]?c.read[k]:c[k];
      cin.push({cert:c.cert.trim(),grader:c.grader.trim(),grade:String(own('grade')).trim(),name:String(own('name')).trim(),set_name:String(own('set_name')).trim(),photo,value:tn(c.value)})}
    const{data,error}=await sb.rpc('record_trade',{p:{trade_date:$('#trDate').value,cash_paid:k.paid,cash_received:k.recv,counterparty:$('#trCp').value.trim(),notes:$('#trNotes').value.trim(),
      cards_out:T.out.map(o=>({id:o.id,value:tn(o.value)})),cards_in:cin}});
    if(error){if(uploaded.length)sb.storage.from('slabs').remove(uploaded);$('#trMsg').textContent=error.code==='PGRST202'?'The record_trade function isn’t set up in Supabase yet.':'Trade not saved: '+error.message;return}
    // record_trade() doesn't know about psa_data; attach verified PSA results to the new cards afterwards
    const tid=data?.trade_id;
    if(tid)for(const c of T.in){const p=psaFor(c.psa,c.cert.trim());if(p)await sb.from('cards').update({psa_data:p}).eq('acquired_trade_id',tid).eq('cert',c.cert.trim())}
    T.in.forEach(c=>c.url&&URL.revokeObjectURL(c.url));T=null;toast('Trade saved');await home('trades');await load();if(tid)openTrade(tid)}
  catch(e){if(uploaded.length)sb.storage.from('slabs').remove(uploaded);$('#trMsg').textContent='Trade not saved: '+(e.message||e)}
  finally{btn.disabled=false}}

// ---------- expenses ----------
const CATS=['Grading fees','Shipping and postage','Supplies','Selling and platform fees','Travel','Meals','Show and booth fees','Software and subscriptions','Other'];
pills($('#xfCat'),CATS);
let xYear=String(new Date().getFullYear()),xEditing=null,xBlob=null,xRaw=null,xUrl=null;
const yearOf=e=>(e.expense_date||'').slice(0,4);
const xsort=(a,b)=>(b.expense_date||'').localeCompare(a.expense_date||'')||(b.expense_time||'').localeCompare(a.expense_time||'')||String(b.created_at).localeCompare(String(a.created_at));
async function loadExpenses(){const{data,error}=await sb.from('expenses').select('*');if(error){$('#xList').innerHTML=`<div class="empty">Could not load expenses: ${esc(error.message)}</div>`;return}
  expenses=(data||[]).sort(xsort);const paths=expenses.map(e=>e.photo).filter(p=>p&&!rurls[p]);
  if(paths.length){const{data:sg}=await sb.storage.from('receipts').createSignedUrls(paths,86400);(sg||[]).forEach(x=>{if(x.signedUrl)rurls[x.path]=x.signedUrl})}
  renderExp()}
function renderExp(){const cy=String(new Date().getFullYear()),years=[...new Set([cy,xYear,...expenses.map(yearOf).filter(Boolean)])].sort().reverse();
  $('#xYears').innerHTML=years.map(y=>`<button class="pill${y===xYear?' on':''}" data-y="${y}">${y}</button>`).join('');
  const list=expenses.filter(e=>yearOf(e)===xYear),tot={};list.forEach(e=>tot[e.category||'Other']=(tot[e.category||'Other']||0)+N(e.amount));
  $('#xTotal').textContent=money0(list.reduce((a,e)=>a+N(e.amount),0));$('#xCount').textContent=list.length;
  const cats=Object.entries(tot).sort((a,b)=>b[1]-a[1]);$('#xCats').hidden=!cats.length;
  $('#xCats').innerHTML=cats.map(([c,v])=>`<div class="kv"><span>${esc(c)}</span><span class="v">${money(v)}</span></div>`).join('');
  $('#xList').innerHTML=list.map(e=>`<button class="li" data-x="${esc(e.id)}">${rurls[e.photo]?`<img class="th" src="${esc(rurls[e.photo])}" alt="" loading="lazy">`:'<div class="th ph"><i class="ic" data-i="receipt"></i></div>'}<div class="in"><b>${esc(e.vendor||'No vendor')}</b><small>${fmtDate(e.expense_date)}${e.expense_time?' '+esc(String(e.expense_time).slice(0,5)):''}</small><small>${esc(e.category||'Other')}</small></div><div class="amt">${money(e.amount)}</div></button>`).join('')
    ||`<div class="empty">No expenses for ${esc(xYear)}.</div>`;fillIcons($('#xList'))}
$('#xYears').onclick=e=>{const b=e.target.closest('[data-y]');if(b){xYear=b.dataset.y;renderExp()}};
$('#xList').onclick=e=>{const b=e.target.closest('[data-x]');if(b)openXForm(expenses.find(x=>String(x.id)===b.dataset.x))};
$('#xCsv').onclick=()=>dl(new Blob([expCsv(expenses.filter(e=>yearOf(e)===xYear).reverse())],{type:'text/csv'}),'card-ledger-expenses-'+xYear+'.csv');
function isoDate(s){if(!s)return'';const m=String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);const d=new Date(s);return isNaN(d)?'':ymd(d)}
function hhmm(s){const m=String(s??'').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?/i);if(!m)return'';let h=+m[1];if(m[3])h=h%12+(/p/i.test(m[3])?12:0);return h<24&&+m[2]<60?pad(h)+':'+m[2]:''}
const num=v=>{const n=parseFloat(String(v??'').replace(/[^0-9.\-]/g,''));return isNaN(n)?'':n.toFixed(2)};
function matchCat(c){const l=String(c??'').trim().toLowerCase();if(!l)return null;return CATS.find(x=>x.toLowerCase()===l)||CATS.find(x=>x.toLowerCase().split(/\W+/).some(w=>w.length>3&&w!=='fees'&&l.includes(w)))||'Other'}
function openXForm(e,pre){xEditing=e||null;const d=e||pre||{};
  $('#xfTitle').textContent=e?'Edit expense':'New expense';$('#xfAmt').value=d.amount??'';$('#xfVendor').value=d.vendor||'';$('#xfDate').value=d.expense_date||today();
  $('#xfTime').value=d.expense_time?String(d.expense_time).slice(0,5):'';$('#xfTax').value=d.tax??'';$('#xfPay').value=d.payment_method||'';$('#xfNotes').value=d.notes||'';
  pset($('#xfCat'),d.category&&CATS.includes(d.category)?d.category:d.category?'Other':null);
  const u=e?rurls[e.photo]:xUrl;$('#xfImg').hidden=!u;if(u)$('#xfImg').src=u;$('#xfDel').hidden=!e;$('#xfMsg').textContent=pre&&pre.msg||'';show('xform')}
$('#xAddHand').onclick=()=>{xBlob=xRaw=null;if(xUrl)URL.revokeObjectURL(xUrl);xUrl=null;openXForm(null,{})};
$('#xAdd').onclick=()=>pickPhoto('Add a receipt',async f=>{if(xUrl)URL.revokeObjectURL(xUrl);xRaw=null;$('#loadTxt').textContent='Reading receipt…';show('loading');
  let pre={msg:''};try{xBlob=await shrink(f);xUrl=URL.createObjectURL(xBlob);const{data,error}=await sb.functions.invoke('read-receipt',{body:{image:await b64(xBlob)}});if(error)throw error;const d=data||{};xRaw=d;
    pre={vendor:d.vendor||'',expense_date:isoDate(d.date)||today(),expense_time:hhmm(d.time),amount:num(d.total),tax:num(d.tax),category:matchCat(d.category),payment_method:d.payment_method||'',notes:d.summary||'',msg:'Check the details, then save.'}}
  catch{pre={msg:'Could not read the receipt. Enter the details by hand.'}}
  openXForm(null,pre)});
$('#xfSave').onclick=async()=>{if($('#xfAmt').value===''){$('#xfMsg').textContent='Enter the amount.';return}if(!$('#xfDate').value){$('#xfMsg').textContent='Enter the date.';return}
  const row={vendor:$('#xfVendor').value.trim(),expense_date:$('#xfDate').value,expense_time:$('#xfTime').value||null,amount:N($('#xfAmt').value),tax:N($('#xfTax').value),
    category:pget($('#xfCat'))||'Other',payment_method:$('#xfPay').value.trim(),notes:$('#xfNotes').value.trim()};
  const btn=$('#xfSave');btn.disabled=true;$('#xfMsg').textContent='Saving…';
  try{if(xEditing){const{error}=await sb.from('expenses').update(row).eq('id',xEditing.id);if(error){$('#xfMsg').textContent='Save failed: '+error.message;return}}
    else{let photo=null;if(xBlob){const u=(await sb.auth.getUser()).data.user,path=u.id+'/'+Date.now()+'.jpg',up=await sb.storage.from('receipts').upload(path,xBlob,{contentType:'image/jpeg'});
        if(up.error){$('#xfMsg').textContent='Photo upload failed: '+up.error.message;return}photo=path}
      const{error}=await sb.from('expenses').insert({...row,photo,raw:xRaw});if(error){if(photo)sb.storage.from('receipts').remove([photo]);$('#xfMsg').textContent='Save failed: '+error.message;return}
      xBlob=xRaw=null;if(xUrl)URL.revokeObjectURL(xUrl);xUrl=null}
    xYear=row.expense_date.slice(0,4);toast('Expense saved');await home('exp');loadExpenses()}
  finally{btn.disabled=false}};
$('#xfDel').onclick=async()=>{if(!confirm('Delete this expense and its receipt photo permanently?'))return;const e=xEditing;
  if(e.photo){const{error}=await sb.storage.from('receipts').remove([e.photo]);if(error){$('#xfMsg').textContent='Could not delete photo: '+error.message;return}}
  const{error}=await sb.from('expenses').delete().eq('id',e.id);if(error){$('#xfMsg').textContent='Delete failed: '+error.message;return}toast('Expense deleted');await home('exp');loadExpenses()};

// ---------- CSV + backup (psa_data is never included) ----------
const CARD_COLS=['cert','grader','grade','name','set_name','bought_on','cost','buy_fees','bought_from','status','sold_on','sold_for','sell_fees','sold_platform',
  'acquired_via','acquired_trade_id','disposed_trade_id','trade_value_in','trade_value_out','fmv_basis','trade_gain'];
const cardsCsv=(list,files,tl)=>{const td=id=>id?(tl.find(t=>String(t.id)===String(id))?.trade_date||''):'';
  return toCsv([...CARD_COLS,'acquired_trade_date','disposed_trade_date','profit','profit_tax_view',...(files?['photo_file']:[])],
    list.map(c=>[...CARD_COLS.map(k=>c[k]),td(c.acquired_trade_id),td(c.disposed_trade_id),c.status==='sold'?profit(c).toFixed(2):'',
      c.status==='sold'?profitTax(c).toFixed(2):c.status==='traded'?tradeGainTax(c).toFixed(2):'',...(files?[files.get(c.id)||'']:[])]))};
const tradesCsv=(tl,cl)=>toCsv(['trade_id','trade_date','counterparty','cash_paid','cash_received','cards_out','value_out','cards_in','value_in','carryover_basis_in','market_value_basis_in','carryover_gain','notes'],
  tl.map(t=>{const o=cl.filter(c=>String(c.disposed_trade_id)===String(t.id)),i=cl.filter(c=>String(c.acquired_trade_id)===String(t.id)),s=(l,f)=>l.reduce((a,c)=>a+N(f(c)),0).toFixed(2),
    names=l=>l.map(c=>[c.grader,c.grade,c.name,'#'+c.cert].filter(Boolean).join(' ')).join('; ');
    return[t.id,t.trade_date,t.counterparty,t.cash_paid,t.cash_received,names(o),s(o,c=>c.trade_value_out),names(i),s(i,c=>c.trade_value_in),s(i,myBasis),s(i,taxBasis),t.carryover_gain,t.notes]}));
const EXP_COLS=['expense_date','expense_time','vendor','category','amount','tax','payment_method','notes'];
const expCsv=(list,files)=>toCsv([...EXP_COLS,...(files?['photo_file']:[])],list.map(e=>[...EXP_COLS.map(k=>k==='expense_time'&&e[k]?String(e[k]).slice(0,5):e[k]),...(files?[files.get(e.id)||'']:[])]));
let jszipP=null;
const loadJSZip=()=>jszipP||=new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  s.onload=()=>ok(window.JSZip);s.onerror=()=>{jszipP=null;s.remove();fail(new Error('Could not load JSZip'))};document.head.appendChild(s)});
const slug=s=>String(s??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9.]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
let backingUp=false;
async function backup(){if(backingUp)return;backingUp=true;const say=t=>toast(t,0);
  try{say('Loading zip library…');const JSZip=await loadJSZip();say('Reading cards and expenses…');
    const[c,x,t]=await Promise.all([sb.from('cards').select('*').order('bought_on'),sb.from('expenses').select('*'),sb.from('trades').select('*').order('trade_date')]);
    if(c.error||x.error||t.error)throw c.error||x.error||t.error;
    const allCards=c.data||[],allExp=(x.data||[]).sort(xsort).reverse(),allTrades=t.data||[],zip=new JSZip(),used=new Set(),files=new Map(),missing=[];
    const fname=(dir,parts,path)=>{const ext=(path.match(/\.[A-Za-z0-9]+$/)||['.jpg'])[0].toLowerCase(),base=dir+'/'+(parts.map(slug).filter(Boolean).join('_')||'photo');let n=base+ext,i=2;while(used.has(n))n=base+'-'+i+++ext;used.add(n);return n};
    const jobs=[...allCards.filter(r=>r.photo).map(r=>({bucket:'slabs',row:r,file:fname('slab-photos',[r.bought_on,r.grader+' '+r.grade,r.name,r.cert],r.photo)})),
      ...allExp.filter(r=>r.photo).map(r=>({bucket:'receipts',row:r,file:fname('receipt-photos',[r.expense_date,r.vendor,num(r.amount)],r.photo)}))];
    const total=jobs.length;let done=0;say(`Downloading photos 0 / ${total}…`);
    const worker=async()=>{for(let j;(j=jobs.shift());){const{data,error}=await sb.storage.from(j.bucket).download(j.row.photo);
      if(error||!data)missing.push(`${j.bucket}/${j.row.photo}: ${error?.message||'no data'}`);else{zip.file(j.file,data,{binary:true,compression:'STORE'});files.set(j.row.id,j.file)}
      say(`Downloading photos ${++done} / ${total}…`)}};
    await Promise.all(Array.from({length:Math.min(4,total)},worker));
    zip.file('cards.csv',cardsCsv(allCards,files,allTrades));zip.file('expenses.csv',expCsv(allExp,files));zip.file('trades.csv',tradesCsv(allTrades,allCards));
    if(missing.length)zip.file('missing-photos.txt',missing.join('\n'));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'},m=>say(`Building zip ${Math.round(m.percent)}%…`));
    dl(blob,'card-ledger-backup-'+today()+'.zip');
    toast(`Backup saved: ${pl(allCards.length,'card')}, ${pl(allTrades.length,'trade')}, ${pl(allExp.length,'expense')}, ${total-missing.length} of ${total} photos${missing.length?' (missing ones listed in the zip)':''}.`,6000)}
  catch(e){toast('Backup failed: '+(e.message||e),6000)}
  finally{backingUp=false}}
