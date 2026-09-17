## vocabulary
`AGENTS.md` is named `CLAUDE.md` here. Slice ids use the retained `W<n>` scheme, not `S<n>` — read
the `Slice: S3` example below as `Unit: W<n>`.

## tightened-authorization
`CLAUDE.md`, *Git and Pull Requests* carves `/slice` out to open its PR as a draft, without asking
— narrower than this core's "never as a draft." Where `gh pr view` finds a PR already open on this
branch, **ask before marking it ready for review** rather than treating the existing-PR case as
already actionable; do not open a second PR either way. This tightens what the core does on its
own — it does not remove the core's authorization to open a PR at all when none exists.
