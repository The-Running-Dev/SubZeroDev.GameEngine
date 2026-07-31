/**
 * Content — four deliberately broken copies of the Bureaucracy arc (03 §12, `TODO.md`
 * W15), each a single-field mutation of `bulgariaBureaucracySource` (`plans/
 * 22-w15-bureaucracy-campaign-and-broken-fixtures.md`, Decision 4) — proving
 * `validateCampaign` (W14) against real, full-sized content rather than only the
 * synthetic fixtures its own unit tests already used.
 */

import type { ChoiceNodeSource, AutoNodeSource } from "../kinds/story-graph/source.js";
import { bulgariaBureaucracySource } from "./bulgaria-bureaucracy.js";

function clone(): typeof bulgariaBureaucracySource {
  return structuredClone(bulgariaBureaucracySource);
}

/** Tier 1, `dangling_reference` — `expired`'s `question_reality` choice points nowhere. */
export const danglingNodeFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const expired = source.nodes["expired"] as ChoiceNodeSource;
  const questionReality = expired.choices.find((c) => c.id === "question_reality")!;
  questionReality.goto = "nonexistent_office";
  return source;
})();

/** Tier 1, `undeclared_variable` — `room_14`'s effect writes a variable the schema never declares. */
export const undeclaredVariableFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const room14 = source.nodes["room_14"] as AutoNodeSource;
  room14.effects = [{ op: "increment", var: "office_visits_undeclared", by: 1 }];
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
 * Tier 2, `unreachable_cycle` — `room_14` is rewired to loop on itself instead of handing
 * off to `room_6`, so its pass-through can never reach a `choice`/`ending` node again.
 * `room_6` and `reward` fall out of the reachable set entirely as a result (reported as
 * `unreachable_node`, not `unreachable_cycle` — `validateReachability` only checks
 * escape for nodes it already found reachable) — both are expected, real cascading
 * consequences of the one broken edge, not separate mutations.
 */
export const settlementCycleFixture = ((): typeof bulgariaBureaucracySource => {
  const source = clone();
  const room14 = source.nodes["room_14"] as AutoNodeSource;
  room14.goto = "room_14";
  return source;
})();
