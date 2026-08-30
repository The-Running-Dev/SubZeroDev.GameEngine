import type { ActionParams, AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import type { EventName, Severity } from "../../../core/observability/types.js";
import type { StateChange } from "../../../core/kernel/reasons.js";
import { resolveStatus } from "../outcome.js";
import type { WorldGraphKindState } from "../state.js";

export type Params = Readonly<Record<string, string | number | boolean>>;

export function params(value: ActionParams | undefined): Params | null {
  return value === undefined || value === null || typeof value !== "object" ? null : value;
}
export function stringParam(value: Params, key: string): string | null {
  return typeof value[key] === "string" ? value[key] : null;
}
export function optionalStringParam(value: Params, key: string): string | null | undefined {
  return value[key] === undefined ? undefined : stringParam(value, key);
}
export function integerParam(value: Params, key: string): number | null {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isInteger(candidate) ? candidate : null;
}

export function rejected(state: WorldGraphKindState, code: string, messageKey = code.startsWith("core.") ? code : `world-graph.reason.${code}`): AdvanceResult<WorldGraphKindState> {
  return { state, status: resolveStatus(state), changes: [], messages: [{ key: messageKey, visible: true }], error: { code: code.replace(/^core\.reason\./, ""), messageKey } };
}

export function accepted(state: WorldGraphKindState, changes: StateChange[]): AdvanceResult<WorldGraphKindState> {
  assertReferentialIntegrity(state);
  return { state, status: resolveStatus(state), changes, messages: [] };
}

export function change(path: string, value: string | number | boolean, reason: string, visible: boolean, previous?: string | number | boolean): StateChange {
  return previous === undefined
    ? { path, op: "set", value, reason, visible }
    : { path, op: "set", value, previous, reason, visible };
}

export function spend(state: WorldGraphKindState, amountCents: number): WorldGraphKindState["finances"] {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error(`Invalid world-graph expense: ${amountCents}`);
  return {
    ...state.finances,
    cashCents: state.finances.cashCents - amountCents,
    expensesTodayCents: state.finances.expensesTodayCents + amountCents,
    expensesTotalCents: state.finances.expensesTotalCents + amountCents,
  };
}

/** `event` is one `events.ts` table entry — name and severity travel together so a call
 *  site can no longer pair the right name with the wrong severity (W96, 12 §12). */
export function emit(ctx: KindContext, event: { readonly name: EventName; readonly severity: Severity }, data: Record<string, string | number | boolean>): void {
  ctx.emit.emit(event.name, event.severity, { data });
}

export function assertReferentialIntegrity(state: WorldGraphKindState): void {
  const buildingIds = new Set(state.buildings.map((entry) => entry.id));
  const queueIds = new Set(state.buildings.map((entry) => entry.queue.id));
  const guestIds = new Set(state.guests.map((entry) => entry.id));
  const siteIds = new Set(state.constructionSites.map((entry) => entry.id));
  const incidentIds = new Set(state.incidents.map((entry) => entry.id));
  const zoneIds = new Set(state.map.zones.map((entry) => entry.id));
  for (const building of state.buildings) {
    if (building.queue.guestIds.some((id) => !guestIds.has(id))) throw new Error(`Dangling queue guest in ${building.queue.id}`);
  }
  for (const guest of state.guests) {
    if (guest.intent.kind === "seek_service" && !buildingIds.has(guest.intent.buildingId)) throw new Error(`Dangling guest building ${guest.id}`);
  }
  for (const staff of state.staff) {
    if (staff.assignedBuildingId !== null && !buildingIds.has(staff.assignedBuildingId)) throw new Error(`Dangling staff building ${staff.id}`);
    if (staff.assignedZoneId !== null && !zoneIds.has(staff.assignedZoneId)) throw new Error(`Dangling staff zone ${staff.id}`);
    if (staff.task !== null) {
      if (staff.task.guestId !== null && !guestIds.has(staff.task.guestId)) throw new Error(`Dangling task guest ${staff.task.id}`);
      if (staff.task.queueId !== null && !queueIds.has(staff.task.queueId)) throw new Error(`Dangling task queue ${staff.task.id}`);
      if (staff.task.buildingId !== null && !buildingIds.has(staff.task.buildingId)) throw new Error(`Dangling task building ${staff.task.id}`);
      if (staff.task.constructionSiteId !== null && !siteIds.has(staff.task.constructionSiteId)) throw new Error(`Dangling task site ${staff.task.id}`);
      if (staff.task.incidentId !== null && !incidentIds.has(staff.task.incidentId)) throw new Error(`Dangling task incident ${staff.task.id}`);
    }
  }
  for (const incident of state.incidents) {
    if (incident.buildingId !== null && !buildingIds.has(incident.buildingId)) throw new Error(`Dangling incident building ${incident.id}`);
    if (incident.guestId !== null && !guestIds.has(incident.guestId)) throw new Error(`Dangling incident guest ${incident.id}`);
    if (incident.zoneId !== null && !zoneIds.has(incident.zoneId)) throw new Error(`Dangling incident zone ${incident.id}`);
  }
}
