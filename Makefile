.PHONY: build-lib build-standalone build test dev

build-lib:
	cd frontend && npm run build-lib

build-standalone:
	cd frontend && npm run build

build: build-lib build-standalone

test:
	cd frontend && npx vitest run

dev:
	cd frontend && npm run dev
