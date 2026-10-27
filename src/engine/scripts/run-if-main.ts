import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Whether `callerUrl` (a module's `import.meta.url`) names the process entrypoint `argv1`.
 * The entrypoint is converted with Node's own path → URL utilities rather than concatenated
 * onto `file://`: on Windows `argv[1]` is `D:\…\x.ts`, and `file://D:\…\x.ts` never equals
 * `file:///D:/…/x.ts`, so the hand-built comparison made every CLI a silent no-op there.
 */
export function isMainModule(callerUrl: string, argv1: string | undefined): boolean {
  return argv1 !== undefined && pathToFileURL(resolve(argv1)).href === callerUrl;
}

/**
 * Shared ESM "is this file the entrypoint" guard for the `scripts/` CLIs — `check-content.ts`
 * and `validate-campaign.ts` each ran this same two-condition check independently; kept in
 * one place so a fix to the guard itself doesn't need applying twice.
 */
export function runIfMainModule(callerUrl: string, main: () => Promise<void>): void {
  if (isMainModule(callerUrl, process.argv[1])) {
    main().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
