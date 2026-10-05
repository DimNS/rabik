.PHONY: install ai-check check test dev build

install:
	@bun install

# Единая команда для ии-агента
ai-check: check
	@git diff --exit-code -- ./package.json || { echo "❌ Изменения в package.json — остановись и попроси человека посмотреть твои изменения"; exit 1; }

check:
	@bun run check

test:
	@bun run test

dev:
	@bun run dev

build:
	@bun run build
