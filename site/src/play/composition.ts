import {
  buildBulgariaBureaucracyCampaign,
  buildBulgariaDrivingCampaign,
  buildBulgariaEnterpriseCampaign,
  buildBulgariaInheritanceCampaign,
  buildBulgariaReturnCampaign,
  buildLuciferChroniclesCampaign,
  buildValidatedContentRegistry,
  createEngine,
  createInMemorySessionStore,
  simulationKind,
  storyGraphKind,
  worldGraphKind,
  type SessionPersistence,
  type StoredSaveRecord,
  type SessionStore,
} from "@the-running-dev/game-engine";

export interface BrowserCampaign {
  readonly campaignId: string;
  readonly title: string;
  readonly description: string;
  readonly duration: string;
  readonly contentNotice: string;
  readonly featured: boolean;
  readonly sources?: readonly { label: string; href: string }[];
}

function localPersistence(): SessionPersistence {
  const sessions = new Map();
  return {
    sessions: {
      async get(id) {
        return sessions.get(id);
      },
      async put(record) {
        sessions.set(record.sessionId, record);
      },
    },
    saves: {
      async get(id) {
        const raw = localStorage.getItem(`subzerodev.play.save.v1.${id}`);
        return raw ? (JSON.parse(raw) as StoredSaveRecord) : undefined;
      },
      async put(record) {
        localStorage.setItem(
          `subzerodev.play.save.v1.${record.campaignId}`,
          JSON.stringify(record),
        );
      },
      async delete(id) {
        const raw = await this.get(id);
        if (raw)
          localStorage.removeItem(`subzerodev.play.save.v1.${raw.campaignId}`);
      },
    },
  };
}

function browserStorageAvailable(): boolean {
  try {
    const probe = "subzerodev.play.storage-probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function createBrowserDemo(): {
  catalog: readonly BrowserCampaign[];
  store: SessionStore;
} {
  const built = [
    buildLuciferChroniclesCampaign(),
    buildBulgariaBureaucracyCampaign(),
    buildBulgariaReturnCampaign(),
    buildBulgariaDrivingCampaign(),
    buildBulgariaInheritanceCampaign(),
    buildBulgariaEnterpriseCampaign(),
  ];
  if (built.some((result) => !result.ok || result.value === undefined))
    throw new Error("A playable campaign could not be built.");
  const campaigns = built.map((result) => result.value!);
  const kinds = {
    "story-graph": storyGraphKind,
    simulation: simulationKind,
    "world-graph": worldGraphKind,
  } as const;
  const registry = buildValidatedContentRegistry(campaigns, kinds);
  if (!registry.ok || !registry.value)
    throw new Error("The playable catalog could not be validated.");
  const descriptions = [
    [
      "Lucifer Chronicles: The Bulgarian Incident",
      "A profane, cosmic support ticket through property, paperwork, cars, AI scope creep, and Hell.",
      "35–50 min",
      "Strong language, religious satire, dangerous-driving anecdotes, and recognizable parody.",
      true,
    ],
    [
      "The Bureaucracy",
      "Municipal, cadastral, archive, notary, and translation routes through one determined folder.",
      "10–15 min per route",
      "Satirical depictions of public offices, administrative failure, and financial frustration.",
      false,
    ],
    [
      "The Return",
      "Return to Bulgaria through city, village, or temporary-home routes.",
      "8–12 min per route",
      "Themes of migration, family pressure, housing, and homesickness.",
      false,
    ],
    [
      "Driving",
      "Inspection, road trouble, insurance, towing, and mechanical optimism.",
      "10–15 min per route",
      "Dangerous-driving anecdotes, police encounters, breakdowns, and financial loss.",
      false,
    ],
    [
      "Inheritance",
      "Family property, evidence, neighbours, court, and tomato-adjacent law.",
      "10–15 min per route",
      "Family conflict, police and court proceedings, property damage, and abandonment.",
      false,
    ],
    [
      "Enterprise",
      "Clients, tax, hiring, growth, cashflow, and the price of one more opportunity.",
      "10–15 min per route",
      "Debt, bankruptcy, audits, job pressure, and business failure.",
      false,
    ],
  ] as const;
  return {
    catalog: Object.freeze(
      campaigns.map((campaign, index) => ({
        campaignId: campaign.campaign.id,
        title:
          registry.value!.strings.get(campaign.campaign.titleKey) ??
          descriptions[index]![0],
        description: descriptions[index]![1],
        duration: descriptions[index]![2],
        contentNotice: descriptions[index]![3],
        featured: descriptions[index]![4],
        ...(index === 0
          ? {
              sources: [
                { label: "SubZeroDev Blog", href: "https://subzerodev.com" },
              ],
            }
          : {}),
      })),
    ),
    store: createInMemorySessionStore({
      engine: createEngine({ kinds, registry: registry.value }),
      registry: registry.value,
      persistence:
        typeof localStorage === "undefined" || !browserStorageAvailable()
          ? undefined
          : localPersistence(),
    }),
  };
}
