export const tickets = [
  {
    id: 24,
    title: "Kollision in Turn 1",
    race: "Italian Grand Prix",
    lap: 24,
    corner: "Turn 1",
    status: "In Bearbeitung",
    priority: "Hoch",
    drivers: [
      {
        id: 1,
        name: "Max Verstappen",
        team: "Red Bull Racing",
        number: 1,
        flag: "🇳🇱",
      },
      {
        id: 2,
        name: "Lando Norris",
        team: "McLaren",
        number: 4,
        flag: "🇬🇧",
      },
    ],
    description:
      "Kontakt beim Anbremsen von Turn 1. Beide Fahrer melden den Vorfall der FIA.",
  },

  {
    id: 23,
    title: "Track Limits",
    race: "British Grand Prix",
    lap: 18,
    corner: "Turn 9",
    status: "Offen",
    priority: "Normal",
    drivers: [
      {
        id: 3,
        name: "Charles Leclerc",
        team: "Ferrari",
        number: 16,
        flag: "🇲🇨",
      },
    ],
    description:
      "Mehrfaches Verlassen der Strecke.",
  },

  {
    id: 22,
    title: "Unsafe Release",
    race: "Belgian Grand Prix",
    lap: 12,
    corner: "Pit Exit",
    status: "Erledigt",
    priority: "Niedrig",
    drivers: [
      {
        id: 4,
        name: "George Russell",
        team: "Mercedes",
        number: 63,
        flag: "🇬🇧",
      },
    ],
    description:
      "Unsicheres Herausfahren aus der Boxengasse.",
  },
];