if (typeof window.__tribuneDataLoaded === "undefined") {
window.__tribuneDataLoaded = true;

const SUPABASE_URL = "https://fcmikgybijgxuupzxqhh.supabase.co";
const SUPABASE_KEY = "sb_publishable_f57DCsIibKCeuOyjn6atcQ_xmUSdMUB";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  authSwitch.textContent = isSignUp ? "Deja inscrit ? Se connecter" : "Pas encore de compte ? S'inscrire";
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
      authError.textContent = "Inscription reussie ! Vous pouvez vous connecter.";
      isSignUp = false;
      authTitle.textContent = "Connexion";
      authSubmit.textContent = "Se connecter";
      authSwitch.textContent = "Pas encore de compte ? S'inscrire";
      authEmail.value = "";
      authPassword.value = "";
    }
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

const vipBanner = document.getElementById("vip-banner");

async function checkVipStatus() {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;

  if (!session || !session.user) {
    authBtn.textContent = "Connexion";
    vipBanner.style.display = "none";
    return false;
  }

  authBtn.textContent = "Deconnexion";

  try {
    const profileResult = await supabase
      .from("Profils")
      .select("est_vip")
      .eq("email", session.user.email)
      .single();

    if (profileResult.error) {
      await supabase.from("Profils").insert({ email: session.user.email, est_vip: false });
      vipBanner.style.display = "none";
      return false;
    }

    if (profileResult.data && profileResult.data.est_vip) {
      vipBanner.style.display = "block";
      return true;
    }
  } catch (err) {
    console.error("Erreur VIP:", err);
  }

  vipBanner.style.display = "none";
  return false;
}

authBtn.addEventListener("click", async (e) => {
  if (authBtn.textContent === "Deconnexion") {
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
  }
});

async function loadJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Erreur de chargement " + path + ":", err);
    return null;
  }
}

async function displayMatches(isVip) {
  const data = await loadJson("matches.json");
  const matches = data ? data.matches : null;
  if (!matches || matches.length === 0) return;

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
        '<div class="kickoff">' + hero.league + ' . ' + hero.kickoffLabel + '</div>' +
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
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const shouldLock = i > 0 && !isVip;
      const lockedClass = shouldLock ? "locked" : "";
      const lockOverlay = shouldLock ? '<div class="lock-overlay"><div class="lock-icon">V</div><span>Reserve VIP</span></div>' : "";
      html += '<div class="pick-card ' + lockedClass + '">' +
        '<div class="league">' + match.league + ' . ' + match.kickoffLabel + '</div>' +
        '<div class="fixture">' + match.home + ' vs ' + match.away + '</div>' +
        '<div class="tip">' + match.tip + '</div>' +
        '<div class="meta"><span>Score de confiance</span><span class="conf">' + match.confidence + '%</span></div>' +
        lockOverlay +
        '</div>';
    }
    picksGrid.innerHTML = html;
  }
}

async function displayResults() {
  const data = await loadJson("results.json");
  const history = data ? data.history : null;
  const container = document.getElementById("results-list");
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<p style="color:var(--muted); font-size:14px;">Aucun resultat pour le moment. Revenez apres les premiers matchs.</p>';
    return;
  }

  let html = "";
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    const icon = r.correct ? "V" : "X";
    const color = r.correct ? "var(--turf)" : "var(--red)";
    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-top:1px solid var(--line); font-size:13.5px;">' +
      '<span>' + r.league + ' . ' + r.home + ' ' + r.scoreLabel + ' ' + r.away + '</span>' +
      '<span style="color:' + color + '; font-weight:700; font-family:\'JetBrains Mono\', monospace;">' + icon + '</span>' +
      '</div>';
  }
  container.innerHTML = html;
}

async function init() {
  let isVip = false;
  try {
    isVip = await checkVipStatus();
  } catch (err) {
    console.error("Erreur checkVipStatus:", err);
  }
  try {
    await displayMatches(isVip);
  } catch (err) {
    console.error("Erreur displayMatches:", err);
  }
  try {
    await displayResults();
  } catch (err) {
    console.error("Erreur displayResults:", err);
  }
}

window.addEventListener("load", init);

let authListenerInitialized = false;
supabase.auth.onAuthStateChange((event) => {
  if (!authListenerInitialized) {
    authListenerInitialized = true;
    return;
  }
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    location.reload();
  }
});

                       }
