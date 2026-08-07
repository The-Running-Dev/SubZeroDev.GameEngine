import {
  buildValidatedContentRegistry,
  createEngine,
  createInMemorySessionStore,
  fromPortable,
  simulationKind,
  storyGraphKind,
  worldGraphKind,
  type PortableCampaign,
  type PortableManifest,
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
  /** Playable and registered, but omitted from the public dossier grid — reachable only by a direct `?campaign=` link. */
  readonly hidden?: boolean;
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

// SPIKE: campaigns are runtime-loaded JSON under /campaigns/, not compiled into the
// engine package. See plans/spike-notes.md. `base` matches Vite's `BASE_URL` so this
// resolves under a subpath deploy (`/play/`) the same way the rest of the site does.
async function fetchJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(`${base}campaigns/${path}`);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return (await response.json()) as T;
}

async function loadPortableCampaigns(): Promise<readonly PortableCampaign[]> {
  const manifest = await fetchJson<PortableManifest>("manifest.json");
  return Promise.all(manifest.campaigns.map((fileName) => fetchJson<PortableCampaign>(fileName)));
}

export interface BrowserDemo {
  readonly catalog: readonly BrowserCampaign[];
  /** Resolves any registered campaign, listed or hidden — the direct-link path for a hidden one. */
  findCampaign(campaignId: string): BrowserCampaign | undefined;
  readonly store: SessionStore;
}

export async function createBrowserDemo(): Promise<BrowserDemo> {
  const portables = await loadPortableCampaigns();
  const hydrated = portables.map((portable) => fromPortable(portable));

  const kinds = {
    "story-graph": storyGraphKind,
    simulation: simulationKind,
    "world-graph": worldGraphKind,
  } as const;
  const registry = buildValidatedContentRegistry(
    hydrated.map((h) => h.built),
    kinds,
  );
  if (!registry.ok || !registry.value)
    throw new Error(`The playable catalog could not be validated: ${JSON.stringify(registry.errors)}`);

  const all = hydrated.map(({ built, catalog }) => ({
    campaignId: built.campaign.id,
    title: registry.value!.strings.get(built.campaign.titleKey) ?? catalog.title,
    description: catalog.description,
    duration: catalog.duration,
    contentNotice: catalog.contentNotice,
    featured: catalog.featured,
    ...(catalog.hidden ? { hidden: true } : {}),
    ...(catalog.sources ? { sources: catalog.sources } : {}),
  }));

  return {
    catalog: Object.freeze(all.filter((campaign) => !campaign.hidden)),
    findCampaign: (campaignId) =>
      all.find((campaign) => campaign.campaignId === campaignId),
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
