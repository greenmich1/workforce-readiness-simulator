SHELL        := /bin/bash
BACKEND_DIR  := $(shell pwd)
FRONTEND_DIR := $(shell pwd)/frontend
VENV         := $(BACKEND_DIR)/.venv
PY           := $(VENV)/bin/python
PIP          := $(VENV)/bin/pip
UVICORN      := $(VENV)/bin/uvicorn
BACKEND_PORT  := 8000
FRONTEND_PORT := 3000
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m
.DEFAULT_GOAL := dev

.PHONY: install install-backend install-frontend dev backend frontend test clean _check-venv _check-node

install: install-backend install-frontend
	@printf "$(GREEN)All dependencies installed$(RESET)\n"

install-backend:
	@printf "$(CYAN)Setting up Python virtualenv in .venv$(RESET)\n"
	python3 -m venv $(VENV)
	$(PIP) install --quiet --upgrade pip
	$(PIP) install --quiet -r requirements.txt
	@printf "$(GREEN)Backend ready$(RESET)\n"

install-frontend:
	@printf "$(CYAN)Installing frontend packages$(RESET)\n"
	cd "$(FRONTEND_DIR)" && npm install --silent
	@printf "$(GREEN)Frontend ready$(RESET)\n"

dev: _check-venv _check-node
	@printf "$(CYAN)backend  -> http://localhost:$(BACKEND_PORT)$(RESET)\n"
	@printf "$(CYAN)frontend -> http://localhost:$(FRONTEND_PORT)$(RESET)\n"
	@printf "$(CYAN)Ctrl+C stops both$(RESET)\n"
	@trap 'kill 0' INT; \
	(cd "$(BACKEND_DIR)" && $(UVICORN) main:app --reload-dir . --reload-exclude .venv --port $(BACKEND_PORT) 2>&1 | sed 's/^/[backend]  /') & \
	(cd "$(FRONTEND_DIR)" && npm run dev -- --port $(FRONTEND_PORT) 2>&1 | sed 's/^/[frontend] /') & \
	wait

backend: _check-venv
	@printf "$(CYAN)backend -> http://localhost:$(BACKEND_PORT)$(RESET)\n"
	cd "$(BACKEND_DIR)" && $(UVICORN) main:app --reload-dir . --reload-exclude .venv --port $(BACKEND_PORT)

frontend: _check-node
	@printf "$(CYAN)frontend -> http://localhost:$(FRONTEND_PORT)$(RESET)\n"
	cd "$(FRONTEND_DIR)" && npm run dev -- --port $(FRONTEND_PORT)

test: _check-venv
	@printf "$(CYAN)Running backend smoke tests$(RESET)\n"
	@cd "$(BACKEND_DIR)" && $(PY) -c "\
import sys; sys.path.insert(0, '.'); \
from generator import build_snapshot_from_profile; \
from models import GeneratorProfile; \
p = GeneratorProfile(employees=20,roles=5,courses=10,sites=1,shift_patterns=1,relationship_density=0.5,training_window_days=14); \
s1 = build_snapshot_from_profile(p); \
s2 = build_snapshot_from_profile(p); \
assert s1['phase'] == 'planned'; \
assert len(s1['placements']) == len(s2['placements']); \
print('  generator deterministic    OK'); \
print('  phase = planned            OK'); \
print(f'  placements: ' + str(len(s1['placements'])) + '   OK'); \
"

clean:
	@printf "$(CYAN)Removing .venv$(RESET)\n"
	rm -rf $(VENV)
	@printf "$(GREEN)Clean$(RESET)\n"

_check-venv:
	@if [ ! -f "$(UVICORN)" ]; then \
		printf "$(CYAN)Venv missing - installing backend first$(RESET)\n"; \
		$(MAKE) --no-print-directory install-backend; \
	fi

_check-node:
	@if [ ! -d "$(FRONTEND_DIR)/node_modules" ]; then \
		printf "$(CYAN)node_modules missing - installing frontend first$(RESET)\n"; \
		$(MAKE) --no-print-directory install-frontend; \
	fi
