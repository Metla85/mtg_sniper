console.log("🚀 Iniciando MTG Sniper V36 (Restauración UI)...");

let supabase = null;
let currentMode = 'arbitrage';
let masterData = []; 
let currentData = []; 
let sortCol = 'ratio'; 
let sortAsc = false;
let chartInstance = null;
let searchTimer = null;

// --- HELPERS UI ---
function uiSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function uiSetHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function uiShow(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function uiHide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }

// --- 1. INICIO ---
window.onload = function() {
    if (typeof window.supabase === 'undefined') { alert("Error: Librería Supabase no cargada."); return; }

    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');

    if (!url || !key) { uiShow('config-screen'); uiHide('main-screen'); return; }

    try {
        supabase = window.supabase.createClient(url, key);
        uiHide('config-screen'); uiShow('main-screen');
        initAutocomplete(); 
        loadData(); 
    } catch (e) {
        console.error(e); alert("Error inicio: " + e.message);
    }
};

// --- 2. CARGA DE DATOS ---
async function loadData() {
    if (currentMode === 'search') return;

    uiShow('view-table'); uiHide('view-search'); uiShow('toolbar');
    uiSetText('status-text', "Cargando...");
    uiSetHTML('table-body', '');

    let rpcName, metricLabel;
    
    if (currentMode === 'arbitrage') { 
        rpcName = 'get_arbitrage_opportunities'; metricLabel = 'Gap'; sortCol = 'ratio'; sortAsc = false;
    } else if (currentMode === 'trend') { 
        rpcName = 'get_us_spikes'; metricLabel = 'Subida %'; sortCol = 'ratio'; sortAsc = false;
    } else if (currentMode === 'demand') { 
        rpcName = 'get_demand_spikes'; metricLabel = 'Demanda 7d'; sortCol = 'ratio'; sortAsc = false;
    } else if (currentMode === 'radar') {
        rpcName = 'get_modern_radar'; metricLabel = '% Uso'; sortCol = 'popularity'; sortAsc = false;
    }

    try {
        const { data, error } = await supabase.rpc(rpcName);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            uiSetText('status-text', "0 resultados");
            const msg = currentMode === 'radar' ? "Sin datos. Ejecuta el script python." : "Sin datos.";
            uiSetHTML('table-body', `<tr><td colspan="8" class="text-center py-8 text-slate-400">${msg}</td></tr>`);
            masterData = [];
            return;
        }

        masterData = data;
        uiSetText('col-metric', metricLabel);

        currentData = [...masterData];
        doSort(); 
        
        const filterInput = document.getElementById('filter-min-eur');
        if (filterInput && parseFloat(filterInput.value) > 0) applyFilters();
        else {
            uiSetText('status-text', `${currentData.length} resultados`);
            renderTable();
        }

    } catch (err) {
        console.error(err); alert("Error datos: " + err.message);
        uiSetText('status-text', "Error API");
    }
}

// --- 3. FILTROS Y ORDENACIÓN ---
function applyFilters() {
    const input = document.getElementById('filter-min-eur');
    let minEur = (input && input.value) ? parseFloat(input.value) : 0;
    if (isNaN(minEur)) minEur = 0;

    currentData = masterData.filter(item => {
        const price = (item.eur !== null) ? parseFloat(item.eur) : 0;
        return price >= minEur;
    });

    doSort();
    uiSetText('status-text', `${currentData.length} resultados`);
    renderTable();
}

function sortBy(column) {
    if (sortCol === column) sortAsc = !sortAsc;
    else { sortCol = column; sortAsc = false; }
    applyFilters();
}

function doSort() {
    currentData.sort((a, b) => {
        let valA = a[sortCol] ?? 0;
        let valB = b[sortCol] ?? 0;
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
    });
}

// --- 4. RENDERIZADO (RESTAURADO) ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!currentData.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-center text-slate-400 py-8">Vacío.</td></tr>`; return; }

    currentData.forEach((item, index) => {
        let val, color;
        
        // Visualización del Valor Principal
        if (currentMode === 'radar') {
            let pop = parseFloat(item.popularity || 0);
            val = pop.toFixed(1) + '%';
            color = pop > 20 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-blue-50 text-blue-800 border-blue-200';
        } else {
            let ratio = parseFloat(item.ratio || 0);
            if (currentMode === 'arbitrage') { 
                val = ratio.toFixed(2)+'x'; color = ratio > 2 ? 'ratio-extreme' : 'ratio-high'; 
            } else if (currentMode === 'trend') { 
                val = '+'+ratio.toFixed(0)+'%'; color = 'ratio-high'; 
            } else { 
                val = '+'+Math.round(ratio)+'%'; color = 'bg-amber-100 text-amber-800 border-amber-200'; 
            }
        }
        
        // Flecha de Variación
        const change = parseFloat(item.rank_change || 0);
        let arrow = '—', arrowClass = 'text-slate-300';

        if (currentMode === 'radar') {
            if (change > 0) { arrow = `▲ +${change.toFixed(1)}%`; arrowClass = 'rank-up'; }
            else if (change < 0) { arrow = `▼ ${change.toFixed(1)}%`; arrowClass = 'rank-down'; }
        } else {
            if (change > 0) { arrow = `▲ ${Math.round(change)}`; arrowClass = 'rank-up'; }
            else if (change < 0) { arrow = `▼ ${Math.abs(Math.round(change))}`; arrowClass = 'rank-down'; }
        }

        const { mkmLink, ckLink, edhLink } = getLinks(item);

        // Botón Radar (Moxfield)
        let radarBtn = '';
        if (currentMode === 'radar' && item.example_deck_id) {
            radarBtn = `
                <a href="https://www.moxfield.com/decks/${item.example_deck_id}" target="_blank" class="icon-btn text-orange-600 hover:bg-orange-50" title="Moxfield">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                </a>`;
        }

        const row = `
            <tr class="card-row border-b border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 pl-6">
                    <div class="flex items-center gap-3">
                        <div class="cursor-pointer" onclick="showImage('${item.image_uri}')">
                            <img src="${item.image_uri}" class="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm" onerror="this.style.display='none'">
                        </div>
                        <div class="font-bold text-slate-800 text-sm leading-tight">${item.name}</div>
                    </div>
                </td>
                <td class="px-2 py-3 text-center"><span class="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">${item.set_code || '??'}</span></td>
                <td class="px-4 py-3 text-right font-mono font-bold text-slate-700">${(item.eur||0).toFixed(2)}€</td>
                <td class="hide-mobile px-4 py-3 text-right font-mono text-slate-400">$${(item.usd||0).toFixed(2)}</td>
                <td class="px-4 py-3 text-center"><span class="ratio-badge ${color} border">${val}</span></td>
                <td class="px-4 py-3 text-center text-xs font-mono text-slate-600">#${item.edhrec_rank||'—'}</td>
                <td class="px-4 py-3 text-center text-xs font-bold ${arrowClass}">${arrow}</td>
                <td class="px-4 py-3 text-center">
                    <div class="icon-group flex justify-center gap-1">
                        <button onclick="openChart(${index})" class="icon-btn text-blue-600 hover:bg-blue-50" title="Gráfica">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-8v8m-4-8v8M4 16h16"></path></svg>
                        </button>
                        ${radarBtn}
                        <a href="${mkmLink}" target="_blank" class="icon-btn text-indigo-600 hover:bg-indigo-50" title="MKM">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </a>
                        <a href="${ckLink}" target="_blank" class="icon-btn text-emerald-600 hover:bg-emerald-50" title="CardKingdom">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z"/></svg>
                        </a>
                        <a href="${edhLink}" target="_blank" class="icon-btn text-purple-600 hover:bg-purple-50" title="EDHRec">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        </a>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// --- 5. FUNCIONALIDADES ---
function getLinks(item) {
    const cleanName = item.name ? item.name.replace(/'/g, '').replace(/\/\/.*/, '') : 'card';
    const mkmLink = item.mkm_link || `https://www.cardmarket.com/en/Magic/Cards/${cleanName.replace(/ /g, '-')}`;
    const ckLink = `https://www.cardkingdom.com/purchasing/mtg_singles?search=header&filter%5Bname%5D=${encodeURIComponent(item.name || '')}`;
    const edhLink = `https://edhrec.com/cards/${cleanName.toLowerCase().replace(/ /g, '-')}`;
    return { mkmLink, ckLink, edhLink };
}

async function openChart(i) {
    const item = currentData[i];
    if (!item) { alert("Error: Ítem no encontrado."); return; }

    uiShow('chart-modal');
    uiSetText('modal-title', `${item.name} (${item.set_code})`);
    
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null; // Limpieza explicita
    }

    try {
        const { data, error } = await supabase.rpc('get_card_history', { 
            target_card_name: item.name, 
            target_set_code: item.set_code 
        });

        if (error || !data || data.length === 0) {
            alert(error ? "Error SQL: " + error.message : "Sin historial.");
            uiHide('chart-modal');
            return;
        }

        const ctx = document.getElementById('priceChart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(x => new Date(x.date).toLocaleDateString(undefined, {month:'2-digit', day:'2-digit'})),
                datasets: [
                    { label: 'USD', data: data.map(x => x.usd), borderColor: '#3b82f6', tension: 0.2, pointRadius: 2, yAxisID: 'y_price' },
                    { label: 'EUR', data: data.map(x => x.eur), borderColor: '#22c55e', tension: 0.2, pointRadius: 2, yAxisID: 'y_price' },
                    { label: 'Rank', data: data.map(x => x.edhrec_rank), borderColor: '#a855f7', borderDash: [5,5], yAxisID: 'y_rank', hidden: false, borderWidth: 1 }
                ]
            },
            options: { 
                maintainAspectRatio: false,
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: { 
                    y_price: { type: 'linear', position: 'right', beginAtZero: false },
                    y_rank: { type: 'linear', position: 'left', reverse: true, grid: { drawOnChartArea: false } } 
                }
            }
        });

    } catch (err) {
        uiHide('chart-modal');
        alert("Error gráfica: " + err.message);
    }
}

function showImage(url) {
    document.getElementById('enlarged-image').src = url;
    uiShow('image-modal');
}

function switchMode(mode) {
    currentMode = mode;
    ['arbitrage', 'trend', 'demand', 'search', 'radar'].forEach(m => {
        const btn = document.getElementById('tab-'+m);
        if (btn) btn.className = (m === mode) ? 'flex-1 py-3 px-2 text-xs font-bold uppercase active-tab whitespace-nowrap' : 'flex-1 py-3 px-2 text-xs font-bold uppercase inactive-tab whitespace-nowrap';
    });

    if (mode === 'search') {
        uiHide('view-table'); uiShow('view-search'); uiHide('toolbar');
        document.getElementById('search-input').focus();
    } else {
        uiShow('view-table'); uiHide('view-search'); uiShow('toolbar');
        document.getElementById('search-input').value = '';
        loadData();
    }
}

function initAutocomplete() {
    const input = document.getElementById('search-input');
    const list = document.getElementById('suggestions-list');
    input.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        clearTimeout(searchTimer);
        if (term.length < 3) { list.classList.add('hidden'); return; }
        searchTimer = setTimeout(async () => {
            const { data } = await supabase.rpc('search_cards', { keyword: term });
            if (!data || !data.length) { list.classList.add('hidden'); return; }
            list.innerHTML = '';
            [...new Set(data.map(i => i.name))].slice(0,8).forEach(name => {
                const li = document.createElement('li');
                li.className = 'px-4 py-3 text-sm border-b hover:bg-slate-50 cursor-pointer';
                li.innerText = name;
                li.onclick = () => performSearch(name);
                list.appendChild(li);
            });
            list.classList.remove('hidden');
        }, 300);
    });
    document.addEventListener('click', (e) => {
        if(!input.contains(e.target) && !list.contains(e.target)) list.classList.add('hidden');
    });
}

async function performSearch(name) {
    uiHide('suggestions-list');
    document.getElementById('search-input').value = name;
    uiHide('search-placeholder');
    uiHide('copy-btn');
    
    const grid = document.getElementById('search-results-grid');
    grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">Buscando...</div>';

    const { data } = await supabase.rpc('search_cards', { keyword: name });
    currentData = data || []; 
    grid.innerHTML = '';

    if (!data.length) { grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">No encontrado.</div>'; return; }

    currentData.forEach((item, i) => {
        const { mkmLink, ckLink, edhLink } = getLinks(item);
        const card = document.createElement('div');
        card.className = "card-sheet bg-white rounded shadow p-4 flex flex-col gap-2";
        card.innerHTML = `
            <div class="flex gap-4">
                <img src="${item.image_uri}" class="w-20 rounded shadow" onclick="showImage('${item.image_uri}')">
                <div class="flex-1">
                    <div class="font-bold text-lg">${item.name}</div>
                    <div class="text-xs uppercase text-gray-500 font-bold">${item.set_code}</div>
                    <div class="flex justify-between mt-2">
                        <div class="text-center"><div class="text-[10px] text-gray-400">EUR</div><div class="font-bold">${(item.eur||0).toFixed(2)}€</div></div>
                        <div class="text-center"><div class="text-[10px] text-gray-400">USD</div><div class="font-bold text-gray-500">$${(item.usd||0).toFixed(2)}</div></div>
                    </div>
                </div>
            </div>
            <div class="flex gap-1 mt-2 pt-2 border-t">
                <button onclick="openChart(${i})" class="flex-1 bg-blue-50 text-blue-600 font-bold py-2 rounded text-xs">Gráfica</button>
                <a href="${mkmLink}" target="_blank" class="icon-btn text-indigo-600 bg-indigo-50">M</a>
                <a href="${ckLink}" target="_blank" class="icon-btn text-emerald-600 bg-emerald-50">C</a>
            </div>`;
        grid.appendChild(card);
    });
}

function saveConfig() {
    const u = document.getElementById('input-url').value.trim();
    const k = document.getElementById('input-key').value.trim();
    if(u && k) { localStorage.setItem('supabase_url', u); localStorage.setItem('supabase_key', k); location.reload(); }
}
function resetConfig() { if(confirm("¿Reset?")) { localStorage.clear(); location.reload(); } }
function copyToClipboardSafe() {
    const txt = currentData.map(i => `1 ${i.name.split(' // ')[0]}`).join('\n');
    navigator.clipboard.writeText(txt);
    Toastify({text: "Copiado", duration: 2000, style:{background:"#4f46e5"}}).showToast();
                        }
