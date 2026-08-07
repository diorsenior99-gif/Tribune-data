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
    const result = await supabase.auth.signUp({ email: email, password: password });
    if (result.error) {
      authError.textContent = result.error.message;
    } else {
      authError.textContent = "Inscription réussie ! Vous pouvez vous connecter.";
      isSignUp = false;
      authTitle.textContent = "Connexion";
      authSubmit.textContent = "Se connecter";
      authSwitch.textContent = "Pas encore de compte ? S'inscrire";
      authEmail.value = "";
      authPassword.value = "";}
  } else {
    const result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
      authError.textContent = result.error.message;
    } else {
      modal.style.display = "none";
      location.reload();
    }
  }
});

// ===== VIP STATUS =====
const vipBanner = document.getElementById("vip-banner");

async function checkVipStatus() {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;

  if (!session || !session.user) {
    authBtn.textContent = "Connexion";
    vipBanner.style.display = "none";
    return false;
  }

  authBtn.textContent = "Déconnexion";

  try {
    const profileResult = await supabase
      .from("Profils")
      .select("est_vip")
      .eq("email", session.user.email)
      .single();

    if (profileResult.error) {
      await supabase.from("Profils").insert({
        email: session.user.email,
        est_vip: false
      });
      vipBanner.style.display = "none";
      return false;
    }

    if (profileResult.data && profileResult.data.est_vip) {
      vipBanner.style.display = "block";
      const lockedCards = document.querySelectorAll(".locked");
      lockedCards.forEach(function(card) {
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

  const hero = matches[0];
  if (hero) {
    const ticketBody = document.querySelector(".ticket-body");
    if (ticketBody) {
      ticketBody.innerHTML =
        '<div class="matchup">' +
          '<div class="team">' +
            '<div class="crest a">' + hero.home.substring(0, 3).toUpperCase() + '</div>' +
            '<div class="team-name">' + hero.home + '</div>' +
            '<div class="form"><span class="w">V</span><span class="w">V</span><span class="d">N</span><span class="w">V</span><span class="l">D</span></div>' +
          '</div>' +
          '<div class="vs">VS</div>' +
          '<div class="team">' +
            '<div class="crest b">' + hero.away.substring(0, 3).toUpperCase() + '</div>' +
            '<div class="team-name">' + hero.away + '</div>' +
            '<div class="form"><span class="d">N</span><span class="w">V</span><span class="w">V</span><span class="d">N</span><span class="l">D</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="kickoff">' + hero.kickoffLabel + '</div>' +
        '<div class="confidence-label"><span>Indice de confiance</span><span class="confidence-value">' + hero.confidence + '%</span></div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + hero.confidence + '%;"></div></div>' +
        '<div class="probs">' +
          '<div class="prob pick"><div class="k">1 . ' + hero.home + '</div><div class="v">' + hero.probHome + '%</div></div>' +
          '<div class="prob"><div class="k">N</div><div class="v">' + hero.probDraw + '%</div></div>' +
          '<div class="prob"><div class="k">2 . ' + hero.away + '</div><div class="v">' + hero.probAway + '%</div></div>' +
        '</div>';
    }
  }

  const picksGrid = document.querySelector(".picks-grid");
  if (picksGrid) {
    let html = "";
    for (let i = 0; i < Math.min(3, matches.length); i++) {
      const match = matches[i];
      const lockedClass = i > 0 ? "locked" : "";
      const lockOverlay = i > 0 ? '<div class="lock-overlay"><div class="lock-icon">L</div><span>Reserve VIP</span></div>' : "";
      html += '<div class="pick-card ' + lockedClass + '">' +
        '<div class="league">Ligue 1 . ' + match.kickoffLabel + '</div>' +
        '<div class="fixture">' + match.home + ' vs ' + match.away + '</div>' +
        '<div class="tip">' + match.tip + '</div>' +
        '<div class="meta"><span>Score de confiance</span><span class="conf">' + match.confidence + '%</span></div>' +
        lockOverlay +
        '</div>';
    }
    picksGrid.innerHTML = html;
  }
}

// ===== INITIALISATION =====
async function init() {
  try {
    await checkVipStatus();
  } catch (err) {
    console.error("Erreur checkVipStatus:", err);
  }
  try {
    await displayMatches();
  } catch (err) {
    console.error("Erreur displayMatches:", err);
  }
}

window.addEventListener("load", init);

supabase.auth.onAuthStateChange(async () => {
  await checkVipStatus();
});
