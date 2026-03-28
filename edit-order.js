// edit-order.js - Otak Operasional Replikator Transaksi Masa Lalu

const formatRp = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// Pengunci ID Transaksi Spesifik via URL (https://.../edit-order.html?id=xxx)
const targetOrderId = new URLSearchParams(window.location.search).get('id');

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    if (!session || !targetOrderId) { 
        alert("Akses PWA Ditolak: Kredensial Rapuh atau ID Tagihan Hilang!");
        window.location.href = 'orders.html'; 
        return; 
    }

    const selectCustomer = document.getElementById('selectCustomer');
    const itemsContainer = document.getElementById('dynamicItemsContainer');
    const btnAddItemRow = document.getElementById('btnAddItemRow');
    const inputFeeJastip = document.getElementById('inputFeeJastip');
    const inputShippingCost = document.getElementById('inputShippingCost');
    const form = document.getElementById('editOrderForm');
    
    let globalInventoryData = [];

    // 1. MESIN WAKTU (Pre-Populate API Menarik Masa Lalu)
    async function loadTimeMachine() {
        try {
            const currentStoreId = localStorage.getItem('jastip_store_id');

            // A. Mengundang Kontak Pelanggan (Milik Toko ini)
            const { data: custData, error: custErr } = await window.supabaseClient.from('customers').select('id, name').eq('store_id', currentStoreId);
            if (custErr) throw custErr;
            selectCustomer.innerHTML = '<option value="">-- Sentuh dan Pilih Nama Pembeli --</option>';
            custData.forEach(cust => {
                const opt = document.createElement('option');
                opt.value = cust.id; opt.textContent = cust.name;
                selectCustomer.appendChild(opt);
            });

            // B. Mengundang Katalog Gudang (Milik Toko ini)
            const { data: invData, error: invErr } = await window.supabaseClient.from('inventory').select('id, item_name, price, hpp, stock_qty').eq('store_id', currentStoreId);
            if (invErr) throw invErr;
            globalInventoryData = invData;

            // C. MENGGIPNOTIS DATA TRANSAKSI UTAMA PWA (Hanya Jika Milik Toko ini)
            const { data: orderData, error: orderErr } = await window.supabaseClient
                .from('orders')
                .select('*')
                .eq('id', targetOrderId)
                .eq('store_id', currentStoreId) // SEGEL
                .single();
            if (orderErr) throw orderErr;

            // Membangkitkan Isian Masa Lalu ke Form Replikator
            selectCustomer.value = orderData.customer_id;
            inputFeeJastip.value = orderData.fee_jastip || 0;
            inputShippingCost.value = orderData.shipping_cost || 0;

            // Mereplika Barisan Keranjang Belanja Siluman yang Tersembunyi (Array JSON)
            const oldItems = orderData.items || [];
            if (oldItems.length === 0) {
                // Buat 1 baris kosong jika keajaiban server hilang
                createItemRow();
            } else {
                // Merangkai ulang daftar belanja sesuai memori API
                oldItems.forEach(it => {
                    createItemRow(it);
                });
            }

            // Menyembunyikan Tirai Loading dan Membuka Papan Catur Editor
            document.getElementById('loadingState').classList.add('d-none');
            document.getElementById('mainEditorContainer').classList.remove('d-none');

            // Kalkulasikan segera Grand Total Angka Bawaannya
            calculateGrandTotal();

        } catch(e) {
            alert("Operasi Replikasi PWA Gagal Membuka Database Masa Lalu: " + e.message);
            window.location.href = 'orders.html';
        }
    }
    
    loadTimeMachine();

    // 2. SISTEM DUPLIKATOR BARIS (Dengan Kekuatan Prefill)
    let itemCount = 0; 

    function createItemRow(prefilledData = null) {
        itemCount++;
        const row = document.createElement('div');
        row.className = 'item-row bg-light rounded-3 p-3 position-relative';
        row.id = `item-row-${itemCount}`;
        
        let itemOptions = '<option value="">Pilih Koleksi Barang Gudang...</option>';
        globalInventoryData.forEach(inv => {
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
                    <label class="small fw-bold text-muted mb-1">Harga Manual Revisi Jual</label>
                    <div class="input-group shadow-sm border-0 rounded-2">
                        <span class="input-group-text border-0 bg-white fw-bold">Rp</span>
                        <input type="number" class="form-control border-0 item-dyn-price bg-white fw-bold text-warning" min="0" required placeholder="0">
                    </div>
                </div>
                <div class="col-5 col-md-3">
                    <label class="small fw-bold text-muted mb-1">Qty Tagih</label>
                    <input type="number" class="form-control border-0 item-dyn-qty bg-white shadow-sm fw-bold" value="1" min="1" required>
                </div>
            </div>
        `;
        
        itemsContainer.appendChild(row);
        
        const newSelect = row.querySelector('.item-dyn-name');
        const priceTarget = row.querySelector('.item-dyn-price');
        const qtyTarget = row.querySelector('.item-dyn-qty');

        // Jika form ini dipanggil oleh Data Lama (Pre-Fill), Injeksi Angkanya Langsung!
        if(prefilledData) {
            newSelect.value = prefilledData.name;
            priceTarget.value = prefilledData.price;
            qtyTarget.value = prefilledData.qty;
            // Gunakan HPP lama dari database jika ada, atau ambil dari dropdown baru jika admin ganti barang
            row.dataset.oldHpp = prefilledData.hpp || 0;
        }

        // Intervensi Realtime Harga seperti biasa
        newSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const realPrice = selectedOption.getAttribute('data-price');
            if(realPrice) { priceTarget.value = realPrice; calculateGrandTotal(); } 
            else { priceTarget.value = ''; }
        });

        bindRealtimeCalculators();
    }
    
    btnAddItemRow.addEventListener('click', () => { createItemRow(); });
    
    window.removeItemRow = (rowId) => {
        const row = document.getElementById(rowId);
        if (row && itemsContainer.children.length > 1) {
            row.remove(); calculateGrandTotal(); 
        } else {
            alert('Akurat Tolak: Tagihan Setidaknya memiliki 1 jejak nyata.');
        }
    };

    // 3. MESIN DOM MATHEMATICS (Kalkulator)
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
        const shipping = parseFloat(inputShippingCost.value) || 0; 
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
    
    inputFeeJastip.addEventListener('input', calculateGrandTotal);
    inputShippingCost.addEventListener('input', calculateGrandTotal);

    // 4. API PENIMPA NOTA KE SUPABASE
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formError = document.getElementById('formError');
        
        const custId = selectCustomer.value;
        if (!custId) { return; }

        let finalItemsPayload = [];
        const selectNode = document.querySelectorAll('.item-dyn-name');
        const priceNode = document.querySelectorAll('.item-dyn-price');
        const qtyNode = document.querySelectorAll('.item-dyn-qty');

        for (let i = 0; i < selectNode.length; i++) {
            const itemNameText = selectNode[i].value;
            const ItemIdFromGudang = selectNode[i].options[selectNode[i].selectedIndex].getAttribute('data-id');
            const itemHpp = parseFloat(selectNode[i].options[selectNode[i].selectedIndex].getAttribute('data-hpp')) || parseFloat(selectNode[i].closest('.item-row').dataset.oldHpp) || 0;
            
            if (!itemNameText || itemNameText === "") { return; }
            
            finalItemsPayload.push({
                product_id: ItemIdFromGudang, 
                name: itemNameText,
                price: parseFloat(priceNode[i].value) || 0,
                hpp: itemHpp,
                qty: parseInt(qtyNode[i].value) || 1
            });
        }

        const exactFinalPrice = calculateGrandTotal();
        const pureJastipFee = parseFloat(inputFeeJastip.value) || 0;
        const pureShipping = parseFloat(inputShippingCost.value) || 0;

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-grow spinner-grow-sm me-2"></span> Menimpa Transaksi...';

        // LONTARKAN KE DATABASE (UPDATE/REPLACE BARISAN JSON, BUKAN INSERT)
        const { error: orderError } = await window.supabaseClient
            .from('orders')
            .update({ 
                customer_id: custId,
                items: finalItemsPayload,    
                fee_jastip: pureJastipFee,   
                shipping_cost: pureShipping,  
                total_price: exactFinalPrice
            })
            .eq('id', targetOrderId);

        // (Tidak ada aksi UPDATE Stok Inventori. Persetujuan admin: Mengurangi Stok hanya waktu BUAT BARU. Mengedit harus setel manual)

        if (orderError) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="bi bi-pencil-square me-2"></i> Timpa Laporan Basis Data';
            formError.classList.remove('d-none');
            formError.querySelector('span').textContent = "Pusat Menolak Revisi Anda: " + orderError.message;
            return;
        }

        // Berhasil Direvisi total, tendang admin ke Layar Kanban Asal
        window.location.href = 'orders.html';
    });
});
