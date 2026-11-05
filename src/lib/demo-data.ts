import type {
  Category,
  DemoState,
  Incident,
  IncidentStatus,
  Priority,
} from "./types";

// All people, reports, and incident positions are fictional training fixtures.
// Geographic labels provide map context only; they do not identify real emergencies.
const fixtureTime = "2026-11-06T08:30:00.000Z";

export function createDemoState(): DemoState {
  // Relative timestamps keep new actions after the fixture history, including
  // around midnight in East Africa Time.
  const base = Date.now();
  const at = (minutes: number) =>
    new Date(base - minutes * 60_000).toISOString();
  const rows: [
    string,
    Category,
    string,
    string,
    [number, number] | null,
    Priority,
    IncidentStatus,
    string | null,
    number,
  ][] = [
    [
      "001",
      "Road Accident",
      "Two-vehicle collision",
      "Jinja Road · Nakawa",
      [0.3315, 32.6139],
      "Critical",
      "Pending",
      null,
      12,
    ],
    [
      "002",
      "Fire Outbreak",
      "Commercial building fire",
      "Industrial Area · Kampala",
      [0.3083, 32.6014],
      "Critical",
      "Responding",
      "fire-1",
      26,
    ],
    [
      "003",
      "Road Accident",
      "Motorcycle collision",
      "Bombo Road · Wandegeya",
      [0.3395, 32.5745],
      "High",
      "Accepted",
      "road-1",
      39,
    ],
    [
      "004",
      "Fire Outbreak",
      "Residential fire report",
      "Ntinda · Kampala",
      [0.3581, 32.6176],
      "High",
      "Pending",
      null,
      53,
    ],
    [
      "005",
      "Road Accident",
      "Vehicle obstructing junction",
      "Entebbe Road · Clock Tower",
      [0.3026, 32.5801],
      "Medium",
      "Responding",
      "road-2",
      71,
    ],
    [
      "006",
      "Road Accident",
      "Multi-vehicle road incident",
      "Northern Bypass · Bwaise",
      [0.365, 32.5596],
      "High",
      "Pending",
      null,
      88,
    ],
    [
      "007",
      "Fire Outbreak",
      "Small workshop fire",
      "Bugolobi · Kampala",
      [0.3153, 32.6245],
      "Medium",
      "Accepted",
      "fire-2",
      114,
    ],
    [
      "008",
      "Road Accident",
      "Single-vehicle collision",
      "Makerere Hill Road",
      [0.3436, 32.5651],
      "Low",
      "Resolved",
      "road-1",
      152,
    ],
    [
      "009",
      "Fire Outbreak",
      "Reported electrical fire",
      "Bukoto · Kampala",
      [0.3527, 32.6016],
      "High",
      "Resolved",
      "fire-1",
      221,
    ],
    [
      "010",
      "Road Accident",
      "Vehicle collision report",
      "Kira Road · Kamwokya",
      [0.3456, 32.5925],
      "Medium",
      "Resolved",
      "road-3",
      263,
    ],
    [
      "011",
      "Fire Outbreak",
      "Duplicate workshop report",
      "Bugolobi · Kampala",
      [0.3155, 32.6241],
      "Low",
      "Cancelled",
      null,
      291,
    ],
    [
      "012",
      "Road Accident",
      "Road incident awaiting location",
      "Location confirmation needed",
      null,
      "Medium",
      "Pending",
      null,
      321,
    ],
  ];

  const incidents: Incident[] = rows.map(
    ([
      id,
      category,
      title,
      location,
      coordinates,
      priority,
      status,
      responderId,
      minutes,
    ]) => {
      const reportedAt = at(minutes);
      const timeline: Incident["timeline"] = [
        {
          id: `${id}-report`,
          at: reportedAt,
          actor: "Training reporter",
          title: "Simulated incident reported",
          detail:
            "Fictional training record. No emergency services have been contacted.",
          kind: "report",
        },
      ];
      if (responderId)
        timeline.push({
          id: `${id}-assign`,
          at: at(minutes - 2),
          actor: "Demo coordinator",
          title: "Responder assigned",
          kind: "assignment",
        });
      if (["Accepted", "Responding", "Resolved"].includes(status))
        timeline.push({
          id: `${id}-accept`,
          at: at(minutes - 4),
          actor: "Demo responder",
          title: "Incident accepted",
          kind: "status",
        });
      if (["Responding", "Resolved"].includes(status))
        timeline.push({
          id: `${id}-respond`,
          at: at(minutes - 7),
          actor: "Demo responder",
          title: "Response started",
          kind: "status",
        });
      if (status === "Resolved")
        timeline.push({
          id: `${id}-resolve`,
          at: at(minutes - 32),
          actor: "Demo responder",
          title: "Incident resolved",
          detail: "Training response complete; fictional scene cleared.",
          kind: "status",
        });
      if (status === "Cancelled")
        timeline.push({
          id: `${id}-cancel`,
          at: at(minutes - 8),
          actor: "Demo coordinator",
          title: "Incident cancelled",
          detail: "Duplicate of training incident SERS-007.",
          kind: "status",
        });
      return {
        id,
        reference: `SERS-${id}`,
        category,
        title,
        description: `Simulated ${category.toLowerCase()} report near ${location}. ${category === "Road Accident" ? "Assess the scene, confirm the road conditions, and coordinate the assigned response team." : "Confirm the reported fire location, assess access to the scene, and coordinate the assigned fire response team."} This record exists for dashboard training only.`,
        location,
        coordinates,
        priority,
        status,
        responderId,
        reportedAt,
        updatedAt: timeline[timeline.length - 1].at,
        timeline,
      };
    },
  );

  // A small historical set makes every chart derive from the same incident records.
  for (let day = 1; day <= 6; day++) {
    for (let n = 0; n < 3 + (day % 3); n++) {
      const id = `H${day}${n}`;
      const category: Category = n % 2 ? "Fire Outbreak" : "Road Accident";
      const reportedAt = at(day * 1440 + n * 75);
      const ended = at(day * 1440 + n * 75 - 38);
      incidents.push({
        id,
        reference: `SERS-${id}`,
        category,
        title: `Archived training ${category.toLowerCase()}`,
        description: "Fictional historical record for training analytics.",
        location: "Kampala training area",
        coordinates: null,
        priority: n % 2 ? "Medium" : "Low",
        status: "Resolved",
        responderId: category === "Road Accident" ? "road-1" : "fire-1",
        reportedAt,
        updatedAt: ended,
        timeline: [
          {
            id: `${id}-report`,
            at: reportedAt,
            actor: "Training reporter",
            title: "Simulated incident reported",
            kind: "report",
          },
          {
            id: `${id}-resolve`,
            at: ended,
            actor: "Demo responder",
            title: "Incident resolved",
            kind: "status",
          },
        ],
      });
    }
  }

  return {
    version: 1,
    incidents,
    responders: [
      {
        id: "road-1",
        name: "Alex Morgan",
        initials: "AM",
        callsign: "ROAD 01",
        category: "Road Accident",
        availability: "On duty",
        active: true,
      },
      {
        id: "road-2",
        name: "Daniel Okello",
        initials: "DO",
        callsign: "ROAD 02",
        category: "Road Accident",
        availability: "On duty",
        active: true,
      },
      {
        id: "road-3",
        name: "Sarah Namuli",
        initials: "SN",
        callsign: "ROAD 03",
        category: "Road Accident",
        availability: "Available",
        active: true,
      },
      {
        id: "road-4",
        name: "James Kato",
        initials: "JK",
        callsign: "ROAD 04",
        category: "Road Accident",
        availability: "Available",
        active: true,
      },
      {
        id: "fire-1",
        name: "Nina Patel",
        initials: "NP",
        callsign: "FIRE 01",
        category: "Fire Outbreak",
        availability: "On duty",
        active: true,
      },
      {
        id: "fire-2",
        name: "Peter Mugisha",
        initials: "PM",
        callsign: "FIRE 02",
        category: "Fire Outbreak",
        availability: "On duty",
        active: true,
      },
      {
        id: "fire-3",
        name: "Grace Achieng",
        initials: "GA",
        callsign: "FIRE 03",
        category: "Fire Outbreak",
        availability: "Available",
        active: true,
      },
      {
        id: "fire-4",
        name: "David Ssemanda",
        initials: "DS",
        callsign: "FIRE 04",
        category: "Fire Outbreak",
        availability: "Off duty",
        active: true,
      },
    ],
    notifications: [
      {
        id: "n-1",
        incidentId: "001",
        title: "Critical road accident awaiting assignment",
        at: at(12),
        read: false,
      },
      {
        id: "n-2",
        incidentId: "004",
        title: "New fire outbreak report",
        at: at(53),
        read: false,
      },
      {
        id: "n-3",
        incidentId: "003",
        title: "Alex Morgan accepted SERS-003",
        at: at(35),
        read: true,
      },
    ],
    role: "admin",
    preferences: { dark: false, name: "Jordan Williams", notifications: true },
  };
}

export const DEMO_FIXTURE_REFERENCE = fixtureTime;
