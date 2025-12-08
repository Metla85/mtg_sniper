// --- 1. SISTEMA DE ERRORES VISUAL (EL CHIVATO) ---
// Esto atrapará cualquier error y te lo mostrará en el móvil
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorBox = document.createElement('div');
    errorBox.style.cssText = "position:fixed; top:0; left:0; width:100%; background:red; color:white; padding:20px; z-index:99999; font-family:sans-serif; font-size:14px; white-space:pre-wrap;";
    errorBox.innerText = `🚨 ERROR CRÍTICO:\n${msg}\n\nLínea: ${lineNo}`;
    document.body.appendChild(errorBox);
    return false;
};

console.log("🚀 Iniciando MTG Sniper V35 (Mobile)...");

// Variables Globales
let supabase = null;
let currentMode = 'arbitrage';
let masterData = []; 
let currentData = []; 
let sortCol = 'ratio'; 
let sortAsc = false;
let chartInstance = null;

// --- HELPERS UI ---
function uiShow(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}
function uiHide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
function uiLog(msg) {
    // Si estamos atascados en blanco, esto ayuda a ver progreso
    // Descomentar la siguiente línea si quieres ver el log en pantalla:
    // document.body.insertAdjacentHTML('beforeend', `<div style="font-size:10px;color:gray;">${msg}</div>`);
    console.log(msg);
}

// --- 2. INICIO ---
window.onload = function() {
    uiLog("📱 Window Loaded.");

    // Comprobación de librería
    if (typeof window.supabase === 'undefined') {
        throw new Error("Librería Supabase no cargada. Revisa tu internet.");
    }

    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');

    // SI NO HAY CLAVES -> PANTALLA LOGIN
    if (!url || !key) {
        uiLog("🔒 Sin claves. Mostrando Login.");
        uiShow('config-screen');
        uiHide('main-screen');
        return;
    }

    // INTENTO DE CONEXIÓN
    try {
        uiLog("🔌 Conectando...");
        supabase = window.supabase.createClient(url, key);
        
        // Si no ha fallado, mostramos la app
        uiHide('config-screen');
        uiShow('main-screen');
        
        initAutocomplete(); 
        loadData(); 

    } catch (e) {
        throw new Error("Fallo al iniciar Supabase: " + e.message);
    }
};

// --- 3. CARGA DE DATOS ---
async function loadData() {
    if (currentMode === 'search') return;

    uiShow('toolbar');
    uiShow('view-table');
    uiHide('view-search');
    
    const statusEl = document.getElementById('status-text');
    if(statusEl) statusEl.innerText = "Cargando...";
    
    const tbody = document.getElementById('table-body');
    if(tbody) tbody.innerHTML = '';

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
            if(statusEl) statusEl.innerText = "0 datos";
            if(tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8">Sin datos.</td></tr>`;
            masterData = [];
            return;
        }

        masterData = data;
        const metricEl = document.getElementById('col-metric');
        if(metricEl) metricEl.innerText = metricLabel;

        currentData = [...masterData];
        doSort(); 
        
        // Filtro
        const filterInput = document.getElementById('filter-min-eur');
        if (filterInput && parseFloat(filterInput.value) > 0) {
            applyFilters();
        } else {
            if(statusEl) statusEl.innerText = `${currentData.length} resultados`;
            renderTable();
        }

    } catch (err) {
        console.error(err);
        alert("Error API: " + err.message);
    }
}

// --- 4. FUNCIONES LÓGICAS ---
function applyFilters() {
    const input = document.getElementById('filter-min-eur');
    let minEur = (input && input.value) ? parseFloat(input.value) : 0;
    if (isNaN(minEur)) minEur = 0;

    currentData = masterData.filter(item => {
        const price = (item.eur !== null) ? parseFloat(item.eur) : 0;
        return price >= minEur;
    });

    doSort();
    const statusEl = document.getElementById('status-text');
    if(statusEl) statusEl.innerText = `${currentData.length} resultados`;
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

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!currentData.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8">Vacío.</td></tr>`; return; }

    currentData.forEach((item, index) => {
        let val, color;
        
        // Visual
        if (currentMode === 'radar') {
            let pop = parseFloat(item.popularity || 0);
            val = pop.toFixed(1) + '%';
            color = pop > 20 ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-800';
        } else {
            let ratio = parseFloat(item.ratio || 0);
            val = currentMode === 'trend' ? '+'+ratio.toFixed(0)+'%' : ratio.toFixed(2)+'x';
            if(currentMode === 'demand') val = '+'+Math.round(ratio)+'%';
            color = ratio > 2 ? 'ratio-extreme' : 'ratio-high';
        }
        
        // Flecha
        const change = parseFloat(item.rank_change || 0);
        let arrow = '—';
        let arrowClass = 'text-slate-300';
        
        if (currentMode === 'radar') {
            if (change > 0) { arrow = `▲ +${change.toFixed(1)}%`; arrowClass = 'rank-up'; }
            else if (change < 0) { arrow = `▼ ${change.toFixed(1)}%`; arrowClass = 'rank-down'; }
        } else {
            if (change > 0) { arrow = `▲ ${Math.round(change)}`; arrowClass = 'rank-up'; }
            else if (change < 0) { arrow = `▼ ${Math.abs(Math.round(change))}`; arrowClass = 'rank-down'; }
        }

        const cleanName = item.name.replace(/'/g, '').replace(/\/\/.*/, '');
        const mkmLink = item.mkm_link || `https://www.cardmarket.com/en/Magic/Cards/${cleanName.replace(/ /g, '-')}`;
        
        // Botón Moxfield
        let extraBtn = '';
        if (currentMode === 'radar' && item.example_deck_id) {
            extraBtn = `<a href="https://www.moxfield.com/decks/${item.example_deck_id}" target="_blank" class="icon-btn text-orange-600 hover:bg-orange-50">M</a>`;
        }

        const row = `
            <tr class="card-row border-b border-slate-100 hover:bg-slate-50" onclick="openChart(${index})">
                <td class="px-4 py-3 pl-6">
                    <div class="flex items-center gap-3">
                        <img src="${item.image_uri}" class="w-8 h-8 rounded object-cover" onerror="this.style.display='none'">
                        <div class="font-bold text-sm">${item.name}</div>
                    </div>
                </td>
                <td class="px-2 py-3 text-center text-xs uppercase font-bold text-slate-400">${item.set_code || ''}</td>
                <td class="px-4 py-3 text-right font-mono font-bold">${(item.eur||0).toFixed(2)}€</td>
                <td class="hide-mobile px-4 py-3 text-right font-mono text-slate-400">$${(item.usd||0).toFixed(2)}</td>
                <td class="px-4 py-3 text-center"><span class="${color} ratio-badge">${val}</span></td>
                <td class="px-4 py-3 text-center text-xs font-mono">#${item.edhrec_rank||'—'}</td>
                <td class="px-4 py-3 text-center text-xs font-bold ${arrowClass}">${arrow}</td>
                <td class="px-4 py-3 text-center flex justify-center gap-1">
                    ${extraBtn}
                    <a href="${mkmLink}" target="_blank" class="icon-btn text-indigo-600 hover:bg-indigo-50" onclick="event.stopPropagation()">€</a>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// --- 5. OTRAS ---
function switchMode(mode) {
    currentMode = mode;
    ['arbitrage', 'trend', 'demand', 'search', 'radar'].forEach(m => {
        const btn = document.getElementById('tab-'+m);
        if(btn) btn.className = (m === mode) ? 'flex-1 py-3 px-2 text-xs font-bold uppercase active-tab whitespace-nowrap' : 'flex-1 py-3 px-2 text-xs font-bold uppercase inactive-tab whitespace-nowrap';
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
            [...new Set(data.map(i => i.name))].forEach(name => {
                const li = document.createElement('li');
                li.className = 'px-4 py-3 text-sm border-b hover:bg-slate-50 cursor-pointer';
                li.innerText = name;
                li.onclick = () => performSearch(name);
                list.appendChild(li);
            });
            list.classList.remove('hidden');
        }, 300);
    });
}

async function performSearch(name) {
    uiHide('suggestions-list');
    document.getElementById('search-input').value = name;
    uiHide('search-placeholder');
    const { data } = await supabase.rpc('search_cards', { keyword: name });
    currentData = data || [];
    const statusEl = document.getElementById('status-text');
    if(statusEl) statusEl.innerText = `${currentData.length} resultados`;
    const grid = document.getElementById('search-results-grid');
    grid.innerHTML = '';
    
    currentData.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = "card-sheet bg-white rounded shadow p-4 mb-2";
        card.innerHTML = `
            <div class="flex gap-4">
                <img src="${item.image_uri}" class="w-20 rounded">
                <div>
                    <div class="font-bold text-lg">${item.name}</div>
                    <div class="text-sm text-gray-500">${item.set_code}</div>
                    <div class="mt-2 font-mono font-bold">${(item.eur||0).toFixed(2)}€</div>
                    <button onclick="openChart(${i})" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-xs">Historial</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

async function openChart(i) {
    const item = currentData[i];
    if (!item) return;
    uiShow('chart-modal');
    uiSetText('modal-title', item.name);
    
    if (chartInstance) chartInstance.destroy();
    
    const { data } = await supabase.rpc('get_card_history', { target_card_name: item.name, target_set_code: item.set_code });
    if(!data) { alert("Sin datos"); return; }

    const ctx = document.getElementById('priceChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(x => new Date(x.date).toLocaleDateString(undefined, {month:'2-digit', day:'2-digit'})),
            datasets: [
                { label: 'EUR', data: data.map(x => x.eur), borderColor: '#22c55e', yAxisID: 'y_price' },
                { label: 'Rank', data: data.map(x => x.edhrec_rank), borderColor: '#a855f7', borderDash:[5,5], yAxisID: 'y_rank' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { y_price: {position:'right'}, y_rank: {position:'left', reverse:true} }
        }
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
    alert("Copiado");
        }
        
