# Dependency Audit

This document describes the dependency-auditing process for the Nexus Video Platform monorepo.

## Quick Start

```bash
# From the repository root
bash scripts/audit-report.sh
```

The script will:

1. Run `npm audit --json` and save the full output to `audit-report.json`.
2. Parse the JSON to count vulnerabilities by severity.
3. Print a human-readable summary and exit with code **1** if any critical or high vulnerabilities are found.

## When to Run

| Trigger | Frequency |
|---|---|
| Before every release | Mandatory |
| After adding / upgrading a dependency | Recommended |
| Weekly CI schedule | Automated (add to `.github/workflows`) |

## Reading the Report

The raw `audit-report.json` follows the [npm audit JSON schema](https://docs.npmjs.com/cli/v10/commands/npm-audit#json). Key fields:

- `metadata.vulnerabilities` — aggregate counts by severity.
- `vulnerabilities.<pkg>` — per-package details including affected versions, fix availability, and advisory URL.

## Resolution Strategies

1. **`npm audit fix`** — applies non-breaking patches automatically.
2. **`npm audit fix --force`** — allows semver-major bumps; review changelogs before running.
3. **Manual upgrade** — when the automated fix is unavailable, upgrade the vulnerable package (or its parent dependency) directly.
4. **Override / resolution** — use the `overrides` field in the root `package.json` to pin a transitive dependency to a patched version:
   ```jsonc
   {
     "overrides": {
       "vulnerable-pkg": ">=2.0.1"
     }
   }
   ```
5. **Accept the risk** — if a vulnerability does not apply to the project's usage context, document it in the table below and suppress it in CI.

## Known Acceptable Vulnerabilities

| Package | Severity | Advisory | Reason for Acceptance |
|---|---|---|---|
| *(none yet)* | — | — | — |

## CI Integration

Add the following step to your GitHub Actions workflow to fail the build on critical / high issues:

```yaml
- name: Dependency audit
  run: bash scripts/audit-report.sh
```
