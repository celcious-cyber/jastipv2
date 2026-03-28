// inventory.js - Arsitektur Operasi CRUD Gudang Jastip Edisi Terbaru (Tanpa Modal)

document.addEventListener('DOMContentLoaded', async () => {
    // Validasi Keamanan Penuh menggunakan Akses yang Diekstraksi Top-Level
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    // Autentikasi ketat, paksa keluar jika tidak punya Session ID
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    // Inisialisasi Fungsi Utama
    loadInventory();
    setupSearch();
});

// Format Angka ke Standar Rupiah tanpa Koma Desimal
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// 1. FUNGSI FETCH: Membaca dan Menyortir Data
async function loadInventory(searchQuery = '') {
    const grid = document.getElementById('inventoryGrid');
    const loading = document.getElementById('loadingState');
    
    grid.innerHTML = '';
    loading.classList.remove('d-none');

    try {
        const currentStoreId = localStorage.getItem('jastip_store_id');
        
        // Build Base Query (Hanya ambil barang milik TOKO ini)
        let query = window.supabaseClient
            .from('inventory')
            .select('*')
            .eq('store_id', currentStoreId) // SEGEL: Filter Toko
            .order('created_at', { ascending: false });

        // Build Search Query Filter Cerdas
        if (searchQuery) {
            query = query.or(`item_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;
        loading.classList.add('d-none');

        if (error) throw error;

        // Render Antarmuka
        if (data && data.length > 0) {
            data.forEach(item => {
                grid.appendChild(createItemCard(item));
            });
        } else {
            // Tampilan Kekosongan (Empty State) Estetik Rustic
            grid.innerHTML = `
                <div class="col-12 text-center py-5 mb-5 fade-in">
                    <i class="bi bi-box-seam-fill text-muted opacity-50" style="font-size: 5rem; color: var(--sand) !important;"></i>
                    <p class="text-muted mt-3 fw-medium fs-5">Katalog kosong atau tidak ditemukan.</p>
                </div>
            `;
        }

    } catch (err) {
        console.error("Gagal memuat inventori", err);
        loading.innerHTML = `<p class="text-danger fw-bold text-center mt-4">Koneksi macet. Coba ulangi kembali.</p>`;
    }
}

// 2. FUNGSI RENDER: Mendesain Struktur UI Kartu PWA
function createItemCard(item) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4 mb-3';
    
    // Status Stok Dinamis: Merah Jika Habis, Sage-Green Jika Ready
    const isOutOfStock = parseInt(item.stock_qty) === 0;
    const badgeColor = isOutOfStock ? 'bg-danger' : 'bg-sage-green';
    const bgColor = isOutOfStock ? '#fff8f6' : '#ffffff';

    // Perhitungan Logika Bisnis: Margin Laba
    const brandName = item.brand || 'No Brand';
    const hppValue = item.hpp || 0;
    const potentialMargin = (item.price || 0) - hppValue;

    col.innerHTML = `
        <div class="card summary-card border-0 p-3 h-100 shadow-sm" style="background-color: ${bgColor}; border-radius: 20px;">
            
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="d-flex flex-wrap gap-2 text-wrap">
                    <span class="badge shadow-sm ${badgeColor} rounded-pill px-3 py-2 fw-medium mb-1">${item.category}</span>
                    <span class="badge shadow-sm bg-white text-dark border border-light rounded-pill px-3 py-2 fw-bold mb-1"><i class="bi bi-tag-fill me-1" style="color:var(--terracotta);"></i>${brandName}</span>
                </div>
                <button class="btn btn-sm btn-light border-0 rounded-circle text-danger shadow-sm flex-shrink-0" onclick="deleteItem('${item.id}')" title="Hapus Barang" style="width: 32px; height: 32px; display:flex; align-items:center; justify-content:center;">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>
            
            <h5 class="fw-bold text-dark mt-3 mb-1 text-wrap" style="font-family: 'Jost', sans-serif;; overflow:hidden; text-overflow:ellipsis;">${item.item_name}</h5>
            
            <!-- Margin Block Analytics -->
            <div class="mt-3 py-2 px-3 rounded-4 shadow-sm" style="background-color: #f7f9f8; border-left: 4px solid var(--sage-green);">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="small d-block text-muted fw-bold">Potensi Cuan (Margin)</span>
                    <span class="fs-6 fw-bold text-success">${formatRupiah(potentialMargin)}</span>
                </div>
                <div class="d-flex justify-content-between mt-1 pt-1 border-top border-light">
                    <span class="small text-muted" style="font-size: 0.70rem;">HPP</span>
                    <span class="small text-muted fw-bold" style="font-size: 0.75rem;">${formatRupiah(hppValue)}</span>
                </div>
            </div>
            
            <div class="d-flex justify-content-between align-items-end mt-4">
                <div>
                    <p class="text-muted small mb-0 fw-bold">Harga Jual</p>
                    <span class="fw-bold fs-5 text-terracotta">${formatRupiah(item.price)}</span>
                </div>
                <div class="text-end">
                    <p class="text-muted small mb-0 fw-bold">Sisa Stok</p>
                    <span class="fw-bold fs-3 ${isOutOfStock ? 'text-danger' : 'text-dark'}">${item.stock_qty} <span class="fs-6 fw-normal text-muted">pcs</span></span>
                </div>
            </div>

        </div>
    `;
    return col;
}

// 4. FUNGSI DELETE (Hapus Komponen Memori via Supabase)
window.deleteItem = async (id) => {
    // Gunakan konfirmasi primitif ringan untuk cegah klik tak sengaja di layar HP
    if (confirm("Gudang: Apakah Anda 100% yakin ingin membuang barang ini seketika secara permanen?")) {
        const { error } = await window.supabaseClient
            .from('inventory')
            .delete()
            .eq('id', id);
            
        if (error) {
            alert("Sistem mengunci hapusan: " + error.message);
        } else {
            // Berhasil menghapus, refresh DOM seketika
            loadInventory(); 
        }
    }
}

// 5. FUNGSI SEARCH (Debounce Polisher & Kecepatan Input Realtime)
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    let debounceTimer;

    // Trigger setiap pengguna mengetik alfabet
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        // Delay 300 milidetik agar tidak menguras Limit API Supabase
        debounceTimer = setTimeout(() => {
            loadInventory(e.target.value);
        }, 300); 
    });
}
