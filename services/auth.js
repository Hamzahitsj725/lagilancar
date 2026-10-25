/**
 * SIM-Market Enterprise - Authentication & Role Claims Service
 * Menangani proses sign-in, verifikasi hak akses role, dan manajemen sesi Supabase
 */

import { supabaseClient } from '../config/supabase.js';
import { panggilDatabaseAman } from './db.js';
import { store } from './state.js';
import { showToast } from './notification.js';

export async function periksaSesiAktif(onSuccessCallback) {
    try {
        if (!supabaseClient) return;

        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) return;

        const userUuid = session.user.id;
        const { data: profil, error: profilErr } = await panggilDatabaseAman({
            tabel: 'profil',
            aksi: 'SELECT',
            filterKolom: 'id',
            filterNilai: userUuid,
            single: true
        });

        if (!profilErr && profil) {
            store.setActiveUser(profil, profil.jabatan);
            aktifkanTampilanDashboard(profil.username, profil.jabatan, onSuccessCallback);
        }
    } catch (err) {
        console.warn("Pemeriksaan sesi aktif:", err.message);
    }
}

export async function loginUser(email, password, expectedRole = null, onSuccessCallback = null) {
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "Autentikasi & Masuk";

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `Memverifikasi... <i class="fa-solid fa-spinner animate-spin ml-2"></i>`;
        }

        const resLogin = await panggilDatabaseAman({
            aksi: 'AUTH_LOGIN',
            email: email,
            password: password
        });

        if (resLogin.error) {
            throw new Error(resLogin.error.message || "Gagal melakukan autentikasi.");
        }

        const userUuid = resLogin.data.user.id;
        const { data: profil, error: profilError } = await panggilDatabaseAman({
            tabel: 'profil',
            aksi: 'SELECT',
            filterKolom: 'id',
            filterNilai: userUuid,
            single: true
        });

        if (profilError || !profil) {
            throw new Error("Gagal memuat profil hak akses jabatan dari database.");
        }

        // Validasi kesesuaian jabatan jika form menyertakan pilihan jabatan
        if (expectedRole && profil.jabatan.toLowerCase() !== expectedRole.toLowerCase() && profil.jabatan !== 'master admin') {
            throw new Error(`Akun Anda terdaftar sebagai [${profil.jabatan}], bukan [${expectedRole}]. Silakan pilih jabatan yang sesuai.`);
        }

        store.setActiveUser(profil, profil.jabatan);

        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.add('opacity-0', 'scale-95');
        }

        showToast(`Selamat datang, ${profil.username}! Anda login sebagai ${profil.jabatan.toUpperCase()}.`, "success");

        setTimeout(() => {
            aktifkanTampilanDashboard(profil.username, profil.jabatan, onSuccessCallback);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }, 400);

    } catch (err) {
        console.error("Login gagal:", err.message);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }

        const loginScreen = document.getElementById('login-screen');
        const container = loginScreen ? loginScreen.firstElementChild : null;
        if (container) {
            container.classList.add('animate-shake', 'border-rose-500/40');
            setTimeout(() => { container.classList.remove('animate-shake'); }, 400);
        }

        showToast("Autentikasi Gagal: " + err.message, "error", 5000);
    }
}

export function aktifkanTampilanDashboard(username, role, onReadyCallback = null) {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');

    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) {
        mainApp.classList.remove('hidden');
        document.body.className = "text-slate-100 min-h-screen w-full block bg-[#020617]";

        const nameEl = document.getElementById('user-display-name');
        const roleEl = document.getElementById('user-display-role');
        const avatarEl = document.getElementById('avatar-box');

        if (nameEl) nameEl.innerText = username;
        if (roleEl) roleEl.innerText = role;
        if (avatarEl) avatarEl.innerText = (username || "U").charAt(0).toUpperCase();

        setTimeout(() => {
            mainApp.classList.remove('opacity-0');
            applyRolePermissions(role);
            if (onReadyCallback && typeof onReadyCallback === 'function') {
                onReadyCallback();
            }
        }, 50);
    }
}

export function applyRolePermissions(role) {
    document.querySelectorAll('.menu-section').forEach(el => el.classList.add('hidden'));
    let defaultTab = "penjualan";

    const secKasir = document.getElementById('sec-kasir');
    const secGudang = document.getElementById('sec-gudang');
    const secManajer = document.getElementById('sec-manajer');
    const secSetting = document.getElementById('sec-setting');

    const cleanRole = (role || "").toLowerCase();

    if (cleanRole === "kasir") {
        if (secKasir) secKasir.classList.remove('hidden');
        defaultTab = "penjualan";
    } else if (cleanRole === "admin gudang") {
        if (secGudang) secGudang.classList.remove('hidden');
        defaultTab = "stok";
    } else if (cleanRole === "manajer") {
        if (secManajer) secManajer.classList.remove('hidden');
        defaultTab = "laporan";
    } else if (cleanRole === "master admin") {
        if (secKasir) secKasir.classList.remove('hidden');
        if (secGudang) secGudang.classList.remove('hidden');
        if (secManajer) secManajer.classList.remove('hidden');
        defaultTab = "penjualan";
    }

    // Setting menu tersedia untuk semua role
    if (secSetting) secSetting.classList.remove('hidden');

    if (window.switchTab && typeof window.switchTab === 'function') {
        window.switchTab(defaultTab);
    }
}

export async function logoutUser() {
    if (confirm("Keluar dari konsol sistem SIM-Market Enterprise?")) {
        try {
            if (supabaseClient) {
                await supabaseClient.auth.signOut();
            }
        } catch (e) {
            console.error("Logout error:", e);
        }
        location.reload();
    }
}
