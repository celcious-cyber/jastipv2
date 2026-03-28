// Authentication Logic with Supabase

// --- HOTFIX: Bersihkan Service Worker localhost versi lama yang memblokir API ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.warn("Rogue ServiceWorker berhasil dihapus untuk mencegah error Supabase.");
        }
    });
}
// --------------------------------------------------------------------------------

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// 1. Eksekusi Pengecekan Status Login Awal
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    
    // Inisialisasi Toggle UI Form
    window.toggleAuth = (isRegister) => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const toggleText = document.getElementById('authToggleText');
        const loginText = document.getElementById('authLoginText');

        if (isRegister) {
            loginForm.classList.add('d-none');
            registerForm.classList.remove('d-none');
            toggleText.classList.add('d-none');
            loginText.classList.remove('d-none');
        } else {
            loginForm.classList.remove('d-none');
            registerForm.classList.add('d-none');
            toggleText.classList.remove('d-none');
            loginText.classList.add('d-none');
        }
    };

    // Event Listener untuk Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storeName = document.getElementById('regStoreName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const { error } = await registerUser(email, password, storeName);
            if (error) {
                document.getElementById('registerError').classList.remove('d-none');
                document.getElementById('registerError').querySelector('span').textContent = error.message;
            }
        });
    }
});

// Event Listener for Login form
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        loginUser(email, password);
    });
}

// 2. FUNGSI REGISTRASI AKUN BARU (ADMIN ATAU STAFF DIUNDANG)
    async function registerUser(email, password, storeName) {
        const regBtn = document.querySelector('#registerForm button');
        const regError = document.getElementById('registerError');
        regBtn.disabled = true; 
        regBtn.textContent = 'Mendaftarkan...';

        try {
            // 1. Sign Up to Supabase Auth
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            const newUser = authData.user;
            if (!newUser) throw new Error("Gagal mendapatkan User ID. Silakan cek email (jika konfirmasi aktif).");

            console.log("User Auth berhasil dibuat:", newUser.id);

            // 2. Buat Toko Baru
            const { data: newStore, error: storeErr } = await window.supabaseClient.from('store_settings').insert([{
                store_name: storeName || ('Jastip ' + email.split('@')[0]),
                is_premium: true
            }]).select('id').single();

            if (storeErr) {
                console.error("Gagal buat store_settings:", storeErr);
                throw new Error("Gagal membuat data Toko: " + storeErr.message);
            }

            console.log("Toko berhasil dibuat dengan ID:", newStore.id);

            // 3. Hubungkan User sebagai Admin Toko tersebut
            const { error: linkErr } = await window.supabaseClient.from('store_users').insert([{
                user_id: newUser.id,
                store_id: newStore.id,
                role: 'admin',
                status: 'active',
                email: email
            }]);

            if (linkErr) {
                console.error("Gagal buat store_users:", linkErr);
                throw new Error("Gagal menghubungkan Akun ke Toko: " + linkErr.message);
            }

            // 4. Simpan ke LocalStorage untuk akses cepat di frontend
            localStorage.setItem('jastip_store_id', newStore.id);
            localStorage.setItem('jastip_role', 'admin');

            console.log("Pendaftaran Berhasil Total! Mengalihkan...");

            // Langsung Login
            window.location.href = 'dashboard.html';
            return { data: authData, error: null };
            
        } catch (error) {
            console.error('CRITICAL ERROR REGISTRATION:', error);
            regError.classList.remove('d-none');
            regError.querySelector('span').textContent = error.message;
            regBtn.disabled = false; 
            regBtn.textContent = 'Buat Akun Jastip';
            return { data: null, error };
        }
    }

// Event Listener for Logout Button in Dashboard
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// 3. Fungsi utama memproses Login ke Supabase
async function loginUser(email, password) {
    try {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Memproses...';

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (error) {
            if (loginError) {
                const errorSpan = loginError.querySelector('span');
                if (errorSpan) errorSpan.textContent = error.message;
                loginError.classList.remove('d-none');
            }
            return;
        }

        // 1. Simpan sesi ke localStorage jika berhasil
        localStorage.setItem('user_session', JSON.stringify(data.session));

        // 2. CEK APAKAH USER SUDAH PUNYA TOKO (Auto-Provisioning)
        const { data: userRole } = await window.supabaseClient
            .from('store_users')
            .select('store_id, role')
            .eq('user_id', data.user.id)
            .maybeSingle();

        if (userRole) {
            // User sudah terdaftar di toko
            localStorage.setItem('jastip_store_id', userRole.store_id);
            localStorage.setItem('jastip_role', userRole.role);
        } else {
            // User belum punya toko → Buatkan otomatis!
            console.log("User baru terdeteksi, membuat toko otomatis...");
            
            const { data: newStore } = await window.supabaseClient
                .from('store_settings')
                .insert([{ 
                    store_name: 'Jastip ' + (data.user.email?.split('@')[0] || 'Studio'),
                    is_premium: true 
                }])
                .select('id')
                .single();

            if (newStore) {
                await window.supabaseClient.from('store_users').insert([{
                    user_id: data.user.id,
                    store_id: newStore.id,
                    role: 'admin',
                    status: 'active',
                    email: data.user.email
                }]);
                localStorage.setItem('jastip_store_id', newStore.id);
                localStorage.setItem('jastip_role', 'admin');
                console.log("Toko baru berhasil dibuat! ID:", newStore.id);
            }
        }

        window.location.href = 'dashboard.html';
        
    } catch (err) {
        console.error("Error during login", err);
    }
}

async function logout() {
    await window.supabaseClient.auth.signOut();
    // Bersihkan semua jejak sesi dan tema
    localStorage.removeItem('user_session');
    localStorage.removeItem('jastip_store_id');
    localStorage.removeItem('jastip_store_settings');
    window.location.href = 'index.html';
}

function checkAuthState() {
    const session = localStorage.getItem('user_session');
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '';
    
    const isInPages = currentPath.includes('/pages/');
    const rootPath = isInPages ? '../' : './';
    const loginPath = rootPath + 'index.html';
    const dashboardPath = rootPath + 'dashboard.html';

    if (session) {
        if (isLoginPage) {
            window.location.href = dashboardPath;
        }
    } else {
        if (!isLoginPage) {
            window.location.href = loginPath;
        }
    }
}
