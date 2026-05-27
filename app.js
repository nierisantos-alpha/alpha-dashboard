// ── utils ──
const f  = (n,d=2)=>isNaN(+n)||n==null?'—':(+n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fi = n=>isNaN(+n)||n==null?'—':(+n).toLocaleString('pt-BR');
const fr = n=>n&&+n?'R$\u00a0'+f(n):'—';

const LABELS={last_7d:'7 dias',last_14d:'14 dias',last_30d:'30 dias',this_month:'Este mês',last_90d:'90 dias'};

let sChart=null, pChart=null, deferredInstall=null;
let activePreset='last_30d', activeCustomFrom='', activeCustomTo='';

// ── aggregate helpers ──
function aggCamps(data){
  const m={};
  data.forEach(r=>{
    const k=r.campaign||'Sem nome';
    if(!m[k]) m[k]={n:k,st:r.account_status||'—',sp:0,im:0,re:0,cl:0,pu:0,rs:0,rc:0};
    m[k].sp+=+(r.spend||0); m[k].im+=+(r.impressions||0);
    m[k].re+=+(r.reach||0); m[k].cl+=+(r.clicks||0); m[k].pu+=+(r.purchases||0);
    if(r.purchase_roas){m[k].rs+=+(r.purchase_roas);m[k].rc++;}
  });
  return Object.values(m).sort((a,b)=>b.sp-a.sp);
}

function aggDate(data){
  const m={};
  data.forEach(r=>{
    if(!r.date) return;
    if(!m[r.date]) m[r.date]={sp:0,pu:0};
    m[r.date].sp+=+(r.spend||0); m[r.date].pu+=+(r.purchases||0);
  });
  const dates=Object.keys(m).sort();
  return {dates, spend:dates.map(d=>+m[d].sp.toFixed(2)), purch:dates.map(d=>m[d].pu)};
}

// ── render metrics ──
function renderMetrics(data){
  const t=data.reduce((a,r)=>({
    sp:a.sp++(r.spend||0),im:a.im++(r.impressions||0),
    re:a.re++(r.reach||0),cl:a.cl++(r.clicks||0),pu:a.pu++(r.purchases||0)
  }),{sp:0,im:0,re:0,cl:0,pu:0});
  const cpm=t.im?t.sp/t.im*1000:0, cpc=t.cl?t.sp/t.cl:0,
        ctr=t.im?t.cl/t.im*100:0,  cpp=t.pu?t.sp/t.pu:0;
  const cards=[
    {icon:'💰',label:'Investido',     value:'R$\u00a0'+f(t.sp), sub:'Total no período'},
    {icon:'👥',label:'Alcance',       value:fi(t.re),             sub:'Pessoas únicas'},
    {icon:'👁',label:'Impressões',    value:fi(t.im),             sub:'Exibições'},
    {icon:'🖱',label:'Cliques',       value:fi(t.cl),             sub:'CTR '+f(ctr,2)+'%'},
    {icon:'🛒',label:'Compras',       value:fi(t.pu),             sub:'Conversões'},
    {icon:'🧾',label:'Custo/Compra', value:fr(cpp),              sub:'Por conversão'},
    {icon:'📊',label:'CPM',           value:fr(cpm),              sub:'Mil impressões'},
    {icon:'🎯',label:'CPC',           value:fr(cpc),              sub:'Por clique'},
  ];
  const grid=document.getElementById('metricsGrid');
  grid.innerHTML=cards.map(c=>`
    <div class="mcard">
      <div class="mc-icon">${c.icon}</div>
      <div class="mc-label">${c.label}</div>
      <div class="mc-value">${c.value}</div>
      <div class="mc-sub">${c.sub}</div>
    </div>`).join('');
  setTimeout(()=>grid.querySelectorAll('.mcard').forEach((el,i)=>{
    setTimeout(()=>el.classList.add('loaded'),i*60);
  }),50);
}

// ── render table ──
function renderTable(camps){
  document.getElementById('campCount').textContent=camps.length+' campanhas';
  document.getElementById('campBody').innerHTML=camps.map(c=>{
    const cpm=c.im?c.sp/c.im*1000:0, cpc=c.cl?c.sp/c.cl:0,
          ctr=c.im?c.cl/c.im*100:0,  cpp=c.pu?c.sp/c.pu:0,
          roas=c.rc?c.rs/c.rc:0, on=c.st==='ACTIVE';
    const roasClass=roas>=2?'roas-good':roas>0?'roas-ok':'';
    return `<tr>
      <td class="tname" title="${c.n}">${c.n}</td>
      <td><span class="badge ${on?'badge-on':'badge-off'}">${on?'Ativa':'Pausada'}</span></td>
      <td>${fr(c.sp)}</td><td>${fi(c.re)}</td><td>${fi(c.im)}</td>
      <td>${fi(c.cl)}</td><td>${f(ctr,2)}%</td>
      <td>${fr(cpm)}</td><td>${fr(cpc)}</td>
      <td>${fi(c.pu)}</td><td>${fr(cpp)}</td>
      <td class="${roasClass}">${roas?f(roas,2)+'x':'—'}</td>
    </tr>`;
  }).join('');
}

// ── render charts ──
function renderCharts(bd){
  const lbs=bd.dates.map(d=>{const[,m,dy]=d.split('-');return`${dy}/${m}`;});
  const gc='rgba(255,255,255,.04)', tc='#555';
  const base={
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{
      backgroundColor:'#1c1c1c',titleColor:'#f0f0f0',bodyColor:'#888',
      borderColor:'#2e2e2e',borderWidth:1,padding:10,cornerRadius:8
    }},
    scales:{
      x:{ticks:{color:tc,font:{size:10},maxTicksLimit:8,autoSkip:true},grid:{color:gc},border:{display:false}},
      y:{ticks:{color:tc,font:{size:10}},grid:{color:gc},border:{display:false}}
    }
  };
  if(sChart){sChart.destroy();sChart=null;}
  if(pChart){pChart.destroy();pChart=null;}
  sChart=new Chart(document.getElementById('spendChart'),{type:'line',data:{labels:lbs,datasets:[{
    data:bd.spend,borderColor:'#F5A623',backgroundColor:'rgba(245,166,35,.07)',
    fill:true,tension:.4,pointRadius:bd.dates.length>25?0:3,
    borderWidth:2.5,pointBackgroundColor:'#F5A623',pointBorderColor:'#0d0d0d',pointBorderWidth:1.5
  }]},options:{...base,scales:{...base.scales,y:{...base.scales.y,
    ticks:{...base.scales.y.ticks,callback:v=>'R$'+Number(v).toLocaleString('pt-BR')}}}}});
  pChart=new Chart(document.getElementById('purchChart'),{type:'bar',data:{labels:lbs,datasets:[{
    data:bd.purch,backgroundColor:'rgba(245,166,35,.65)',
    borderRadius:4,hoverBackgroundColor:'#F5A623'
  }]},options:base});
}

// ── load data ──
async function loadData(){
  const btn=document.getElementById('refreshBtn');
  btn.textContent='…'; btn.disabled=true;
  document.getElementById('errBox').style.display='none';
  document.getElementById('contentArea').style.display='none';
  document.getElementById('loadingState').style.display='flex';

  const TOKEN=window.__TOKEN__;
  let url=`/api/data/${TOKEN}?`;
  if(activeCustomFrom&&activeCustomTo&&activePreset==='custom'){
    url+=`date_from=${activeCustomFrom}&date_to=${activeCustomTo}`;
  } else {
    url+=`date_preset=${activePreset}`;
  }

  try{
    const res=await fetch(url);
    const json=await res.json();
    if(!res.ok) throw new Error(json.error||'Erro desconhecido');
    const data=json.data||[];
    if(!data.length) throw new Error('Sem dados nesse período. Verifique se o Meta Ads está conectado no Windsor.ai.');

    // period label
    if(activePreset==='custom'&&activeCustomFrom&&activeCustomTo){
      document.getElementById('periodLabel').textContent=`${activeCustomFrom} → ${activeCustomTo}`;
    } else {
      document.getElementById('periodLabel').textContent=LABELS[activePreset]||activePreset;
    }
    const now=new Date();
    document.getElementById('lastUpd').textContent=
      now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

    renderMetrics(data);
    renderTable(aggCamps(data));
    renderCharts(aggDate(data));

    document.getElementById('loadingState').style.display='none';
    document.getElementById('contentArea').style.display='block';
  }catch(e){
    document.getElementById('loadingState').style.display='none';
    document.getElementById('errTitle').textContent='Erro ao carregar';
    document.getElementById('errMsg').textContent=e.message;
    document.getElementById('errBox').style.display='block';
  }
  btn.textContent='↺'; btn.disabled=false;
}

// ── period tabs ──
function setPreset(p,el){
  if(p==='custom'){ openDateModal(); return; }
  activePreset=p; activeCustomFrom=''; activeCustomTo='';
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  loadData();
}

// ── date modal ──
function openDateModal(){
  document.getElementById('dateModal').classList.add('open');
  const today=new Date().toISOString().slice(0,10);
  const ago30=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  document.getElementById('mDateFrom').value=activeCustomFrom||ago30;
  document.getElementById('mDateTo').value=activeCustomTo||today;
}
function closeDateModal(){
  document.getElementById('dateModal').classList.remove('open');
}
function applyCustomDate(){
  const df=document.getElementById('mDateFrom').value;
  const dt=document.getElementById('mDateTo').value;
  if(!df||!dt){ alert('Selecione as duas datas.'); return; }
  activeCustomFrom=df; activeCustomTo=dt; activePreset='custom';
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  document.getElementById('tabCustom').classList.add('active');
  closeDateModal();
  loadData();
}

// ── PWA install ──
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault(); deferredInstall=e;
  document.getElementById('installBanner').style.display='flex';
});
function installApp(){
  if(!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(()=>{
    deferredInstall=null;
    document.getElementById('installBanner').style.display='none';
  });
}
function dismissInstall(){
  document.getElementById('installBanner').style.display='none';
}

// ── service worker ──
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

// ── init ──
document.addEventListener('DOMContentLoaded', ()=>{
  // set default active tab to match default preset
  const defTab = document.querySelector(`.ptab[data-preset="${window.__PERIODO__}"]`);
  if(defTab){ document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active')); defTab.classList.add('active'); activePreset=window.__PERIODO__; }
  loadData();
});
