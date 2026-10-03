/**
 * Simulation kind — the legal `where` fields per `exists`/`count` collection (§8.2, W116).
 *
 * Contract: `10-simulation-kind.md` §8.2 (*A `where` field must be declared by its collection's
 * item type*) and §14. Each of §8.2's eight collections names one item type; a `where` `field`
 * is legal only if it is a single-segment scalar property that type declares, and an optional
 * one only under the four operators the frozen evaluator (04 §18) does not throw on.
 *
 * **The table is typed against the item types, so it cannot drift from them.** `FieldTable<T>`
 * is keyed by exactly `keyof T` and each value is the classification the property's declared
 * type forces — leaving a property out, adding one the type lacks, or misclassifying one (an
 * optional property as `"scalar"`, an array as `"scalar"`) is a compile error until the table
 * follows. Nothing here reads content: the eight item types are closed, so the legal set is
 * fixed per engine version, like the collection table itself.
 */

import type {
  BusinessRecord,
  CourseEnrollment,
  Credential,
  InventoryItem,
  JobApplication,
  ProjectRuntimeState,
  RelationshipState,
} from "./actor.js";
import type { NPCState } from "./state.js";

/** `"scalar"` — a required `number`/`string`/`boolean` property (including `Cents`, `LocKey` and
 *  string-literal unions). `"optional"` — the same but declared `?`. `"composite"` — anything
 *  else (an array or object type), which a `where` can never address (§8.2). */
export type FieldKind = "scalar" | "optional" | "composite";

type FieldKindOf<T, K extends keyof T> = [Exclude<T[K], undefined>] extends [string | number | boolean]
  ? Record<never, never> extends Pick<T, K>
    ? "optional"
    : "scalar"
  : "composite";

/** One classification per property of `T`, forced by the property's declared type. */
export type FieldTable<T> = { readonly [K in keyof T]-?: FieldKindOf<T, K> };

const INVENTORY_ITEM_FIELDS: FieldTable<InventoryItem> = {
  instanceId: "scalar",
  definitionId: "scalar",
  quantity: "scalar",
  acquiredWeek: "scalar",
  purchasePriceCents: "scalar",
  condition: "scalar",
  weeksSinceMaintenance: "scalar",
  broken: "scalar",
};

const RELATIONSHIP_FIELDS: FieldTable<RelationshipState> = {
  npcId: "scalar",
  category: "scalar",
  affinity: "scalar",
  trust: "scalar",
  respect: "scalar",
  resentment: "scalar",
  knownSinceWeek: "scalar",
  lastInteractionWeek: "optional",
  interactionCount: "scalar",
};

const JOB_APPLICATION_FIELDS: FieldTable<JobApplication> = {
  jobId: "scalar",
  submittedWeek: "scalar",
  resolvesWeek: "scalar",
  contested: "scalar",
  outcome: "optional",
};

const COURSE_ENROLLMENT_FIELDS: FieldTable<CourseEnrollment> = {
  courseId: "scalar",
  startedWeek: "scalar",
  weeksCompleted: "scalar",
  attendedUnits: "scalar",
  studyUnits: "scalar",
  missedSessions: "scalar",
  tuitionPaidCents: "scalar",
  tuitionOutstandingCents: "scalar",
  retainedProgress: "scalar",
  status: "scalar",
};

const CREDENTIAL_FIELDS: FieldTable<Credential> = {
  id: "scalar",
  courseId: "scalar",
  awardedWeek: "scalar",
  level: "scalar",
  labelKey: "scalar",
};

const PROJECT_FIELDS: FieldTable<ProjectRuntimeState> = {
  instanceId: "scalar",
  definitionId: "scalar",
  startedWeek: "scalar",
  progressUnits: "scalar",
  status: "scalar",
  completedWeek: "optional",
};

const BUSINESS_FIELDS: FieldTable<BusinessRecord> = {
  instanceId: "scalar",
  definitionId: "scalar",
  startedWeek: "scalar",
  cashOnHandCents: "scalar",
  weeksOperated: "scalar",
  status: "scalar",
  closedWeek: "optional",
  closedReason: "optional",
};

const NPC_FIELDS: FieldTable<NPCState> = {
  id: "scalar",
  definitionId: "scalar",
  memories: "composite",
  currentRole: "scalar",
  availability: "composite",
  flags: "composite",
};

/** §8.2's closed collection table, mapped to the legal-field classification of its item type —
 *  also the one place the eight names live for the validator (`validate.ts`). */
export const COLLECTION_FIELDS: Readonly<Record<string, Readonly<Record<string, FieldKind>>>> = {
  "player.inventory": INVENTORY_ITEM_FIELDS,
  "player.relationships": RELATIONSHIP_FIELDS,
  "player.career.pendingApplications": JOB_APPLICATION_FIELDS,
  "player.education.enrollments": COURSE_ENROLLMENT_FIELDS,
  "player.education.credentials": CREDENTIAL_FIELDS,
  "player.projects": PROJECT_FIELDS,
  "player.businesses": BUSINESS_FIELDS,
  "world.npcs": NPC_FIELDS,
};
