// Test input only: goes through the same published-result preparation as production.
import { QualifyingFormat, ResultSession } from "@/domain/enums";
import { composeSessionGraphic, prepareSessionGraphic, selectGraphicSession } from "../result-graphic-data";
import { hydrateGraphicAssets } from "../result-graphic-storage";
import { graphicTemplates, type GraphicTemplate } from "../templates/catalog";
import { raceFixture } from "./fixtures";

export async function preparedTextGraphic(type: GraphicTemplate) {
  const race = raceFixture();
  race.race.name = "Melbourne Grand Prix";
  race.race.circuit = "Albert Park";
  race.race.round = 1;
  race.race.season.name = "Season 7";
  race.race.season.league.code = "F1";
  const session = race.sessions[0];
  session.session = graphicTemplates[type].session;
  session.qualifyingFormat = session.session === ResultSession.Qualifying ? QualifyingFormat.Full : null;
  for (const row of session.results) {
    row.driver.name = ["Patrick Mahomes", "Jörg Weiß-Søren", "André O'Neill"][row.driverId - 1];
    row.representedTeam.name = ["AMD Mercedes F1 Team", "Müller Racing", "Côte d’Azur Racing"][row.driverId - 1];
    row.q3TimeMs = 77828 + (row.driverId - 1) * 201;
    row.fastestLapMs = 77828 + (row.driverId - 1) * 201;
    row.totalTimeMs = row.adjustedTimeMs = 5524381 + (row.driverId - 1) * 201;
    row.gapToWinnerMs = (row.driverId - 1) * 201;
    row.racePoints = [25, 18, 15][row.driverId - 1];
  }
  const selected = selectGraphicSession(race, type, session.id);
  const prepared = prepareSessionGraphic(selected, type);
  const rows = await hydrateGraphicAssets(prepared.rows, async () => null);
  return composeSessionGraphic(race, selected, type, prepared, rows, null);
}
