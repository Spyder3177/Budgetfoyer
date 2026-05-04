const STORAGE_KEY = "budget_foyer_v1";
const DEFAULT_CATEGORIES = [
  "Courses","Essence","Maison","Électricité / Gaz","Eau","Internet / Téléphone","Assurances",
  "Crédit / Loyer","Santé","Enfants","Loisirs","Restaurants","Abonnements","Impôts",
  "Vêtements","Achats divers","Revenus","Épargne","Retraits espèces","Virements internes","Non catégorisé"
];

const DEFAULT_RULES = [
  ["CARREFOUR","Courses"],["LECLERC","Courses"],["INTERMARCHE","Courses"],["LIDL","Courses"],["ALDI","Courses"],["AUCHAN","Courses"],["SUPER U","Courses"],
  ["TOTAL","Essence"],["ESSO","Essence"],["AVIA","Essence"],["CARBURANT","Essence"],["STATION","Essence"],
  ["EDF","Électricité / Gaz"],["ENGIE","Électricité / Gaz"],["ENEDIS","Électricité / Gaz"],
  ["ORANGE","Internet / Téléphone"],["FREE","Internet / Téléphone"],["SFR","Internet / Téléphone"],["BOUYGUES","Internet / Téléphone"],
  ["AXA","Assurances"],["MAIF","Assurances"],["MACIF","Assurances"],["MMA","Assurances"],["ASSURANCE","Assurances"],
  ["AMAZON","Achats divers"],["CDISCOUNT","Achats divers"],["PAYPAL","Achats divers"],
  ["NETFLIX","Abonnements"],["SPOTIFY","Abonnements"],["DISNEY","Abonnements"],["CANAL","Abonnements"],["APPLE.COM","Abonnements"],
  ["RESTAURANT","Restaurants"],["MCDONALD","Restaurants"],["BURGER","Restaurants"],["UBER EATS","Restaurants"],["DELIVEROO","Restaurants"],
  ["IMPOT","Impôts"],["DGFIP","Impôts"],["TRESOR PUBLIC","Impôts"],
  ["SALAIRE","Revenus"],["VIREMENT","Virements internes"],["RETRAIT","Retraits espèces"],["DAB","Retraits espèces"]
].map(([keyword,category])=>({keyword,category}));

let state = loadState();
let currentView = "dashboard";

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) return JSON.parse(raw);
  return { transactions: [], rules: DEFAULT_RULES, periodMonths: 24 };
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function money(n){ return (n||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"}); }
function parseAmount(v){
  if(v === undefined || v === null) return 0;
  let s = String(v).trim().replace(/\s/g,"").replace("€","").replace(",",".");
  if(!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function parseDate(v){
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if(m){
    const y = m[3].length === 2 ? "20"+m[3] : m[3];
    return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0,10);
}
function normalize(s){ return String(s||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
function detectDelimiter(text){
  const first = text.split(/\r?\n/).find(l=>l.trim()) || "";
  const candidates = [";","\t",","];
  return candidates.map(d=>[d,(first.match(new RegExp(d === "\t" ? "\\t" : "\\"+d,"g"))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];
}
function splitCSVLine(line, delimiter){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c === '"'){
      if(q && line[i+1] === '"'){ cur+='"'; i++; }
      else q=!q;
    } else if(c === delimiter && !q){ out.push(cur); cur=""; }
    else cur+=c;
  }
  out.push(cur);
  return out.map(x=>x.trim().replace(/^"|"$/g,""));
}
function parseCSV(text){
  text = text.replace(/^\uFEFF/,"");
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  const headers = splitCSVLine(lines.shift(), delimiter).map(h=>normalize(h));
  const idx = name => headers.findIndex(h => h.includes(normalize(name)));
  const dateI = idx("DATE"), libI = idx("LIBELLE"), debitI = idx("DEBIT"), creditI = idx("CREDIT");
  if(dateI < 0 || libI < 0 || debitI < 0 || creditI < 0) throw new Error("Colonnes introuvables. Il faut Date, Libellé, Débit euros, Crédit euros.");
  return lines.map(line=>{
    const cols = splitCSVLine(line, delimiter);
    const date = parseDate(cols[dateI]);
    const label = cols[libI] || "";
    const debit = Math.abs(parseAmount(cols[debitI]));
    const credit = Math.abs(parseAmount(cols[creditI]));
    if(!date || !label) return null;
    return { id:"", date, label, cleanLabel: cleanLabel(label), debit, credit, category:"", account:"", importedAt:new Date().toISOString() };
  }).filter(Boolean);
}
function cleanLabel(label){
  return String(label).replace(/\b(CB|CARTE|PAIEMENT|PRELEVEMENT|PRLV|VIR|SEPA)\b/gi,"").replace(/\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/g,"").replace(/\s+/g," ").trim();
}
function makeId(t){ return btoa(unescape(encodeURIComponent([t.date,t.label,t.debit,t.credit,t.account].join("|")))).slice(0,64); }
function categorize(t){
  if(t.credit > 0 && t.debit === 0) return "Revenus";
  const hay = normalize(t.label + " " + t.cleanLabel);
  const found = state.rules.find(r => hay.includes(normalize(r.keyword)));
  return found ? found.category : "Non catégorisé";
}
function filteredByPeriod(){
  const months = Number(state.periodMonths);
  if(months >= 999) return [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  const maxDate = state.transactions.reduce((m,t)=> t.date > m ? t.date : m, "");
  if(!maxDate) return [];
  const d = new Date(maxDate); d.setMonth(d.getMonth() - months + 1); d.setDate(1);
  const min = d.toISOString().slice(0,10);
  return state.transactions.filter(t=>t.date >= min).sort((a,b)=>b.date.localeCompare(a.date));
}
function monthsInData(rows){
  return [...new Set(rows.map(t=>t.date.slice(0,7)))].sort();
}

function render(){
  document.getElementById("periodSelect").value = state.periodMonths;
  document.getElementById("periodLabel").textContent = state.periodMonths >= 999 ? "Tout" : state.periodMonths + " mois";
  fillSelects();
  renderDashboard();
  renderTransactions();
  renderRules();
}
function fillSelects(){
  const catFilter = document.getElementById("categoryFilter");
  const ruleCategory = document.getElementById("ruleCategory");
  const cats = DEFAULT_CATEGORIES;
  catFilter.innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(c=>`<option>${c}</option>`).join("");
  ruleCategory.innerHTML = cats.map(c=>`<option>${c}</option>`).join("");
  const accounts = [...new Set(state.transactions.map(t=>t.account))].filter(Boolean);
  document.getElementById("accountFilter").innerHTML = '<option value="">Tous les comptes</option>' + accounts.map(a=>`<option>${a}</option>`).join("");
}
function renderDashboard(){
  const rows = filteredByPeriod();
  const months = monthsInData(rows);
  const monthCount = Math.max(months.length,1);
  const expenses = rows.reduce((s,t)=>s+t.debit,0), income = rows.reduce((s,t)=>s+t.credit,0);
  document.getElementById("kpiExpenses").textContent = money(expenses);
  document.getElementById("kpiIncome").textContent = money(income);
  document.getElementById("kpiBalance").textContent = money((income-expenses)/monthCount);
  document.getElementById("kpiExpensesAvg").textContent = money(expenses/monthCount)+"/mois";
  document.getElementById("kpiIncomeAvg").textContent = money(income/monthCount)+"/mois";
  document.getElementById("kpiCount").textContent = rows.length;
  document.getElementById("kpiMonths").textContent = `${months.length} mois analysés`;

  const byCat = {};
  rows.forEach(t=>{
    if(t.debit <= 0) return;
    byCat[t.category] ??= {total:0,count:0};
    byCat[t.category].total += t.debit; byCat[t.category].count++;
  });
  const catRows = Object.entries(byCat).map(([cat,v])=>({cat,total:v.total,avg:v.total/monthCount,count:v.count})).sort((a,b)=>b.total-a.total);
  const tbody = document.querySelector("#categoryTable tbody");
  tbody.innerHTML = catRows.map(r=>`<tr><td>${r.cat}</td><td>${money(r.total)}</td><td><strong>${money(r.avg)}</strong></td><td>${r.count}</td></tr>`).join("") || `<tr><td colspan="4">Importe un CSV pour commencer.</td></tr>`;

  const max = Math.max(...catRows.slice(0,8).map(r=>r.avg),1);
  document.getElementById("topCategories").innerHTML = catRows.slice(0,8).map(r=>`
    <div class="bar-row"><div class="bar-meta"><strong>${r.cat}</strong><span>${money(r.avg)}/mois</span></div><div class="bar"><i style="width:${Math.round(r.avg/max*100)}%"></i></div></div>
  `).join("") || `<p class="muted">Aucune dépense.</p>`;

  renderRecurring(rows);
  renderMonthlyChart(rows);
}
function renderRecurring(rows){
  const map = {};
  rows.filter(t=>t.debit>0).forEach(t=>{
    const key = normalize(t.cleanLabel).slice(0,38);
    if(!key) return;
    map[key] ??= {label:t.cleanLabel,total:0,count:0,months:new Set(),avg:0};
    map[key].total += t.debit; map[key].count++; map[key].months.add(t.date.slice(0,7));
  });
  const recurring = Object.values(map).filter(x=>x.months.size>=3).map(x=>({...x,avg:x.total/x.count})).sort((a,b)=>b.months.size-a.months.size || b.avg-a.avg).slice(0,8);
  document.getElementById("recurringList").innerHTML = recurring.map(x=>`
    <div class="list-item"><strong>${x.label}</strong><span>${x.months.size} mois · env. ${money(x.avg)} / opération</span></div>
  `).join("") || `<p class="muted">Aucune dépense fixe détectée pour l’instant.</p>`;
}
function renderMonthlyChart(rows){
  const canvas = document.getElementById("monthlyChart"), ctx = canvas.getContext("2d");
  const scale = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 800, h = 240;
  canvas.width = w*scale; canvas.height = h*scale; ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,w,h);
  const months = monthsInData(rows);
  const data = months.map(m=>{
    const r = rows.filter(t=>t.date.slice(0,7)===m);
    const exp = r.reduce((s,t)=>s+t.debit,0), inc = r.reduce((s,t)=>s+t.credit,0);
    return {m, exp, inc, bal:inc-exp};
  });
  if(!data.length){ ctx.fillStyle="#6b7280"; ctx.fillText("Importe un CSV pour afficher le graphique.",20,40); return; }
  const max = Math.max(...data.map(d=>Math.max(d.exp,d.inc,Math.abs(d.bal))),1);
  const pad=34, gap=8, bw=Math.max(8,(w-pad*2)/data.length-gap);
  ctx.font="12px -apple-system, BlinkMacSystemFont, Segoe UI";
  ctx.strokeStyle="#e5e7eb"; ctx.beginPath(); ctx.moveTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
  data.forEach((d,i)=>{
    const x=pad+i*(bw+gap), base=h-pad;
    const eh=(d.exp/max)*(h-70), ih=(d.inc/max)*(h-70);
    ctx.fillStyle="#111827"; ctx.fillRect(x, base-eh, bw/2, eh);
    ctx.fillStyle="#9ca3af"; ctx.fillRect(x+bw/2, base-ih, bw/2, ih);
    if(i%Math.ceil(data.length/8)===0){ ctx.fillStyle="#6b7280"; ctx.fillText(d.m.slice(5)+"/"+d.m.slice(2,4), x, h-8); }
  });
  ctx.fillStyle="#111827"; ctx.fillText("Noir = dépenses · Gris = revenus", pad, 18);
}
function renderTransactions(){
  let rows = filteredByPeriod();
  const q = normalize(document.getElementById("searchInput").value || "");
  const acc = document.getElementById("accountFilter").value;
  const cat = document.getElementById("categoryFilter").value;
  if(q) rows = rows.filter(t=>normalize(t.label+" "+t.category+" "+t.account).includes(q));
  if(acc) rows = rows.filter(t=>t.account===acc);
  if(cat) rows = rows.filter(t=>t.category===cat);
  document.getElementById("transactionCount").textContent = `${rows.length} opération${rows.length>1?"s":""}`;
  const tbody = document.querySelector("#transactionsTable tbody");
  tbody.innerHTML = rows.slice(0,1000).map(t=>`
    <tr>
      <td>${new Date(t.date).toLocaleDateString("fr-FR")}</td>
      <td>${t.account}</td>
      <td title="${t.label}">${t.cleanLabel || t.label}</td>
      <td><select class="category-select" data-id="${t.id}">${DEFAULT_CATEGORIES.map(c=>`<option ${c===t.category?"selected":""}>${c}</option>`).join("")}</select></td>
      <td class="amount-neg">${t.debit ? money(t.debit) : ""}</td>
      <td class="amount-pos">${t.credit ? money(t.credit) : ""}</td>
    </tr>`).join("") || `<tr><td colspan="6">Aucune transaction.</td></tr>`;
}
function renderRules(){
  document.getElementById("rulesList").innerHTML = state.rules.map((r,i)=>`
    <span class="chip"><strong>${r.keyword}</strong> → ${r.category}<button data-rule="${i}">×</button></span>
  `).join("");
}

document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav,.view").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); document.getElementById(btn.dataset.view).classList.add("active");
  currentView = btn.dataset.view;
  const titles = {
    dashboard:["Dashboard","Vue globale des finances du foyer"],
    import:["Import CSV","Ajoute les relevés de chaque compte"],
    transactions:["Transactions","Contrôle et corrige les catégories"],
    categories:["Catégories","Règles automatiques de classement"],
    settings:["Réglages","Maintenance des données locales"]
  };
  document.getElementById("pageTitle").textContent = titles[currentView][0];
  document.getElementById("pageSubtitle").textContent = titles[currentView][1];
}));

document.getElementById("periodSelect").addEventListener("change",e=>{ state.periodMonths=Number(e.target.value); saveState(); render(); });
["searchInput","accountFilter","categoryFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderTransactions));
document.getElementById("clearFilters").addEventListener("click",()=>{ searchInput.value=""; accountFilter.value=""; categoryFilter.value=""; renderTransactions(); });

document.getElementById("csvFile").addEventListener("change",async e=>{
  const files = [...e.target.files]; const account = document.getElementById("accountSelect").value;
  let added=0, skipped=0, errors=[];
  for(const f of files){
    try{
      const text = await f.text();
      const parsed = parseCSV(text).map(t=>{ t.account=account; t.category=categorize(t); t.id=makeId(t); return t; });
      const existing = new Set(state.transactions.map(t=>t.id));
      parsed.forEach(t=>{ if(existing.has(t.id)) skipped++; else {state.transactions.push(t); existing.add(t.id); added++;} });
    }catch(err){ errors.push(`${f.name}: ${err.message}`); }
  }
  saveState(); render();
  const box=document.getElementById("importResult"); box.style.display="block";
  box.textContent = `${added} opération(s) ajoutée(s), ${skipped} doublon(s) ignoré(s).` + (errors.length ? " Erreurs : " + errors.join(" | ") : "");
  e.target.value="";
});

document.addEventListener("change",e=>{
  if(e.target.classList.contains("category-select")){
    const id=e.target.dataset.id, cat=e.target.value;
    const t = state.transactions.find(x=>x.id===id);
    if(t){
      t.category=cat;
      const kw = prompt(`Mot-clé à mémoriser pour toujours classer ce type d’opération en “${cat}” ?\nLaisse vide pour ne pas créer de règle.`, t.cleanLabel.split(" ").slice(0,2).join(" "));
      if(kw && kw.trim().length>2) state.rules.unshift({keyword:kw.trim().toUpperCase(),category:cat});
      saveState(); render();
    }
  }
});
document.getElementById("addRuleBtn").addEventListener("click",()=>{
  const keyword = document.getElementById("ruleKeyword").value.trim().toUpperCase();
  const category = document.getElementById("ruleCategory").value;
  if(keyword.length<2) return;
  state.rules.unshift({keyword,category}); document.getElementById("ruleKeyword").value="";
  saveState(); render();
});
document.getElementById("rulesList").addEventListener("click",e=>{
  if(e.target.dataset.rule !== undefined){ state.rules.splice(Number(e.target.dataset.rule),1); saveState(); render(); }
});
document.getElementById("recatBtn").addEventListener("click",()=>{
  state.transactions.forEach(t=>t.category=categorize(t)); saveState(); render();
});
document.getElementById("clearDataBtn").addEventListener("click",()=>{
  if(confirm("Effacer toutes les transactions et règles personnalisées ?")){
    localStorage.removeItem(STORAGE_KEY); state=loadState(); render();
  }
});
document.getElementById("exportBtn").addEventListener("click",()=>{
  const rows = filteredByPeriod();
  const header = ["Date","Compte","Libellé","Catégorie","Débit euros","Crédit euros"];
  const csv = [header.join(";")].concat(rows.map(t=>[
    t.date,t.account,`"${String(t.label).replaceAll('"','""')}"`,t.category,
    String(t.debit).replace(".",","),String(t.credit).replace(".",",")
  ].join(";"))).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="budget-foyer-export.csv"; a.click(); URL.revokeObjectURL(a.href);
});

if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
render();
