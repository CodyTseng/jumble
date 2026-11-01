# Schemata test fixtures

These 21 JSON schemas are copied without modification from
`@nostrability/schemata@0.3.2`, under `dist/nips/`. They are used only by
`schemata-validation.spec.ts`, not shipped in the application. The upstream
GPL-3.0-or-later license is retained in `LICENSE`; it applies to these fixtures.
Package URL, tarball integrity, and the copied file list are in `manifest.json`.

The published package declares its code-generation and bundling tools as runtime
dependencies. Keeping the already-generated schemas here avoids installing
quicktype, its unsupported GraphQL dependency, and the unused webpack toolchain.

To refresh, download a reviewed upstream version using
`npm pack @nostrability/schemata@<version> --ignore-scripts` in a temporary
directory and extract the archive. Copy only the paths listed in `manifest.json`
from `package/dist/nips/`, retain the upstream license, and update the manifest
version, tarball URL, and npm integrity. Review schema changes, then run
`npm run test:schemas` and the full test suite. Do not regenerate schemas locally:
tests should use the published upstream definitions.
