const SUPABASE_URL = "https://fcmikgybijgxuupzxqhh.supabase.co";
const SUPABASE_KEY = "sb_publishable_f57DCsIibKCeuOyjn6atcQ_xmUSdMUB";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authBtn = document.getElementById('auth-btn');
const authModal = document.getElementById('auth-modal');
const closeModal = document.getElementById('close-modal');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitch = document.getElementById('auth-switch');
const vipBanner = document.getElementById('vip-banner');

let mode = 'login';

authBtn.addEventListener('click', () => {
  if (authBtn.dataset.loggedIn === 'true') {
    supabaseClient.auth.signOut().then(() => location.reload());
  } else {
    authModal.style.display = 'flex';
  }
});

closeModal.addEventListener('click', () => {
  authModal.style.display = 'none';
  authError.textContent = '';
});

authModal.addEventListener('click', (e) => {
  if (e.target === authModal) {
    authModal.style.display = 'none';
  }
});

authSwitch.addEventListener('click', () => {
  mode = mode === 'login' ? 'signup' : 'login';
  authTitle.textContent = mode === 'login' ? 'Connexion' : 'Inscription';
  authSubmit.textContent = mode === 'login' ? 'Se connecter' : "S'inscrire";
  authSwitch.textContent = mode === 'login'
    ? "Pas encore de compte ? S'inscrire"
    : "Déjà un compte ? Se connecter";
  authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (mode === 'signup') {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      authError.textContent = error.message;
      return;
    }
    await supabaseClient.from('Profils').insert([{ email: email, est_vip: false }]);
    authError.style.color = '#5FA070';
    authError.textContent = "Compte créé ! Tu peux maintenant te connecter.";
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      authError.textContent = error.message;
      return;
    }
    location.reload();
  }
});

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const email = session.user.email;
    authBtn.textContent = 'Déconnexion';
    authBtn.dataset.loggedIn = 'true';

    const { data: profil } = await supabaseClient
      .from('Profils')
      .select('est_vip')
      .eq('email', email)
      .maybeSingle();

    if (profil && profil.est_vip) {
      document.querySelectorAll('.locked').forEach(card => card.classList.remove('locked'));
      document.querySelectorAll('.lock-overlay').forEach(el => el.remove());
      if (vipBanner) vipBanner.style.display = 'block';
    }
  }
}

checkSession();
