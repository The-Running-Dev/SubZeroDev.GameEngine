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
          `subzerodev.play.save.v1.${record.saveId}`,
          JSON.stringify(record),
        );
      },
      async delete(id) {
        localStorage.removeItem(`subzerodev.play.save.v1.${id}`);
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
      "45–60 min",
      true,
    ],
    [
      "The Bureaucracy",
      "The original Bulgarian municipal fixture.",
      "10 min",
      false,
    ],
    [
      "The Return",
      "Return to Bulgaria and meet the consequences.",
      "10 min",
      false,
    ],
    [
      "Driving",
      "Road etiquette, mechanical optimism, and poor decisions.",
      "10 min",
      false,
    ],
    [
      "Inheritance",
      "Family property, documents, and tomato-adjacent law.",
      "10 min",
      false,
    ],
    [
      "Enterprise",
      "A small question develops enterprise features.",
      "10 min",
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
        featured: descriptions[index]![3],
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
