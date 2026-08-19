/**
 * Content — four deliberately broken copies of the Bureaucracy arc (03 §12, `TODO.md`
 * W15), each a single-field mutation of `bulgariaBureaucracySource` (`plans/
 * 22-w15-bureaucracy-campaign-and-broken-fixtures.md`, Decision 4) — proving
 * `validateCampaign` (W14) against real, full-sized content rather than only the
 * synthetic fixtures its own unit tests already used.
 *
 * Retargeted onto the route-based node ids `adventure-builder.ts` now generates (W77):
 * the original `expired`/`room_14` ids predate that generator and no longer exist, and
 * the shape it emits has no `auto`-kind node left to mutate, so the two fixtures that
 * used to target one now target an equivalent `choice`/`random` node instead. Each
 * fixture's Tier and code are unchanged; only which node stands in for the mutation is.
 */

import type { ChoiceNodeSource, RandomNodeSource } from "../kinds/story-graph/source.js";
import { bulgariaBureaucracySource } from "./bulgaria-bureaucracy.js";

function clone(): typeof bulgariaBureaucracySource {
  return structuredClone(bulgariaBureaucracySource);
}

/** Tier 1, `dangling_reference` — `municipality`'s `wait` choice points nowhere. */
export const danglingNodeFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const municipality = source.nodes["municipality"] as ChoiceNodeSource;
  const wait = municipality.choices.find((c) => c.id === "wait")!;
  wait.goto = "nonexistent_office";
  return source;
})();

/** Tier 1, `undeclared_variable` — `registry_route_event_1`'s first transition writes a
 *  variable the schema never declares. */
export const undeclaredVariableFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const event1 = source.nodes["registry_route_event_1"] as RandomNodeSource;
  event1.transitions[0]!.effects = [{ op: "increment", var: "office_visits_undeclared", by: 1 }];
  return source;
})();

/** Tier 2, `unreachable_node` — an extra node with no incoming edge from anywhere reachable. */
export const unreachableNodeFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  source.nodes["orphan_office"] = {
    kind: "choice",
    text: { key: "bureaucracy.orphan_office.text", text: "A door nobody was ever told about." },
    choices: [
      {
        id: "shrug",
        label: { key: "bureaucracy.choice.shrug.label", text: "Shrug and leave" },
        goto: "orphan_office",
      },
    ],
  };
  return source;
})();

/**
 * Tier 2, `unreachable_cycle` — `registry_route_event_2`'s two transitions are rewired to
 * loop back on itself instead of handing off to `registry_route_event_2a`/`2b`, so it can
 * never reach a `choice`/`ending` node again. `registry_route_event_2a`, `2b`,
 * `registry_route_3`, `registry_route_4`, `ending_document_obtained` and `ending_miracle`
 * fall out of the reachable set entirely as a result (reported as `unreachable_node`, not
 * `unreachable_cycle` — `validateReachability` only checks escape for nodes it already
 * found reachable) — all expected, real cascading consequences of the one broken node,
 * not separate mutations.
 */
export const settlementCycleFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const event2 = source.nodes["registry_route_event_2"] as RandomNodeSource;
  for (const transition of event2.transitions) transition.goto = "registry_route_event_2";
  return source;
})();
