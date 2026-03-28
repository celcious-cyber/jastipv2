// add-order.js - Masterpiece Order Calculator Engine PWA (Edisi Relasi Inventori & Ongkir)

// Format Angka ke Standar Rupiah tanpa Koma Desimal
const formatRp = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const selectCustomer = document.getElementById('selectCustomer');
    const itemsContainer = document.getElementById('dynamicItemsContainer');
    const btnAddItemRow = document.getElementById('btnAddItemRow');
    const inputFeeJastip = document.getElementById('inputFeeJastip');
    const inputShippingCost = document.getElementById('inputShippingCost'); // Kolom Tangkapan Ongkir Baru
    const form = document.getElementById('addOrderForm');
    
    // VARIABEL GLOBAL PEYIMPAN CACHE INVENTORI (Supaya dropdrown instan dan tak narik API berulang kali)
    let globalInventoryData = [];

    // 1. ASINKRON FETCH DATA GANDA (Pelanggan & Inventori)
    async function loadInitialData() {
        try {
            const currentStoreId = localStorage.getItem('jastip_store_id');

            // Fetch Pelanggan (Hanya yang milik TOKO ini)
            const { data: custData, error: custErr } = await window.supabaseClient.from('customers').select('id, name').eq('store_id', currentStoreId);
            if (custErr) throw custErr;
            selectCustomer.innerHTML = '<option value="">-- Sentuh dan Pilih Nama Pembeli --</option>';
            custData.forEach(cust => {
                const opt = document.createElement('option');
                opt.value = cust.id;
                opt.textContent = cust.name;
                selectCustomer.appendChild(opt);
            });

            // Fetch Inventori (Hanya yang milik TOKO ini)
            const { data: invData, error: invErr } = await window.supabaseClient
                .from('inventory')
                .select('id, item_name, price, hpp, stock_qty')
                .eq('store_id', currentStoreId)
                .gt('stock_qty', 0);
            if (invErr) throw invErr;
            globalInventoryData = invData; // Simpan di cache lokal otak browser js

            // Cetak Kerangka Baris Pertama Setelah Inventori Terisi
            createItemRow();

        } catch(e) {
            selectCustomer.innerHTML = '<option value="">(Error API TibaTiba) Parameter Gagal Dimuat.</option>';
            alert("Sistem Kehilangan Daya Penuh: " + e.message);
        }
    }
    loadInitialData();

    // 2. SISTEM BARIS ITEM DINAMIS (Event Delegation DOM & Inventory Pulling)
    let itemCount = 0; 

    function createItemRow() {
        itemCount++;
        const row = document.createElement('div');
        row.className = 'item-row bg-light rounded-3 p-3 position-relative';
        row.id = `item-row-${itemCount}`;
        
        // Membangun Tumpukan Opsi Dropdown Berupa Katalog Array Inventori
        let itemOptions = '<option value="">Pilih Koleksi Barang Gudang...</option>';
        globalInventoryData.forEach(inv => {
            // Tampilkan Sisa Stok sebagai Navigasi Halus
            itemOptions += `<option value="${inv.item_name}" data-hpp="${inv.hpp || 0}" data-price="${inv.price}" data-id="${inv.id}">[Sisa ${inv.stock_qty}] - ${inv.item_name}</option>`;
        });

        row.innerHTML = `
            <button type="button" class="btn btn-sm btn-danger rounded-circle position-absolute border-0 shadow-sm" onclick="removeItemRow('${row.id}')" title="Buang Item" style="top: -10px; right: -10px; width:28px; height:28px;">
                <i class="bi bi-x"></i>
            </button>
            <div class="row g-2 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="small fw-bold text-muted mb-1">Pilih Barang Titipan Asal Gudang</label>
                    <select class="form-select border-0 item-dyn-name bg-white shadow-sm fw-medium" required>
                        ${itemOptions}
                    </select>
                </div>
                <div class="col-7 col-md-4">
                    <label class="small fw-bold text-muted mb-1">Harga Otomatis Jual Satuan</label>
                    <div class="input-group shadow-sm border-0 rounded-2">
                        <span class="input-group-text border-0 bg-white fw-bold">Rp</span>
                        <!-- Mengunci Harga Sementara (Readonly tapi dibiarkan terbuka jika admin Jastip ingin negosiasi diskon) -->
                        <input type="number" class="form-control border-0 item-dyn-price bg-white fw-bold" min="0" required placeholder="0">
                    </div>
                </div>
                <div class="col-5 col-md-3">
                    <label class="small fw-bold text-muted mb-1">Qty Tagih</label>
                    <input type="number" class="form-control border-0 item-dyn-qty bg-white shadow-sm fw-bold" value="1" min="1" required>
                </div>
            </div>
        `;
        
        itemsContainer.appendChild(row);
        
        // IKAT TALI SENSOR KECERDASAN 
        const newSelect = row.querySelector('.item-dyn-name');
        const priceTarget = row.querySelector('.item-dyn-price');
        
        // Sensor Pemilih (Jika Dropdown berubah, tembak Harga Baru berdasarkan Data Atribut yang Disembunyikan)
        newSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const realPrice = selectedOption.getAttribute('data-price');
            
            if(realPrice) { 
                priceTarget.value = realPrice; 
                calculateGrandTotal(); // Panggil paksa mesin math saat berubah
            } else {
                priceTarget.value = '';
            }
        });

        bindRealtimeCalculators(); // Ikat kembali ke Kalkulator Grand Total
    }
    
    // Tombol Injeksi Penambah Lapis Baris Baru
    btnAddItemRow.addEventListener('click', () => { createItemRow(); });
    
    // Mesin Eksekutor Pemenggal Komponen Row
    window.removeItemRow = (rowId) => {
        const row = document.getElementById(rowId);
        if (row && itemsContainer.children.length > 1) {
            row.remove();
            calculateGrandTotal(); 
        } else {
            alert('Akurat Tolak: Tagihan Jastip PWA minimal dituntut menahan 1 baris item produk murni agar legal.');
        }
    };

    // 3. MESIN DOM MATHEMATICS (Kalkulator Finansial Termasuk Ongkir)
    function calculateGrandTotal() {
        let totalItemsPrice = 0;
        const prices = document.querySelectorAll('.item-dyn-price');
        const qtys = document.querySelectorAll('.item-dyn-qty');
        
        for (let i = 0; i < prices.length; i++) {
            const p = parseFloat(prices[i].value) || 0;
            const q = parseInt(qtys[i].value) || 0;
            totalItemsPrice += (p * q);
        }

        const fee = parseFloat(inputFeeJastip.value) || 0;
        const shipping = parseFloat(inputShippingCost.value) || 0; // Membaca kolom ke-3

        // Cuan Rumus Total
        const grandTotal = totalItemsPrice + fee + shipping;

        document.getElementById('grandTotalDisplay').innerText = formatRp(grandTotal);
        return grandTotal;
    }

    function bindRealtimeCalculators() {
        const triggers = itemsContainer.querySelectorAll('.item-dyn-price, .item-dyn-qty');
        triggers.forEach(input => {
            input.removeEventListener('input', calculateGrandTotal); 
            input.addEventListener('input', calculateGrandTotal);
        });
    }
    
    // Pantau Fee dan Ongkir yang mungkin ditimpa jari admin 
    inputFeeJastip.addEventListener('input', calculateGrandTotal);
    inputShippingCost.addEventListener('input', calculateGrandTotal);

    // 4. API PENERBIT NOTA DAN PEMOTONGAN STOK OTOMATIS (ADVANCED DOMAIN)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formError = document.getElementById('formError');
        
        const custId = selectCustomer.value;
        if (!custId) {
            formError.classList.remove('d-none');
            formError.querySelector('span').textContent = "Identitas Pelanggan masih kosong (Pilih dulu lewat Dropdown!)";
            return;
        }

        // Tumpulkan Mesin Panen Keranjang Array
        let finalItemsPayload = [];
        const selectNode = document.querySelectorAll('.item-dyn-name'); // Ini Dropdown Selectnya
        const priceNode = document.querySelectorAll('.item-dyn-price');
        const qtyNode = document.querySelectorAll('.item-dyn-qty');

        for (let i = 0; i < selectNode.length; i++) {
            const itemNameText = selectNode[i].value;
            // Dapatkan Data ID Barangnya Untuk Motong Stok Sebentar Lagi
            const ItemIdFromGudang = selectNode[i].options[selectNode[i].selectedIndex].getAttribute('data-id');

            if (!itemNameText || itemNameText === "") {
                formError.classList.remove('d-none'); formError.querySelector('span').textContent = "Peringatan: Pastikan seluruh kotak rincian barang telah terisi nama/pilihannya.";
                return;
            }
            
            finalItemsPayload.push({
                product_id: ItemIdFromGudang, // Titip ID internal untuk potong stok
                name: itemNameText,
                price: parseFloat(priceNode[i].value) || 0,
                hpp: parseFloat(selectNode[i].options[selectNode[i].selectedIndex].getAttribute('data-hpp')) || 0,
                qty: parseInt(qtyNode[i].value) || 1
            });
        }

        const exactFinalPrice = calculateGrandTotal();
        const pureJastipFee = parseFloat(inputFeeJastip.value) || 0;
        const pureShipping = parseFloat(inputShippingCost.value) || 0;

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span> Mencetak Struk & Membakar Stok Awan...';

        // LONTARKAN KE DATABASE (Langkah 1: Catat Pesanan)
        const currentStoreId = localStorage.getItem('jastip_store_id');
        const { error: orderError } = await window.supabaseClient
            .from('orders')
            .insert([
                { 
                    store_id: currentStoreId,
                    customer_id: custId,
                    items: finalItemsPayload,    
                    fee_jastip: pureJastipFee,   
                    shipping_cost: pureShipping, // Kolom SQL Transparansi Ongkir 
                    total_price: exactFinalPrice,
                    status: 'unpaid'             
                }
            ]);

        if (orderError) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="bi bi-send-check-fill me-2"></i> Eksekusi & Cetak Tagihan';
            
            if (orderError.message.includes("shipping_cost")) {
                formError.classList.remove('d-none');
                formError.querySelector('span').textContent = "Ledakan Database: Master Admin Anda belum membuat/ALTER SQL pembuatan Kolom 'shipping_cost' bertipe Numeric di Supabase Table 'Orders'.";
            } else {
                formError.classList.remove('d-none');
                formError.querySelector('span').textContent = "Pusat Menolak: " + orderError.message;
            }
            return;
        }

        // LONTARKAN PENGURANGAN STOK GUDANG (Langkah 2: Minus Qty)
        for (const dibeli of finalItemsPayload) {
            // Tarik baris barang ini dari Supabase pakai ID rahasia tadi
            const { data: produkEksis } = await window.supabaseClient.from('inventory').select('stock_qty').eq('id', dibeli.product_id).single();
            if(produkEksis) {
                // Potong Qty-nya secara Matematik Murni
                const sisaBaru = produkEksis.stock_qty - dibeli.qty;
                // Ubah Baris di Database tersebut sesuai yang terbaru
                await window.supabaseClient.from('inventory').update({ stock_qty: sisaBaru < 0 ? 0 : sisaBaru }).eq('id', dibeli.product_id);
            }
        }

        // Semuanya lulus secara Ilahi, bawa admin kembali berselancar..
        window.location.href = 'orders.html';
    });
});
