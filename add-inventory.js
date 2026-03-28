// add-inventory.js - Dedicated script for processing the Full Page Form 

document.addEventListener('DOMContentLoaded', async () => {
    // Session Guard Keamanan
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '../index.html'; // Usir jika penyusup mem-bypass url
        return;
    }

    const form = document.getElementById('addInventoryForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const formError = document.getElementById('formError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Pengambilan Variabel Nilai Mentah dari DOM Bootstrap
        const itemName = document.getElementById('itemName').value;
        const itemBrand = document.getElementById('itemBrand').value;
        const itemCategory = document.getElementById('itemCategory').value;
        const itemHpp = document.getElementById('itemHpp').value;
        const itemPrice = document.getElementById('itemPrice').value;
        const itemQty = document.getElementById('itemQty').value;

        // [1] ALGORITMA CERDAS (Pengaman Keuangan Bisnis PWA)
        // Jika Nilai HPP (Harga Modal) melebihi Harga Jual, maka batalkan proses POST dari awal!
        if (parseFloat(itemHpp) > parseFloat(itemPrice)) {
            formError.classList.remove('d-none');
            formError.querySelector('span').textContent = "Peringatan Bisnis: Harga Jual Anda terseting LEBIH RENDAH dari HPP Modal Produksi. Segera koreksi angkanya agar tak merugi!";
            // Kita secara paksa return untuk menggagalkan transaksi insert.
            return;
        } else {
            // Hapus status error jika mereka membenahinya
            formError.classList.add('d-none');
        }

        // [2] Transisi UI Loading Mode
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span> Memproses dan Mengepel Gudang...';

        // [3] Menyemburkan Data Ke Jaringan Objek Supabase (API Push)
        const currentStoreId = localStorage.getItem('jastip_store_id');

        const { error } = await window.supabaseClient
            .from('inventory')
            .insert([
                { 
                    store_id: currentStoreId,
                    item_name: itemName,
                    brand: itemBrand,      
                    hpp: parseFloat(itemHpp), 
                    price: parseFloat(itemPrice), 
                    stock_qty: parseInt(itemQty), 
                    category: itemCategory
                }
            ]);

        // [4] Pengembalian Tampilan Tombol
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-2"></i> Daftarkan ke Gudang';

        if (error) {
            // Error Supabase Handler (Termasuk Kasus 400 Bad Request jika Database Column Typo)
            formError.classList.remove('d-none');
            formError.classList.add('bg-danger', 'text-white');
            formError.querySelector('span').textContent = "Pusat Data menolak pendaftaran: " + error.message + " (Apakah DB Anda sudah cocok nama kolomnya?)";
            return;
        }

        // [5] Proses Selesai - Auto Routing Membawa Admin Pulang ke Daftar List Rak Gudang (Inventory View)
        window.location.href = 'inventory.html';
    });
});
