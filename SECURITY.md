# Security Policy

## Supported releases

Security fixes are applied to the latest published `@zmice/zc` release and the current `main` branch.

## Reporting a vulnerability

Please do not open public issues for sensitive vulnerabilities.

Instead:

1. Prepare a minimal description of the issue and impact.
2. Include affected commands, platform targets, and reproduction steps if possible.
3. Report it privately to the repository owner through GitHub.

## Scope

Security reports are especially useful for:

- unsafe file writes or overwrite handling
- command injection or shell escaping issues
- platform install/update behavior that can corrupt user data
- credential leakage, token handling, or unsafe defaults

## Expectations

- We will review the report and confirm scope.
- We may ask for a reduced reproduction.
- Public disclosure should wait until a fix or mitigation is available.
