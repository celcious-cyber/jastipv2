// Full-Stack App Logic with Javascript & Supabase API

let currentUserRole = 'admin'; 
let currentStoreId = null; // Menyimpan ID Toko tempat user bekerja
let isPremium = true; 
const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';

// Fungsi Format Rupiah Indonesia
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// 1. Eksekusi Inisialisasi Utama saat Dashboard Diload
document.addEventListener('DOMContentLoaded', async () => {
    const isLogin = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
    
    if (isLogin) {
        // jika di halaman index.html, stop agar tidak bentrok,
        return; 
    }

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session && session.user) {
            // Tarik Profile Toko, Hak Akses Akun
            await fetchUserSettings(session.user);
            // Tarik Ringkasan Penjualan
            await fetchDashboardData();
            // Langganan Perubahan Realtime
            setupRealtime();
        } else {
            console.warn("User Session NULL di app.js. Dialihkan ke login.");
            window.location.href = 'index.html';
        }
    } catch (e) {
        console.error("Error App Initialization:", e);
    }
});

// 2. Fetch Pengaturan Toko & Role User (Sistem RBAC)
async function fetchUserSettings(user) {
    try {
        // Fallback UI Username ke alamat Email
        const userNameText = document.getElementById('userNameText');
        if (userNameText) userNameText.innerText = user.email.split('@')[0];

        // 1. MENGAMBIL ROLE & STORE_ID
        const { data: userData, error: userError } = await window.supabaseClient
            .from('store_users')
            .select('role, store_id')
            .eq('user_id', user.id)
            .maybeSingle();
            
        if (!userError && userData) {
            currentUserRole = userData.role;
            currentStoreId = userData.store_id || 1;
            localStorage.setItem('jastip_user_role', currentUserRole);
            localStorage.setItem('jastip_store_id', currentStoreId);
        } else {
            // AUTO-PROVISIONING: User masuk tapi belum punya toko → buatkan!
            console.log("Auto-provisioning: Membuat toko untuk user baru...");
            
            const { data: newStore } = await window.supabaseClient
                .from('store_settings')
                .insert([{ store_name: 'Jastip ' + (user.email?.split('@')[0] || 'Studio'), is_premium: true }])
                .select('id')
                .single();

            if (newStore) {
                await window.supabaseClient.from('store_users').insert([{
                    user_id: user.id,
                    store_id: newStore.id,
                    role: 'admin',
                    status: 'active',
                    email: user.email
                }]);
                currentStoreId = newStore.id;
                currentUserRole = 'admin';
                localStorage.setItem('jastip_store_id', newStore.id);
                localStorage.setItem('jastip_user_role', 'admin');
                console.log("Toko otomatis dibuat! ID:", newStore.id);
            } else {
                currentStoreId = 1;
                localStorage.setItem('jastip_store_id', 1);
            }
        }

        // 2. MENGAMBIL PREMIUM STATUS & STORE NAME (Berdasarkan store_id user)
        if (currentStoreId) {
            const { data: storeData, error: storeError } = await window.supabaseClient
                .from('store_settings')
                .select('store_name, is_premium')
                .eq('id', currentStoreId)
                .maybeSingle();
                
            if (!storeError && storeData) {
                isPremium = storeData.is_premium;
                const snText = document.getElementById('storeNameText');
                if (snText) snText.innerText = storeData.store_name || "Jastip Studio";
            }
        }

    } catch (e) {
        console.log("Supabase Tables might not exist entirely. Proceeding rendering base UI.", e);
    } finally {
        applyRoleAndPremiumUI();
    }
}

// 3. Terapkan Pembatasan UI sesuai DB State
function applyRoleAndPremiumUI() {
    const path = window.location.pathname;
    
    // [A] URL GUARD: Tendang Karyawan dari halaman terlarang
    const adminOnlyPages = ['staff.html', 'reports.html', 'settings.html'];
    const isRestrictedPage = adminOnlyPages.some(p => path.includes(p));

    if (currentUserRole === 'staff' && isRestrictedPage) {
        alert("Akses Ditolak: Halaman ini hanya untuk Pemilik Toko (Admin).");
        window.location.href = isLoginPage ? 'index.html' : '../dashboard.html';
        return;
    }

    // [B] UI HIDING: Sembunyi permanen elemen Admin
    if (currentUserRole === 'staff') {
        const adminElements = document.querySelectorAll('.action-staff, .nav-settings, .action-report');
        adminElements.forEach(el => {
            el.remove(); // Hapus permanen dari DOM agar tidak bisa di-inspect 'display:block'
        });
    }

    // [C] PREMIUM Check: Gembok Modul Live Event & Laporan (Grayscale Mode)
    if (!isPremium) {
        const proBtns = document.querySelectorAll('.pro-feature');
        proBtns.forEach(btn => {
            btn.classList.add('pro-locked');
            btn.onclick = (e) => {
                e.preventDefault();
                showProModal();
            };
        });

        // Kunci Navigasi Bawah
        const navLive = document.getElementById('navLiveEvent');
        if (navLive) {
            navLive.classList.add('pro-locked-nav');
            navLive.onclick = (e) => {
                e.preventDefault();
                showProModal();
            }
        }
    }
}

function showProModal() {
    if(typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(document.getElementById('proModal'));
        modal.show();
    }
}

// 4. Engine Penghitung: Fetch Dashboard Summary dari Database Supabase
async function fetchDashboardData() {
    try {
        // [1] Total Pendapatan (Hanya milik TOKO ini & Status 'completed')
        const { data: revenueData } = await window.supabaseClient
            .from('orders')
            .select('total_price')
            .eq('store_id', currentStoreId) // SEGEL
            .eq('status', 'completed');
            
        const totalRevenue = revenueData ? revenueData.reduce((acc, curr) => acc + (curr.total_price || 0), 0) : 0;
        const revEl = document.getElementById('totalRevenue');
        if (revEl) revEl.innerText = formatRupiah(totalRevenue);

        // [2] Pesanan Sedang Dikemas (Hanya milik TOKO ini)
        const { count: packingCount } = await window.supabaseClient
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', currentStoreId) // SEGEL
            .eq('status', 'packing');
            
        const ordEl = document.getElementById('activeOrders');
        if(ordEl) ordEl.innerText = packingCount || 0;

        // [3] Total Stok Inventori (Hanya milik TOKO ini)
        const { count: inventoryCount } = await window.supabaseClient
            .from('inventory')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', currentStoreId); // SEGEL
            
        const invEl = document.getElementById('totalInventory');
        if(invEl) invEl.innerText = inventoryCount || 0;

        // [4] Total Pelanggan Aktif (Hanya milik TOKO ini)
        const { count: customersCount } = await window.supabaseClient
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', currentStoreId); // SEGEL
            
        const cusEl = document.getElementById('totalCustomers');
        if(cusEl) cusEl.innerText = customersCount || 0;

    } catch (e) {
        console.error("Dashboard calculation failed or missing tables in DB", e);
    }
}

// 5. Arsitektur Realtime: Supabase Websockets Connection
function setupRealtime() {
    window.supabaseClient
        .channel('dashboard-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            console.log('Realtime Triggered: Data Pesanan Update otomatis!', payload);
            fetchDashboardData(); 
            // Setiap ada pesanan dikemas / selesai, angka di layar Anda akan berganti sendiri.
        })
        .subscribe();
}
