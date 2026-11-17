(function(){
'use strict';

/* ---------- 執行時資料（相對路徑 + 防快取） ---------- */
let DATES=[], FULL=[], CLOSE=[], LOSS=[], AMT=[], N=0, LAST=0, BREAKEVEN=0, BUY=0;
let CHG=[], maxSoFar=[], EVENTS={}, CASH_DIV=0, SHARES0=0;
let DATA_OK=false;

const STORY_BY_DATE={
  '2026-06-25': function(ctx){
    return '<b>06-25 登船</b>：均價 '+ctx.buy.toFixed(2)+'，'+ctx.shares0.toLocaleString('en-US')+' 股。天氣晴，船長說這趟是十年的航程。';
  },
  '2026-06-30': function(){ return '<b>06-30 第一根跌停</b>：船身一震，船長說這只是浪花。'; },
  '2026-07-02': function(){ return '<b>07-02 首航遇颱風</b>：三天三根跌停，登船第 6 天就到午夜層。'; },
  '2026-07-03': function(){ return '<b>07-03 漲停</b>：船長在甲板上歡呼。歡呼了一天。'; },
  '2026-07-20': function(ctx){
    const cash=Math.round(ctx.divCash).toLocaleString('en-US');
    const before=ctx.shares0.toLocaleString('en-US');
    const after=ctx.sharesAfterDiv.toLocaleString('en-US');
    return '<b>07-20 除權息</b>：空投救生圈，配股 '+before+' → '+after+' 股，現金 '+cash+' 元。';
  },
  '2026-07-29': function(){ return '<b>07-29 首次闖入深淵層</b>：主電力中斷，船長改用手機手電筒照 K 線。'; },
  '2026-08-10': function(){ return '<b>08-10 漲停</b>：浮回 1,698 公尺，船長開始寫回憶錄。'; },
  '2026-09-10': function(){ return '<b>09-10 兩連漲停</b>：船長開始討論解套後要吃什麼。'; },
  '2026-09-11': function(){ return '<b>09-11 最接近海面的一天</b>：1,142 公尺。香檳開了，後來也沉了。'; },
  '2026-11-16': function(){ return '<b>11-16 跌停，正式腰斬</b>：恭喜加入腰斬俱樂部，會員卡已寄出（防水款）。'; }
};

const MILESTONES={10:['觸礁通報','船底輕微擦撞，船長請大家保持冷靜。'],20:['進水通報','一號艙進水，抽水機運轉中（抽不完）。'],30:['傾斜通報','船身傾斜，船長的咖啡開始自己滑走。'],40:['斷電通報','主電力中斷，窗戶的燈開始閃。'],50:['腰斬通報','恭喜加入腰斬俱樂部。'],60:['海溝通報','抵達人類潛水器極限深度。']};

function md(iso){
  const m=String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m? (m[2]+'-'+m[3]) : iso;
}
function bust(url){ return url + (url.indexOf('?')>=0?'&':'?') + 't=' + Date.now(); }
async function jget(url){
  const r=await fetch(bust(url), {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
  return r.json();
}

function computeDiv(config, actions){
  let shares=Number(config.shares)||0;
  let cash=0;
  const sorted=(actions||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let sharesAfter=shares;
  for(const a of sorted){
    const cd=Number(a.cash_dividend)||0;
    if(cd) cash += cd * shares;
    const sr=Number(a.stock_dividend_ratio)||0;
    if(sr) shares = shares * (1+sr);
    sharesAfter=shares;
  }
  return {cash: cash, shares0: Number(config.shares)||0, sharesAfterDiv: Math.round(sharesAfter)};
}

function buildSeries(entries, buy){
  const FULL=[], DATES=[], CLOSE=[], LOSS=[], AMT=[];
  for(const e of entries){
    FULL.push(e.date);
    DATES.push(md(e.date));
    CLOSE.push(Number(e.close_price));
    LOSS.push(Number(e.loss_pct));
    AMT.push(Number(e.loss_amount));
  }
  const CHG=LOSS.map((l,i)=>i===0?((CLOSE[0]/buy)-1)*100:((1-l/100)/(1-LOSS[i-1]/100)-1)*100);
  const maxSoFar=[]; LOSS.reduce((m,l,i)=>(maxSoFar[i]=Math.max(m,l), maxSoFar[i]),0);
  return {FULL,DATES,CLOSE,LOSS,AMT,CHG,maxSoFar};
}

function buildEvents(FULL, DATES, CLOSE, LOSS, CHG, maxSoFar, storyCtx){
  const out={};
  const N=LOSS.length;
  for(let i=0;i<N;i++){
    const iso=FULL[i];
    const storyFn=STORY_BY_DATE[iso];
    if(storyFn){ out[i]=storyFn(storyCtx); continue; }
    const c=CHG[i], l=LOSS[i];
    const parts=[];
    // 里程碑跨越
    if(i>0){
      for(const th of [10,20,30,40,50,60]){
        if(LOSS[i-1]<th && LOSS[i]>=th){
          parts.push('<b>'+DATES[i]+' '+MILESTONES[th][0]+'</b>：'+MILESTONES[th][1]);
        }
      }
    }
    if(c<=-9.4) parts.push('<b>'+DATES[i]+' 跌停</b>：海況颱風，船身劇震。');
    else if(c>=9.4) parts.push('<b>'+DATES[i]+' 漲停</b>：上升氣流，船長開始寫回憶錄。');
    if(i>0 && LOSS[i]>=maxSoFar[i] && LOSS[i]>LOSS[i-1]){
      parts.push('<b>'+DATES[i]+' 創新深紀錄</b>：深度 '+Math.round(l*100).toLocaleString('en-US')+' m。');
    }
    if(parts.length) out[i]=parts.join(' ');
  }
  return out;
}

function applyMeta(){
  const last=DATES[LAST]||'—';
  const tick=(window.CONFIG&&CONFIG.ticker)?String(CONFIG.ticker).replace(/\.TWO$/,'') : '5386';
  if($('eyebrow')) $('eyebrow').textContent=tick+' · 資料至 '+last+' 收盤';
  if($('endStart')) $('endStart').textContent=(DATES[0]||'—')+' 登船';
  if($('endLast')) $('endLast').textContent=last;
  if($('rDivCash')) $('rDivCash').textContent='股利救生圈 '+Math.round(CASH_DIV).toLocaleString('en-US')+' 元';
  const sl=$('day');
  if(sl){ sl.max=String(LAST); sl.value=String(LAST); }
  // witness badge mark = N
  const w=BADGES.find(b=>b.id==='witness'); if(w) w.mark=String(N);
}

async function loadAll(){
  const [price, config, corp] = await Promise.all([
    jget('data/price-history.json'),
    jget('config.json'),
    jget('data/corporate_actions.json'),
  ]);
  window.CONFIG=config;
  const entries=price.entries||[];
  if(!entries.length) throw new Error('empty entries');
  BUY=Number(config.buy_price);
  const div=computeDiv(config, (corp&&corp.actions)||[]);
  CASH_DIV=div.cash; SHARES0=div.shares0;
  const last=entries[entries.length-1];
  BREAKEVEN = (last.restored_buy_price!=null && last.restored_buy_price!=='')
    ? Number(last.restored_buy_price) : BUY;
  const s=buildSeries(entries, BUY);
  FULL=s.FULL; DATES=s.DATES; CLOSE=s.CLOSE; LOSS=s.LOSS; AMT=s.AMT; CHG=s.CHG; maxSoFar=s.maxSoFar;
  N=LOSS.length; LAST=N-1;
  EVENTS=buildEvents(FULL,DATES,CLOSE,LOSS,CHG,maxSoFar,{
    buy:BUY, shares0:div.shares0, sharesAfterDiv:div.sharesAfterDiv, divCash:div.cash
  });
  DATA_OK=true;
}


const MOODS={
  smug:  {label:'得意中',cls:'good',shake:'',  lines:['看吧！我就說！','浮起來了！快截圖！','今天先不要跟我講話，讓我享受一下。','我早就說是洗盤，你們都不信。']},
  relief:{label:'鬆一口氣',cls:'good',shake:'',lines:['呼…終於紅一天。','我就說基本面沒問題吧…吧？','先不要跟我老婆說今天漲了，怕她叫我賣。']},
  calm:  {label:'淡定',cls:'calm',shake:'',     lines:['這只是正常波動啦。','我研究很久了，相信我。','十年後你們就知道。','你們不懂，這是長期投資。']},
  nervous:{label:'有點緊張',cls:'',shake:'shake1',lines:['沒事沒事，主力在洗盤…對吧？','我只是剛好打開 App，不是一直在看。','等月營收出來就好了。','你們不要一直問我啦。','我手心有點濕，是天氣太熱。']},
  scared:{label:'害怕',cls:'',shake:'shake1',   lines:['不要再跌了不要再跌了不要再跌了。','我手在抖，是冷氣太冷。','我把 App 刪了…又裝回來了。','停損？什麼停損？','今天收盤我不敢看，你們幫我看。']},
  panic: {label:'崩潰中',cls:'',shake:'shake2', lines:['老婆千萬不要打開那個 App。','我現在看到綠色就想吐。','不賣就不算賠…不賣就不算賠…','誰來救救我，我還在船上！','腰斬了…但再腰斬一次就回來了吧？','我昨天夢到它漲停，醒來發現是跌停。']}
};
const BUOY_LINES=['救生圈！謝謝！…等等，它也在沉。','你們是來救我還是來看戲的？','再丟多一點，我還撐得住…吧？','這個尺寸是給倉鼠用的吧！','我要的是漲停，不是救生圈！','好，我先套著，等解套那天還你們。'];
const POKE_LINES=['不要戳我，我在看盤。','你戳我，我的心跳又變快了。','你再戳我就要賣了喔！…騙你的，我不敢。','我現在很脆弱，請輕一點。'];

/* ---------- 小工具 ---------- */
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const store={get(k,d){try{const v=localStorage.getItem('sk2:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('sk2:'+k,JSON.stringify(v))}catch(e){}}};
const pick=a=>a[Math.floor(Math.random()*a.length)];
function zoneOf(m){if(m<200)return['表層','#bfe4f7'];if(m<1000)return['暮光層','#a9d4ee'];if(m<4000)return['午夜層','#9cc0db'];if(m<6000)return['深淵層','#ffb547'];return['海溝層','#c9a2ff']}
function seaOf(c){if(c>=9.4)return'漲停 · 上升氣流';if(c>=3)return'上升氣流';if(c>0)return'微浪回升';if(c===0)return'風平浪靜';if(c>-1)return'平靜';if(c>-3)return'中浪';if(c>-6)return'大浪';if(c>-9.4)return'狂浪';return'颱風（跌停）'}
function limitUps(price){let p=price,n=0;while(p<BREAKEVEN&&n<60){p*=1.1;n++}return n}
function moodOf(i){const c=CHG[i],l=LOSS[i];if(c<=-9.4)return'panic';if(c>=3)return'smug';if(c>0.5)return'relief';if(l<10)return'calm';if(l<30)return'nervous';if(l<50)return'scared';return'panic'}
function bpmOf(i){return Math.round(72+LOSS[i]*1.1+Math.max(0,-CHG[i])*4-Math.max(0,CHG[i])*2)}
let capName=store.get('capName','')||'';
const capLabel=()=>(capName||'船長');

/* ---------- 船長頭像（依情緒換表情） ---------- */
function faceSVG(m){
  const skin={smug:'#f3c9a2',relief:'#f2c9a5',calm:'#f2c9a5',nervous:'#efc6a6',scared:'#e9d6c8',panic:'#d9dcbc'}[m];
  let eyes='',brows='',mouth='',extra='';
  if(m==='smug'){eyes='<path d="M25 41q4-4 8 0M39 41q4-4 8 0" stroke="#1b1b1b" stroke-width="2.4" fill="none" stroke-linecap="round"/>';brows='<path d="M24 34l9-2M39 32l9 2" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>';mouth='<path d="M27 50q9 9 18 0" stroke="#1b1b1b" stroke-width="2.4" fill="#fff"/>';extra='<circle cx="24" cy="47" r="3" fill="#ff8f8a" opacity=".5"/><circle cx="48" cy="47" r="3" fill="#ff8f8a" opacity=".5"/>'}
  else if(m==='relief'){eyes='<path d="M25 42q4-3 8 0M39 42q4-3 8 0" stroke="#1b1b1b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';brows='<path d="M25 35l8 1M39 36l8-1" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>';mouth='<path d="M29 50q7 6 14 0" stroke="#1b1b1b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';extra='<path d="M51 30q3 5 0 8q-3-3 0-8z" fill="#9fd3f5"/>'}
  else if(m==='calm'){eyes='<circle cx="29" cy="42" r="2.4" fill="#1b1b1b"/><circle cx="43" cy="42" r="2.4" fill="#1b1b1b"/>';brows='<path d="M25 36l8 0M39 36l8 0" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>';mouth='<path d="M30 51q6 4 12 0" stroke="#1b1b1b" stroke-width="2.2" fill="none" stroke-linecap="round"/>'}
  else if(m==='nervous'){eyes='<circle cx="29" cy="42" r="2.6" fill="#1b1b1b"/><circle cx="43" cy="42" r="2.6" fill="#1b1b1b"/>';brows='<path d="M25 37l8-3M39 34l8 3" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>';mouth='<path d="M28 52q2-3 4 0t4 0t4 0t4 0" stroke="#1b1b1b" stroke-width="2" fill="none" stroke-linecap="round"/>';extra='<path d="M51 29q4 6 0 10q-4-4 0-10z" fill="#9fd3f5"/>'}
  else if(m==='scared'){eyes='<circle cx="29" cy="42" r="5" fill="#fff" stroke="#1b1b1b" stroke-width="1.4"/><circle cx="43" cy="42" r="5" fill="#fff" stroke="#1b1b1b" stroke-width="1.4"/><circle cx="29" cy="43" r="1.6" fill="#1b1b1b"/><circle cx="43" cy="43" r="1.6" fill="#1b1b1b"/>';brows='<path d="M24 35l9-4M39 31l9 4" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>';mouth='<ellipse cx="36" cy="53" rx="3.5" ry="4" fill="#3a1414"/>';extra='<path d="M51 28q4 6 0 10q-4-4 0-10z" fill="#9fd3f5"/><path d="M20 31q3 5 0 8q-3-3 0-8z" fill="#9fd3f5"/>'}
  else{eyes='<circle cx="29" cy="41" r="5.2" fill="#fff" stroke="#1b1b1b" stroke-width="1.4"/><circle cx="43" cy="41" r="5.2" fill="#fff" stroke="#1b1b1b" stroke-width="1.4"/><circle cx="29" cy="42" r="1.3" fill="#1b1b1b"/><circle cx="43" cy="42" r="1.3" fill="#1b1b1b"/><path d="M27 46q-1 8-3 14M45 46q1 8 3 14" stroke="#7cc4ec" stroke-width="2.6" fill="none" stroke-linecap="round"/>';brows='<path d="M24 34l9-5M39 29l9 5" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>';mouth='<path d="M29 56q7-9 14 0q-7 3-14 0z" fill="#3a1414" stroke="#1b1b1b" stroke-width="1.6"/>';extra='<path d="M52 27q4 6 0 10q-4-4 0-10z" fill="#9fd3f5"/><path d="M18 34q4 6 0 10q-4-4 0-10z" fill="#9fd3f5"/>'}
  return '<svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">'+
    '<ellipse cx="36" cy="44" rx="20" ry="21" fill="'+skin+'"/>'+
    '<path d="M14 28q22-14 44 0l-2 6q-20-6-40 0z" fill="#1d2a3a"/><path d="M18 22q18-12 36 0v6q-18-6-36 0z" fill="#f2f5f7"/><circle cx="36" cy="22" r="3" fill="#ffb547"/>'+
    brows+eyes+mouth+extra+'</svg>';
}
let curMood='panic';
/* ---------- 船長大頭照（只存在本機瀏覽器，不上傳） ---------- */
let capPhoto=store.get('capPhoto','')||'';
if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(capPhoto))capPhoto='';
const MOOD_EMOJI={smug:'😎',relief:'😌',calm:'🙂',nervous:'😅',scared:'😨',panic:'😭'};
function paintFace(m){
  const box=$('face');box.innerHTML='';
  if(capPhoto){const img=document.createElement('img');img.className='photo m-'+m;img.alt='';img.src=capPhoto;const e=document.createElement('span');e.className='memo';e.textContent=MOOD_EMOJI[m]||'';box.appendChild(img);box.appendChild(e)}
  else box.innerHTML=faceSVG(m);
  const u=$('unphoto');if(u)u.hidden=!capPhoto;
}
function squarePhoto(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{const w=img.naturalWidth,h=img.naturalHeight,s=Math.min(w,h);const c=document.createElement('canvas');c.width=c.height=160;c.getContext('2d').drawImage(img,(w-s)/2,(h-s)/2,s,s,0,0,160,160);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',0.85))};
  img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('image'))};img.src=url})}
function setMood(m,line){curMood=m;const M=MOODS[m];paintFace(m);$('face').className=reduce?'':M.shake;$('mood').textContent=M.label;$('mood').className='mood '+M.cls;if(line!==false)say(line||pick(M.lines))}
function say(t){$('dline').textContent=t;talkFx=1}
function setBpm(b){$('bpm').textContent=b;$('ecg').style.animationDuration=(60/b).toFixed(2)+'s'}

/* ---------- 單格通報 ---------- */
let noticeTimer=0;
function notice(html,kind){const box=$('ticker');box.innerHTML='';const n=document.createElement('div');n.className='notice'+(kind?' '+kind:'');n.innerHTML=html;box.appendChild(n);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.add('out'),3200)}
function clearNotice(){clearTimeout(noticeTimer);$('ticker').innerHTML=''}

/* ---------- 徽章 ---------- */
const BADGES=[
  {id:'half',mark:'50',t:'腰斬俱樂部',d:'虧損達 50%'},
  {id:'typhoon',mark:'6',t:'颱風倖存者',d:'撐過 6 根跌停'},
  {id:'abyss',mark:'40',t:'深淵潛水員',d:'虧損達 40%'},
  {id:'buoy',mark:'10',t:'救生圈投手',d:'丟 10 個救生圈'},
  {id:'fan',mark:'12',t:'心理輔導員',d:'聽船長講 12 次話'},
  {id:'witness',mark:'95',t:'全程目擊者',d:'從登船重播到今天'},
  {id:'mate',mark:'3',t:'老船員',d:'歷史挑戰連中 3 題'},
  {id:'oracle',mark:'6',t:'神準大副',d:'歷史挑戰連中 6 題'},
  {id:'press',mark:'報',t:'深海記者',d:'印一份深海日報'}
];
let owned=new Set(store.get('badges',[]));['half','typhoon','abyss'].forEach(b=>owned.add(b));
function renderBadges(fresh){const box=$('badges');box.innerHTML='';BADGES.forEach(b=>{const on=owned.has(b.id);const el=document.createElement('div');el.className='bd'+(on?' on':'')+(fresh===b.id?' fresh':'');el.innerHTML='<span class="disc">'+b.mark+'</span><p class="t">'+b.t+'</p><p class="d">'+(on?b.d:'未解鎖 · '+b.d)+'</p>';box.appendChild(el)});$('bCount').textContent=owned.size+' / '+BADGES.length}
function unlock(id){if(owned.has(id))return;owned.add(id);store.set('badges',[...owned]);const b=BADGES.find(x=>x.id===id);const sec=$('badges').closest('section');if(!(sec&&sec.hidden))notice('解鎖徽章 <b>'+b.t+'</b>：'+b.d,'badge');renderBadges(id)}
renderBadges();

/* ---------- 讀數與重播 ---------- */
let shown=0, shipDepth=0, targetDepth=0;
let playing=false, playTimer=null, replayFromStart=false;
function renderDay(i,announce){
  const d=LOSS[i]*100, z=zoneOf(d), c=CHG[i];
  $('zname').textContent=z[0];$('zname').style.color=z[1];
  $('zdepth').textContent=fmt(d)+' m · '+fmt(d/10+1)+' atm';
  $('seaChip').textContent=seaOf(Math.round(c*100)/100);
  $('dateChip').textContent=DATES[i]+' · '+CLOSE[i];
  $('rAmt').innerHTML='−'+fmt(AMT[i])+'<small> 元</small>';
  $('rDepth').textContent=fmt(d)+' m';
  $('rPct').textContent='−'+LOSS[i].toFixed(2)+'%';
  $('rClose').textContent=CLOSE[i];
  const dm=i?Math.round((LOSS[i]-LOSS[i-1])*100):Math.round(d);
  $('rChg').innerHTML='<span class="'+(c>=0?'up':'down')+'">'+(c>=0?'+':'−')+Math.abs(c).toFixed(2)+'%</span> · '+(dm>=0?'再沉 '+fmt(dm):'浮起 '+fmt(-dm))+' m';
  const need=(BREAKEVEN/CLOSE[i]-1)*100;
  $('rNeed').textContent=need>0?'+'+need.toFixed(1)+'%':'已解套';
  $('rLimit').textContent=need>0?'連拉 '+limitUps(CLOSE[i])+' 根漲停':'重見天日';
  $('rLeft').textContent=(100-LOSS[i]).toFixed(2)+'%';
  $('dayMeta').textContent=(i+1)+' / '+N+' 天';
  $('eventLine').innerHTML=EVENTS[i]||('<b>'+DATES[i]+'</b> 收 '+CLOSE[i]+'，海況'+seaOf(Math.round(c*100)/100)+'。'+(i>0&&LOSS[i]>=maxSoFar[i]&&LOSS[i]>LOSS[i-1]?'又是新深紀錄。':''));
  $('sea').setAttribute('aria-label','青雲號在 '+DATES[i]+' 位於 '+z[0]+'，深度 '+fmt(d)+' 公尺，船長'+MOODS[moodOf(i)].label);
  targetDepth=d;setBpm(bpmOf(i));
  const m=moodOf(i);
  if(announce){
    let said=false;
    if(i>0)for(const th of [10,20,30,40,50,60]){if(LOSS[i-1]<th&&LOSS[i]>=th){notice('<b>'+MILESTONES[th][0]+'</b>：'+MILESTONES[th][1]);said=true}}
    if(!said&&EVENTS[i]&&i!==LAST)notice(EVENTS[i]);
    else if(!said&&i>0&&zoneOf(LOSS[i-1]*100)[0]!==z[0]&&LOSS[i]<LOSS[i-1])notice('<b>浮力通報</b>：回到'+z[0]+'！船長說上次也是這樣開始的。');
    if(m!==curMood||i%3===0)setMood(m);
  }else if(m!==curMood)setMood(m);
}
let slider=null;
function paintTicks(){
  const box=$('ticks'); if(!box) return; box.innerHTML='';
  if(!LAST) return;
  Object.keys(EVENTS).forEach(k=>{const s=document.createElement('span');s.style.left=(Number(k)/LAST*100)+'%';box.appendChild(s)});
}
function setDay(i,announce){i=Math.max(0,Math.min(LAST,i));const prev=shown;shown=i;if(slider)slider.value=i;renderDay(i,announce&&i!==prev)}
function setPlayIcon(p){$('playIcon').innerHTML=p?'<rect x="4" y="3" width="4" height="14" fill="currentColor"/><rect x="12" y="3" width="4" height="14" fill="currentColor"/>':'<path d="M5 3l12 7-12 7z" fill="currentColor"/>';$('play').setAttribute('aria-label',p?'暫停重播':'從登船那天開始重播')}
function stopPlay(){playing=false;clearInterval(playTimer);setPlayIcon(false)}
function wireReplay(){
  slider=$('day');
  paintTicks();
  slider.addEventListener('input',()=>{stopPlay();setDay(+slider.value,true)});
  $('play').addEventListener('click',()=>{
    if(playing){stopPlay();return}
    if(shown>=LAST){setDay(0,false);replayFromStart=true;notice(EVENTS[0]||'');setMood('calm','我研究很久了，這次一定賺。')}else{replayFromStart=shown===0}
    playing=true;setPlayIcon(true);
    playTimer=setInterval(()=>{if(shown>=LAST){stopPlay();clearNotice();if(replayFromStart)unlock('witness');return}setDay(shown+1,true)},reduce?700:560);
  });
}

/* ---------- 跟船長互動 ---------- */
let talks=store.get('talks',0);
function talk(lines){talks++;store.set('talks',talks);say(pick(lines));wobble=1;if(talks>=12)unlock('fan')}
$('dline').addEventListener('click',()=>talk(MOODS[curMood].lines));
$('poke').addEventListener('click',()=>{talk(POKE_LINES);setBpm(bpmOf(shown)+12);setTimeout(()=>setBpm(bpmOf(shown)),2500)});
const nameInput=$('capName');nameInput.value=capName;
nameInput.addEventListener('input',()=>{capName=nameInput.value.trim().slice(0,8);store.set('capName',capName)});
nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')nameInput.blur()});
const photoIn=$('photoIn');
$('portrait').addEventListener('click',()=>photoIn.click());
photoIn.addEventListener('change',()=>{const f=photoIn.files&&photoIn.files[0];photoIn.value='';if(!f)return;
  squarePhoto(f).then(u=>{capPhoto=u;store.set('capPhoto',u);paintFace(curMood);say('這張照片…你們從哪裡拿到的？')}).catch(()=>notice('<b>照片讀不到</b>：換一張試試看。'))});
$('unphoto').addEventListener('click',()=>{capPhoto='';store.set('capPhoto','');paintFace(curMood)});

/* ---------- 救生圈 ---------- */
let buoyCount=store.get('buoys',0);
function paintBuoy(){$('buoyCount').textContent=buoyCount;$('buoyReset').hidden=buoyCount===0}
paintBuoy();
const buoys=[],ripples=[];
function throwBuoy(){buoyCount++;store.set('buoys',buoyCount);paintBuoy();buoys.push({t:0,sx:0.15+Math.random()*0.7,ox:(Math.random()-.5)*60,rot:Math.random()*6,state:'fly'});setTimeout(()=>say(pick(BUOY_LINES)),850);if(buoyCount>=10)unlock('buoy')}
$('buoy').addEventListener('click',throwBuoy);
$('buoyReset').addEventListener('click',()=>{buoyCount=0;store.set('buoys',0);paintBuoy();say('救生圈都收回去了？…好，我自己游。')});

/* ---------- 深海畫布 ---------- */
const cv=$('sea'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,camDepth=shipDepth,lastCam=0,wobble=0,talkFx=0,t0=performance.now(),raf=0,shipHit=null;
const VIEW=1500, SHIP_Y=0.4;
function resize(){const r=cv.getBoundingClientRect();DPR=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener('resize',resize);
const STOPS=[[-500,[196,230,248]],[0,[124,196,236]],[1,[47,134,184]],[200,[29,95,138]],[1000,[15,58,92]],[2500,[10,39,65]],[4000,[6,24,42]],[6000,[3,10,19]],[8000,[1,5,10]]];
function colAt(d){for(let i=1;i<STOPS.length;i++){if(d<=STOPS[i][0]){const a=STOPS[i-1],b=STOPS[i],k=(d-a[0])/(b[0]-a[0]);return'rgb('+a[1].map((v,j)=>Math.round(v+(b[1][j]-v)*k)).join(',')+')'}}return'rgb(1,5,10)'}
const snow=Array.from({length:reduce?24:70},()=>({x:Math.random(),y:Math.random(),z:.3+Math.random()*.7,r:.6+Math.random()*1.4}));
const bubbles=[],sweat=[];
const CREATURES=[{k:'fish',d:140,x:.3},{k:'fish',d:420,x:.75},{k:'jelly',d:760,x:.32},{k:'jelly',d:2300,x:.8},{k:'squid',d:3300,x:.25},{k:'chest',d:4650,x:.8},{k:'angler',d:5250,x:.22},{k:'angler',d:5950,x:.82},{k:'worm',d:6500,x:.6}];
function Y(d,camTop,ppm){return(d-camTop)*ppm}
const FEAR={smug:0,relief:0,calm:0,nervous:.35,scared:.7,panic:1};

function drawCaptain(now,fear){
  // 站在駕駛艙上的小人（你朋友），越怕抖越兇
  const j=fear*(reduce?0:1);const sx=(Math.random()-.5)*3*j,sy=(Math.random()-.5)*2*j;
  ctx.save();ctx.translate(-20+sx,-62+sy);
  ctx.strokeStyle='#dbe6f0';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,14);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(-5,24);ctx.moveTo(0,14);ctx.lineTo(5,24);ctx.stroke();
  if(fear>=.7){const a=Math.sin(now/90)*4;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(-9,-6+a);ctx.moveTo(0,4);ctx.lineTo(9,-6-a);ctx.stroke()} // 舉手求救
  else if(fear>0){ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(-7,10);ctx.moveTo(0,4);ctx.lineTo(6,-2);ctx.stroke();ctx.fillStyle='#7cc4ec';ctx.fillRect(4,-6,4,7)} // 拿手機看盤
  else{ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(-7,12);ctx.moveTo(0,4);ctx.lineTo(7,12);ctx.stroke()}
  ctx.fillStyle='#f2c9a5';ctx.beginPath();ctx.arc(0,-6,6,0,7);ctx.fill();
  ctx.fillStyle='#f2f5f7';ctx.fillRect(-7,-14,14,4);ctx.fillStyle='#1d2a3a';ctx.fillRect(-8,-11,16,2);
  ctx.restore();
}
function drawShip(x,y,s,ang,now,loss,fear){
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.scale(s,s);
  if(loss>=10){const g=ctx.createRadialGradient(70,10,4,120,60,170);g.addColorStop(0,'rgba(255,214,130,.30)');g.addColorStop(1,'rgba(255,214,130,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(60,0);ctx.lineTo(210,70);ctx.lineTo(140,150);ctx.closePath();ctx.fill()}
  ctx.fillStyle='#2b3c4b';ctx.beginPath();ctx.moveTo(-110,-10);ctx.lineTo(110,8);ctx.lineTo(80,34);ctx.lineTo(-86,22);ctx.closePath();ctx.fill();
  ctx.fillStyle='#1b2833';ctx.beginPath();ctx.moveTo(-86,22);ctx.lineTo(80,34);ctx.lineTo(56,44);ctx.lineTo(-72,36);ctx.closePath();ctx.fill();
  ctx.fillStyle='#38506a';ctx.fillRect(-70,-34,78,26);
  ctx.fillStyle='#2f4459';ctx.fillRect(-56,-52,40,18);
  for(let i=0;i<4;i++){let on=1;if(loss>=40){on=(Math.sin(now/180+i*2.3)+Math.sin(now/47+i))>-.6?1:0.15}ctx.fillStyle='rgba(255,181,71,'+on+')';ctx.beginPath();ctx.arc(-58+i*18,-21,4,0,7);ctx.fill()}
  ctx.fillStyle='#ffb547';ctx.fillRect(30,6,44,14);ctx.fillStyle='#1a1200';ctx.font='700 11px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('5386',52,17);
  ctx.strokeStyle='#9fb6c8';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-36,-52);ctx.lineTo(-36,-92);ctx.stroke();
  const fl=Math.sin(now/260)*4;ctx.fillStyle='#3ddc8f';ctx.beginPath();ctx.moveTo(-36,-92);ctx.quadraticCurveTo(-14,-86+fl,6,-82);ctx.lineTo(-36,-70);ctx.closePath();ctx.fill();
  drawCaptain(now,fear);
  ctx.restore();
}
function drawFish(x,y,now){ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(190,225,245,.55)';for(let i=0;i<7;i++){const fx=(i%4)*16+Math.sin(now/400+i)*3,fy=Math.floor(i/4)*12+(i%2)*5;ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx-10,fy-4);ctx.lineTo(fx-10,fy+4);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(fx-10,fy);ctx.lineTo(fx-15,fy-3);ctx.lineTo(fx-15,fy+3);ctx.fill()}ctx.restore()}
function drawJelly(x,y,now,glow){const p=Math.sin(now/700);ctx.save();ctx.translate(x,y+p*6);ctx.fillStyle=glow?'rgba(180,140,255,.35)':'rgba(170,215,255,.32)';ctx.strokeStyle=glow?'rgba(200,170,255,.6)':'rgba(200,235,255,.55)';ctx.beginPath();ctx.ellipse(0,0,18+p*2,12-p*2,0,Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.lineWidth=1.3;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*6,0);ctx.quadraticCurveTo(i*6+Math.sin(now/500+i)*6,18,i*6,34+p*4);ctx.stroke()}if(glow){const g=ctx.createRadialGradient(0,0,2,0,0,40);g.addColorStop(0,'rgba(190,150,255,.35)');g.addColorStop(1,'rgba(190,150,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,40,0,7);ctx.fill()}ctx.restore()}
function drawSquid(x,y,now){ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(40,70,95,.75)';ctx.beginPath();ctx.ellipse(0,0,46,14,-.2,0,7);ctx.fill();ctx.strokeStyle='rgba(40,70,95,.75)';ctx.lineWidth=3;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-40,(i-2.5)*3);ctx.bezierCurveTo(-70,(i-2.5)*8+Math.sin(now/600+i)*8,-95,(i-2.5)*12,-120,(i-2.5)*14+Math.sin(now/500+i)*10);ctx.stroke()}ctx.fillStyle='#ffb547';ctx.beginPath();ctx.arc(28,-3,3,0,7);ctx.fill();ctx.restore()}
function drawAngler(x,y,now){const s=Math.sin(now/900)*8;ctx.save();ctx.translate(x+s,y);ctx.fillStyle='#132636';ctx.strokeStyle='#2c4458';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-34,0);ctx.quadraticCurveTo(-8,-26,26,-6);ctx.lineTo(44,-16);ctx.lineTo(40,0);ctx.lineTo(44,16);ctx.lineTo(26,8);ctx.quadraticCurveTo(-8,26,-34,0);ctx.fill();ctx.stroke();ctx.fillStyle='#dbe6f0';ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(-20,-5);ctx.lineTo(-24,1);ctx.lineTo(-16,3);ctx.lineTo(-30,4);ctx.fill();ctx.fillStyle='#ffb547';ctx.beginPath();ctx.arc(-12,-8,3,0,7);ctx.fill();ctx.strokeStyle='#7f97ab';ctx.beginPath();ctx.moveTo(-10,-18);ctx.quadraticCurveTo(-20,-44,-40,-34);ctx.stroke();const pulse=.7+.3*Math.sin(now/300);const g=ctx.createRadialGradient(-40,-34,1,-40,-34,34*pulse);g.addColorStop(0,'rgba(255,225,150,.95)');g.addColorStop(.25,'rgba(255,181,71,.45)');g.addColorStop(1,'rgba(255,181,71,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(-40,-34,34*pulse,0,7);ctx.fill();ctx.restore()}
function drawChest(x,y){ctx.save();ctx.translate(x,y);ctx.rotate(.12);ctx.fillStyle='#4a3420';ctx.fillRect(-26,-14,52,28);ctx.fillStyle='#5e4229';ctx.fillRect(-26,-22,52,10);ctx.fillStyle='#ffb547';ctx.fillRect(-4,-14,8,8);ctx.fillStyle='rgba(232,241,248,.85)';ctx.font='500 11px "Noto Sans TC",sans-serif';ctx.textAlign='center';ctx.fillText('早知道買 0050',0,34);ctx.restore()}
function drawWorm(x,y,now){ctx.save();ctx.translate(x,y);for(let i=0;i<5;i++){const h=30+i*6;ctx.strokeStyle='rgba(220,230,240,.4)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(i*10,0);ctx.lineTo(i*10+Math.sin(now/700+i)*4,-h);ctx.stroke();ctx.fillStyle='rgba(255,107,107,.7)';ctx.beginPath();ctx.arc(i*10+Math.sin(now/700+i)*4,-h,4,0,7);ctx.fill()}ctx.restore()}

function frame(now){
  if(!W)resize();
  const t=(now-t0)/1000;
  shipDepth+=(targetDepth-shipDepth)*(reduce?1:0.08);
  const ppm=H/VIEW;
  camDepth+=(shipDepth-camDepth)*(reduce?1:0.07);
  const camTop=Math.max(-VIEW*.28,camDepth-VIEW*SHIP_Y);
  const camDelta=lastCam?(camTop-lastCam)*ppm:0;lastCam=camTop||0.0001;
  const g=ctx.createLinearGradient(0,0,0,H);for(let k=0;k<=6;k++){g.addColorStop(k/6,colAt(camTop+VIEW*k/6))}ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const sy=Y(0,camTop,ppm);
  if(sy>-40&&sy<H){ctx.fillStyle='rgba(124,196,236,.55)';ctx.beginPath();ctx.moveTo(0,sy);for(let x=0;x<=W;x+=8)ctx.lineTo(x,sy+Math.sin(x/28+t*1.6)*4);ctx.lineTo(W,sy-60);ctx.lineTo(0,sy-60);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,.8)';ctx.font='500 11px "Noto Sans TC",sans-serif';ctx.textAlign='right';ctx.fillText('海面＝解套線 '+BREAKEVEN+' 元',W-12,sy-10)}
  const rayA=Math.max(0,1-Math.max(0,camTop)/900)*.22;
  if(rayA>0.01){ctx.save();ctx.globalAlpha=rayA*(0.8+0.2*Math.sin(t*0.7));ctx.fillStyle='#d8efff';for(let i=0;i<4;i++){const x0=W*(0.2+i*0.2)+Math.sin(t*0.3+i)*10;ctx.beginPath();ctx.moveTo(x0,Math.max(0,sy));ctx.lineTo(x0+18,Math.max(0,sy));ctx.lineTo(x0+90,H);ctx.lineTo(x0+40,H);ctx.closePath();ctx.fill()}ctx.restore()}
  ctx.fillStyle='rgba(220,235,245,.5)';for(const p of snow){p.y+=(0.00025+p.z*0.0004)-camDelta*p.z/H;if(p.y>1.02)p.y-=1.04;if(p.y<-0.02)p.y+=1.04;ctx.globalAlpha=.25+p.z*.45;ctx.beginPath();ctx.arc(p.x*W+Math.sin(t*.5+p.y*9)*3,p.y*H,p.r,0,7);ctx.fill()}ctx.globalAlpha=1;
  for(const c of CREATURES){const cy=Y(c.d,camTop,ppm);if(cy<-120||cy>H+120)continue;const cx=c.x*W;
    if(c.k==='fish')drawFish(cx+((t*14)%(W+160))-W*.4,cy,now);else if(c.k==='jelly')drawJelly(cx,cy,now,c.d>1500);else if(c.k==='squid')drawSquid(cx,cy,now);else if(c.k==='angler')drawAngler(cx,cy,now);else if(c.k==='chest')drawChest(cx,cy);else drawWorm(cx,cy,now)}
  // 深度尺
  ctx.fillStyle='rgba(2,8,14,.35)';ctx.fillRect(0,0,46,H);ctx.strokeStyle='rgba(147,172,193,.35)';ctx.beginPath();ctx.moveTo(46,0);ctx.lineTo(46,H);ctx.stroke();
  ctx.textAlign='left';for(let d=Math.ceil(camTop/100)*100;d<=camTop+VIEW;d+=100){if(d<0)continue;const y=Y(d,camTop,ppm);const major=d%500===0;ctx.strokeStyle=major?'rgba(220,235,245,.6)':'rgba(220,235,245,.25)';ctx.beginPath();ctx.moveTo(major?32:39,y);ctx.lineTo(46,y);ctx.stroke();if(major){ctx.fillStyle='rgba(220,235,245,.8)';ctx.font='500 9.5px "JetBrains Mono",monospace';ctx.fillText(d>=1000?(d/1000).toFixed(1)+'k':String(d),4,y+3)}}
  for(const [d,name,col] of [[200,'暮光層','#bfe4f7'],[1000,'午夜層','#9cc0db'],[4000,'深淵層','#ffb547'],[6000,'海溝層','#c9a2ff']]){const y=Y(d,camTop,ppm);if(y<0||y>H)continue;ctx.strokeStyle='rgba(255,255,255,.12)';ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(46,y);ctx.lineTo(W,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col;ctx.font='700 11px "Noto Sans TC",sans-serif';ctx.fillText(name+' '+fmt(d)+' m',52,y-5)}
  // 船
  const s=Math.min(1,W/400)*0.9, loss=shipDepth/100, fear=FEAR[curMood];
  wobble*=0.95;talkFx*=0.9;
  const bx=W*0.58, by=Y(shipDepth,camTop,ppm)+Math.sin(t*1.2)*5;
  const ang=-(6+Math.min(22,loss*0.35))*Math.PI/180+Math.sin(t*0.9)*0.025+Math.sin(t*9)*wobble*0.12;
  if(Math.random()<(reduce?.05:.22))bubbles.push({x:bx+(Math.random()-.5)*120*s,y:by-20*s,r:1.5+Math.random()*4,v:0.6+Math.random()*0.9,ph:Math.random()*6,life:0});
  ctx.strokeStyle='rgba(205,232,250,.75)';ctx.lineWidth=1.3;for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.y-=b.v+camDelta;b.life++;const a=Math.max(0,1-b.life/170);if(a<=0||b.y<-10){bubbles.splice(i,1);continue}ctx.globalAlpha=a;ctx.beginPath();ctx.arc(b.x+Math.sin(b.life/12+b.ph)*3,b.y,b.r,0,7);ctx.stroke()}ctx.globalAlpha=1;
  drawShip(bx,by,s,ang,now,loss,fear);
  shipHit={x:bx,y:by,r:110*s};
  // 船長冒汗（越怕越多）
  if(!reduce&&fear>0&&Math.random()<fear*0.08){const cx=bx+(-20*Math.cos(ang)-(-70)*Math.sin(ang))*s,cy=by+(-20*Math.sin(ang)+(-70)*Math.cos(ang))*s;sweat.push({x:cx+(Math.random()-.5)*10,y:cy,vx:(Math.random()-.5)*1.4,vy:-1.6,life:0})}
  ctx.fillStyle='#9fd3f5';for(let i=sweat.length-1;i>=0;i--){const d=sweat[i];d.life++;d.vy+=0.12;d.x+=d.vx;d.y+=d.vy;if(d.life>40){sweat.splice(i,1);continue}ctx.globalAlpha=1-d.life/40;ctx.beginPath();ctx.ellipse(d.x,d.y,1.8,2.6,0,0,7);ctx.fill()}ctx.globalAlpha=1;
  // 救生圈
  for(let i=buoys.length-1;i>=0;i--){const b=buoys[i];b.t+=1/60;let x,y,a=1;const tx=bx+b.ox,ty=by-30*s;
    if(b.state==='fly'){const k=Math.min(1,b.t/0.9);const x0=b.sx*W,y0=-30;x=x0+(tx-x0)*k;y=y0+(ty-y0)*k-Math.sin(k*Math.PI)*90;if(k>=1){b.state='float';b.t=0;ripples.push({x:tx,y:ty,r:4,life:0})}}
    else if(b.state==='float'){x=tx+Math.sin(b.t*3)*4;y=ty+Math.sin(b.t*2.4)*3;if(b.t>1.4){b.state='sink';b.t=0}}
    else{x=tx+Math.sin(b.t*2)*8;y=ty+b.t*55;a=Math.max(0,1-b.t/2.2);if(a<=0){buoys.splice(i,1);continue}}
    b.rot+=b.state==='fly'?0.25:0.02;ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.rotate(b.rot);ctx.lineWidth=7;ctx.strokeStyle='#f2f5f7';ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.stroke();ctx.strokeStyle='#ff6b6b';ctx.setLineDash([9.4,9.4]);ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
  ctx.strokeStyle='rgba(220,240,255,.6)';ctx.lineWidth=1.5;for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.life++;r.r+=1.6;const a=1-r.life/40;if(a<=0){ripples.splice(i,1);continue}ctx.globalAlpha=a;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.4,0,0,7);ctx.stroke()}ctx.globalAlpha=1;
  const dark=Math.min(.55,Math.max(0,camDepth)/9000);if(dark>0.02){const v=ctx.createRadialGradient(bx,by,40,bx,by,Math.max(W,H)*.85);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,'+dark+')');ctx.fillStyle=v;ctx.fillRect(0,0,W,H)}
  raf=requestAnimationFrame(frame);
}
cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;if(shipHit&&Math.hypot(x-shipHit.x,y-shipHit.y)<shipHit.r)talk(POKE_LINES);else throwBuoy()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(!raf){raf=requestAnimationFrame(frame)}});

/* ---------- 歷史挑戰 ---------- */
let q=null, score=store.get('score',{hit:0,all:0,streak:0,best:0});
function renderScore(){$('sHit').textContent=score.hit;$('sAll').textContent=score.all;$('sStreak').textContent=score.streak;$('sBest').textContent=score.best}
function newQ(){let i;do{i=1+Math.floor(Math.random()*(LAST-1))}while(Math.abs(CHG[i+1])<0.005);q={i,done:false};
  const c=CHG[i];$('qDay').innerHTML='第 '+(i+1)+' 天 · '+DATES[i]+' · 收 '+CLOSE[i]+' · 深度 '+fmt(LOSS[i]*100)+' m · 當天 <span class="'+(c>=0?'up':'down')+'">'+(c>=0?'+':'−')+Math.abs(c).toFixed(2)+'%</span>';
  const a=Math.max(0,i-12),seg=LOSS.slice(a,i+1),mn=Math.min(...seg)-2,mx=Math.max(...seg)+2;const pts=seg.map((v,k)=>(k/(seg.length-1||1)*296+2).toFixed(1)+','+((v-mn)/(mx-mn)*40+3).toFixed(1)).join(' ');
  $('qSpark').innerHTML='<polyline points="'+pts+'" fill="none" stroke="#3ddc8f" stroke-width="2" stroke-linejoin="round"/><circle cx="298" cy="'+(((LOSS[i]-mn)/(mx-mn))*40+3).toFixed(1)+'" r="3.5" fill="#ffb547"/>';
  $('qResult').textContent='';$('pickUp').disabled=false;$('pickDown').disabled=false;$('qAsk').textContent='近 '+seg.length+' 天的下潛軌跡（往下＝更深）。隔天收盤，青雲號會？'}
function answer(up){if(!q||q.done)return;q.done=true;$('pickUp').disabled=true;$('pickDown').disabled=true;const n=q.i+1,c=CHG[n],rose=c>0,ok=rose===up;score.all++;if(ok){score.hit++;score.streak++;score.best=Math.max(score.best,score.streak)}else score.streak=0;store.set('score',score);renderScore();
  const dm=Math.round((LOSS[n]-LOSS[q.i])*100);
  $('qResult').innerHTML=(ok?'<b style="color:var(--lamp)">猜中！</b> ':'<b>猜錯。</b> ')+'隔天 '+DATES[n]+' 收 '+CLOSE[n]+'（<span class="'+(rose?'up':'down')+'">'+(rose?'+':'−')+Math.abs(c).toFixed(2)+'%</span>），'+(dm>=0?'再沉 '+fmt(dm):'浮起 '+fmt(-dm))+' 公尺。'+(ok?(up?'樂觀的人偶爾也會對。':'你很懂這艘船。'):(up?capLabel()+'也是這樣想的。':'難得浮一次，被你錯過了。'));
  if(score.streak>=3)unlock('mate');if(score.streak>=6)unlock('oracle')}
$('pickUp').addEventListener('click',()=>answer(true));$('pickDown').addEventListener('click',()=>answer(false));$('qNext').addEventListener('click',newQ);

/* ---------- 深海日報 ---------- */
function press(){const i=shown,c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
  x.fillStyle='#f1ebdd';x.fillRect(0,0,1080,1350);x.fillStyle='#161616';x.textAlign='center';
  x.font='500 22px "JetBrains Mono",monospace';x.fillText('第 '+(i+1)+' 期　·　'+(FULL[i]||('2026-'+DATES[i]))+'　·　每份 0 元',540,70);
  x.font='900 104px "Noto Serif TC",serif';x.fillText('深 海 日 報',540,190);
  x.font='500 22px "Noto Sans TC",sans-serif';x.fillText('THE ABYSS TIMES · 青雲號專刊',540,232);
  x.fillRect(60,256,960,4);x.fillRect(60,266,960,2);
  const dm=i?Math.round((LOSS[i]-LOSS[i-1])*100):Math.round(LOSS[0]*100);const rec=i>0&&LOSS[i]>=maxSoFar[i]&&dm>0;
  const head1=dm>=0?'青雲號再沉 '+fmt(dm)+' 公尺':'青雲號浮起 '+fmt(-dm)+' 公尺';const head2=dm>=0?(rec?'創 '+fmt(LOSS[i]*100)+' 公尺新深紀錄':'目前深度 '+fmt(LOSS[i]*100)+' 公尺'):capLabel()+'宣布：反攻開始';
  x.textAlign='left';x.font='900 70px "Noto Serif TC",serif';x.fillText(head1,60,370);x.fillText(head2,60,460);
  x.strokeStyle='#161616';x.lineWidth=5;x.strokeRect(60,510,470,250);x.font='500 26px "Noto Sans TC",sans-serif';x.fillText('沉沒深度',90,560);
  x.fillStyle='#0d6b3e';x.font='700 84px "JetBrains Mono",monospace';x.fillText('−'+LOSS[i].toFixed(2)+'%',86,660);x.font='700 34px "JetBrains Mono",monospace';x.fillText('−'+fmt(AMT[i])+' 元',90,720);
  x.fillStyle='#e6dfcd';x.fillRect(570,510,450,250);x.strokeStyle='#161616';x.lineWidth=2;x.beginPath();x.moveTo(570,514);x.lineTo(1020,514);x.stroke();x.strokeStyle='#0d6b3e';x.lineWidth=4;x.beginPath();for(let k=0;k<=i;k++){const px=580+(k/LAST)*430,py=520+(LOSS[k]/62)*230;k?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
  x.fillStyle='#161616';x.font='400 30px "Noto Sans TC",sans-serif';const m=moodOf(i);
  const body='【本報深海訊】青雲號 '+DATES[i]+' 收在 '+CLOSE[i]+' 元，當日海況「'+seaOf(Math.round(CHG[i]*100)/100)+'」，位於'+zoneOf(LOSS[i]*100)[0]+'。據目擊者表示，'+capLabel()+'目前心跳 '+bpmOf(i)+' 下、狀態「'+MOODS[m].label+'」，稍早對記者說：「'+pick(MOODS[m].lines)+'」';
  wrap(x,body,60,830,960,48);
  x.fillStyle='#161616';x.fillRect(60,1060,960,130);x.fillStyle='#f1ebdd';x.font='500 28px "Noto Sans TC",sans-serif';const need=(BREAKEVEN/CLOSE[i]-1)*100;x.fillText(need>0?'解套還要':'已解套',90,1110);x.fillStyle='#ff8f8a';x.font='700 54px "JetBrains Mono",monospace';x.fillText(need>0?'+'+need.toFixed(1)+'%':'重見天日',90,1170);x.fillStyle='#f1ebdd';x.font='500 28px "Noto Sans TC",sans-serif';x.fillText(need>0?'等於連拉 '+limitUps(CLOSE[i])+' 根漲停':'',520,1150);
  x.fillStyle='#161616';x.fillRect(60,1230,960,2);x.font='700 28px "Noto Sans TC",sans-serif';x.fillText('上船看即時沉沒 → 青雲號沉沒模擬器',60,1282);x.font='400 22px "Noto Sans TC",sans-serif';x.fillStyle='#4d4a44';x.fillText('純屬朋友間娛樂，不構成任何投資建議。',60,1320);
  const img=$('paper');img.src=c.toDataURL('image/png');img.hidden=false;$('paperHint').hidden=false;unlock('press')}
function wrap(x,text,l,t,w,lh){let line='',y=t;for(const ch of text){const test=line+ch;if(x.measureText(test).width>w){x.fillText(line,l,y);line=ch;y+=lh}else line=test}if(line)x.fillText(line,l,y)}
$('press').addEventListener('click',press);

/* ---------- 開場（等資料） ---------- */
function startUI(){
  applyMeta();
  renderBadges();
  wireReplay();
  shipDepth=LOSS[LAST]*100; targetDepth=shipDepth; shown=LAST;
  renderScore();newQ();
  setMood(moodOf(LAST),'老婆千萬不要打開那個 App。');
  setDay(LAST,false);
  resize();
  if(!raf) raf=requestAnimationFrame(frame);
}
function failUI(err){
  console.warn('qingyun data', err);
  // 舞台照常畫（空海），對話框提示
  BUY=540.22; BREAKEVEN=540.22; FULL=['—']; DATES=['—']; CLOSE=[0]; LOSS=[0]; AMT=[0]; CHG=[0]; maxSoFar=[0]; N=1; LAST=0; EVENTS={}; CASH_DIV=0;
  DATA_OK=false;
  try{
    applyMeta();
    if($('eyebrow')) $('eyebrow').textContent='5386 · 資料暫時讀不到';
    if($('dline')) $('dline').textContent='資料暫時讀不到，晚點再上船';
    if($('mood')) {$('mood').textContent='淡定';$('mood').className='mood calm'}
    if($('face')) paintFace('calm');
    shipDepth=0; targetDepth=0; shown=0;
    resize();
    if(!raf) raf=requestAnimationFrame(frame);
  }catch(e){ console.warn(e); }
}
loadAll().then(startUI).catch(failUI);

})();
