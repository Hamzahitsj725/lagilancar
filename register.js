import { supabaseClient } from './config/supabase.js';

const form = document.getElementById('registerForm');
const submitButton = document.getElementById('submitButton');
const formMessage = document.getElementById('formMessage');

function setMessage(type, text) {
  formMessage.className = `rounded-xl border px-3 py-2 text-sm ${
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }`;
  formMessage.textContent = text;
  formMessage.classList.remove('hidden');
}

async function registerOwner() {
  if (!supabaseClient) {
    setMessage('error', 'Supabase client belum siap. Pastikan script Supabase sudah dimuat dengan benar.');
    return;
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const username = document.getElementById('username').value.trim();
  const namaToko = document.getElementById('nama_toko').value.trim();
  const namaPemilik = document.getElementById('nama_pemilik').value.trim();
  const alamat = document.getElementById('alamat').value.trim();
  const telepon = document.getElementById('telepon').value.trim();

  if (!email || !password || !username || !namaToko || !namaPemilik || !alamat || !telepon) {
    setMessage('error', 'Semua field wajib diisi.');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Memproses pendaftaran...';

  try {
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/index.html`,
        data: {
          username
        }
      }
    });

    if (signUpError) throw signUpError;

    const user = signUpData?.user;
    if (!user?.id) {
      throw new Error('User ID tidak ditemukan setelah pendaftaran auth.');
    }

    const { data: storeData, error: storeError } = await supabaseClient
      .from('toko')
      .insert({
        nama_toko: namaToko,
        nama_pemilik: namaPemilik,
        alamat,
        telepon
      })
      .select('id')
      .single();

    if (storeError) throw storeError;

    const storeId = storeData?.id;
    if (!storeId) {
      throw new Error('ID toko tidak ditemukan setelah insert toko.');
    }

    const { error: profileError } = await supabaseClient.from('profil').insert({
      id: user.id,
      username,
      jabatan: 'master admin',
      store_id: storeId
    });

    if (profileError) throw profileError;

    setMessage('success', 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi, lalu masuk ke sistem.');
    form.reset();
  } catch (error) {
    console.error('registerOwner error:', error);
    setMessage('error', error?.message || 'Terjadi kesalahan saat melakukan pendaftaran.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Daftar Sekarang';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await registerOwner();
});
