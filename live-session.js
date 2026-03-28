// live-session.js - Mesin Grab Realtime untuk Jastip Studio

let currentEvent = null;
let customers = [];
let inventory = [];
let grabbedLogs = [];
let storeId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) { window.location.href = 'live.html'; return; }

    const sessionTitle = document.getElementById('sessionTitle');
    const itemList = document.getElementById('itemList');
    const customerList = document.getElementById('customerList');
    const customerSearch = document.getElementById('customerSearch');
    const grabLogs = document.getElementById('grabLogs');
    const grabCount = document.getElementById('grabCount');
    const btnFinalize = document.getElementById('btnFinalize');
    const finalizeModal = new bootstrap.Modal(document.getElementById('finalizeModal'));

    // 1. Ambil Identitas Sesi & Master Data
    async function initSession() {
        // A. Ambil Info Event
        const { data: event, error: evErr } = await window.supabaseClient.from('live_events').select('*').eq('id', eventId).single();
        if (evErr) { alert("Sesi tidak ditemukan!"); return; }
        currentEvent = event;
        sessionTitle.innerText = event.title;
        storeId = event.store_id;

        // B. Ambil Master Pelanggan (Untuk Auto-complete)
        const { data: custData } = await window.supabaseClient.from('customers').select('*');
        customers = custData || [];
        renderCustomerDatalist();

        // C. Ambil Master Inventori (Stok saat ini)
        const { data: invData } = await window.supabaseClient.from('inventory').select('*');
        inventory = invData || [];
        renderInventoryItems();

        // D. Ambil Histori Grab (Jika ada, untuk dipulihkan)
        const { data: logs } = await window.supabaseClient.from('live_event_grabs').select('*, inventory(item_name), customers(name)').eq('event_id', eventId);
        grabbedLogs = logs || [];
        updateGrabLogs();
    }

    // 2. Render UI Components
    function renderCustomerDatalist() {
        customerList.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
    }

    function renderInventoryItems() {
        itemList.innerHTML = inventory.map(item => `
            <button class="item-btn" onclick="grabAction('${item.id}')">
                <div class="d-flex justify-content-between">
                    <span class="fw-bold text-dark">${item.item_name}</span>
                    <span class="badge bg-light text-muted fw-normal">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="small mt-1 text-muted">Stok: ${item.stock_qty} | Brand: ${item.brand || '-'}</div>
            </button>
        `).join('');
    }

    function updateGrabLogs() {
        grabCount.innerText = `${grabbedLogs.length} Grab`;
        if (grabbedLogs.length === 0) {
            grabLogs.innerHTML = `<p class="text-muted text-center py-4 small">Belum ada aktivitas grab.<br>Coba klik salah satu barang!</p>`;
            return;
        }

        grabLogs.innerHTML = grabbedLogs.slice().reverse().map(log => {
            const time = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="grab-item shadow-sm">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="fw-bold text-terracotta">${log.customers?.name || 'Tamu'}</span>
                        <span class="text-muted" style="font-size: 0.7rem;">${time}</span>
                    </div>
                    <div class="text-dark">${log.inventory?.item_name || 'Barang'} 1x</div>
                </div>
            `;
        }).join('');
    }

    // 3. MESIN UTAMA: ACTION GRAB!
    window.grabAction = async (itemId) => {
        const cName = customerSearch.value.trim();
        if (!cName) {
            alert("⚠️ Pilih/Tulis Nama Pelanggan dulu di atas!");
            customerSearch.focus();
            return;
        }

        // A. Pastikan Customer terdaftar (atau buatkan sementara jika belum ada)
        let customer = customers.find(c => c.name.toLowerCase() === cName.toLowerCase());
        if (!customer) {
            const { data: newCust, error: cErr } = await window.supabaseClient.from('customers').insert([{ name: cName, store_id: storeId }]).select().single();
            if (cErr) return;
            customer = newCust;
            customers.push(newCust);
            renderCustomerDatalist();
        }

        // B. Catat Grab ke Database
        const { data: grabRecord, error: gErr } = await window.supabaseClient
            .from('live_event_grabs')
            .insert([{
                event_id: eventId,
                inventory_id: itemId,
                customer_id: customer.id,
                qty: 1
            }])
            .select('*, inventory(item_name), customers(name)')
            .single();

        if (gErr) {
            alert("Gagal Grab: " + gErr.message);
        } else {
            grabbedLogs.push(grabRecord);
            updateGrabLogs();
            // Feedback Visual: Vibrasi jika didukung mobile
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    // 4. FINALISASI: KONVERSI GRAB KE INVOICE KANBAN
    btnFinalize.addEventListener('click', () => {
        if (grabbedLogs.length === 0) {
            alert("Belum ada grab untuk difinalisasi!");
            return;
        }
        finalizeModal.show();
    });

    document.getElementById('confirmFinalize').addEventListener('click', async () => {
        const btn = document.getElementById('confirmFinalize');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Memproses Invoice Massal...';

        try {
            // A. Kelompokkan Grab berdasarkan CustomerID
            const grouped = grabbedLogs.reduce((acc, grab) => {
                if (!acc[grab.customer_id]) acc[grab.customer_id] = [];
                acc[grab.customer_id].push(grab);
                return acc;
            }, {});

            // B. Iterasi per pelanggan untuk membuat Invoice (Order)
            for (const custId in grouped) {
                const grabs = grouped[custId];
                const itemsPayload = grabs.map(g => ({
                    id: g.inventory_id,
                    name: g.inventory?.item_name,
                    qty: 1, // Di modul live session, kita asumsikan 1 per klik (fast grab)
                    price: inventory.find(i => i.id === g.inventory_id)?.price || 0
                }));

                const total = itemsPayload.reduce((acc, curr) => acc + curr.price, 0);

                await window.supabaseClient.from('orders').insert([{
                    store_id: storeId,
                    customer_id: custId,
                    items: itemsPayload,
                    total_price: total,
                    status: 'unpaid' // Masuk ke Kanban sebagai Unpaid
                }]);
                
                // C. (Opsional) Kurangi Stok Inventori? 
                // Di sini kita bisa lakukan rpc atau loop update stok
            }

            // D. Tutup Event
            await window.supabaseClient.from('live_events').update({ status: 'closed' }).eq('id', eventId);
            
            alert("✅ Selesai! Semua grab telah dikonversi menjadi invoice di papan pesanan.");
            window.location.href = 'live.html';

        } catch (e) {
            alert("Gagal finalisasi: " + e.message);
            btn.disabled = false;
        }
    });

    // Jalankan Inisialisasi
    initSession();
});
