// Supabase config
const SUPABASE_URL = "https://fcmikgybijgxuupzxqhh.supabase.co";
const SUPABASE_KEY = "sb_publishable_f57DCsIibKCeuOyjn6atcQ_xmUSdMUB";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== AUTH MODAL =====
const modal = document.getElementById("auth-modal");
const authBtn = document.getElementById("auth-btn");
const closeBtn = document.getElementById("close-modal");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubmit = document.getElementById("auth-submit");
const authSwitch = document.getElementById("auth-switch");
const authError = document.getElementById("auth-error");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");

let isSignUp = false;

authBtn.addEventListener("click", () => {
  modal.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
  authError.textContent = "";
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    authError.textContent = "";
  }
});

authSwitch.addEventListener("click", (e) => {
  e.preventDefault();
  isSignUp = !isSignUp;
  authTitle.textContent = isSignUp ? "Inscription" : "Connexion";
  authSubmit.textContent = isSignUp ? "S'inscrire" : "Se connecter";
  authSwitch.textContent = isSignUp ? "Déjà inscrit ? Se connecter" : "Pas encore de compte ? S'inscrire";
  authError.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (isSignUp) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      authError.textContent = error.message;
    } else {
      authError.textContent = "Inscription réussie ! Vous pouvez vous connecter.";
      isSignUp = false;
      authTitle.textContent = "Connexion";
      authSubmit.textContent = "Se connecter";
      authSwitch.textContent = "Pas encore de compte ? S'inscrire";
      authEmail.value = "";
      authPassword.value = "";
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authError.textContent = error.message;
    } else {
      modal.style.display = "none";
      location.reload();
    }
  }
});

// ===== VIP STATUS =====
const vipBanner = document.getElementById("vip-banner");

async function checkVipStatus() {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user) {
    authBtn.textContent = "Connexion";
    vipBanner.style.display = "none";
    return false;
  }

  authBtn.textContent = "Déconnexion";

  try {
    const { data, error } = await supabase
      .from("Profils")
      .select("est_vip")
      .eq("email", session.session.user.email)
      .single();

    if (error) {
      console.log("Profil non trouvé, création automatique...");
      await supabase.from("Profils").insert({
        email: session.session.user.email,
        est_vip: false
      });
      vipBanner.style.display = "none";
      return false;
    }

    if (data?.est_vip) {
      vipBanner.style.display = "block";
      document.querySelectorAll(".locked").forEach(card => {
        card.classList.remove("locked");
      });
      return true;
    }
  } catch (err) {
    console.error("Erreur VIP:", err);
  }

  vipBanner.style.display = "none";
  return false;
}

authBtn.addEventListener("click", async (e) => {
  if (authBtn.textContent === "Déconnexion") {
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
  }
});

// ===== CHARGER LES VRAIS MATCHS =====
async function loadMatches() {
  try {
    const response = await fetch("matches.json");
    if (!response.ok) {
      console.error("Fichier matches.json non trouvé");
      return null;
    }
    const data = await response.json();
    return data.matches || [];
  } catch (err) {
    console.error("Erreur lors du chargement des matchs:", err);
    return null;
  }
}

async function displayMatches() {
  const matches = await loadMatches();
  
  if (!matches || matches.length === 0) {
    console.log("Pas de matchs disponibles");
    return;
  }

  // Afficher le premier match dans la section hero (ticket)
  const hero = matches[0];
  if (hero) {
    const ticketBody = document.querySelector(".ticket-body");
    ticketBody.innerHTML = `
      <div class="matchup">
        <div class="team">
          <div class="crest a">${hero.home.substring(0, 3).toUpperCase()}</div>
          <div class="team-name">${hero.home}</div>
          <div class="form"><span class="w">V</span><span class="w">V</span><span class="d">N</span><span class="w">V</span><span class="l">D</span></div>
        </div>
        <div class="vs">VS</div>
        <div class="team">
          <div class="crest b">${hero.away.substring(0, 3).toUpperCase()}</div>
          <div class="team-name">${hero.away}</div>
          <div class="form"><span class="d">N</span><span class="w">V</span><span class="w">V</span><span class="d">N</span><span class="l">D</span></div>
        </div>
      </div>
      <div class="kickoff">${hero.kickoffLabel}</div>
      <div class="confidence-label">
        <span>Indice de confiance</span>
        <span class="confidence-value">${hero.confidence}%</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width: ${hero.confidence}%;"></div></div>
      <div class="probs">
        <div class="prob pick"><div class="k">1 · ${hero.home}</div><div class="v">${hero.probHome}%</div></div>
        <div class="prob"><div class="k">N</div><div class="v">${hero.probDraw}%</div></div>
        <div class="prob"><div class="k">2 · ${hero.away}</div><div class="v">${hero.probAway}%</div></div>
      </div>
    `;
  }

  // Afficher les 3 matchs dans la section "Pronostics du jour"
  const picksGrid = document.querySelector(".picks-grid");
  picksGrid.innerHTML = matches.slice(0, 3).map((match, i) => `
    <div class="pick-card ${i > 0 ? 'locked' : ''}">
      <div class="league">Ligue 1 · ${match.kickoffLabel}</div>
      <div class="fixture">${match.home} — ${match.away}</div>
      <div class="tip">${match.tip}</div>
      <div class="meta"><span>Score de confiance</span><span class="conf">${match.confidence}%</span></div>
      ${i > 0 ? `<div class="lock-overlay"><div class="lock-icon">🔒</div><span>Réservé VIP</span></div>` : ''}
    </div>
  `).join("");
}

// ===== INITIALISATION =====
async function init() {
  await checkVipStatus();
  await displayMatches();
}

// Vérifier la session au chargement
window.addEventListener("load", init);

// Écouter les changements d'authentification
supabase.auth.onAuthStateChange(async () => {
  await checkVipStatus();
});
