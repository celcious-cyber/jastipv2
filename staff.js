// staff.js - Pengendali Arus Tim & RBAC Guard Admin

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL Guard: Pastikan hanya Admin yang masuk ke halaman ini
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const { data: userProfile } = await window.supabaseClient
        .from('store_users')
        .select('role, store_id')
        .eq('user_id', session.user.id)
        .single();

    if (!userProfile || userProfile.role !== 'admin') {
        alert("Akses Ditolak: Halaman khusus Admin.");
        window.location.href = '../dashboard.html';
        return;
    }

    const currentStoreId = userProfile.store_id;

    // 2. Muat Daftar Tim
    const loadStaff = async () => {
        const grid = document.getElementById('staffList');
        const loading = document.getElementById('loadingState');
        loading.classList.remove('d-none');
        grid.innerHTML = '';

        try {
            const { data, error } = await window.supabaseClient
                .from('store_users')
                .select('*')
                .eq('store_id', currentStoreId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            loading.classList.add('d-none');
            data.forEach(staff => {
                grid.appendChild(createStaffCard(staff, session.user.id));
            });
        } catch (e) {
            console.error(e);
            loading.innerHTML = `<p class="text-danger">Gagal memuat tim: ${e.message}</p>`;
        }
    };

    const createStaffCard = (staff, currentUid) => {
        const isSelf = staff.user_id === currentUid;
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6';
        
        const badgeColor = staff.status === 'active' ? 'bg-success' : 'bg-warning text-dark';
        const roleBadge = staff.role === 'admin' ? 'bg-indigo' : 'bg-sage-green';

        col.innerHTML = `
            <div class="card border-0 shadow-sm p-3 rounded-4 bg-white position-relative overflow-hidden mb-2">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle bg-light d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                        <i class="bi bi-person-badge fs-4 text-muted"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <h6 class="fw-bold m-0 text-dark">${staff.email}</h6>
                            <span class="badge ${badgeColor} rounded-pill x-small" style="font-size:0.6rem;">${staff.status.toUpperCase()}</span>
                        </div>
                        <span class="badge ${roleBadge} rounded-pill x-small px-3 py-1 shadow-sm">${staff.role.toUpperCase()}</span>
                    </div>
                    ${!isSelf ? `
                        <button class="btn btn-sm btn-light border-0 text-danger rounded-circle shadow-sm" onclick="fireStaff('${staff.id}')" style="width: 32px; height: 32px;">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    ` : '<span class="x-small text-muted fw-bold">ANDA</span>'}
                </div>
            </div>
        `;
        return col;
    };

    window.fireStaff = async (id) => {
        if (confirm("Pecat Karyawan: Anda yakin ingin mencabut akses orang ini selamanya?")) {
            const { error } = await window.supabaseClient
                .from('store_users')
                .delete()
                .eq('id', id);
            
            if (error) alert(error.message);
            else loadStaff();
        }
    };

    loadStaff();
});
