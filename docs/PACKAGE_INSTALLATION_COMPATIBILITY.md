# Fresh-project package compatibility

OATI release candidates are installed and exercised from empty consumer projects. These checks use the packed or built distribution rather than source-tree imports, so missing files, broken exports, invalid metadata, undeclared runtime requirements, and repository-relative resource access fail the build.

## Required matrix

| Developer package | Runtime matrix | Distribution matrix | Consumer verification |
|---|---|---|---|
| TypeScript SDK | Node.js 20, 22, and 24 | npm and pnpm installation of the generated `.tgz` | compiles the published declarations, imports the root and all seven documented subpaths, builds and schema-validates a Mandate |
| Python SDK | Python 3.11, 3.12, 3.13, and 3.14 | wheel and source distribution | imports only from the isolated virtual environment, builds and validates a Mandate using bundled schemas |
| Go SDK and CLI | Go 1.25 and 1.26 on Linux, macOS, and Windows | fresh consumer module plus `GOBIN` CLI installation | imports the SDK, exercises canonical JSON and a builder, then runs the installed `oati version` binary |

The GitHub Actions workflow runs on pull requests, pushes to `main`, and manual dispatch. Every matrix cell is required and `fail-fast` is disabled so a failure report identifies the complete compatibility boundary.

## Local package checks

```sh
cd sdk/typescript
pnpm install --frozen-lockfile
pnpm test:package-install -- npm
pnpm test:package-install -- pnpm

cd ../python
python -m pip install build
python scripts/generate_schema_bundle.py
python scripts/test_package_install.py --format wheel
python scripts/test_package_install.py --format sdist

cd ../go
go run ./scripts/test-package-install.go
```

Runtime support is changed only through a reviewed compatibility-policy change. Adding a runtime means adding it to this matrix first. Removing one is a breaking support change and must follow the migration policy.
