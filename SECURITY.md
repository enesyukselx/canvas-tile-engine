# Security Policy

## Supported Versions

Canvas Tile Engine is currently in the 0.x release line. Only the latest published
version of each package receives security fixes:

| Package                             | Supported          |
| ----------------------------------- | ------------------ |
| `@canvas-tile-engine/core`          | latest 0.x release |
| `@canvas-tile-engine/react`         | latest 0.x release |
| `@canvas-tile-engine/react-native`  | latest 0.x release |
| `@canvas-tile-engine/renderer-canvas` | latest 0.x release |
| `@canvas-tile-engine/renderer-webgl`  | latest 0.x release |
| `@canvas-tile-engine/renderer-skia`   | latest 0.x release |
| `@canvas-tile-engine/renderer-server` | latest 0.x release |

Older releases do not receive backported fixes. If you are affected by a
vulnerability, upgrade to the latest version of the affected package.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.

Instead, report them privately through GitHub's security advisory form:

**[Report a vulnerability](https://github.com/enesyukselx/canvas-tile-engine/security/advisories/new)**

When reporting, please include as much of the following as you can:

- The affected package(s) and version(s)
- A description of the vulnerability and its potential impact
- Steps to reproduce, ideally with a minimal code example
- Any suggested fix or mitigation, if you have one

## What to Expect

- You will receive an acknowledgment within 7 days.
- Once the report is confirmed, a fix will be developed and released as soon as
  practical, and the advisory will be published after the fix is available.
- You will be credited in the advisory unless you prefer to remain anonymous.

## Scope

In scope: the published npm packages listed above, as built from this repository.

Out of scope:

- The `examples/` applications and the documentation site (`docs/`), which are
  not published packages
- Vulnerabilities in third-party dependencies (report those upstream; reports
  about how this project uses a dependency insecurely are in scope)
- Issues that require a compromised development environment or malicious
  configuration supplied by the application author

Since `@canvas-tile-engine/renderer-server` runs in Node.js and can load images
and fonts from file paths, applications should treat those paths as trusted
input. Reports demonstrating that the engine itself mishandles untrusted data
are welcome.

Thank you for helping keep Canvas Tile Engine and its users safe.
