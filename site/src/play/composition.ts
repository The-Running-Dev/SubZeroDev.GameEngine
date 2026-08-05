import {
  buildBulgariaBureaucracyCampaign,
  buildValidatedContentRegistry,
  createEngine,
  createInMemorySessionStore,
  simulationKind,
  storyGraphKind,
  worldGraphKind,
  type SessionStore,
} from "@the-running-dev/game-engine";

export interface BrowserDemoConfig {
  readonly campaignId: string;
  readonly title: string;
}

export function createBrowserDemo(): {
  config: BrowserDemoConfig;
  store: SessionStore;
} {
  const campaign = buildBulgariaBureaucracyCampaign();
  if (!campaign.ok || campaign.value === undefined) {
    throw new Error("The Bureaucracy campaign could not be built.");
  }

  const kinds = {
    "story-graph": storyGraphKind,
    simulation: simulationKind,
    "world-graph": worldGraphKind,
  } as const;
  const registry = buildValidatedContentRegistry([campaign.value], kinds);
  if (!registry.ok || registry.value === undefined) {
    throw new Error("The Bureaucracy campaign could not be validated.");
  }

  const engine = createEngine({ kinds, registry: registry.value });
  return {
    config: {
      campaignId: campaign.value.campaign.id,
      title:
        registry.value.strings.get(campaign.value.campaign.titleKey) ??
        "The Bureaucracy",
    },
    store: createInMemorySessionStore({ engine, registry: registry.value }),
  };
}
