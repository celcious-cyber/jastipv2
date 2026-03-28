// customers.js - Arsitektur Operasional Direktori Pelanggan

document.addEventListener('DOMContentLoaded', async () => {
    // Validasi Keamanan Lapis Pertama
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    // Giring pelaku tanpa kredensial ke gerbang login
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    // Inisialisasi Tampilan Penuh
    loadCustomers();
    setupSearch();
});

// 1. FUNGSI FETCH: Membaca dan Menyortir Buku Kontak Supabase
async function loadCustomers(searchQuery = '') {
    const grid = document.getElementById('customerGrid');
    const loading = document.getElementById('loadingState');
    
    // Sembunyikan dan munculkan loader di tiap pergantian
    grid.innerHTML = '';
    loading.classList.remove('d-none');

    try {
        const currentStoreId = localStorage.getItem('jastip_store_id');
        
        // Build Base Query (Hanya Pelanggan milik Toko ini)
        let query = window.supabaseClient
            .from('customers')
            .select('*')
            .eq('store_id', currentStoreId) // SEGEL
            .order('created_at', { ascending: false });

        // Filter Ganda (Bisa nyari nama ataupun letak kotanya/alamatnya)
        if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;
        loading.classList.add('d-none'); // Membunuh sinyal loading

        // Jika Database Error 400 (kemungkinan mereka belum meng-ALTER Address), tangkap dan tampilkan dengan anggun
        if (error) throw error;

        // Mesin Cetak UI
        if (data && data.length > 0) {
            data.forEach(user => {
                grid.appendChild(createCustomerCard(user));
            });
        } else {
            // Tampilan "Mati/Kosong" Khusus Pelanggan Tipe Rustic
            grid.innerHTML = `
                <div class="col-12 text-center py-5 mb-5 fade-in">
                    <i class="bi bi-people-fill text-muted opacity-50" style="font-size: 5rem; color: #eedbd5 !important;"></i>
                    <p class="text-muted mt-3 fw-medium fs-5">Buku kontak kosong. Silakan buka jaringan bisnis Anda.</p>
                </div>
            `;
        }

    } catch (err) {
        console.error("Gagal memuat kontak Pelanggan:", err);
        loading.innerHTML = `<p class="text-danger fw-bold text-center mt-4">Koneksi database terputus. Pastikan Anda sudah menge-RUN kode 'address' di SQL editor.</p>`;
    }
}

// 2. FUNGSI RENDER: Mendesain Kartu Identitas Digital PWA
function createCustomerCard(customer) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4 mb-3';
    
    // Ekstraksi Logika: Mengamankan Nomor Kosong & Membuat Format API WA
    const phoneNumber = customer.phone || 'Tak Ada Nomor';
    const addressBlock = customer.address || 'Alamat tidak diatur.';
    
    // Pembersih Nomor WA Indonesia (Ubah 0 jadi 62)
    let waLink = "#";
    let btnStyle = "btn-secondary opacity-50"; 
    
    if (customer.phone) {
        let cleanPhone = customer.phone.replace(/\\D/g, ''); // Buang spasi, strip, kurung
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('8')) {
            cleanPhone = '62' + cleanPhone;
        }
        waLink = `https://wa.me/${cleanPhone}`;
        btnStyle = "btn-success border-0 shadow-sm"; // Jadikan Tombol WA Hidup Berwarna
    }

    col.innerHTML = `
        <div class="card summary-card border-0 p-4 h-100 shadow-sm" style="background-color: #ffffff; border-radius: 20px;">
            
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex align-items-center gap-3">
                    <!-- Bingkai Avatar Inisial Elegan -->
                    <div class="rounded-circle d-flex justify-content-center align-items-center text-white shadow-sm" style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--terracotta), #da9c88);">
                        <i class="bi bi-person-fill fs-3"></i>
                    </div>
                    <div>
                        <h5 class="fw-bold text-dark m-0 text-wrap" style="font-family: 'Jost', sans-serif;">${customer.name}</h5>
                        <span class="small text-muted fw-medium font-monospace">${phoneNumber}</span>
                    </div>
                </div>
                <!-- Action Drop (Delete Icon kecil tersembunyi manis di pojok atas) -->
                <button class="btn btn-sm btn-light border-0 rounded-circle text-danger flex-shrink-0" onclick="deleteCustomer('${customer.id}')" title="Buang Kontak Pembeli" style="width: 32px; height: 32px; display:flex; align-items:center; justify-content:center;">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            
            <!-- Address Panel -->
            <div class="mt-3 py-3 px-3 rounded-4 shadow-sm" style="background-color: #fcf8f6; border-left: 4px solid var(--terracotta);">
                <div class="d-flex align-items-start">
                    <i class="bi bi-geo-alt-fill me-2 mt-1" style="color:var(--terracotta); font-size: 0.85rem;"></i>
                    <span class="small text-dark fw-medium" style="line-height: 1.4;">${addressBlock}</span>
                </div>
            </div>
            
            <!-- Quick WA Chat Bar (Keinginan Besar PWA Jastip Modern) -->
            <div class="mt-4 pt-1">
                <a href="${waLink}" target="_blank" class="btn ${btnStyle} w-100 rounded-pill py-2 fw-bold text-white transition-all d-flex justify-content-center align-items-center">
                    <i class="bi bi-whatsapp me-2 fs-5"></i> Sapa via WhatsApp
                </a>
            </div>

        </div>
    `;
    return col;
}

// 4. FUNGSI DELETE (Menghancurkan Baris Kontak Supabase)
window.deleteCustomer = async (id) => {
    // Validasi Sentuh Manusia
    if (confirm("Direktori: Anda teramat yakin ingin menghapur profil pelanggan ini? Seluruh data kontaknya tak bisa ditarik kembali.")) {
        const { error } = await window.supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);
            
        if (error) {
            alert("Sistem mengunci hapusan: " + error.message);
        } else {
            // Sukses. Runtuhkan layar memori lama, dan gambar ulang data seketika (DOM Refresh Realtime)
            loadCustomers(); 
        }
    }
}

// 5. FUNGSI SEARCH (Mesin Ketik Interaktif Realtime Auto-Debouncer)
function setupSearch() {
    const searchInput = document.getElementById('searchCustomer');
    let debounceTimer;

    // Baca getaran pengetikan alfabet
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        // Tembak Server sesudah setengah detik agar tak spam batas kuota API Gratisan milik PWA anda.
        debounceTimer = setTimeout(() => {
            loadCustomers(e.target.value);
        }, 300); 
    });
}
