# Glean — developer shortcuts

.PHONY: install android typecheck test backend-up backend-down backend-logs

install:            ## Install JS dependencies
	npm install

android:            ## Build + install the Android dev client on a connected device
	npx expo run:android

typecheck:          ## Type-check the project
	npx tsc --noEmit

test:               ## Run unit tests
	npm test

backend-up:         ## Start the bundled backend (Docker)
	@cd backend && { test -f .env || cp .env.example .env; }
	@cd backend && docker compose up -d

backend-down:       ## Stop the bundled backend
	@cd backend && docker compose down

backend-logs:       ## Tail backend logs
	@cd backend && docker compose logs -f
