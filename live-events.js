// live-events.js - Admin: Kelola Daftar Live Event
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const grid = document.getElementById('eventGrid');
    const loading = document.getElementById('loadingState');
    const empty = document.getElementById('emptyState');
    const form = document.getElementById('addEventForm');

    // Ambil store_id
    const { data: me } = await window.supabaseClient.from('store_users').select('store_id').eq('user_id', session.user.id).maybeSingle();
    const storeId = me?.store_id || localStorage.getItem('jastip_store_id');

    async function fetchEvents() {
        loading.classList.remove('d-none');
        grid.innerHTML = '';
        empty.classList.add('d-none');

        const { data, error } = await window.supabaseClient
            .from('live_events')
            .select('*')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false });

        loading.classList.add('d-none');
        if (!data || data.length === 0) { empty.classList.remove('d-none'); return; }

        data.forEach(ev => {
            const date = new Date(ev.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const isActive = ev.status === 'active';
            const publicUrl = `${window.location.origin}/public/event.html?id=${ev.id}`;

            const card = document.createElement('div');
            card.className = 'col-12';
            card.innerHTML = `
                <div class="card event-card shadow-sm p-3 bg-white border-0">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="${isActive ? 'status-live' : 'status-closed'}">${isActive ? '🔴 LIVE' : '✅ Selesai'}</span>
                            <h6 class="fw-bold mt-2 mb-1">${ev.title}</h6>
                            <p class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>${ev.location || '-'} · <i class="bi bi-clock me-1"></i>${ev.duration || '-'}</p>
                            <p class="text-muted small mb-0"><i class="bi bi-calendar3 me-1"></i>${date}</p>
                        </div>
                        ${isActive ? `<button class="btn btn-primary btn-sm rounded-pill px-3" onclick="window.location.href='live-capture.html?id=${ev.id}'">
                            <i class="bi bi-camera-fill me-1"></i> Capture
                        </button>` : ''}
                    </div>
                    ${isActive ? `
                    <div class="share-link mt-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="text-muted"><i class="bi bi-link-45deg me-1"></i>Link Publik:</span>
                            <button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="copyLink('${publicUrl}')">
                                <i class="bi bi-clipboard me-1"></i>Salin
                            </button>
                        </div>
                        <div class="mt-1 fw-bold text-dark" style="font-size: 0.75rem;">${publicUrl}</div>
                    </div>
                    <div class="mt-3 d-flex gap-2">
                        <button class="btn btn-outline-danger btn-sm rounded-pill flex-fill" onclick="finishEvent('${ev.id}')">
                            <i class="bi bi-stop-circle me-1"></i>Selesaikan Event
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Buat Event Baru
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnStartEvent');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Memulai...';

        const { data, error } = await window.supabaseClient.from('live_events').insert([{
            title: document.getElementById('eventTitle').value,
            location: document.getElementById('eventLocation').value,
            duration: document.getElementById('eventDuration').value,
            store_id: parseInt(storeId),
            status: 'active'
        }]).select().single();

        if (error) {
            alert('Gagal buat event: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-broadcast me-2"></i>Mulai Event Sekarang!';
        } else {
            window.location.href = `live-capture.html?id=${data.id}`;
        }
    });

    // Salin Link ke Clipboard
    window.copyLink = (url) => {
        navigator.clipboard.writeText(url);
        alert('Link berhasil disalin! Kirimkan ke pelanggan Anda.');
    };

    // Selesaikan Event & Konversi ke Orders
    window.finishEvent = async (eventId) => {
        if (!confirm('Yakin ingin menyelesaikan event ini? Semua grab akan dikonversi menjadi pesanan.')) return;

        try {
            // 1. Ambil semua grab untuk event ini
            const { data: grabs, error: grabsErr } = await window.supabaseClient
                .from('event_grabs')
                .select('*, event_items(item_name, price, cost_price, brand_name)')
                .eq('event_id', eventId);

            if (grabsErr) throw new Error("Gagal mengambil data grab: " + grabsErr.message);

            if (grabs && grabs.length > 0) {
                // 2. Kelompokkan per pelanggan (nama + phone)
                const grouped = {};
                grabs.forEach(g => {
                    const key = `${g.customer_name}__${g.customer_phone}`;
                    if (!grouped[key]) grouped[key] = { name: g.customer_name, phone: g.customer_phone, address: g.customer_address, items: [] };
                    grouped[key].items.push({
                        name: g.event_items?.item_name || 'Barang',
                        brand: g.event_items?.brand_name || '',
                        cost: g.event_items?.cost_price || 0,
                        price: g.event_items?.price || 0,
                        qty: g.qty
                    });
                });

                // 3. Buat pesanan per pelanggan
                for (const key in grouped) {
                    const cust = grouped[key];
                    const total = cust.items.reduce((acc, i) => acc + (i.price * i.qty), 0);

                    // Cek/Buat customer
                    let { data: existCust, error: custSearchErr } = await window.supabaseClient
                        .from('customers')
                        .select('id, address')
                        .eq('phone', cust.phone)
                        .eq('store_id', storeId)
                        .maybeSingle();

                    // Abaikan error "column address does not exist" jika terjadi
                    if (custSearchErr && custSearchErr.code === 'PGRST204') {
                        // Kolom address tidak ada, ulangi tanpa select address
                         const fallback = await window.supabaseClient
                            .from('customers')
                            .select('id')
                            .eq('phone', cust.phone)
                            .eq('store_id', storeId)
                            .maybeSingle();
                         existCust = fallback.data;
                    }

                    if (!existCust) {
                        const custPayload = { name: cust.name, phone: cust.phone, store_id: parseInt(storeId) };
                        // Coba masukkan alamat jika ada
                        if (cust.address) custPayload.address = cust.address;
                        
                        const { data: newCust, error: newCustErr } = await window.supabaseClient
                            .from('customers')
                            .insert([custPayload])
                            .select('id')
                            .single();
                            
                        if (newCustErr) {
                           // Fallback jika insert dengan address gagal
                           const { data: safeCust, error: safeErr } = await window.supabaseClient
                            .from('customers')
                            .insert([{ name: cust.name, phone: cust.phone, store_id: parseInt(storeId) }])
                            .select('id')
                            .single();
                           if(safeErr) throw new Error("Gagal membuat data pelanggan: " + safeErr.message);
                           existCust = safeCust;
                        } else {
                           existCust = newCust;
                        }
                    } else if (existCust.address === null && cust.address) { // Hanya update jika undefined atau null
                        // Update dengan alamat baru jika alamat sebelumnya kosong
                        await window.supabaseClient.from('customers').update({ address: cust.address }).eq('id', existCust.id).catch(() => {});
                    }

                    const { error: orderErr } = await window.supabaseClient.from('orders').insert([{
                        store_id: parseInt(storeId),
                        customer_id: existCust?.id || null,
                        items: cust.items,
                        total_price: total,
                        status: 'unpaid'
                    }]);
                    
                    if (orderErr) throw new Error("Gagal membuat pesanan: " + orderErr.message);
                }
            }

            // 4. Tutup event
            const { error: closeErr } = await window.supabaseClient.from('live_events').update({ status: 'closed' }).eq('id', eventId);
            if (closeErr) throw new Error("Gagal menutup event: " + closeErr.message);
            
            alert('✅ Event selesai! Semua grab sudah dikonversi ke Pesanan.');
            fetchEvents();
        } catch (err) {
            console.error(err);
            alert("❌ Gagal menyelesaikan event:\n" + err.message + "\n\nPastikan Anda sudah mengupdate script SQL di Supabase.");
        }
    };

    fetchEvents();
});
