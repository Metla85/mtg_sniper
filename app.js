let supabase = null;
let currentMode = 'arbitrage';
let masterData = []; // Datos crudos de la BD
let currentData = []; // Datos filtrados
let sortCol = 'ratio'; 
let sortAsc = false;
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
            alert("Error crítico. Reset.");
            resetConfig();
        }
    }
};

// --- CARGA DE DATOS ---
async function loadData() {
    if (currentMode === 'search') return;

    // Resetear UI
    document.getElementById('view-table').classList.remove('hidden');
    document.getElementById('view-search').classList.add('hidden');
    document.getElementById('toolbar').classList.remove('hidden');
    document.getElementById('status-text').innerText = "Cargando...";
    document.getElementById('table-body').innerHTML = ''; // Limpiar visualmente

    let rpcName, metricLabel;
    
    if (currentMode === 'arbitrage') { 
        rpcName = 'get_arbitrage_opportunities'; 
        metricLabel = 'Gap'; 
        sortCol = 'ratio'; sortAsc = false;
    } else if (currentMode === 'trend') { 
        rpcName = 'get_us_spikes'; 
        metricLabel = 'Subida %'; 
        sortCol = 'ratio'; sortAsc = false;
    } else if (currentMode === 'demand') { 
        rpcName = 'get_demand_spikes'; 
        metricLabel = 'Demanda 7d'; 
        sortCol = 'ratio'; sortAsc = false;
    }

    const { data, error } = await supabase.rpc(rpcName);
    
    if (error) { 
        alert("Error de BD: " + error.message); 
        return; 
    }
    
    // GUARDAR DATOS MAESTROS
    masterData = data || [];
    
    // Si no hay datos, avisamos, pero no rompemos
    if (masterData.length === 0) {
        document.getElementById('status-text').innerText = "0 resultados";
        document.getElementById('table-body').innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Sin datos disponibles.</td></tr>`;
        return;
    }

    document.getElementById('col-metric').innerText = metricLabel;
    
    // LLAMADA CRÍTICA: Aplicar filtros y renderizar
    applyFilters();
}

// --- FILTROS Y ORDENACIÓN ---
function applyFilters() {
    // Leemos el input. Si está vacío o es inválido, asumimos 0.
    const inputElement = document.getElementById('filter-min-eur');
    let minEur = 0;
    
    if (inputElement && inputElement.value) {
        minEur = parseFloat(inputElement.value);
        if (isNaN(minEur)) minEur = 0;
    }

    // Filtramos masterData
    currentData = masterData.filter(item => {
        const price = item.eur ? parseFloat(item.eur) : 0;
        return price >= minEur;
    });

    // Ordenamos
    doSort();
    
    // Renderizamos
    document.getElementById('status-text').innerText = `${currentData.length} resultados`;
    renderTable();
}

function sortBy(column) {
    if (sortCol === column) {
        sortAsc = !sortAsc;
    } else {
        sortCol = column;
        sortAsc = false;
    }
    applyFilters(); // Re-aplicar orden y renderizar
}

function doSort() {
    currentData.sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];

        if (valA === null || valA === undefined) valA = 0;
        if (valB === null || valB === undefined) valB = 0;

        if (typeof valA === 'string') {
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortAsc ? valA - valB : valB - valA;
        }
    });
}

// --- RENDERIZADO ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    if (currentData.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Sin datos tras filtrar.</td></tr>`; 
        return; 
    }

    currentData.forEach((item, index) => {
        let val, color;
        const ratio = parseFloat(item.ratio || 0);

        if (currentMode === 'arbitrage') { 
            val = ratio.toFixed(2)+'x'; 
            color = ratio > 2 ? 'ratio-extreme' : 'ratio-high'; 
        } else if (currentMode === 'trend') { 
            val = '+'+ratio.toFixed(0)+'%'; 
            color = 'ratio-high'; 
        } else { 
            val = '+'+Math.round(ratio)+'%'; 
            color = 'bg-amber-100 text-amber-800 border border-amber-200'; 
        }
        
        const rankInfo = item.edhrec_rank ? `#${item.edhrec_rank}` : '—';
        const change = item.rank_change || 0;
        let arrow = change > 0 ? `▲ ${change}` : (change < 0 ? `▼ ${Math.abs(change)}` : '—');
        let arrowClass = change > 0 ? 'rank-up' : (change < 0 ? 'rank-down' : 'text-slate-300');

        const { mkmLink, ckLink, edhLink } = getLinks(item);

        const row = `
            <tr class="card-row border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 pl-6">
                    <div class="flex items-center gap-3">
                        <div class="cursor-pointer" onclick="showImage('${item.image_uri}', event)">
                            <img src="${item.image_uri}" class="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm" onerror="this.style.display='none'">
                        </div>
                        <div class="font-bold text-slate-800 text-sm leading-tight">${item.name}</div>
                    </div>
                </td>
                <td class="px-2 py-3 text-center"><span class="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">${item.set_code || '??'}</span></td>
                <td class="px-4 py-3 text-right font-mono font-bold text-slate-700">${(item.eur||0).toFixed(2)}€</td>
                <td class="hide-mobile px-4 py-3 text-right font-mono text-slate-400">$${(item.usd||0).toFixed(2)}</td>
                <td class="px-4 py-3 text-center"><span class="${color} ratio-badge">${val}</span></td>
                <td class="px-4 py-3 text-center text-xs font-mono text-slate-600">${rankInfo}</td>
                <td class="px-4 py-3 text-center text-xs font-bold ${arrowClass}">${arrow}</td>
                <td class="px-4 py-3 text-center">
                    <div class="icon-group flex justify-center gap-1">
                        <button onclick="openChart(${index}); event.stopPropagation();" class="icon-btn text-blue-600 hover:bg-blue-50" title="Ver Gráfica">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-8v8m-4-8v8M4 16h16"></path></svg>
                        </button>
                        <a href="${mkmLink}" target="_blank" class="icon-btn text-indigo-600 hover:bg-indigo-50" title="MKM">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </a>
                        <a href="${ckLink}" target="_blank" class="icon-btn text-emerald-600 hover:bg-emerald-50" title="CK">
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

function getLinks(item) {
    const cleanName = item.name ? item.name.replace(/'/g, '').replace(/\/\/.*/, '') : 'card';
    const mkmLink = item.mkm_link || `https://www.cardmarket.com/en/Magic/Cards/${cleanName.replace(/ /g, '-')}`;
    const ckLink = `https://www.cardkingdom.com/purchasing/mtg_singles?search=header&filter%5Bname%5D=${encodeURIComponent(item.name || '')}`;
    const edhLink = `https://edhrec.com/cards/${cleanName.toLowerCase().replace(/ /g, '-')}`;
    return { mkmLink, ckLink, edhLink };
}

// --- GRÁFICAS ---
async function openChart(i) {
    const item = currentData[i];
    const modal = document.getElementById('chart-modal');
    
    if (!item) { alert("Error: Elemento no encontrado."); return; }

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = `${item.name} (${item.set_code})`;
    
    if (chartInstance) chartInstance.destroy();

    try {
        const { data, error } = await supabase.rpc('get_card_history', { 
            target_card_name: item.name, 
            target_set_code: item.set_code 
        });

        if (error) { alert("Error SQL: " + error.message); modal.classList.add('hidden'); return; }
        if (!data || data.length === 0) { alert("Sin historial."); modal.classList.add('hidden'); return; }

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
                    y_price: { type: 'linear', position: 'right', beginAtZero: false, title: {display: true, text: 'Precio'} },
                    y_rank: { type: 'linear', position: 'left', reverse: true, grid: { drawOnChartArea: false }, title: {display: true, text: 'Rank #'} }
                }
            }
        });

    } catch (err) {
        alert("Error JS: " + err.message);
        modal.classList.add('hidden');
    }
}

// --- UTILIDADES ---
function switchMode(mode) {
    currentMode = mode;
    ['arbitrage', 'trend', 'demand', 'search'].forEach(m => {
        const btn = document.getElementById('tab-'+m);
        btn.className = (m === mode) ? 'flex-1 py-3 px-2 text-xs font-bold uppercase active-tab whitespace-nowrap' : 'flex-1 py-3 px-2 text-xs font-bold uppercase inactive-tab whitespace-nowrap';
    });

    if (mode === 'search') {
        document.getElementById('view-table').classList.add('hidden');
        document.getElementById('view-search').classList.remove('hidden');
        document.getElementById('toolbar').classList.add('hidden'); 
        document.getElementById('search-input').focus();
    } else {
        document.getElementById('view-table').classList.remove('hidden');
        document.getElementById('view-search').classList.add('hidden');
        document.getElementById('toolbar').classList.remove('hidden');
        document.getElementById('search-input').value = '';
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
