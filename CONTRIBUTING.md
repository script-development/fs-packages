# Contributing

Full contributing guide: **[packages.script.nl/contributing](https://packages.script.nl/contributing)**

Covers the 8-gate CI pipeline, development workflow, adding a new package, conventions, and the publishing process.

## Quick Reference

```bash
npm install           # Install dependencies
npm run build         # Build all packages (run before typecheck)
npm run test:coverage # Run tests with 100% coverage threshold
npm run test:mutation # Run mutation testing with 90% threshold
npm run format        # Format with oxfmt
npm run lint          # Lint with oxlint
npx changeset         # Create a changeset for your changes
```
