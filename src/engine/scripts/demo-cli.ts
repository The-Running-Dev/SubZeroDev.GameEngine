/**
 * Interactive CLI play-test harness — `design/30-slices.md`, "Breadth: The Platform".
 *
 * Manual play-testing tooling, not a shipped client: it lives outside `src/`, so neither
 * the determinism guard nor the client-contract's "must not import a kind" rule
 * (`eslint.config.js`) applies to it. It drives the same `TextClient` + `SessionStore`
 * every automated test does — no projection or store shortcut, no contract change — and
 * exists purely so a human can play a committed campaign from a terminal.
 *
 * Run with `npm run demo` from `src/engine/`.
 */

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import { createEngine } from "../src/core/kernel/engine.js";
import { createInMemorySessionStore } from "../src/core/session/store.js";
import { buildValidatedContentRegistry } from "../src/core/validation/tiered.js";
import type { ActionParams, KindRegistry } from "../src/core/kernel/types.js";
import type { SessionStore } from "../src/core/session/types.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";

import { storyGraphKind } from "../src/kinds/story-graph/kind.js";
import { simulationKind } from "../src/kinds/simulation/kind.js";

import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildBulgariaDrivingCampaign } from "../src/campaigns/bulgaria-driving.js";
import { buildBulgariaInheritanceCampaign } from "../src/campaigns/bulgaria-inheritance.js";
import { buildBulgariaReturnCampaign } from "../src/campaigns/bulgaria-return.js";
import { buildBulgariaEnterpriseCampaign } from "../src/campaigns/bulgaria-enterprise.js";
import { buildStableLifeCampaign } from "../src/campaigns/stable-life.js";

import { TextClient } from "../src/clients/text/client.js";

const CAMPAIGN_BUILDERS: ReadonlyArray<() => ReturnType<typeof buildBulgariaBureaucracyCampaign>> = [
  buildBulgariaBureaucracyCampaign,
  buildBulgariaDrivingCampaign,
  buildBulgariaInheritanceCampaign,
  buildBulgariaReturnCampaign,
  buildBulgariaEnterpriseCampaign,
  buildStableLifeCampaign,
];

function buildClient(): TextClient {
  const campaigns: BuiltCampaign[] = CAMPAIGN_BUILDERS.map((build) => {
    const result = build();
    if (!result.ok || !result.value) {
      throw new Error(`demo-cli: a committed campaign failed to build — ${JSON.stringify(result.errors)}`);
    }
    return result.value;
  });

  const kinds: KindRegistry = { "story-graph": storyGraphKind, simulation: simulationKind } as KindRegistry;
  const registryResult = buildValidatedContentRegistry(campaigns, kinds);
  if (!registryResult.ok || !registryResult.value) {
    throw new Error(`demo-cli: committed content failed validation — ${JSON.stringify(registryResult.errors)}`);
  }

  const engine = createEngine({ kinds, registry: registryResult.value });
  const store: SessionStore = createInMemorySessionStore({ engine, registry: registryResult.value });
  return new TextClient(store);
}

/** `"key=value key2=value2"` → `ActionParams` — a manual-play convenience, not a parser
 *  the engine ever sees; malformed tokens (no `=`) are silently dropped. */
function parseParams(tokens: readonly string[]): ActionParams | undefined {
  if (tokens.length === 0) return undefined;
  const params: Record<string, string> = {};
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    params[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Chained `readline/promises` `question()` calls drop lines that arrive faster than the
 * consumer awaits them — each call registers a fresh one-shot `'line'` listener, and a
 * burst of already-buffered input (a full pipe, not a human typing) can emit several
 * `'line'` events before the next `question()` is listening, silently losing them. The
 * async iterator queues internally instead, so it is correct for both a human typing and
 * piped/scripted input.
 */
function makeAsker(rl: readline.Interface): (prompt: string) => Promise<string | null> {
  const lines = rl[Symbol.asyncIterator]();
  return async (prompt: string) => {
    output.write(prompt);
    const { value, done } = await lines.next();
    return done ? null : value;
  };
}

async function main(): Promise<void> {
  const client = buildClient();
  const rl = readline.createInterface({ input, output });
  const ask = makeAsker(rl);

  console.log("SubZeroDev.GameEngine — interactive CLI play-test harness\n");
  console.log(client.listCampaigns().text);
  console.log();

  const campaignInput = (await ask(`Campaign id to play [${BULGARIA_BUREAUCRACY_CAMPAIGN_ID}]: `))?.trim();
  const campaignId = campaignInput || BULGARIA_BUREAUCRACY_CAMPAIGN_ID;
  const seedInput = (await ask("Seed (blank for random): "))?.trim();

  const created = await client.createSession(seedInput ? { campaignId, seed: seedInput } : { campaignId });
  let sessionId = created.value.sessionId;
  console.log(`\nSession ${sessionId}\n`);
  console.log(created.text);

  console.log('\nType an action id (optionally "id key=value ..."), or: view | save | load <id> | quit\n');

  for (;;) {
    const line = await ask("> ");
    if (line === null) break;
    const raw = line.trim();
    if (!raw) continue;
    if (raw === "quit" || raw === "exit") break;

    if (raw === "view") {
      console.log(`\n${(await client.getView(sessionId)).text}\n`);
      continue;
    }

    if (raw === "save") {
      console.log(`\n${(await client.saveGame(sessionId)).text}\n`);
      continue;
    }

    if (raw.startsWith("load ")) {
      const loaded = await client.loadGame(raw.slice("load ".length).trim());
      sessionId = loaded.value.sessionId;
      console.log(`\n${loaded.text}\n`);
      continue;
    }

    const [actionId, ...paramTokens] = raw.split(/\s+/);
    const result = await client.submitAction(sessionId, actionId!, parseParams(paramTokens));
    console.log(`\n${result.text}\n`);
  }

  rl.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
