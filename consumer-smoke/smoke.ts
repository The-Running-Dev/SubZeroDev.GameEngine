import assert from "node:assert/strict";
import {
  buildCampaign,
  buildContentRegistry,
  buildValidatedContentRegistry,
  buildWorldGraphCampaign,
  createEngine,
  storyGraphKind,
  simulationKind,
  worldGraphKind,
  type Campaign,
  type Engine,
  type KindRegistry,
  type LocKey,
  type WorldGraphCampaign,
  type WorldGraphCampaignSource,
  type WorldGraphKindState,
  type WorldGraphOutcome,
  type WorldGraphView,
} from "@the-running-dev/game-engine";

type WorldGraphPublicTypes = [
  WorldGraphCampaignSource,
  WorldGraphCampaign,
  WorldGraphKindState,
  WorldGraphView,
  WorldGraphOutcome,
];

function expectOk<T>(result: { ok: boolean; value?: T }, context: string): T {
  assert.equal(result.ok, true, context);
  assert.ok(result.value !== undefined, `${context}: value should be present`);
  return result.value;
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

function runEngineSmoke(): void {
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
  assert.equal(worldGraphKind.id, "world-graph");
  assert.equal(typeof buildWorldGraphCampaign, "function");
  const publicTypesResolve = <T extends WorldGraphPublicTypes>(): T | undefined => undefined;
  assert.equal(publicTypesResolve(), undefined);
  assertCampaignContentCastThrows(kinds, authoredText);
}

runEngineSmoke();
