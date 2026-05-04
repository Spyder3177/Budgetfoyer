const STORAGE_KEY = "budget_foyer_v3";

const VIEWS = ["dashboard", "import", "transactions", "categories", "settings"];

const DEFAULT_CATEGORIES = [
  "Courses","Essence","Maison","Électricité / Gaz","Eau","Internet / Téléphone","Assurances",
  "Crédit / Loyer","Santé","Enfants","Loisirs","Restaurants","Abonnements","Impôts",
  "Vêtements","Achats divers","Revenus","Épargne","Retraits espèces","Virements internes",
  "Frais bancaires","Animaux","Auto","Cadeaux","Non catégorisé"
];

const DEFAULT_RULES = [
  ["CARREFOUR","Courses"],["LECLERC","Courses"],["INTERMARCHE","Courses"],["LIDL","Courses"],["ALDI","Courses"],["AUCHAN","Courses"],["SUPER U","Courses"],["U EXPRESS","Courses"],["NETTO","Courses"],
  ["TOTAL","Essence"],["ESSO","Essence"],["AVIA","Essence"],["CARBURANT","Essence"],["STATION","Essence"],["E.LECLERC AUTO","Essence"],["SHELL","Essence"],
  ["EDF","Électricité / Gaz"],["ENGIE","Électricité / Gaz"],["ENEDIS","Électricité / Gaz"],["TOTALENERGIES","Électricité / Gaz"],
  ["VEOLIA","Eau"],["SAUR","Eau"],["EAU","Eau"],
  ["ORANGE","Internet / Téléphone"],["FREE","Internet / Téléphone"],["SFR","Internet / Téléphone"],["BOUYGUES","Internet / Téléphone"],["B&YOU","Internet / Téléphone"],
  ["AXA","Assurances"],["MAIF","Assurances"],["MACIF","Assurances"],["MMA","Assurances"],["ASSURANCE","Assurances"],["GROUPAMA","Assurances"],["CREDIT AGRICOLE ASSURANCE","Assurances"],
  ["LOYER","Crédit / Loyer"],["PRET","Crédit / Loyer"],["ECHEANCE PRET","Crédit / Loyer"],["CREDIT LOGEMENT","Crédit / Loyer"],
  ["PHARMACIE","Santé"],["DOCTEUR","Santé"],["MEDECIN","Santé"],["MUTUELLE","Santé"],["OPTICIEN","Santé"],
  ["AMAZON","Achats divers"],["CDISCOUNT","Achats divers"],["PAYPAL","Achats divers"],["ALIEXPRESS","Achats divers"],["SHEIN","Vêtements"],["KIABI","Vêtements"],["H&M","Vêtements"],["ZARA","Vêtements"],
  ["NETFLIX","Abonnements"],["SPOTIFY","Abonnements"],["DISNEY","Abonnements"],["CANAL","Abonnements"],["APPLE.COM","Abonnements"],["GOOGLE","Abonnements"],["MICROSOFT","Abonnements"],["PRIME VIDEO","Abonnements"],
  ["RESTAURANT","Restaurants"],["MCDONALD","Restaurants"],["BURGER","Restaurants"],["UBER EATS","Restaurants"],["DELIVEROO","Restaurants"],["KFC","Restaurants"],
  ["IMPOT","Impôts"],["DGFIP","Impôts"],["TRESOR PUBLIC","Impôts"],
  ["SALAIRE","Revenus"],["PAIE","Revenus"],["CAF","Revenus"],["POLE EMPLOI","Revenus"],["CPAM","Revenus"],
  ["VIREMENT INTERNE","Virements internes"],["VIR INTERNE","Virements internes"],["RETRAIT","Retraits espèces"],["DAB","Retraits espèces"],
  ["FRAIS","Frais bancaires"],["COTISATION","Frais bancaires"],["COMMISSION","Frais bancaires"],
  ["ANIMALIS","Animaux"],["ZOOPLUS","Animaux"],["VETERINAIRE","Animaux"],
  ["FEU VERT","Auto"],["NORAUTO","Auto"],["MIDAS","Auto"],["GARAGE","Auto"]
].map(([keyword,category])=>({keyword,category}));

let state = loadState();

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  return { transactions: [], rules: DEFAULT_RULES, periodMonths: 24, lastImportDebug: null };
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function money(n){ return (n||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"}); }
function normalize(s){ return String(s||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g," ").replace(/\s+/g," ").trim(); }
function stripQuotes(s){ return String(s ?? "").trim().replace(/^"|"$/g,"").replaceAll('""','"'); }

function parseAmount(v){
  if(v === undefined || v === null) return 0;
  let s = String(v).trim();
  if(!s) return 0;
  s = s.replace(/\u00A0/g," ").replace(/€/g,"").replace(/\s/g,"");
  let negative = false;
  if(/^\(.*\)$/.test(s)){ negative = true; s = s.slice(1,-1); }
  if(s.endsWith("-")){ negative = true; s = s.slice(0,-1); }
  if(s.startsWith("-")){ negative = true; s = s.slice(1); }
  s = s.replace(/\./g,"").replace(",",".");
  const n = Number(s);
  if(!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function parseDate(v){
  const s = String(v || "").trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if(m){
    const y = m[3].length === 2 ? "20"+m[3] : m[3];
    return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }
  m = s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if(m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0,10);
}

function detectDelimiter(text){
  const sample = text.split(/\r?\n/).filter(l=>l.trim()).slice(0,8).join("\n");
  const candidates = [";","\t",","];
  return candidates.map(d=>[d,(sample.match(new RegExp(d === "\t" ? "\\t" : "\\"+d,"g"))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];
}

function splitCSVLine(line, delimiter){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c === '"'){
      if(q && line[i+1] === '"'){ cur+='"'; i++; }
      else q=!q;
    } else if(c === delimiter && !q){ out.push(stripQuotes(cur)); cur=""; }
    else cur+=c;
  }
  out.push(stripQuotes(cur));
  return out;
}

function scoreHeaderRow(cols){
  const joined = normalize(cols.join(" "));
  let score = 0;
  ["DATE","LIBELLE","LIBELLE OPERATION","DEBIT","CREDIT","MONTANT","OPERATION","VALEUR"].forEach(k=>{
    if(joined.includes(k)) score += 2;
  });
  if(cols.length >= 3) score += 1;
  return score;
}

function findHeader(lines, delimiter){
  let best = { index: 0, headers: splitCSVLine(lines[0] || "", delimiter), score: -1 };
  lines.slice(0,12).forEach((line,i)=>{
    const cols = splitCSVLine(line, delimiter);
    const score = scoreHeaderRow(cols);
    if(score > best.score) best = { index:i, headers:cols, score };
  });
  return best;
}

function findColumn(headers, groups){
  const norm = headers.map(h=>normalize(h));
  for(const group of groups){
    const wanted = group.map(normalize);
    const exact = norm.findIndex(h=>wanted.includes(h));
    if(exact >= 0) return exact;
    const partial = norm.findIndex(h=>wanted.some(w=>h.includes(w)));
    if(partial >= 0) return partial;
  }
  return -1;
}

function detectColumns(headers){
  const dateI = findColumn(headers, [
    ["DATE OPERATION","DATE D OPERATION","DATE DE L OPERATION","DATE"],
    ["DATE COMPTABLE","DATE VALEUR"]
  ]);
  const libI = findColumn(headers, [
    ["LIBELLE","LIBELLE OPERATION","LIBELLE DE L OPERATION","DESIGNATION","DESCRIPTION","INTITULE","OPERATION"],
    ["NATURE","REFERENCE"]
  ]);
  const debitI = findColumn(headers, [
    ["DEBIT EUROS","DEBIT EURO","DEBIT","MONTANT DEBIT","DEPENSES","SORTIE"]
  ]);
  const creditI = findColumn(headers, [
    ["CREDIT EUROS","CREDIT EURO","CREDIT","MONTANT CREDIT","RECETTES","ENTREE"]
  ]);
  const amountI = findColumn(headers, [
    ["MONTANT EUROS","MONTANT EURO","MONTANT","AMOUNT","VALEUR","EUROS"]
  ]);
  const dateValeurI = findColumn(headers, [["DATE VALEUR","DATE DE VALEUR"]]);
  return {dateI, libI, debitI, creditI, amountI, dateValeurI};
}

function cleanLabel(label){
  return String(label)
    .replace(/\b(CB|CARTE|PAIEMENT|PRELEVEMENT|PRLV|VIR|VIREMENT|SEPA|ACHAT|FACTURE)\b/gi," ")
    .replace(/\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/g," ")
    .replace(/\d{2}:\d{2}/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function parseBankCSV(text){
  text = text.replace(/^\uFEFF/,"");
  const delimiter = detectDelimiter(text);
  const allLines = text.split(/\r?\n/).filter(l=>l.trim());
  if(!allLines.length) throw new Error("Fichier vide.");
  const headerInfo = findHeader(allLines, delimiter);
  const headers = headerInfo.headers;
  const colsInfo = detectColumns(headers);
  const {dateI, libI, debitI, creditI, amountI, dateValeurI} = colsInfo;

  state.lastImportDebug = { delimiter, headers, colsInfo };

  if(dateI < 0 && dateValeurI < 0) {
    throw new Error("Colonne date introuvable. Colonnes détectées : " + headers.join(" | "));
  }
  if(libI < 0) {
    throw new Error("Colonne libellé introuvable. Colonnes détectées : " + headers.join(" | "));
  }
  if(debitI < 0 && creditI < 0 && amountI < 0) {
    throw new Error("Colonne montant introuvable. Colonnes détectées : " + headers.join(" | "));
  }

  const lines = allLines.slice(headerInfo.index + 1);
  const rows = [];
  for(const line of lines){
    const cols = splitCSVLine(line, delimiter);
    if(cols.length < 2) continue;
    const date = parseDate(cols[dateI >= 0 ? dateI : dateValeurI]);
    const label = cols[libI] || "";
    if(!date || !label) continue;

    let debit = 0, credit = 0;
    if(debitI >= 0) debit = Math.abs(parseAmount(cols[debitI]));
    if(creditI >= 0) credit = Math.abs(parseAmount(cols[creditI]));

    if(amountI >= 0 && debitI < 0 && creditI < 0){
      const amount = parseAmount(cols[amountI]);
      if(amount < 0) debit = Math.abs(amount);
      else credit = amount;
    }

    if(debit === 0 && credit === 0) continue;

    rows.push({
      id:"", date, label, cleanLabel: cleanLabel(label),
      debit, credit, category:"", account:"",
      importedAt:new Date().toISOString()
    });
  }
  if(!rows.length) throw new Error("Aucune opération lisible trouvée. Vérifie que le fichier n’est pas un export comptable spécial.");
  return rows;
}

function makeId(t){
  const raw = [t.date, normalize(t.label), Number(t.debit).toFixed(2), Number(t.credit).toFixed(2), t.account].join("|");
  let hash = 0;
  for(let i=0;i<raw.length;i++) hash = ((hash<<5)-hash) + raw.charCodeAt(i) | 0;
  return "tx_" + Math.abs(hash) + "_" + raw.length;
}

function categorize(t){
  if(t.credit > 0 && t.debit === 0) {
    const hay = normalize(t.label + " " + t.cleanLabel);
    const foundIncome = state.rules.find(r => hay.includes(normalize(r.keyword)));
    return foundIncome ? foundIncome.category : "Revenus";
  }
  const hay = normalize(t.label + " " + t.cleanLabel);
  const found = state.rules.find(r => hay.includes(normalize(r.keyword)));
  return found ? found.category : "Non catégorisé";
}

function filteredByPeriod(){
  const months = Number(state.periodMonths);
  const sorted = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  if(months >= 999) return sorted;
  const maxDate = sorted.reduce((m,t)=> t.date > m ? t.date : m, "");
  if(!maxDate) return [];
  const d = new Date(maxDate); d.setMonth(d.getMonth() - months + 1); d.setDate(1);
  const min = d.toISOString().slice(0,10);
  return sorted.filter(t=>t.date >= min);
}
function monthsInData(rows){ return [...new Set(rows.map(t=>t.date.slice(0,7)))].sort(); }

function setView(view){
  document.querySelectorAll(".nav,.view").forEach(x=>x.classList.remove("active"));
  const btn = document.querySelector(`.nav[data-view="${view}"]`);
  const panel = document.getElementById(view);
  if(btn) btn.classList.add("active");
  if(panel) panel.classList.add("active");

  const titles = {
    dashboard:["Dashboard","Vue globale des finances du foyer"],
    import:["Import CSV","Ajoute les relevés de chaque compte"],
    transactions:["Transactions","Contrôle et corrige les catégories"],
    categories:["Catégories","Règles automatiques de classement"],
    settings:["Réglages","Maintenance des données locales"]
  };
  document.getElementById("pageTitle").textContent = titles[view][0];
  document.getElementById("pageSubtitle").textContent = titles[view][1];
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
  const cats = DEFAULT_CATEGORIES;
  document.getElementById("categoryFilter").innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(c=>`<option>${c}</option>`).join("");
  document.getElementById("ruleCategory").innerHTML = cats.map(c=>`<option>${c}</option>`).join("");
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
  document.querySelector("#categoryTable tbody").innerHTML = catRows.map(r=>`<tr><td>${r.cat}</td><td>${money(r.total)}</td><td><strong>${money(r.avg)}</strong></td><td>${r.count}</td></tr>`).join("") || `<tr><td colspan="4">Importe un CSV pour commencer.</td></tr>`;

  const max = Math.max(...catRows.slice(0,8).map(r=>r.avg),1);
  document.getElementById("topCategories").innerHTML = catRows.slice(0,8).map(r=>`
    <div class="bar-row"><div class="bar-meta"><strong>${r.cat}</strong><span>${money(r.avg)}/mois</span></div><div class="bar"><i style="width:${Math.round(r.avg/max*100)}%"></i></div></div>
  `).join("") || `<p class="muted">Aucune dépense.</p>`;

  renderRecurring(rows);
  requestAnimationFrame(()=>renderMonthlyChart(rows));
}

function renderRecurring(rows){
  const map = {};
  rows.filter(t=>t.debit>0).forEach(t=>{
    const key = normalize(t.cleanLabel).slice(0,42);
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
  const canvas = document.getElementById("monthlyChart");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 280), h = Math.max(rect.height, 120);
  canvas.width = w*scale; canvas.height = h*scale; ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,w,h);
  const months = monthsInData(rows);
  const data = months.map(m=>{
    const r = rows.filter(t=>t.date.slice(0,7)===m);
    const exp = r.reduce((s,t)=>s+t.debit,0), inc = r.reduce((s,t)=>s+t.credit,0);
    return {m, exp, inc};
  });
  ctx.font="12px -apple-system, BlinkMacSystemFont, Segoe UI";
  if(!data.length){ ctx.fillStyle="#6b7280"; ctx.fillText("Importe un CSV pour afficher le graphique.",16,38); return; }
  const max = Math.max(...data.map(d=>Math.max(d.exp,d.inc)),1);
  const pad=28, gap=6, bw=Math.max(6,(w-pad*2)/data.length-gap);
  const base=h-24;
  ctx.strokeStyle="#e5e7eb"; ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(w-pad, base); ctx.stroke();
  data.forEach((d,i)=>{
    const x=pad+i*(bw+gap);
    const eh=(d.exp/max)*(h-58), ih=(d.inc/max)*(h-58);
    ctx.fillStyle="#111827"; ctx.fillRect(x, base-eh, bw/2, eh);
    ctx.fillStyle="#9ca3af"; ctx.fillRect(x+bw/2, base-ih, bw/2, ih);
    if(i%Math.ceil(data.length/6)===0){ ctx.fillStyle="#6b7280"; ctx.font="10px -apple-system"; ctx.fillText(d.m.slice(5)+"/"+d.m.slice(2,4), x, h-7); }
  });
  ctx.fillStyle="#111827"; ctx.font="11px -apple-system"; ctx.fillText("Noir dépenses · Gris revenus", pad, 14);
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
  document.querySelector("#transactionsTable tbody").innerHTML = rows.slice(0,1500).map(t=>`
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

document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
document.getElementById("periodSelect").addEventListener("change",e=>{ state.periodMonths=Number(e.target.value); saveState(); render(); });
["searchInput","accountFilter","categoryFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderTransactions));
document.getElementById("clearFilters").addEventListener("click",()=>{ searchInput.value=""; accountFilter.value=""; categoryFilter.value=""; renderTransactions(); });

document.getElementById("csvFile").addEventListener("change",async e=>{
  const files = [...e.target.files]; const account = document.getElementById("accountSelect").value;
  let added=0, skipped=0, errors=[];
  for(const f of files){
    try{
      const text = await f.text();
      const parsed = parseBankCSV(text).map(t=>{ t.account=account; t.category=categorize(t); t.id=makeId(t); return t; });
      const existing = new Set(state.transactions.map(t=>t.id));
      parsed.forEach(t=>{ if(existing.has(t.id)) skipped++; else {state.transactions.push(t); existing.add(t.id); added++;} });
    }catch(err){ errors.push(`${f.name}: ${err.message}`); }
  }
  saveState(); render();
  const box=document.getElementById("importResult"); box.style.display="block";
  box.classList.toggle("error", errors.length > 0);
  box.textContent = `${added} opération(s) ajoutée(s), ${skipped} doublon(s) ignoré(s).` + (errors.length ? " Erreurs : " + errors.join(" | ") : " Import terminé.");
  e.target.value="";
});

document.addEventListener("change",e=>{
  if(e.target.classList.contains("category-select")){
    const id=e.target.dataset.id, cat=e.target.value;
    const t = state.transactions.find(x=>x.id===id);
    if(t){
      t.category=cat;
      const kw = prompt(`Mot-clé à mémoriser pour toujours classer ce type d’opération en “${cat}” ?\nLaisse vide pour ne pas créer de règle.`, (t.cleanLabel || t.label).split(" ").slice(0,2).join(" "));
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
document.getElementById("recatBtn").addEventListener("click",()=>{ state.transactions.forEach(t=>t.category=categorize(t)); saveState(); render(); });
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

/* Swipe iOS entre onglets */
(function enableIOSSwipeNavigation(){
  const main = document.querySelector(".main");
  let startX=0, startY=0, currentX=0, tracking=false, locked=false;

  function activeIndex(){
    const active = document.querySelector(".nav.active");
    return Math.max(0, VIEWS.indexOf(active?.dataset?.view || "dashboard"));
  }
  function goTo(index){
    if(index < 0 || index >= VIEWS.length) return;
    main.classList.add("page-snap");
    setView(VIEWS[index]);
    setTimeout(()=>main.classList.remove("page-snap"), 240);
  }
  function blockedTarget(target){
    return target.closest("input, select, button, table, .table-wrap, .bars, .chips, .list, .dropzone");
  }

  document.addEventListener("touchstart", e=>{
    if(e.touches.length !== 1 || blockedTarget(e.target)) return;
    startX = currentX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true; locked = false;
  }, {passive:true});

  document.addEventListener("touchmove", e=>{
    if(!tracking || e.touches.length !== 1) return;
    currentX = e.touches[0].clientX;
    const dx = currentX - startX;
    const dy = e.touches[0].clientY - startY;
    if(!locked && Math.abs(dx) > 14) locked = Math.abs(dx) > Math.abs(dy) * 1.35;
    if(locked){
      const pull = Math.max(-42, Math.min(42, dx * .22));
      main.style.setProperty("--swipe-x", pull + "px");
      main.classList.add("swipe-live");
    }
  }, {passive:true});

  document.addEventListener("touchend", e=>{
    if(!tracking) return;
    tracking=false;
    const dx = currentX - startX;
    main.classList.remove("swipe-live");
    main.style.setProperty("--swipe-x", "0px");
    if(locked && Math.abs(dx) > 86){
      const i = activeIndex();
      if(dx < 0) goTo(i+1);
      else goTo(i-1);
    }
  }, {passive:true});
})();

window.addEventListener("resize", ()=>requestAnimationFrame(()=>renderMonthlyChart(filteredByPeriod())));
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
setView("dashboard");
render();
