// add_staff.js - Mesin Pengirim Undangan Akses Toko (Invite Logic)

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ambil Session & Role (Guard)
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const { data: userProfile } = await window.supabaseClient
        .from('store_users')
        .select('role, store_id')
        .eq('user_id', session.user.id)
        .single();

    if (!userProfile || userProfile.role !== 'admin') {
        window.location.href = '../dashboard.html';
        return;
    }

    const currentStoreId = userProfile.store_id;

    // 2. Submit Form Undangan
    const form = document.getElementById('addStaffForm');
    const btn = document.getElementById('btnInvite');
    const err = document.getElementById('formError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('staffEmail').value.toLowerCase();

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-grow spinner-grow-sm me-1"></span> Mengunci...';
        err.classList.add('d-none');

        try {
            // [LOGIKA]: Masukkan ke store_users dengan status 'invited'
            // RLS akan memastikan hanya admin dari store_id yang sama yang bisa insert
            const { error: inviteError } = await window.supabaseClient
                .from('store_users')
                .insert([{
                    email: email,
                    store_id: currentStoreId,
                    role: 'staff',
                    status: 'invited'
                }]);

            if (inviteError) {
                if (inviteError.code === '23505') {
                    throw new Error("Email ini sudah terdaftar sebagai anggota atau undangan di toko Anda.");
                }
                throw inviteError;
            }

            alert("Suksess! Anggota Tim telah diundang. Beritahu mereka untuk Sign Up menggunakan email tersebut.");
            window.location.href = 'staff.html';

        } catch (e) {
            err.classList.remove('d-none');
            err.querySelector('span').textContent = e.message;
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Kirim';
        }
    });
});
