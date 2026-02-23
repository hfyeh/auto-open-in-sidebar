PLUGIN_ID ?= auto-open-in-sidebar
PLUGIN_FILES := main.js manifest.json styles.css
OUTDIR ?= release
VERSION := $(shell node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')).version)")
PACKAGE_FILE := $(OUTDIR)/$(PLUGIN_ID)-$(VERSION).zip

.PHONY: help deps dev build rebuild clean install install-vault package

help:
	@echo "Targets:"
	@echo "  make deps                     Install npm dependencies"
	@echo "  make dev                      Run esbuild in watch mode"
	@echo "  make build                    Type-check and build main.js"
	@echo "  make rebuild                  Clean and build"
	@echo "  make clean                    Remove build artifacts"
	@echo "  make install DESTDIR=...      Copy plugin files to a directory"
	@echo "  make install-vault VAULT=...  Install into a vault plugin folder"
	@echo "  make package                  Build and create release zip"

all: build

deps:
	npm install

dev:
	npm run dev

build:
	npm run build

rebuild: clean build

clean:
	rm -f main.js

install: build
	@test -n "$(DESTDIR)" || (echo "Error: DESTDIR is required"; exit 1)
	mkdir -p "$(DESTDIR)"
	cp $(PLUGIN_FILES) "$(DESTDIR)/"
	@echo "Installed to $(DESTDIR)"

install-vault: build
	@test -n "$(VAULT)" || (echo "Error: VAULT is required"; exit 1)
	$(MAKE) install DESTDIR="$(VAULT)/.obsidian/plugins/$(PLUGIN_ID)"

package: build
	mkdir -p "$(OUTDIR)"
	rm -f "$(PACKAGE_FILE)"
	zip -j "$(PACKAGE_FILE)" $(PLUGIN_FILES)
	@echo "Packaged $(PACKAGE_FILE)"
