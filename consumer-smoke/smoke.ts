import assert from "node:assert/strict";
import {
  buildCampaign,
  buildContentRegistry,
  buildValidatedContentRegistry,
  buildValidatedPackRegistry,
  buildWorldGraphCampaign,
  buildWorldGraphMvpCampaign,
  computeResolutionId,
  createEngine,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  SESSION_PERSISTENCE_CONFLICT,
  storyGraphKind,
  simulationKind,
  worldGraphKind,
  type ActionType,
  type Campaign,
  type CampaignCatalog,
  type CampaignSummary,
  type ContentPack,
  type Engine,
  type GameAction,
  type KindRegistry,
  type LocKey,
  type PublicWorldState,
  type SessionPersistenceConflict,
  type SessionStoreErrorCode,
  type SimulationCampaign,
  type SimulationKindState,
  type SimulationOutcome,
  type SimulationView,
  type WeeklyActionPlan,
  type WorldGraphCampaign,
  type WorldGraphCampaignSource,
  type WorldGraphKindState,
  type WorldGraphOutcome,
  type WorldGraphView,
} from "@the-running-dev/game-engine";

/**
 * The author-time contract (W74.1, W74.6; engine contract §19), resolved from the *packed
 * tarball* through the `./authoring` entry in the package's `exports` map — never from a
 * source link, which would prove nothing about what actually ships.
 *
 * Every value and every type the subpath exports is named here on purpose. That is what
 * makes this file the second half of the closure check: `src/authoring.test.ts` fails when a
 * name is added, and this build fails when one is taken away.
 */
import {
  buildAdventureCampaign,
  buildCampaign as buildCampaignForAuthoring,
  buildReplayOutcome,
  buildSimulationCampaign,
  buildStoryGraphCampaign,
  createAdventureSource,
  digestManifestResolution,
  digestPortableCampaign,
  findDivergence,
  migrateV1AdventureState,
  runReplayFixture,
  toPortable,
  type AchievementDefinitionSource,
  type AdventureConfig,
  type AdventureEnding,
  type AdventureRoute,
  type AuthoredText,
  type AutoNodeSource,
  type BackgroundDefinitionSource,
  type BuiltCampaign,
  type Campaign as AuthoringCampaign,
  type ChoiceNodeSource,
  type ChoiceSource,
  type CommandResult,
  type Condition,
  type Consequence,
  type CourseDefinitionSource,
  type DifficultyDefinitionSource,
  type EmployerDefinitionSource,
  type EndingNodeSource,
  type EventDefinitionSource,
  type GoalDefinitionSource,
  type HeadlineDefinitionSource,
  type HousingDefinitionSource,
  type ItemDefinitionSource,
  type JobDefinitionSource,
  type LocationDefinitionSource,
  type NPCDefinitionSource,
  type NodeSource,
  type OpportunityDefinitionSource,
  type Outcome,
  type PortableCampaign,
  type PortableCampaignBody,
  type PortableCatalog,
  type PortableManifest,
  type PortableManifestEntry,
  type PortableMigration,
  type RandomNodeSource,
  type RandomTransition,
  type ReplayFixture,
  type ReplayResult,
  type ReplayRunnerContext,
  type ReplayVerdict,
  type ScenarioDefinitionSource,
  type SimulationAchievementDefinitionSource,
  type SimulationActionLabelKeysSource,
  type SimulationCampaignSource,
  type SkillDefinitionSource,
  type StoryGraphCampaign,
  type StoryGraphCampaignSource,
  type StoryGraphKindState,
  type Submission,
  type TraitDefinitionSource,
  type VarValue,
  type VariableDeclSource,
  type VariableSchemaSource,
} from "@the-running-dev/game-engine/authoring";

type AuthoringPublicTypes = [
  AchievementDefinitionSource,
  AdventureConfig,
  AdventureEnding,
  AdventureRoute,
  AuthoredText,
  AutoNodeSource,
  BackgroundDefinitionSource,
  BuiltCampaign,
  AuthoringCampaign,
  ChoiceNodeSource,
  ChoiceSource,
  CommandResult<BuiltCampaign>,
  Condition,
  Consequence,
  CourseDefinitionSource,
  DifficultyDefinitionSource,
  EmployerDefinitionSource,
  EndingNodeSource,
  EventDefinitionSource,
  GoalDefinitionSource,
  HeadlineDefinitionSource,
  HousingDefinitionSource,
  ItemDefinitionSource,
  JobDefinitionSource,
  LocationDefinitionSource,
  NPCDefinitionSource,
  NodeSource,
  OpportunityDefinitionSource,
  Outcome,
  PortableCampaign,
  PortableCampaignBody,
  PortableCatalog,
  PortableManifest,
  PortableManifestEntry,
  PortableMigration,
  RandomNodeSource,
  RandomTransition,
  ReplayFixture,
  ReplayResult,
  ReplayRunnerContext,
  ReplayVerdict,
  ScenarioDefinitionSource,
  SimulationAchievementDefinitionSource,
  SimulationActionLabelKeysSource,
  SimulationCampaignSource,
  SkillDefinitionSource,
  StoryGraphCampaign,
  StoryGraphCampaignSource,
  StoryGraphKindState,
  Submission,
  TraitDefinitionSource,
  VarValue,
  VariableDeclSource,
  VariableSchemaSource,
];

type WorldGraphPublicTypes = [
  WorldGraphCampaignSource,
  WorldGraphCampaign,
  WorldGraphKindState,
  WorldGraphView,
  WorldGraphOutcome,
];

type SimulationPublicTypes = [
  SimulationCampaign,
  SimulationKindState,
  SimulationView,
  PublicWorldState,
  SimulationOutcome,
  ActionType,
  GameAction,
  WeeklyActionPlan,
];

type SessionPersistencePublicTypes = [
  SessionStoreErrorCode,
  SessionPersistenceConflict,
];

function expectOk<T>(result: { ok: boolean; value?: T }, context: string): T {
  assert.equal(result.ok, true, context);
  assert.ok(result.value !== undefined, `${context}: value should be present`);
  return result.value;
}

/** Asserts, at the type level, that `T` is exactly the declared public-types tuple. */
function assertTypeSurface<T extends readonly unknown[]>(): void {
  const resolve = <U extends T>(): U | undefined => undefined;
  assert.equal(resolve(), undefined);
}

function assertCampaignContentCastThrows(kinds: KindRegistry, authoredText: readonly { key: LocKey; text: string }[]): void {
  const malformedCampaign: Campaign = {
    id: "smoke-malformed",
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: "smoke.title",
    content: {},
  };

  const malformedBuilt = expectOk(buildCampaign(malformedCampaign, authoredText), "buildCampaign should accept malformed smoke fixture");
  let threw = false;

  try {
    buildValidatedContentRegistry([malformedBuilt], kinds);
  } catch (error) {
    threw = true;
    const message = error instanceof Error ? error.message : String(error);
    assert.match(
      message,
      /Object\.keys|cannot convert .*? object|campaign\.content/i,
      "Known malformed campaign cast failure should still surface (see OPEN-QUESTIONS §3)",
    );
  }

  assert.equal(threw, true, "Malformed content should throw through the shared validation boundary");
}

/**
 * An author-time round trip over the packed subpath: source in, built campaign out, portable
 * JSON and its digests, then the replay runner over the result. Deliberately built from a
 * campaign written *here* — the whole point of the seam is that the engine's own published
 * stories are not what an author reaches for.
 */
async function runAuthoringSmoke(kinds: KindRegistry): Promise<void> {
  const source: StoryGraphCampaignSource = {
    description: { key: "authoring.description", text: "A campaign authored against the subpath." },
    variables: {
      resolve: { type: "int", initial: 0, min: 0, max: 3, visible: true, label: { key: "authoring.var.resolve", text: "Resolve" } },
    },
    startNodeId: "start",
    nodes: {
      start: {
        kind: "choice",
        text: { key: "authoring.start.text", text: "The form asks for your form." },
        choices: [
          {
            id: "submit",
            label: { key: "authoring.start.submit", text: "Submit the form about the form" },
            goto: "ending",
            effects: [{ op: "increment", var: "resolve", by: 1 }],
          },
        ],
      },
      ending: {
        kind: "ending",
        text: { key: "authoring.ending.text", text: "Stamped." },
        endingId: "authoring_stamped",
      },
    },
    achievements: [],
  };

  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: AuthoringCampaign = {
    id: "authoring-smoke",
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: "authoring.title",
    content,
  };
  const built = expectOk(
    buildCampaignForAuthoring(campaign, [{ key: "authoring.title", text: "Authoring Smoke" }, ...authoredText]),
    "the subpath's own builder should build an authored campaign",
  );

  const catalog: PortableCatalog = {
    title: "Authoring Smoke",
    description: "Proves the author-time subpath ships.",
    duration: "1 minute",
    contentNotice: "None.",
    featured: false,
  };
  const portable = toPortable(built, catalog);
  assert.equal(portable.formatVersion, 2);
  assert.equal(portable.campaign.id, "authoring-smoke");

  // Both digests are content-addressed, so equality across two calls is the claim worth
  // making — and inequality against a mutated document is what makes it worth anything.
  const digest = digestPortableCampaign(portable);
  assert.equal(digest, digestPortableCampaign(portable), "campaign digests should be stable");
  assert.notEqual(digest, digestPortableCampaign({ ...portable, catalog: { ...catalog, featured: true } }));
  assert.equal(
    digestManifestResolution([{ id: campaign.id, version: campaign.version }]),
    digestManifestResolution([{ id: campaign.id, version: campaign.version }]),
    "manifest resolution digests should be stable",
  );

  const registry = expectOk(buildContentRegistry([built]), "the authored campaign should register");
  const ctx: ReplayRunnerContext = {
    engine: createEngine({ kinds, registry }),
    kinds,
    registry,
    profiles: createInMemoryProfileStore(),
    profileId: "consumer-smoke-authoring",
  };
  // W98.6 — the async catalog path, reachable through the packed tarball. `listCampaigns`
  // returns `Promise<CampaignCatalog>` now, not a bare `CampaignSummary[]` (04-core.md §7.3).
  const store = createInMemorySessionStore({ engine: ctx.engine, registry, profiles: ctx.profiles });
  const sessionCatalog: CampaignCatalog = await store.listCampaigns(ctx.profileId);
  assert.ok(
    sessionCatalog.campaigns.some((c) => c.campaignId === campaign.id),
    "the async catalog should list the authored campaign",
  );
  assert.equal(
    sessionCatalog.strings[campaign.titleKey],
    "Authoring Smoke",
    "the catalog's own strings should resolve the title key",
  );
  // The old signature (`listCampaigns(): CampaignSummary[]`) no longer type-checks — a
  // caller built against it fails to compile rather than reading `undefined` at runtime
  // (04-core.md §7.3, "Migrating callers").
  // @ts-expect-error — listCampaigns is async now; this assignment must not type-check.
  const rejectedOldShape: CampaignSummary[] = store.listCampaigns(ctx.profileId);
  void rejectedOldShape;

  const submissions: readonly Submission[] = [{ actionId: "submit" }];
  const fixture: ReplayFixture = {
    name: "authoring-smoke",
    config: { campaignId: campaign.id, seed: "consumer-smoke-authoring" },
    campaignVersion: campaign.version,
    capturedUnder: "consumer-smoke",
    submissions,
  };

  const result: ReplayResult = await buildReplayOutcome(ctx, fixture);
  assert.equal(result.kind, "outcome", "the authored campaign should replay");
  const outcome: Outcome = result.kind === "outcome" ? result.outcome : assert.fail("no outcome");
  assert.equal(outcome.finalStatus, "ended");
  assert.equal(outcome.acceptedActions, 1);

  assert.equal(findDivergence(outcome, outcome), undefined, "an outcome should not diverge from itself");
  assert.equal(findDivergence(outcome, { ...outcome, acceptedActions: 0 }), submissions.length);

  const verdict: ReplayVerdict = await runReplayFixture(ctx, fixture, outcome);
  assert.equal(verdict.kind, "match");

  // The adventure trio is reachable and callable through the subpath. The shared builder
  // stays here precisely because it is not a published campaign (W74.7).
  assert.equal(typeof createAdventureSource, "function");
  assert.equal(typeof buildAdventureCampaign, "function");
  const migrated = migrateV1AdventureState({}, "2.0.0", source, {});
  assert.equal(migrated.ok, false, "a non-v1 state is not migratable");
  const migratedV1 = migrateV1AdventureState({ currentNodeId: "start", variables: {} }, "1.0.0", source, {});
  assert.equal(migratedV1.ok, true, "a v1 state should migrate to v2 declarations");

  assertTypeSurface<AuthoringPublicTypes>();

  // W88 — the simulation kind's authoring surface: `buildSimulationCampaign` is reachable
  // through the subpath, and a host compiles `SimulationView` (and its siblings) against the
  // root, both resolved from the packed tarball rather than a source link.
  const simulationSource: SimulationCampaignSource = {
    description: { key: "simulation-authoring.description", text: "A campaign authored against the subpath." },
    jobs: [],
    courses: [],
    housing: [],
    items: [],
    events: [],
    npcs: [],
    goals: [],
    scenarios: [],
    difficulties: [],
    opportunities: [],
    achievements: [],
    headlines: [],
    employers: [],
    locations: [],
    backgrounds: [],
    traits: [],
    skills: [],
    scenarioId: "smoke-scenario",
    goalFailurePrecedence: "goals_win",
    sceneTemplate: { key: "simulation-authoring.scene", text: "Week {week}." },
    actionLabels: {
      planAdd: { key: "simulation-authoring.plan-add", text: "Add" },
      planRemove: { key: "simulation-authoring.plan-remove", text: "Remove" },
      planClear: { key: "simulation-authoring.plan-clear", text: "Clear" },
      endWeek: { key: "simulation-authoring.end-week", text: "End Week" },
    },
  };
  const simulationBuilt = buildSimulationCampaign(simulationSource);
  assert.equal(simulationBuilt.content.scenarioId, "smoke-scenario", "the subpath's simulation builder should lift the campaign mechanically");
  assert.equal(simulationBuilt.authoredText.length, 6, "every top-level AuthoredText field should be collected");

  assertTypeSurface<SimulationPublicTypes>();
}

function runEngineSmoke(): KindRegistry {
  const kinds: KindRegistry = {
    "story-graph": storyGraphKind,
    simulation: simulationKind,
    "world-graph": worldGraphKind,
  };

  const authoredText: readonly { key: LocKey; text: string }[] = [
    { key: "smoke.title", text: "Smoke Campaign" },
    { key: "smoke.description", text: "A tiny smoke story." },
    { key: "smoke.start.text", text: "Begin the only choice." },
    { key: "smoke.choice.play", text: "Play" },
    { key: "smoke.ending", text: "Done." },
  ];

  const campaign: Campaign = {
    id: "smoke-campaign",
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: "smoke.title",
    content: {
      descriptionKey: "smoke.description",
      variables: {},
      startNodeId: "start",
      achievements: [],
      nodes: {
        start: {
          id: "start",
          kind: "choice",
          textKey: "smoke.start.text",
          choices: [
            {
              id: "play",
              labelKey: "smoke.choice.play",
              goto: "ending",
            },
          ],
        },
        ending: {
          id: "ending",
          kind: "ending",
          textKey: "smoke.ending",
          endingId: "smoke_end",
        },
      },
    },
  };

  const validBuilt = expectOk(buildCampaign(campaign, authoredText), "valid campaign should build");
  const registry = expectOk(
    buildContentRegistry([validBuilt]),
    "registry build should succeed",
  );

  const engine: Engine = createEngine({
    kinds,
    registry,
  });

  const created = expectOk(engine.createGame({ campaignId: "smoke-campaign" }), "createGame should succeed for a valid smoke campaign");
  assert.equal(created.status, "active");

  // W76: the fold-validate-reattach sequence, reachable through the packed tarball —
  // proves the resolution stamp survives npm pack/install, not just source imports.
  const pack: ContentPack = {
    id: "smoke-pack",
    version: "1.0.0",
    kindId: "story-graph",
    dependsOn: [],
    campaigns: [validBuilt],
    strings: new Map(validBuilt.strings),
  };
  const packRegistry = expectOk(buildValidatedPackRegistry([pack], kinds), "pack registry should fold and validate");
  assert.equal(packRegistry.resolution, computeResolutionId([pack]));
  assert.equal(packRegistry.campaigns.get("smoke-campaign")?.version, packRegistry.resolution);
  assert.equal(worldGraphKind.id, "world-graph");
  assert.equal(SESSION_PERSISTENCE_CONFLICT, "SessionPersistenceConflict");
  assert.equal(typeof buildWorldGraphCampaign, "function");
  const worldGraphCampaign = expectOk(buildWorldGraphMvpCampaign(), "world-graph MVP campaign should build");
  const worldGraphRegistry = expectOk(
    buildValidatedContentRegistry([worldGraphCampaign], kinds),
    "world-graph MVP registry should validate",
  );
  const runWorldGraphReplay = (): string => {
    const worldGraphEngine = createEngine({
      kinds,
      registry: worldGraphRegistry,
      ids: {
        newGameId: () => "game:consumer-smoke-world-graph",
        newSeed: () => "seed:consumer-smoke-world-graph",
      },
    });
    const worldGraphGame = expectOk(
      worldGraphEngine.createGame({ campaignId: worldGraphCampaign.campaign.id, seed: "consumer-smoke-world-graph" }),
      "world-graph MVP should construct through the package boundary",
    );
    assert.equal(worldGraphGame.kindId, "world-graph");
    const hired = expectOk(
      worldGraphEngine.submitAction(worldGraphGame, "hire_staff", { definitionId: "cleaner" }),
      "world-graph MVP should hire through the package boundary",
    );
    const completed = expectOk(
      worldGraphEngine.submitAction(hired, "advance_ticks", { ticks: 10 }),
      "world-graph MVP should resolve through the package boundary",
    );
    assert.equal(completed.status, "ended");
    const serialized = worldGraphEngine.serialize(completed);
    const restored = expectOk(worldGraphEngine.deserialize(serialized), "world-graph MVP should deserialize through the package boundary");
    assert.equal(worldGraphEngine.serialize(restored), serialized);
    return serialized;
  };
  assert.equal(runWorldGraphReplay(), runWorldGraphReplay(), "packed world-graph replays should be byte-identical");
  assertTypeSurface<WorldGraphPublicTypes>();
  assertTypeSurface<SessionPersistencePublicTypes>();
  assertCampaignContentCastThrows(kinds, authoredText);
  return kinds;
}

await runAuthoringSmoke(runEngineSmoke());
