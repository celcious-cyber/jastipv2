// settings.js - Mesin Pengendali Modul Identitas Global (Warna Tema & Templat Pesan Bawah WA)

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const loading = document.getElementById('loadingState');
    const formContainer = document.getElementById('settingsForm');
    
    // Objek Elemen-Elemen Kendali Form
    const storeName = document.getElementById('storeName');
    const storeSlogan = document.getElementById('storeSlogan');
    const bankAcc = document.getElementById('bankAcc');
    const contactPhone = document.getElementById('contactPhone');
    const waGreeting = document.getElementById('waGreeting');
    const waClosing = document.getElementById('waClosing');
    const themePrimary = document.getElementById('themePrimary');
    const themeSecondary = document.getElementById('themeSecondary');

    // Tangkap wujud ID asli dari struktur masa lalu Anda (UUID / Int) agar tidak bentrokan Relasi Foreign Key
    // Ambil ID Toko dari LocalStorage yang sudah diset oleh app.js (Sangat penting untuk Multi-tenancy)
    let primarySettingsId = localStorage.getItem('jastip_store_id') || 1;

    // 1. Tarik Bukti Data Pengaturan Masa Lampau
    try {
        const { data, error } = await window.supabaseClient.from('store_settings').select('*').eq('id', primarySettingsId).maybeSingle();
        if(data) {
            primarySettingsId = data.id; 
            storeName.value = data.store_name || '';
            storeSlogan.value = data.store_slogan || '';
            bankAcc.value = data.bank_account || '';
            contactPhone.value = data.phone_number || '';
            waGreeting.value = data.wa_greeting || '';
            waClosing.value = data.wa_closing || '';
            
            if(data.theme_color_primary) themePrimary.value = data.theme_color_primary;
            if(data.theme_color_secondary) themeSecondary.value = data.theme_color_secondary;

            // Soroti Tumpukan Palet Tema sesuai Identitas Server Server
            document.querySelectorAll('.theme-card').forEach(tc => tc.classList.remove('active'));
            if(data.theme_color_primary === '#e8a0bf') document.getElementById('theme-pink')?.classList.add('active');
            else if(data.theme_color_primary === '#d4915e') document.getElementById('theme-sunset')?.classList.add('active');
            else if(data.theme_color_primary === '#4a90d9') document.getElementById('theme-ocean')?.classList.add('active');
            else if(data.theme_color_primary === '#9b7ec8') document.getElementById('theme-lavender')?.classList.add('active');
        }
    } catch(e) { console.log('Suntikan pengaturan kosong ditarik.'); }

    loading.classList.add('d-none');
    formContainer.classList.remove('d-none');

    // 2. Skrip Fungsional Untuk Kotak Pemilihan Palet Ajaib
    window.selectTheme = (element, pColor, sColor) => {
        // Hapuskan ikatan highlight kartu yang lama
        document.querySelectorAll('.theme-card').forEach(tc => tc.classList.remove('active'));
        // Tegaskan cahaya ke kartu yang baru diklik
        element.classList.add('active');
        
        // Simpan Memori Kebutuhan Database
        themePrimary.value = pColor;
        themeSecondary.value = sColor;
        
        // Pratilik Langsung Layar Global (Live Preview) Tanpa Menyimpan!
        document.documentElement.style.setProperty('--terracotta', pColor);
        document.documentElement.style.setProperty('--sage-green', sColor);
    };

    // 3. API Push Modifikasi Pengaturan ke Server Pusat
    formContainer.addEventListener('submit', async(e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        const errormsg = document.getElementById('formError');
        btn.disabled = true; btn.innerHTML = '<span class="spinner-grow spinner-grow-sm me-2"></span> Menerapkan...'; errormsg.classList.add('d-none');

        // [PENGAMAN]: Pastikan ID adalah angka yang valid untuk database Integer
        let finalId = parseInt(primarySettingsId);
        if (isNaN(finalId)) finalId = 1; // Paksa ke ID 1 jika terdeteksi NaN (Bocor Multi-tenant)

        const payload = {
            id: finalId,
            store_name: storeName.value,
            store_slogan: storeSlogan.value,
            theme_color_primary: themePrimary.value,
            theme_color_secondary: themeSecondary.value,
            bank_account: bankAcc.value,
            phone_number: contactPhone.value,
            wa_greeting: waGreeting.value,
            wa_closing: waClosing.value
        };

        // Gunakan UPDATE (bukan upsert) karena baris toko sudah pasti ada sejak pendaftaran
        const { id, ...updatePayload } = payload; // Pisahkan 'id' dari data yang akan di-update
        const { error } = await window.supabaseClient.from('store_settings').update(updatePayload).eq('id', finalId);

        if (error) {
            btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-2"></i> Terapkan Tema & Simpan Pengaturan';
            
            // Jaring tangkap error spesifik Tabel Baru
            if(error.message.includes("does not exist")) {
                errormsg.classList.remove('d-none'); 
                errormsg.querySelector('span').textContent = "Peringatan Darurat: Server menolak karena Anda belom meng-Copas SQL Skema Tabel store_settings di Supabase!";
            } else {
                errormsg.classList.remove('d-none'); 
                errormsg.querySelector('span').textContent = "Gangguan Lontaran API: " + error.message;
            }
        } else {
            // Mendorong Ulang Sinkronisasi Paksa PWA LocalStorage Supaya Tema Tak Berganti ke Bawaan
            localStorage.setItem('jastip_store_settings', JSON.stringify(payload));
            window.applyJastipGlobalSettings(payload);
            
            btn.innerHTML = 'Mahakarya Tersimpan!';
            btn.classList.add("bg-success");
            btn.classList.remove("btn-dark");
            
            setTimeout(() => { 
                btn.disabled = false; 
                btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-2"></i> Terapkan & Simpan PWA';
                btn.classList.replace("bg-success", "btn-dark");
            }, 2000);
        }
    });
});
