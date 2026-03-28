# Contributing to pandapower-viz

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/matheusduartedm/pandapower-viz
cd pandapower-viz/frontend
npm install
```

## Development

```bash
npm run dev          # start dev server (standalone app)
npm test             # run tests
npm run typecheck    # type check with tsc
npm run build-lib    # build npm library (dist/)
```

## Making changes

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Run `npm test` and `npm run typecheck` — both must pass
4. Commit with a descriptive message: `feat: add marker clustering for large networks`
5. Open a PR against `main`

## Commit conventions

We use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests

## Project structure

```
frontend/src/
├── core/           # Types, parser, layout, colors — no React dependency
├── components/     # React components (NetworkDiagram, NetworkMap)
├── styles/         # CSS with --ppviz-* custom properties
├── standalone/     # Standalone app (welcome screen, sample loader)
└── index.ts        # npm library barrel export
```

- `core/` can be used without React
- `components/` depends on `core/` and React
- `standalone/` is the demo app, not part of the npm library

## What to work on

Check the [issues](https://github.com/matheusduartedm/pandapower-viz/issues) — anything labeled `good first issue` or `help wanted` is a good starting point.

## Questions?

Open a [discussion](https://github.com/matheusduartedm/pandapower-viz/discussions) or comment on an issue.
