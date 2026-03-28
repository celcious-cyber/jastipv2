// live-capture.js - Admin: Capture barang ke katalog live secara real-time
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const eventId = new URLSearchParams(window.location.search).get('id');
    if (!eventId) { window.location.href = 'live-events.html'; return; }

    const titleEl = document.getElementById('eventTitle');
    const grid = document.getElementById('itemGrid');
    const emptyItems = document.getElementById('emptyItems');
    const form = document.getElementById('captureForm');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    const grabCountEl = document.getElementById('grabCount');

    let imageData = null;

    // Helper: Mengubah DataURL (Base64) menjadi Blob untuk upload storage
    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    }

    // 1. Load Event Info
    const { data: event } = await window.supabaseClient.from('live_events').select('*').eq('id', eventId).single();
    if (event) titleEl.textContent = event.title;

    // 2. Handle Photo Capture
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 800; // Tingkatkan kualitas sedikit karena sudah pakai storage
                const scale = maxW / img.width;
                canvas.width = maxW;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                imageData = canvas.toDataURL('image/jpeg', 0.8);
                photoPreview.innerHTML = `<img src="${imageData}" alt="Preview">`;
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 3. Submit Item Baru
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCapture');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...';

        try {
            let finalImageUrl = null;
            if (imageData) {
                const blob = dataURLtoBlob(imageData);
                const fileName = `event_${eventId}/${Date.now()}.jpg`;
                
                const { error: uploadErr } = await window.supabaseClient.storage
                    .from('event-images')
                    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = window.supabaseClient.storage
                    .from('event-images')
                    .getPublicUrl(fileName);
                
                finalImageUrl = urlData.publicUrl;
            }

            const { error } = await window.supabaseClient.from('event_items').insert([{
                event_id: eventId,
                item_name: document.getElementById('itemName').value,
                brand_name: document.getElementById('itemBrand').value,
                cost_price: parseFloat(document.getElementById('itemHPP').value) || 0,
                price: parseFloat(document.getElementById('itemPrice').value) || 0,
                stock_qty: parseInt(document.getElementById('itemStock').value) || 1,
                image_url: finalImageUrl
            }]);

            if (error) throw error;

            // Reset form
            form.reset();
            document.getElementById('itemStock').value = '1';
            imageData = null;
            photoPreview.innerHTML = `<i class="bi bi-camera placeholder-icon"></i><p class="small text-muted mt-2 mb-0">Ketuk untuk ambil foto</p>`;
            
        } catch (err) {
            alert('Gagal Capture: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Tambah ke Katalog Live';
        }
    });

    // 4. Render Items
    function renderItems(items) {
        // Bersihkan hanya item cards, bukan emptyItems
        grid.querySelectorAll('.item-col').forEach(el => el.remove());
        
        if (!items || items.length === 0) {
            emptyItems.classList.remove('d-none');
            return;
        }
        emptyItems.classList.add('d-none');

        items.forEach(item => {
            const displayImg = item.image_url || item.image_data; // Mendukung fallback jika masih ada base64
            const col = document.createElement('div');
            col.className = 'col-6 item-col';
            col.innerHTML = `
                <div class="card item-card-live shadow-sm border-0 position-relative">
                    <div class="item-actions">
                        <button class="btn-action-mini btn-edit-mini" onclick="editItem('${item.id}')">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-action-mini btn-delete-mini" onclick="deleteItem('${item.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    ${displayImg ? `<img src="${displayImg}" alt="${item.item_name}">` : 
                    `<div class="bg-light d-flex align-items-center justify-content-center" style="height:120px;"><i class="bi bi-image text-muted fs-1"></i></div>`}
                    <div class="p-2">
                        <div class="product-info">
                        <div class="text-muted small mb-1">${item.brand_name || ''}</div>
                        <h6 class="fw-bold small mb-1 text-truncate">${item.item_name}</h6>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span class="fw-bold" style="color: var(--terracotta); font-size: 0.75rem;">Rp ${Number(item.price).toLocaleString('id-ID')}</span>
                        </div>
                        <div class="mt-1">
                            <span class="badge ${item.stock_qty > 0 ? 'bg-success' : 'bg-danger'} rounded-pill" style="font-size: 0.6rem;">${item.stock_qty > 0 ? `Stok: ${item.stock_qty}` : 'Habis'}</span>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(col);
        });
    }

    // 5. Fetch Items Awal
    async function fetchItems() {
        const { data } = await window.supabaseClient.from('event_items').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        renderItems(data);
    }

    // 6. Fetch Grab Count & Log
    async function fetchGrabCount() {
        const { count } = await window.supabaseClient.from('event_grabs').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
        grabCountEl.textContent = `${count || 0} Grab`;
        fetchGrabs();
    }

    async function fetchGrabs() {
        const { data: grabs } = await window.supabaseClient
            .from('event_grabs')
            .select('*, event_items(item_name, image_data)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(10);
        
        const log = document.getElementById('grabLog');
        if (!grabs || grabs.length === 0) {
            log.innerHTML = '<div class="text-center py-4 text-muted small">Belum ada aktivitas grab...</div>';
            return;
        }

        log.innerHTML = grabs.map(g => `
            <div class="grab-log-item position-relative pe-5">
                <img src="${g.event_items?.image_data || 'https://via.placeholder.com/40'}" class="grab-log-img">
                <div class="grab-log-info">
                    <h6>${g.customer_name}</h6>
                    <p>${g.event_items?.brand_name ? `[${g.event_items.brand_name}] ` : ''}${g.event_items?.item_name || 'Item'}</p>
                </div>
                <div class="grab-log-time">${new Date(g.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                <button class="btn btn-sm btn-outline-success position-absolute rounded-circle" style="right: 10px; top: 15px; padding: 4px 8px;" onclick="processGrab(event, '${g.id}')" title="Buat Pesanan">
                    <i class="bi bi-cart-plus"></i>
                </button>
            </div>
        `).join('');
    }

    // Fungsi Konversi Grab Tunggal menjadi Pesanan
    window.processGrab = async (e, grabId) => {
        let btn = null;
        try {
            if (e && e.currentTarget) {
                btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            }

            // 1. Ambil data grab
            const { data: g, error: grabErr } = await window.supabaseClient
                .from('event_grabs')
                .select('*, event_items(item_name, price, cost_price, brand_name)')
                .eq('id', grabId)
                .single();

            if (grabErr) throw grabErr;

            // 2. Cek atau Buat Pelanggan
            const { data: me } = await window.supabaseClient.from('store_users').select('store_id').maybeSingle();
            const storeId = me?.store_id || localStorage.getItem('jastip_store_id');

            let { data: existCust } = await window.supabaseClient
                .from('customers')
                .select('id, address')
                .eq('phone', g.customer_phone)
                .eq('store_id', storeId)
                .maybeSingle();

            if (!existCust) {
                // Buat pelanggan baru
                const { data: newCust, error: newCustErr } = await window.supabaseClient
                    .from('customers')
                    .insert([{ 
                        name: g.customer_name, 
                        phone: g.customer_phone, 
                        address: g.customer_address || null,
                        store_id: parseInt(storeId) 
                    }])
                    .select('id')
                    .single();
                if (newCustErr) throw new Error("Gagal membuat pelanggan: " + newCustErr.message);
                existCust = newCust;
            } else if (!existCust.address && g.customer_address) {
                await window.supabaseClient.from('customers').update({ address: g.customer_address }).eq('id', existCust.id).catch(()=>{}).select();
            }

            // 3. Buat pesanan
            const orderItem = {
                name: g.event_items?.item_name || 'Barang Live',
                brand: g.event_items?.brand_name || '',
                cost: g.event_items?.cost_price || 0,
                price: g.event_items?.price || 0,
                qty: g.qty || 1
            };

            const { error: orderErr } = await window.supabaseClient.from('orders').insert([{
                store_id: parseInt(storeId),
                customer_id: existCust.id,
                items: [orderItem],
                total_price: orderItem.price * orderItem.qty,
                status: 'unpaid'
            }]);

            if (orderErr) throw new Error("Gagal membuat pesanan: " + orderErr.message);

            // 4. Hapus grab setelah berhasil dibuat pesanan (agar tidak duplikat)
            await window.supabaseClient.from('event_grabs').delete().eq('id', grabId);

            // Fetch ulang agar UI terupdate
            fetchGrabCount();
            alert('✅ Berhasil memasukkan ke daftar pesanan!');

        } catch (err) {
            console.error(err);
            alert('❌ Gagal memproses: ' + err.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-cart-plus"></i>';
            }
        }
    };

    // 7. REALTIME: Auto-update saat ada item baru atau stok berubah
    window.supabaseClient
        .channel('live-capture-items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_items', filter: `event_id=eq.${eventId}` }, () => {
            fetchItems();
        })
        .subscribe();

    window.supabaseClient
        .channel('live-capture-grabs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_grabs', filter: `event_id=eq.${eventId}` }, (payload) => {
            fetchGrabCount();
            fetchItems(); // Refresh stok
            
            // Opsional: Bunyi notifikasi jika diinginkan
            // try { new Audio('../assets/notification.mp3').play(); } catch(e){}
        })
        .subscribe();

    // 8. Edit & Delete Logic
    window.editItem = async (id) => {
        const { data, error } = await window.supabaseClient.from('event_items').select('*').eq('id', id).single();
        if (error || !data) { alert('Gagal mengambil data barang'); return; }

        document.getElementById('editItemId').value = data.id;
        document.getElementById('editItemName').value = data.item_name;
        document.getElementById('editItemBrand').value = data.brand_name || '';
        document.getElementById('editItemHPP').value = data.cost_price || 0;
        document.getElementById('editItemPrice').value = data.price || 0;
        document.getElementById('editItemStock').value = data.stock_qty || 0;

        const modal = new bootstrap.Modal(document.getElementById('editItemModal'));
        modal.show();
    };

    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editItemId').value;
        const btn = document.getElementById('btnUpdateItem');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...';

        const { error } = await window.supabaseClient.from('event_items').update({
            item_name: document.getElementById('editItemName').value,
            brand_name: document.getElementById('editItemBrand').value,
            cost_price: parseFloat(document.getElementById('editItemHPP').value) || 0,
            price: parseFloat(document.getElementById('editItemPrice').value) || 0,
            stock_qty: parseInt(document.getElementById('editItemStock').value) || 0
        }).eq('id', id);

        if (error) {
            alert('Gagal update: ' + error.message);
        } else {
            bootstrap.Modal.getInstance(document.getElementById('editItemModal')).hide();
        }
        btn.disabled = false;
        btn.innerHTML = 'Simpan Perubahan';
    });

    window.deleteItem = async (id) => {
        if (!confirm('Hapus barang ini dari katalog?')) return;
        const { error } = await window.supabaseClient.from('event_items').delete().eq('id', id);
        if (error) alert('Gagal hapus: ' + error.message);
    };

    fetchItems();
    fetchGrabCount();
});
