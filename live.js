// live.js - Manajer Sesi Live Event Jastip PWA

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const loading = document.getElementById('loadingState');
    const empty = document.getElementById('emptyState');
    const grid = document.getElementById('eventGrid');
    const searchInput = document.getElementById('eventSearch');
    const addForm = document.getElementById('addEventForm');

    let allEvents = [];

    // 1. Ambil Data Sesi Live dari Database
    async function fetchEvents() {
        loading.classList.remove('d-none');
        grid.innerHTML = '';
        empty.classList.add('d-none');

        const { data, error } = await window.supabaseClient
            .from('live_events')
            .select('*')
            .order('created_at', { ascending: false });

        loading.classList.add('d-none');

        if (error) {
            console.error("Gagal ambil sesi live:", error);
            return;
        }

        allEvents = data;
        renderEvents(allEvents);
    }

    // 2. Tampilkan Kartu Event ke Layar
    function renderEvents(events) {
        grid.innerHTML = '';
        if (events.length === 0) {
            empty.classList.remove('d-none');
            return;
        }

        events.forEach(ev => {
            const dateStr = new Date(ev.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const statusClass = ev.status === 'active' ? 'bg-active' : 'bg-closed';
            const statusText = ev.status === 'active' ? 'Sedang Berlangsung 🎥' : 'Selesai';

            const card = document.createElement('div');
            card.className = 'col-6 col-md-4';
            card.innerHTML = `
                <div class="card event-card shadow-sm h-100 p-3 bg-white border-0" onclick="goToSession('${ev.id}')">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="status-badge ${statusClass} fw-bold">${statusText}</span>
                    </div>
                    <h6 class="fw-bold text-dark mt-2 mb-1">${ev.title}</h6>
                    <p class="text-muted small mb-0"><i class="bi bi-calendar3 me-1"></i> ${dateStr}</p>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // 3. Fungsi Navigasi ke Sesi Interaktif
    window.goToSession = (id) => {
        window.location.href = `live-session.html?id=${id}`;
    };

    // 4. Pencarian Live (Client Side)
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = allEvents.filter(ev => ev.title.toLowerCase().includes(val));
        renderEvents(filtered);
    });

    // 5. Submit Event Baru
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnStartLive');
        const title = document.getElementById('eventTitle').value;
        
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Membuka Studio...';

        const { data: userRole } = await window.supabaseClient.from('store_users').select('store_id').eq('user_id', session.user.id).single();

        const { data, error } = await window.supabaseClient
            .from('live_events')
            .insert([{
                title: title,
                store_id: userRole.store_id,
                status: 'active'
            }])
            .select()
            .single();

        if (error) {
            alert("Gagal membuka sesi live: " + error.message);
            btn.disabled = false;
            btn.innerHTML = 'Mulai Sekarang!';
        } else {
            // Langsung lempar ke Ruang Live Session
            window.location.href = `live-session.html?id=${data.id}`;
        }
    });

    // Jalankan pertama kali
    fetchEvents();
});
