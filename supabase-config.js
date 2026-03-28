const SUPABASE_URL = 'https://tnpblnxqakljbgiofgze.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucGJsbnhxYWtsamJnaW9mZ3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTY2NzcsImV4cCI6MjA5MDI3MjY3N30.1IrQTdgEJ1FGvzn_cTwcstoAPaYRQrMXgQvSFYY1DJA';

// Inisialisasi client Supabase dengan menyimpannya ke objek window 
// agar tidak terjadi konflik alias (shadowing) dengan objek library CDN utama 'window.supabase'.
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client initialized');

// ============================================
// MESIN INJEKSI TEMA IDENTITAS GLOBAL (PWA SETTINGS)
// ============================================
window.applyJastipGlobalSettings = (config) => {
    if(!config) return;
    
    // 1. Suntik Warna Skema CSS Secara Live Tanpa Refresh
    if(config.theme_color_primary) document.documentElement.style.setProperty('--terracotta', config.theme_color_primary);
    if(config.theme_color_secondary) document.documentElement.style.setProperty('--sage-green', config.theme_color_secondary);
    
    // 2. Timpa Teks Nama & Slogan Toko jika elemennya bersandi 'global-store-*' hadir di layar
    document.querySelectorAll('.global-store-name').forEach(el => el.textContent = config.store_name);
    document.querySelectorAll('.global-store-slogan').forEach(el => el.textContent = config.store_slogan);
};

// Tahap 1: Cegah Flash Putih (Ambil dari Cache Lokal seketika Browser merender HTML)
try {
    const localStoreCache = localStorage.getItem('jastip_store_settings');
    if(localStoreCache) window.applyJastipGlobalSettings(JSON.parse(localStoreCache));
} catch(e) {}

// Tahap 2: Sinkronisasi Latar Belakang (Ambil Cepat dari Server jika Kasir sedang Online)
window.syncGlobalSettings = async () => {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;

        // 1. Ambil ID Toko dari LocalStorage dulu (Prioritas Tinggi)
        let storeId = localStorage.getItem('jastip_store_id');
        
        if (!storeId) {
            // Jika tidak ada di lokal, baru tanya ke database
            const { data: userRole } = await window.supabaseClient.from('store_users').select('store_id').eq('user_id', session.user.id).maybeSingle();
            if (userRole) {
                storeId = userRole.store_id;
                localStorage.setItem('jastip_store_id', storeId);
            } else {
                storeId = 1; // Fallback Terakhir
            }
        }

        // 2. Tarik Pengaturan Terbaru (Warna, Nama, Slogan)
        const { data, error } = await window.supabaseClient.from('store_settings').select('*').eq('id', storeId).maybeSingle();
        
        if (data && !error) {
            localStorage.setItem('jastip_store_settings', JSON.stringify(data));
            window.applyJastipGlobalSettings(data);
        }
    } catch(e) {
        console.error("Gagal sinkronisasi tema:", e);
    }
};

// Trigger penarikan konfigurasi seketika objek window tercipta
window.syncGlobalSettings();
