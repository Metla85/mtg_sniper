let supabase = null;
let currentMode = 'arbitrage';
let currentData = [];
let searchTimer = null;
let chartInstance = null;

// --- INICIO ---
window.onload = function() {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');

    if (!url || !key) {
        document.getElementById('config-screen').classList.remove('hidden');
    } else {
        document.getElementById('config-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        try {
            supabase = window.supabase.createClient(url, key);
            initAutocomplete(); 
            loadData();
        } catch (e) {
            alert("Error inicializando. Reset.");
            resetConfig();
        }
    }
};

// --- CARGA DE DATOS ---
async function loadData() {
    if (currentMode === 'search') return;

    document.getElementById('view-table').classList.remove('hidden');
    document.getElementById('view-search').classList.add('hidden');
    document.getElementById('status-bar').classList.remove('hidden');

    document.getElementById('status-text').innerText = "Cargando...";
    let rpcName, metricLabel;
    
    if (currentMode === 'arbitrage') { rpcName = 'get_arbitrage_opportunities'; metricLabel = 'Gap'; }
    else if (currentMode === 'trend') { rpcName = 'get_us_spikes'; metricLabel = 'Subida %'; }
    else if (currentMode === 'demand') { rpcName = 'get_demand_spikes'; metricLabel = 'Demanda 7d'; }

    const { data, error } = await supabase.rpc(rpcName);
    if (error) { alert("Error API: " + error.message); return; }
    
    currentData = data || [];
    if (currentMode !== 'demand') currentData.sort((a, b) => b.ratio - a.ratio);
    
    document.getElementById('status-text').innerText = `${currentData.length} resultados`;
    document.getElementById('col-metric').innerText = metricLabel;
    renderTable();
}

// Helper para Links
function getLinks(item) {
    const cleanName = item.name.replace(/'/g, '').replace(/\/\/.*/, '');
    const mkmLink = item.mkm_link || `https://www.cardmarket.com/en/Magic/Cards/${cleanName.replace(/ /g, '-')}`;
    const ckLink = `https://www.cardkingdom.com/purchasing/mtg_singles?search=header&filter%5Bname%5D=${encodeURIComponent(item.name)}`;
    const edhLink = `https://edhrec.com/cards/${cleanName.toLowerCase().replace(/ /g, '-')}`;
    return { mkmLink, ckLink, edhLink };
}

// --- RENDER TABLA ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    if (currentData.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Sin datos.</td></tr>`; return; }

    currentData.forEach((item, index) => {
        let val, color;
        if (currentMode === 'arbitrage') { val = item.ratio.toFixed(2)+'x'; color = item.ratio > 2 ? 'ratio-extreme' : 'ratio-high'; }
        else if (currentMode === 'trend') { val = '+'+item.ratio.toFixed(0)+'%'; color = 'ratio-high'; }
        else { val = '+'+Math.round(item.ratio)+'%'; color = 'bg-amber-100 text-amber-800 border border-amber-200'; }
        
        const rankInfo = item.edhrec_rank ? `#${item.edhrec_rank}` : '—';
        const rankChange = item.rank_change || 0;
        let arrow = rankChange > 0 ? `<span class="rank-up">▲ ${rankChange}</span>` : (rankChange < 0 ? `<span class="rank-down">▼ ${Math.abs(rankChange)}</span>` : '<span class="text-slate-300">—</span>');

        const { mkmLink, ckLink, edhLink } = getLinks(item);

        const row = `
            <tr class="card-row border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 pl-6">
                    <div class="flex items-center gap-3">
                        <div class="cursor-pointer" onclick="showImage('${item.image_uri}', event)">
                            <img src="${item.image_uri}" class="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm">
                        </div>
                        <div class="font-bold text-slate-800 text-sm leading-tight">${item.name}</div>
                    </div>
                </td>
                <td class="px-2 py-3 text-center"><span class="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">${item.set_code}</span></td>
                <td class="px-4 py-3 text-right font-mono font-bold text-slate-700">${(item.eur||0).toFixed(2)}€</td>
                <td class="hide-mobile px-4 py-3 text-right font-mono text-slate-400">$${(item.usd||0).toFixed(2)}</td>
                <td class="px-4 py-3 text-center"><span class="${color} ratio-badge">${val}</span></td>
                <td class="px-4 py-3 text-center text-xs font-mono text-slate-600">${rankInfo}</td>
                <td class="px-4 py-3 text-center text-xs font-bold">${arrow}</td>
                <td class="px-4 py-3 text-center">
                    <div class="icon-group flex justify-center gap-1">
                        <button onclick="openChart(${index}); event.stopPropagation();" class="icon-btn text-blue-600 hover:bg-blue-50" title="Ver Gráfica">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-8v8m-4-8v8M4 16h16"></path></svg>
                        </button>
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

// --- BÚSQUEDA ---
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

            const uniques = [...new Set(data.map(i => i.name))].slice(0, 8);
            list.innerHTML = '';
            
            uniques.forEach(name => {
                const li = document.createElement('li');
                li.className = 'px-4 py-3 text-sm font-medium hover:bg-indigo-50 cursor-pointer border-b border-slate-50 flex items-center gap-2';
                li.innerHTML = `🔍 ${name}`;
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
    document.getElementById('suggestions-list').classList.add('hidden');
    document.getElementById('search-input').value = name;
    document.getElementById('search-placeholder').classList.add('hidden');
    document.getElementById('copy-btn').classList.add('hidden');
    
    const grid = document.getElementById('search-results-grid');
    grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">Buscando...</div>';

    const { data } = await supabase.rpc('search_cards', { keyword: name });
    currentData = data || [];
    grid.innerHTML = '';

    if (currentData.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">No encontrado.</div>';
        return;
    }

    document.getElementById('status-text').innerText = `${currentData.length} versiones`;

    currentData.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = "card-sheet bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col";
        const { mkmLink, ckLink, edhLink } = getLinks(item);
        
        const gapHtml = item.ratio > 1.5 ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded border border-green-200">Gap: ${item.ratio}x</span>` : '';
        const rankChange = item.rank_change || 0;
        let arrow = rankChange > 0 ? `<span class="rank-up text-sm">▲ ${rankChange}</span>` : (rankChange < 0 ? `<span class="rank-down text-sm">▼ ${Math.abs(rankChange)}</span>` : '<span class="text-gray-300">—</span>');

        card.innerHTML = `
            <div class="flex p-4 gap-4 items-start">
                <div class="w-1/3 min-w-[90px] cursor-pointer" onclick="showImage('${item.image_uri}', event)">
                    <img src="${item.image_uri}" class="w-full rounded-lg shadow-sm hover:opacity-90">
                </div>
                <div class="w-2/3 flex flex-col gap-1">
                    <div>
                        <div class="font-black text-lg leading-tight text-slate-800">${item.name}</div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">${item.set_code}</div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 my-2">
                        <div class="bg-slate-50 p-2 rounded text-center border">
                            <div class="text-[10px] text-gray-400 uppercase font-bold">EUR</div>
                            <div class="font-bold text-slate-700 text-lg">${(item.eur||0).toFixed(2)}€</div>
                        </div>
                        <div class="bg-slate-50 p-2 rounded text-center border">
                            <div class="text-[10px] text-gray-400 uppercase font-bold">USD</div>
                            <div class="font-bold text-slate-500 text-lg">$${(item.usd||0).toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center mt-auto border-t border-dashed border-slate-200 pt-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-gray-400 uppercase font-bold">Rank</span>
                            <span class="text-xs font-mono font-bold text-slate-600">#${item.edhrec_rank||'?'}</span>
                        </div>
                        <div class="flex flex-col text-right">
                            <span class="text-[10px] text-gray-400 uppercase font-bold">Var. 24h</span>
                            ${arrow}
                        </div>
                    </div>
                    <div class="mt-2 text-right">${gapHtml}</div>
                </div>
            </div>
            <div class="bg-slate-50 p-3 border-t flex justify-between items-center gap-2">
                <button onclick="openChart(${i})" class="flex-1 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 py-2 rounded shadow-sm flex items-center justify-center gap-2">
                    <span>📊</span> Historial
                </button>
                <div class="flex gap-1">
                    <a href="${mkmLink}" target="_blank" class="icon-btn text-indigo-600 bg-indigo-50" title="MKM">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </a>
                    <a href="${ckLink}" target="_blank" class="icon-btn text-emerald-600 bg-emerald-50" title="CK">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z"/></svg>
                    </a>
                    <a href="${edhLink}" target="_blank" class="icon-btn text-purple-600 bg-purple-50" title="EDH">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    </a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- GRÁFICAS ---
async function openChart(i) {
    const item = currentData[i];
    const modal = document.getElementById('chart-modal');
    
    if (!item) return alert("Error: Elemento no encontrado.");

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = `${item.name} (${item.set_code})`;
    
    if (chartInstance) chartInstance.destroy();

    try {
        const { data, error } = await supabase.rpc('get_card_history', { 
            target_card_name: item.name, 
            target_set_code: item.set_code 
        });

        if (error) {
            alert("Error SQL: " + error.message);
            modal.classList.add('hidden');
            return;
        }

        if (!data || data.length === 0) {
            alert("No hay historial disponible.");
            modal.classList.add('hidden');
            return;
        }

        const ctx = document.getElementById('priceChart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(x => new Date(x.date).toLocaleDateString(undefined, {month:'2-digit', day:'2-digit'})),
                datasets: [
                    { label: 'USD', data: data.map(x => x.usd), borderColor: '#3b82f6', tension: 0.3, pointRadius: 2 },
                    { label: 'EUR', data: data.map(x => x.eur), borderColor: '#22c55e', tension: 0.3, pointRadius: 2 },
                    { label: 'Rank', data: data.map(x => x.edhrec_rank), borderColor: '#a855f7', borderDash: [5,5], yAxisID: 'y1', hidden: false }
                ]
            },
            options: { 
                maintainAspectRatio: false,
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: { 
                    y: { beginAtZero: false, position: 'left' }, 
                    y1: { type: 'linear', display: true, position: 'right', reverse: true, grid: { drawOnChartArea: false } } 
                }
            }
        });

    } catch (err) {
        alert("Error JS: " + err.message);
        modal.classList.add('hidden');
    }
}

// --- HELPERS ---
function switchMode(mode) {
    currentMode = mode;
    ['arbitrage', 'trend', 'demand', 'search'].forEach(m => {
        const btn = document.getElementById('tab-'+m);
        btn.className = (m === mode) ? 'flex-1 py-3 px-2 text-xs font-bold uppercase active-tab whitespace-nowrap' : 'flex-1 py-3 px-2 text-xs font-bold uppercase inactive-tab whitespace-nowrap';
    });

    if (mode === 'search') {
        document.getElementById('view-table').classList.add('hidden');
        document.getElementById('view-search').classList.remove('hidden');
        document.getElementById('status-bar').classList.add('hidden'); 
        document.getElementById('search-input').focus();
    } else {
        document.getElementById('view-table').classList.remove('hidden');
        document.getElementById('view-search').classList.add('hidden');
        document.getElementById('status-bar').classList.remove('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-results-grid').innerHTML = '';
        document.getElementById('search-placeholder').classList.remove('hidden');
        loadData();
    }
}

function showImage(url, e) {
    e.stopPropagation();
    document.getElementById('enlarged-image').src = url;
    document.getElementById('image-modal').classList.remove('hidden');
}

function saveConfig() {
    const u = document.getElementById('input-url').value.trim();
    const k = document.getElementById('input-key').value.trim();
    if(u && k) { localStorage.setItem('supabase_url', u); localStorage.setItem('supabase_key', k); location.reload(); }
}
function resetConfig() { if(confirm("¿Borrar configuración?")) { localStorage.clear(); location.reload(); } }
function copyToClipboardSafe() {
    const txt = currentData.map(i => `1 ${i.name.split(' // ')[0]}`).join('\n');
    navigator.clipboard.writeText(txt).then(() => Toastify({text: "Copiado", duration: 2000, style:{background:"#4f46e5"}}).showToast());
            }
        
