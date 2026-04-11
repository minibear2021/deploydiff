# DeployDiff Release Plan

## Goal

Prepare DeployDiff for a first Visual Studio Code Marketplace release with a package that can be built locally and has the minimum repository, documentation, and release collateral expected for a public extension.

## Steps

- [x] Add required Marketplace metadata to `package.json`.
  Notes: repository, homepage, bugs, keywords, and stronger categories were filled from the existing Git remote.

- [x] Add release collateral files.
  Notes: `LICENSE` and `CHANGELOG.md` were added so the extension is not published as a bare prototype.

- [x] Rewrite `README.md` for Marketplace users.
  Notes: replaced scaffold-oriented copy with install, configuration, usage, security, and limitation guidance.

- [x] Tighten package contents.
  Notes: `.vscodeignore` now excludes `.vscode-test` and built test output from the published extension package.

- [x] Validate local packaging with `vsce package`.
  Notes: completed successfully and produced `deploydiff-0.0.1.vsix`.

- [x] Reduce package size by bundling or excluding more files.
  Notes: switched the published entrypoint to a bundled `dist/extension.js`, excluded repository-only files from the VSIX, and reduced the package from 503 files to 487 files. Packaging now completes without the earlier bundling warning.

- [ ] Add Marketplace branding assets.
  Notes: an extension icon and optional screenshots are still missing. This is strongly recommended for a public listing but requires design assets.

- [ ] Prepare publisher credentials and publish.
  Notes: requires a VS Marketplace publisher, a PAT, and a final `vsce publish` run in the target account.

## Exit Criteria

- Local build, lint, test, and package all pass.
- Marketplace metadata is present and points to the public repository.
- User-facing documentation explains setup and current limitations.
- Remaining release tasks are only external-account or design-asset work.