<!-- Generated compatibility pointer. Do not edit directly. -->

> Canonical content is in [20-contract.md](20-contract.md). This file preserves pre-migration relative links and section anchors only.

# Core Specification

## 1. The Two Layers of "Engine"

### 1.1 Internal Modules

## 2. The `GameState` Envelope

## 3. The Kind Interface — The Seam

### 3.1 KindContext

### 3.2 `KindOutcome` — Terminal Identity a Host Can Read

## 4. Registration and the Pure Engine

## 5. Configuration

## 6. Scenes and Actions (Generic)

## 7. The Session Store and the Platform API

### 7.1 The Profile Store

#### Kind-owned cross-game data

#### Invariants

### 7.2 Host Persistence — The Record Store Beneath the Session Store

### 7.3 The Campaign Catalog

#### Progress, and the `profileId` that gates it

#### Migrating callers

### 7.4 Session Lifecycle — Listing, Branching, Deleting

#### Listing

#### Deleting

#### Branching

#### Reproducing a stored session from its log

#### Authorization is host-owned, and `SessionStore` stays caller-agnostic

#### Error semantics

#### Invariants

#### The coverage checklist moves to thirteen

## 8. Randomness

## 9. Projection

### 9.1 The Copy Boundary — the Kernel Owns It

## 10. Content, Saves, Migration

### 10.1 Content Registry

#### The Authoring → Registry Boundary

### 10.2 Save Envelope and Migration

### 10.3 Why Not Event Sourcing

## 11. Tiered Validation

#### Which string table validation checks against

## 12. Reason Codes, State Changes, Messages

## 13. The MCP Surface

## 14. Determinism Harness

## 15. How the Story-Graph Kind Plugs In

## 16. What This Unblocks

## 17. Identifier Conventions

## 18. Frozen Primitives

## 19. Published Narrative Authoring

## 20. The Ordered System Pipeline
