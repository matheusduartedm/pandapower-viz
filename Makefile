.PHONY: build-lib build-standalone build-widget build test dev

build-lib:
	cd frontend && npm run build-lib

build-standalone:
	cd frontend && npm run build

build-widget:
	cd frontend && npx vite build --mode widget

build: build-lib build-standalone build-widget

test:
	cd frontend && npx vitest run

dev:
	cd frontend && npm run dev
