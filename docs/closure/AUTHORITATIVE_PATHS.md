# Authoritative paths

## Submissions

`src/lib/domain/commands.ts` `submitForm` is the write that counts. The browser store in `src/lib/forms/store.ts` is a cache. It posts through `/api/agent/v1/sync`. If the two disagree, the relational row wins after the next sync.

## Workflow

`src/lib/workflow/runtime.ts` is the interpreter for the acceptance flow: splits, joins, timers, HTTP, PDF, ECM, and email. `src/lib/workflow/durable-runtime.ts` is the SQL store for tokens and human tasks. `src/lib/forms/gateways.ts` remains an in-memory preview helper and is not the production continuation path.

Join release is single-shot inside `arriveAtJoin`. A second arrival after release does not continue the graph again.

## Forms in the designer

The studio still edits the client store. Stale-edit rejection lives at `POST /api/platform/revisions` and in `saveEdit`. The studio does not call it yet, so two open designers can still overwrite each other until that call is added to the save button.

## PDF

`src/lib/pdf/acroform.ts` fills and flattens bytes. `src/lib/pdf/editor-model.ts` stores normalized placements. `src/lib/forms/pdf.ts` is the simple generated PDF used when there is no template. Generated document history is a new row per regeneration, not an overwrite.

## Identity

Local passwords use Argon2id in `src/lib/identity/passwords.ts`. `src/lib/platform/crypto.ts` still verifies older scrypt records. OIDC in `src/lib/identity/oidc.ts` builds the authorization request. Better Auth stays off. There is no live issuer in this workspace.

## Storage

Object providers implement the contract in `src/lib/storage/types.ts`. `src/lib/storage/capability.ts` records what is implemented versus partial. REST ECM mapping is `src/lib/storage/rest-ecm.ts` and refuses blocked destinations.
