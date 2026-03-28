// orders.js - Papan Kanban Pesanan dengan Logika Modal (Rincian) & Relasi Edit

document.addEventListener('DOMContentLoaded', async () => {
    // Validasi Keamanan
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }
    loadKanbanBoards();
});

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// 1. ENGINE PENGAMBIL DATA KANBAN 
async function loadKanbanBoards() {
    const loading = document.getElementById('loadingState');
    loading.classList.remove('d-none');
    
    const boardUnpaid = document.getElementById('board-unpaid');
    const boardPacking = document.getElementById('board-packing');
    const boardCompleted = document.getElementById('board-completed');

    boardUnpaid.innerHTML = ''; boardPacking.innerHTML = ''; boardCompleted.innerHTML = '';

    try {
        const currentStoreId = localStorage.getItem('jastip_store_id');

        const { data: orders, error } = await window.supabaseClient
            .from('orders')
            .select(`*, customers (name, phone)`)
            .eq('store_id', currentStoreId) // SEGEL: Filter Toko
            .order('created_at', { ascending: false });

        loading.classList.add('d-none');
        if (error) throw error;

        let counts = { unpaid: 0, packing: 0, completed: 0 };

        if (!orders || orders.length === 0) {
            renderEmptyState(boardUnpaid, "Tak ada antrean pesanan masuk.");
            renderEmptyState(boardPacking, "Belum ada pesanan yang sedang diproses.");
            renderEmptyState(boardCompleted, "Belum ada transaksi selesai.");
            return;
        }

        orders.forEach(order => {
            if (order.status === 'unpaid' || order.status === 'pending') {
                boardUnpaid.appendChild(createOrderCard(order, 'unpaid')); counts.unpaid++;
            } else if (order.status === 'packing') {
                boardPacking.appendChild(createOrderCard(order, 'packing')); counts.packing++;
            } else if (order.status === 'completed') {
                boardCompleted.appendChild(createOrderCard(order, 'completed')); counts.completed++;
            }
        });

        if (counts.unpaid === 0) renderEmptyState(boardUnpaid, "Semua pesanan lunas diproses!");
        if (counts.packing === 0) renderEmptyState(boardPacking, "Tak ada yang perlu dikepak saat ini.");
        if (counts.completed === 0) renderEmptyState(boardCompleted, "Belum ada nota sejarah tercatat.");

    } catch (err) {
        console.error("Gagal menjaring arus pesanan PWA:", err);
        loading.innerHTML = `<p class="text-danger fw-bold text-center mt-4">Koneksi Papan Kanban Error.</p>`;
    }
}

function renderEmptyState(container, message) {
    container.innerHTML = `
        <div class="col-12 text-center py-5 fade-in">
            <i class="bi bi-inbox-fill text-muted opacity-50" style="font-size: 4rem; color: #ece2de !important;"></i>
            <p class="text-muted mt-3 fw-medium">${message}</p>
        </div>
    `;
}

// 2. DOM MESIN PEMBUATAN STRUKTUR KARTU KANBAN (VERSI RINGKAS)
function createOrderCard(order, statusMode) {
    const col = document.createElement('div');
    col.className = 'col-12';
    
    const customerName = order.customers ? order.customers.name : order.customer_name || 'Pembeli Tak Dikenal';
    const itemCount = (order.items || []).length;
    let statusClass = `status-${statusMode}`;
    const orderDataPayload = encodeURIComponent(JSON.stringify(order));

    // Tombol Navigasi Umum (Rincian, Edit, dan Hapus) - Berlaku Global di semua Status Kanban
    let globalButtons = `
        <div class="d-flex gap-2 w-100 mt-2 mb-2">
            <button class="btn btn-light shadow-sm fw-bold flex-fill py-2 text-dark border" style="font-size:0.85rem;" onclick="showOrderDetails('${orderDataPayload}')">
                <i class="bi bi-search me-1 text-sage-green"></i> Rincian
            </button>
            <button class="btn btn-light shadow-sm fw-bold flex-fill py-2 text-dark border" style="font-size:0.85rem;" onclick="window.location.href='edit-order.html?id=${order.id}'">
                <i class="bi bi-pencil-square me-1 text-terracotta"></i> Edit Tghn
            </button>
            <!-- Tombol Hapus Merah Mungil -->
            <button class="btn btn-outline-danger shadow-sm fw-bold py-2 border" style="font-size:0.85rem;" onclick="deleteOrder('${order.id}')" title="Buang Tagihan Selamanya">
                <i class="bi bi-trash3-fill"></i>
            </button>
        </div>
    `;

    // Tombol Aksi Khas masing-masing State (Unpaid->Packing, dsb)
    let actionButtons = '';
    if (statusMode === 'unpaid') {
        actionButtons = `
            <div class="d-flex gap-2 w-100 mt-2">
                <button class="btn btn-outline-success rounded-pill fw-bold flex-fill py-2" style="font-size:0.85rem;" onclick="copyInvoiceText(this, '${orderDataPayload}')">
                    <i class="bi bi-whatsapp me-1"></i> Teks Berwujud
                </button>
                <button class="btn btn-primary rounded-pill fw-bold flex-fill py-2" style="background-color: var(--terracotta); border:none; font-size:0.85rem;" onclick="updateOrderStatus('${order.id}', 'packing')">
                    Revisi -> Dikemas <i class="bi bi-box-seam ms-1"></i>
                </button>
            </div>
        `;
    } else if (statusMode === 'packing') {
        actionButtons = `
            <button class="btn w-100 rounded-pill fw-bold py-2 text-white shadow-sm mt-2" style="background-color: var(--sage-green); border:none;" onclick="updateOrderStatus('${order.id}', 'completed')">
                <i class="bi bi-check2-circle fs-5 align-middle me-2"></i>Tandai Selesai Dikirim
            </button>
        `;
    } else if (statusMode === 'completed') {
        actionButtons = `
            <div class="text-center w-100 py-2 rounded-4 mt-2" style="background-color: #f7f9f8; color: var(--sage-green);">
                <i class="bi bi-patch-check-fill me-1"></i> Transaksi Mengendap (Final)
            </div>
        `;
    }

    col.innerHTML = `
        <div class="card summary-card border-0 p-3 shadow-sm bg-white ${statusClass}" style="border-radius: 16px;">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle d-flex justify-content-center align-items-center text-white" style="width: 44px; height: 44px; background-color: #2c3e50;">
                        <i class="bi bi-person-fill fs-5"></i>
                    </div>
                    <div>
                        <h6 class="fw-bold text-dark m-0 pb-1" style="font-family: 'Jost', sans-serif;">${customerName}</h6>
                        <span class="small text-muted font-monospace"><i class="bi bi-calendar-event me-1"></i>${new Date(order.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                </div>
            </div>
            
            <div class="p-3 mb-3 border border-light rounded-4 bg-light d-flex justify-content-between align-items-center">
                <span class="small fw-medium text-muted"><i class="bi bi-cart3 me-1"></i> ${itemCount} Barang Diborong</span>
                <span class="fw-bold fs-5 text-terracotta">${formatRupiah(order.total_price)}</span>
            </div>

            <!-- Panel Tombol Pintas -->
            ${globalButtons}
            ${actionButtons}
        </div>
    `;

    return col;
}


// 3. FITUR BARU: INJEKSI DATA KE MODAL POP-UP (Rincian Detil Per-Pesanan)
window.showOrderDetails = (orderJson) => {
    const o = JSON.parse(decodeURIComponent(orderJson));
    const content = document.getElementById('orderDetailContent');
    
    // Mesin Pencetak Struk Rincian
    let itemsHTML = '';
    const itemList = o.items || []; 
    if (itemList.length > 0) {
        itemList.forEach(it => {
            const sub = parseFloat(it.price) * parseInt(it.qty);
            itemsHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light">
                    <div>
                        <span class="d-block fw-bold text-dark" style="font-size:0.9rem;">${it.name}</span>
                        <span class="text-muted small">${it.qty} x ${formatRupiah(it.price)}</span>
                    </div>
                    <span class="fw-medium text-dark small">${formatRupiah(sub)}</span>
                </div>
            `;
        });
    }

    content.innerHTML = `
        <div class="text-center mb-4">
            <h6 class="fw-bold text-muted text-uppercase mb-1" style="font-size:0.75rem; letter-spacing:1px;">Tagihan Atas Nama</h6>
            <h4 class="fw-bold text-dark" style="font-family: 'Jost', sans-serif;">${o.customers ? o.customers.name : o.customer_name}</h4>
            <span class="badge ${o.status === 'unpaid' ? 'bg-warning text-dark' : (o.status==='packing' ? 'bg-sage-green text-white' : 'bg-success text-white')} rounded-pill mt-1 px-3 py-2 fw-bold">${o.status.toUpperCase()}</span>
        </div>
        
        <div class="bg-light p-3 rounded-4 mb-3 border border-white shadow-sm">
            <span class="small fw-bold text-muted d-block mb-3 border-bottom border-light pb-2"><i class="bi bi-cart4 me-1"></i>Isi Keranjang</span>
            ${itemsHTML}
            
            <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
                <span class="small fw-bold text-muted">Aksi Fee Jastip</span>
                <span class="fw-medium text-dark small">+ ${formatRupiah(o.fee_jastip || 0)}</span>
            </div>
            
            <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-light">
                <span class="small fw-bold text-muted">Logistik & Ongkir</span>
                <span class="fw-medium text-dark small">+ ${formatRupiah(o.shipping_cost || 0)}</span>
            </div>
        </div>
        
        <div class="d-flex justify-content-between align-items-end p-4 rounded-4 text-white shadow-sm" style="background: linear-gradient(135deg, var(--terracotta), #da9c88);">
            <span class="small fw-bold opacity-75 letter-spacing-1">GRAND TOTAL</span>
            <span class="fw-bold fs-3">${formatRupiah(o.total_price)}</span>
        </div>
    `;

    // Menarik Trigger Bootstrap Modal
    const modal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
    modal.show();
};


// 4. GENERATOR TEKS TAGIHAN WA (TEMPLATE PREMIUM V2 - JASTIPIN.SINI STYLE)
window.copyInvoiceText = (btnElement, orderJson) => {
    try {
        const o = JSON.parse(decodeURIComponent(orderJson));
        const custName = o.customers ? o.customers.name : o.customer_name;
        
        let cfg = {};
        try { cfg = JSON.parse(localStorage.getItem('jastip_store_settings')) || {}; } catch(e){}
        
        const storeName = cfg.store_name || "JASTIP STUDIO";
        const storeSlogan = cfg.store_slogan || "Solusi Belanja Tanpa Ribet";
        const bankAcc = cfg.bank_account || "Belum diatur di Pengaturan";
        
        const closingTemplate = cfg.wa_closing || `Silakan mentransfer ke {bank} dan kirim bukti tf-nya kemari ya kak. Terima kasih! ❤️`;
        
        // Generator Nomor Invoice (4 Digit pad + Nama)
        const orderNo = o.order_no || Math.floor(Math.random() * 9000) + 1000;
        const invID = String(orderNo).padStart(4, '0');
        const formattedDate = new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // 1. Bagian Salam Pembuka (Hardcoded agar konsisten cantik)
        let text = `Halo *${custName}* 👋\n`;
        text += `Pesanan kamu sudah kami proses ya!\n\n`;
        
        // 2. Bagian Identitas Toko
        text += `*${storeName.toUpperCase()}*\n`;
        text += `_${storeSlogan}_\n\n`;
        
        // 3. Bagian Detail Invoice (Hanya Nomor Urut 4 Digit)
        text += `*Invoice #${invID}*\n`;
        text += `Tanggal: ${formattedDate}\n\n`;

        text += `*Rincian Pesanan:*\n`;
        const items = o.items || [];
        items.forEach((it) => {
            const sub = it.price * it.qty;
            text += `• ${it.name}  x${it.qty} — ${formatRupiah(sub)}\n`;
        });

        if (o.fee_jastip > 0) text += `• Fee Jastip/Packing — ${formatRupiah(o.fee_jastip)}\n`;
        if (o.shipping_cost > 0) text += `• Ongkos Kirim — ${formatRupiah(o.shipping_cost)}\n`;

        text += `─────────────────────\n`;
        text += `*Total Tagihan: ${formatRupiah(o.total_price)}*\n\n`;

        // 4. Bagian Rekening (Multi)
        text += `🏦 *Transfer ke:*\n`;
        text += `${bankAcc}\n\n`;

        // 5. Bagian Salam Penutup (Dinamis)
        text += closingTemplate.replace('{bank}', bankAcc);

        navigator.clipboard.writeText(text).then(() => {
            const toastEl = document.getElementById('copyToast');
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
        });
    } catch(e) { console.error("Clipboard Error:", e); }
}

// 5. API PERUBAHAN STATUS PUSH-UPDATE SUPABASE
window.updateOrderStatus = async (orderId, targetStatus) => {
    if(confirm(`Yakin memindahkan barisan tiket pesanan ini menuju zona tahap '${targetStatus.toUpperCase()}'?`)){
        const loading = document.getElementById('loadingState');
        loading.classList.remove('d-none');

        const { error } = await window.supabaseClient.from('orders').update({ status: targetStatus }).eq('id', orderId);

        if (error) {
            alert("Operasi kandas: " + error.message);
            loading.classList.add('d-none');
        } else {
            loadKanbanBoards();
        }
    }
}

// 6. MESIN PENGHAPUSAN SUPABASE DARI EKSISTENSI
window.deleteOrder = async (orderId) => {
    if(confirm("AWAS! Apakah Anda 100% yakin untuk melenyapkan riwayat tagihan jastip ini selamanya dari buku besar kasir PWA? Data ini tak bisa kembali!")) {
        const loading = document.getElementById('loadingState');
        loading.classList.remove('d-none');

        const { error } = await window.supabaseClient.from('orders').delete().eq('id', orderId);

        if (error) {
            alert("Sistem Supabase Gagal Memusnahkan Data: " + error.message);
            loading.classList.add('d-none');
        } else {
            loadKanbanBoards(); // Resinkronisasi Paksa Layar Utama Kanban
        }
    }
}
