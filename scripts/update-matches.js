// Script qui récupère les prochains matchs de Ligue 1 via football-data.org
// et calcule un score de confiance simple basé sur le classement des équipes.

const TOKEN = process.env.FOOTBALL_API_TOKEN;
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "FL1"; // Ligue 1

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "X-Auth-Token": TOKEN }
  });
  if (!res.ok) {
    throw new Error(`Erreur API (${res.status}) pour ${url}`);
  }
  return res.json();
}

function computeConfidence(homePos, awayPos, totalTeams) {
  // Plus l'écart de classement est grand, plus la confiance est haute.
  const gap = awayPos - homePos; // positif si l'équipe à domicile est mieux classée
  const base = 50;
  const swing = Math.max(-30, Math.min(30, gap * 2));
  const homeAdvantage = 6; // petit bonus pour l'équipe qui reçoit
  let confHome = base + swing + homeAdvantage;
  confHome = Math.max(20, Math.min(85, confHome));
  const remaining = 100 - confHome;
  const confDraw = Math.round(remaining * 0.45);
  const confAway = remaining - confDraw;
  return {
    confidence: Math.round(confHome),
    probHome: Math.round(confHome),
    probDraw: confDraw,
    probAway: confAway
  };
}

async function main() {
  if (!TOKEN) {
    throw new Error("FOOTBALL_API_TOKEN manquant.");
  }

  const standingsData = await fetchJson(`${BASE}/competitions/${COMPETITION}/standings`);
  const table = standingsData.standings.find(s => s.type === "TOTAL").table;
  const totalTeams = table.length;
  const posByTeam = {};
  table.forEach(row => { posByTeam[row.team.id] = row.position; });

  const matchesData = await fetchJson(`${BASE}/competitions/${COMPETITION}/matches?status=SCHEDULED`);
  const upcoming = matchesData.matches
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .slice(0, 3);

  const results = upcoming.map(m => {
    const homePos = posByTeam[m.homeTeam.id] || Math.ceil(totalTeams / 2);
    const awayPos = posByTeam[m.awayTeam.id] || Math.ceil(totalTeams / 2);
    const conf = computeConfidence(homePos, awayPos, totalTeams);
    const kickoff = new Date(m.utcDate);

    return {
      league: "Ligue 1",
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
      tip: conf.confidence >= 55
        ? `Victoire ${m.homeTeam.shortName || m.homeTeam.name}`
        : "Match équilibré"
    };
  });

  const fs = require("fs");
  fs.writeFileSync("matches.json", JSON.stringify({
    updatedAt: new Date().toISOString(),
    matches: results
  }, null, 2));

  console.log(`Fichier matches.json mis à jour avec ${results.length} match(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
