// Recupere les prochains matchs de plusieurs ligues via football-data.org,
// calcule un score de confiance, et suit l'historique des predictions resolues.

const TOKEN = process.env.FOOTBALL_API_TOKEN;
const BASE = "https://api.football-data.org/v4";
const fs = require("fs");

// Ligues couvertes par le plan gratuit de football-data.org
const LEAGUE_COMPETITIONS = ["FL1", "PL", "PD", "BL1", "SA", "DED", "PPL", "BSA", "ELC"];
const CUP_COMPETITIONS = ["CL", "EC", "WC"];
const ALL_COMPETITIONS = [...LEAGUE_COMPETITIONS, ...CUP_COMPETITIONS];

const LEAGUE_NAMES = {
  FL1: "Ligue 1", PL: "Premier League", PD: "Liga", BL1: "Bundesliga",
  SA: "Serie A", DED: "Eredivisie", PPL: "Primeira Liga", BSA: "Brasileirao",
  ELC: "Championship", CL: "Ligue des Champions", EC: "Euro", WC: "Coupe du Monde"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  if (!res.ok) {
    throw new Error(`Erreur API (${res.status}) pour ${url}`);
  }
  return res.json();
}

async function safeFetch(url) {
  try {
    const data = await fetchJson(url);
    await sleep(6500); // respecter la limite de 10 requetes/minute
    return data;
  } catch (err) {
    console.error(`Echec pour ${url}: ${err.message}`);
    await sleep(6500);
    return null;
  }
}

function computeConfidence(homePos, awayPos) {
  const gap = awayPos - homePos;
  const base = 50;
  const swing = Math.max(-30, Math.min(30, gap * 2));
  const homeAdvantage = 6;
  let confHome = base + swing + homeAdvantage;
  confHome = Math.max(20, Math.min(85, confHome));
  const remaining = 100 - confHome;
  const confDraw = Math.round(remaining * 0.45);
  const confAway = remaining - confDraw;
  return { confidence: Math.round(confHome), probHome: Math.round(confHome), probDraw: confDraw, probAway: confAway };
}

function neutralConfidence() {
  return { confidence: 50, probHome: 50, probDraw: 25, probAway: 25 };
}

function outcomeFromScore(home, away) {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

async function collectUpcomingMatches() {
  const allUpcoming = [];

  for (const comp of ALL_COMPETITIONS) {
    let posByTeam = {};
    if (LEAGUE_COMPETITIONS.includes(comp)) {
      const standingsData = await safeFetch(`${BASE}/competitions/${comp}/standings`);
      if (standingsData) {
        try {
          const table = standingsData.standings.find(s => s.type === "TOTAL").table;
          table.forEach(row => { posByTeam[row.team.id] = row.position; });
        } catch (e) { /* pas de classement exploitable */ }
      }
    }

    const matchesData = await safeFetch(`${BASE}/competitions/${comp}/matches?status=SCHEDULED`);
    if (!matchesData || !matchesData.matches) continue;

    matchesData.matches.forEach(m => {
      const homePos = posByTeam[m.homeTeam.id];
      const awayPos = posByTeam[m.awayTeam.id];
      const conf = (homePos && awayPos) ? computeConfidence(homePos, awayPos) : neutralConfidence();
      const kickoff = new Date(m.utcDate);

      allUpcoming.push({
        id: m.id,
        league: LEAGUE_NAMES[comp] || comp,
        home: m.homeTeam.shortName || m.homeTeam.name,
        away: m.awayTeam.shortName || m.awayTeam.name,
        kickoffISO: m.utcDate,
        kickoffLabel: kickoff.toLocaleString("fr-FR", {
          weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
        }),
        confidence: conf.confidence,
        probHome: conf.probHome,
        probDraw: conf.probDraw,
        probAway: conf.probAway,
        predictedOutcome: conf.confidence >= 55 ? "HOME" : (conf.probAway > conf.probHome ? "AWAY" : "DRAW"),
        tip: conf.confidence >= 55 ? `Victoire ${m.homeTeam.shortName || m.homeTeam.name}` : "Match equilibre"
      });
    });
  }

  allUpcoming.sort((a, b) => new Date(a.kickoffISO) - new Date(b.kickoffISO));
  return allUpcoming.slice(0, 4);
}

async function resolveHistory(previousMatches) {
  let history = [];
  if (fs.existsSync("results.json")) {
    try {
      history = JSON.parse(fs.readFileSync("results.json", "utf8")).history || [];
    } catch (e) { history = []; }
  }

  const now = new Date();
  const stillPending = [];

  for (const entry of previousMatches) {
    const kickoff = new Date(entry.kickoffISO);
    if (kickoff < now) {
      const matchData = await safeFetch(`${BASE}/matches/${entry.id}`);
      if (matchData && matchData.status === "FINISHED" && matchData.score && matchData.score.fullTime) {
        const homeScore = matchData.score.fullTime.home;
        const awayScore = matchData.score.fullTime.away;
        const actual = outcomeFromScore(homeScore, awayScore);
        history.unshift({
          league: entry.league,
          home: entry.home,
          away: entry.away,
          scoreLabel: `${homeScore} - ${awayScore}`,
          predictedOutcome: entry.predictedOutcome,
          actualOutcome: actual,
          correct: entry.predictedOutcome === actual,
          date: entry.kickoffISO
        });
      }
      // si pas encore termine ou erreur, on l'abandonne simplement (pas remis en attente)
    } else {
      stillPending.push(entry);
    }
  }

  history = history.slice(0, 20);
  return { history, stillPending };
}

async function main() {
  if (!TOKEN) throw new Error("FOOTBALL_API_TOKEN manquant.");

  let previousMatches = [];
  if (fs.existsSync("matches.json")) {
    try {
      previousMatches = JSON.parse(fs.readFileSync("matches.json", "utf8")).matches || [];
    } catch (e) { previousMatches = []; }
  }

  const { history } = await resolveHistory(previousMatches);
  fs.writeFileSync("results.json", JSON.stringify({ updatedAt: new Date().toISOString(), history }, null, 2));

  const matches = await collectUpcomingMatches();
  fs.writeFileSync("matches.json", JSON.stringify({ updatedAt: new Date().toISOString(), matches }, null, 2));

  console.log(`matches.json: ${matches.length} match(s). results.json: ${history.length} resultat(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
