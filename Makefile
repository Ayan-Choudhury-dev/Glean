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

backend-up:         ## Start PocketBase (Docker)
	@cd backend/pocketbase && { test -f .env || cp .env.example .env; }
	@cd backend/pocketbase && docker compose up -d

backend-down:       ## Stop PocketBase
	@cd backend/pocketbase && docker compose down

backend-logs:       ## Tail PocketBase logs
	@cd backend/pocketbase && docker compose logs -f
