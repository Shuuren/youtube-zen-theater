# Vendored anti-slop plugin provenance

Source: the fresh-install asset bundle at `/Users/renshuuuu/.agents/external/general/dmmulroy-anti-slop/install-anti-slop/assets/anti-slop`, copied by that skill's `scripts/install.mjs`. The bundle exposes no upstream VCS commit for the generic rules, so the exact upstream commit is unknown rather than guessed.

Installed entry point: `tools/oxlint/anti-slop/index.ts`.

Installed dependencies: `oxlint@1.85.0` and `@oxlint/plugins@1.85.0`, queried from the npm registry on 2026-09-22 and pinned exactly. The copied asset manifest hash is `9823144c60c14e15aca925d556dcf9875b0cec0da7bd813f2a1e8e2cf0a19e2f` (SHA-256 over sorted file hashes).

The nested `vendor/eslint-stylistic/UPSTREAM.md` and `vendor/eslint-stylistic/LICENSE` record the exact source commit and license for the readability rule's adapted upstream files. No Effect rules are registered because this repository has no direct `effect` dependency.

Intentional local configuration: generic rules are registered at error severity in `.oxlintrc.json`; the vendored tree is ignored as implementation input, while owned JavaScript, configuration, documentation, and scripts remain linted.
