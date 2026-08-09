// Recupere les prochains matchs de plusieurs ligues via football-data.org.
// Version simplifiee : confiance neutre + leger bonus domicile (pas de classement pour l'instant).

const TOKEN = process.env.FOOTBALL_API_TOKEN;
const BASE = "https://api.football-data.org/v4";
const fs = require("fs");

const COMPETITIONS = ["FL1", "PL", "PD", "BL1", "SA", "DED", "PPL", "BSA", "ELC"];

const LEAGUE_NAMES = {
  FL1: "Ligue 1", PL: "Premier League", PD: "Liga", BL1: "Bundesliga",
  SA: "Serie A", DED: "Eredivisie", PPL: "Primeira Liga", BSA: "Brasileirao",
  ELC: "Championship"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function outcomeFromScore(home, away) {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

// Genere un pronostic HT/FT simple (mi-temps / fin de match)
// base sur l'avantage domicile utilise dans le reste du script.
function buildHtFtTip(homeName) {
  return `1/1 (${homeName} mene a la mi-temps et gagne)`;
}

// Genere un pronostic de score exact simple, coherent avec l'issue predite.
function buildExactScoreTip() {
  return "2-1";
}

async function collectUpcomingMatches() {
  const allUpcoming = [];

  for (const comp of COMPETITIONS) {
    try {
      const matchesData = await fetchJson(`${BASE}/competitions/${comp}/matches?status=SCHEDULED`);
      const count = matchesData.matches ? matchesData.matches.length : 0;
      console.log(`${comp}: ${count} match(s) programme(s) trouve(s)`);

      if (matchesData.matches) {
        matchesData.matches.forEach(m => {
          const confHome = 56;
          const kickoff = new Date(m.utcDate);
          const homeName = m.homeTeam.shortName || m.homeTeam.name;
          allUpcoming.push({
            id: m.id,
            league: LEAGUE_NAMES[comp] || comp,
            home: homeName,
            away: m.awayTeam.shortName || m.awayTeam.name,
            kickoffISO: m.utcDate,
            kickoffLabel: kickoff.toLocaleString("fr-FR", {
              weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
            }),
            confidence: confHome,
            probHome: confHome,
            probDraw: 20,
            probAway: 24,
            predictedOutcome: "HOME",
            tip: `Victoire ${homeName}`,
            htftTip: buildHtFtTip(homeName),
            exactScoreTip: buildExactScoreTip()
          });
        });
      }
    } catch (err) {
      console.log(`${comp}: ECHEC (${err.message})`);
    }
    await sleep(6500);
  }

  allUpcoming.sort((a, b) => new Date(a.kickoffISO) - new Date(b.kickoffISO));
  console.log(`Total combine avant tri final: ${allUpcoming.length} match(s)`);
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

  for (const entry of previousMatches) {
    const kickoff = new Date(entry.kickoffISO);
    if (kickoff < now) {
      try {
        const matchData = await fetchJson(`${BASE}/matches/${entry.id}`);
        if (matchData.status === "FINISHED" && matchData.score && matchData.score.fullTime) {
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
      } catch (err) {
        console.log(`Resolution match ${entry.id}: ECHEC (${err.message})`);
      }
      await sleep(6500);
    }
  }

  return history.slice(0, 20);
}

async function main() {
  if (!TOKEN) throw new Error("FOOTBALL_API_TOKEN manquant.");

  let previousMatches = [];
  if (fs.existsSync("matches.json")) {
    try {
      previousMatches = JSON.parse(fs.readFileSync("matches.json", "utf8")).matches || [];
    } catch (e) { previousMatches = []; }
  }

  const history = await resolveHistory(previousMatches);
  fs.writeFileSync("results.json", JSON.stringify({ updatedAt: new Date().toISOString(), history }, null, 2));

  const matches = await collectUpcomingMatches();
  fs.writeFileSync("matches.json", JSON.stringify({ updatedAt: new Date().toISOString(), matches }, null, 2));

  console.log(`RESULTAT FINAL -> matches.json: ${matches.length} match(s). results.json: ${history.length} resultat(s).`);
}

main().catch(err => {
  console.error("ERREUR FATALE:", err.message);
  process.exit(1);
});
