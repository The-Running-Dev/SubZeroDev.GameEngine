/**
 * Shared ESM "is this file the entrypoint" guard for the `scripts/` CLIs — `check-content.ts`
 * and `validate-campaign.ts` each ran this same two-condition check independently; kept in
 * one place so a fix to the guard itself doesn't need applying twice.
 */
export function runIfMainModule(callerUrl: string, main: () => Promise<void>): void {
  if (process.argv[1] !== undefined && callerUrl === `file://${process.argv[1]}`) {
    main().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
