# GTA Healing Agent v3.1

Self-contained GitHub Actions health checker for Group Travel Airlines.

This version keeps the current healing logic intact but places the runner script and its Playwright dependency in the same directory so Node.js resolves the package correctly.

Repository files replaced by this package:
- `.github/workflows/healing-agent.yml`
- `scripts/healing-agent/healing-agent.mjs`
- `scripts/healing-agent/package.json`

No website/CMS files are modified by the agent.
