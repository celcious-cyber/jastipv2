// add-customer.js - Controller Logic Asynchronous Form Pelanggan

document.addEventListener('DOMContentLoaded', async () => {
    // Session Guard Keamanan Mematikan
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '../index.html'; // Usir jika penyusup mem-bypass url
        return;
    }

    const form = document.getElementById('addCustomerForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const formError = document.getElementById('formError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Memanen Variabel String dari DOM Bootstrap
        const custName = document.getElementById('custName').value.trim();
        const custPhone = document.getElementById('custPhone').value.trim();
        const custAddress = document.getElementById('custAddress').value.trim();

        // [1] ALGORITMA CERDAS (Validasi Kekacauan Input Typo)
        if (custName.length < 2) {
            showError("Nama pembeli terlalu pendek atau mencurigakan.");
            return;
        }
        if (custAddress.length < 8) {
            showError("Alamat pengiriman tak mungkin sependek itu. Mohon lengkapi demi presisi kurir.");
            return;
        }

        formError.classList.add('d-none'); // Sembunyikan sinyal lampu merah jika lolos

        // [2] Transisi UI Loading Mode Berputar
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Mengirim ke Awan...';

        // [3] Menyemburkan Payload Ke Jaringan Objek Supabase (API Push)
        const currentStoreId = localStorage.getItem('jastip_store_id');
        
        const { error } = await window.supabaseClient
            .from('customers')
            .insert([
                { 
                    store_id: currentStoreId, // SEGEL: Ikat ke Toko
                    name: custName,
                    phone: custPhone,
                    address: custAddress 
                }
            ]);

        // [4] Pengembalian Tampilan Tombol
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="bi bi-journal-plus me-2"></i> Daftarkan Buku Kontak';

        if (error) {
            // Error Penjaga Supabase (Menganalisis Kode 400 Bad Request Address Column)
            if (error.code === 'PGRST204' || error.message.includes("address")) {
                showError("Gagal Total: Anda belum mengeksekusi kode SQL pembuatan kolom 'address' di Supabase.");
            } else {
                showError("Pusat Data menolak pendaftaran: " + error.message);
            }
            return;
        }

        // [5] Transaksi Lulus - Auto Routing admin Pulang ke Direktori Utama Pelanggan (Contact View)
        window.location.href = 'customers.html';
    });
});

function showError(message) {
    const errorBox = document.getElementById('formError');
    errorBox.classList.remove('d-none');
    errorBox.classList.add('bg-danger', 'text-white');
    errorBox.querySelector('span').textContent = message;
}
