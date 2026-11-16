# Builds Tourbillon.app (menu bar app + live wallpaper) with the screen saver bundled inside.
# Needs only the Xcode Command Line Tools (xcode-select --install).

APP      := build/Tourbillon.app
SAVER    := build/Tourbillon.saver
MIN_OS   := 13.0
ARCHS    := arm64 x86_64
SWIFT    := swiftc -O -swift-version 5
APP_SRC  := $(wildcard native/App/*.swift)
SAVER_SRC:= $(wildcard native/Saver/*.swift)
WEB      := $(wildcard web/*.js web/*.css web/index.html)

.PHONY: all app saver run install install-saver clean

all: app

saver: $(SAVER)
app: $(APP)

$(SAVER): $(SAVER_SRC) native/Saver/Info.plist $(WEB)
	rm -rf $@ && mkdir -p $@/Contents/MacOS $@/Contents/Resources/web build/obj
	for a in $(ARCHS); do \
	  $(SWIFT) -target $$a-apple-macos$(MIN_OS) -emit-library -module-name TourbillonSaver \
	    -framework ScreenSaver -framework WebKit -o build/obj/saver-$$a $(SAVER_SRC) || exit 1; \
	done
	lipo -create $(foreach a,$(ARCHS),build/obj/saver-$(a)) -output $@/Contents/MacOS/Tourbillon
	cp native/Saver/Info.plist $@/Contents/Info.plist
	cp web/index.html web/engine.js web/app.js web/styles.css $@/Contents/Resources/web/
	[ -f assets/thumbnail.png ] && cp assets/thumbnail*.png $@/Contents/Resources/ || true
	echo '{}' > $@/Contents/Resources/config.json

$(APP): $(APP_SRC) native/App/Info.plist $(WEB) $(SAVER)
	rm -rf $@ && mkdir -p $@/Contents/MacOS $@/Contents/Resources/web build/obj
	for a in $(ARCHS); do \
	  $(SWIFT) -target $$a-apple-macos$(MIN_OS) -module-name Tourbillon \
	    -framework AppKit -framework WebKit -framework ServiceManagement \
	    -o build/obj/app-$$a $(APP_SRC) || exit 1; \
	done
	lipo -create $(foreach a,$(ARCHS),build/obj/app-$(a)) -output $@/Contents/MacOS/Tourbillon
	cp native/App/Info.plist $@/Contents/Info.plist
	cp web/index.html web/engine.js web/app.js web/styles.css $@/Contents/Resources/web/
	[ -f assets/AppIcon.icns ] && cp assets/AppIcon.icns $@/Contents/Resources/ || true
	cp -R $(SAVER) $@/Contents/Resources/
	codesign --force --sign - $@ >/dev/null 2>&1 || true

run: app
	open $(APP)

install: app
	rm -rf /Applications/Tourbillon.app && cp -R $(APP) /Applications/
	open /Applications/Tourbillon.app

install-saver: saver
	mkdir -p "$(HOME)/Library/Screen Savers"
	rm -rf "$(HOME)/Library/Screen Savers/Tourbillon.saver"
	cp -R $(SAVER) "$(HOME)/Library/Screen Savers/"

clean:
	rm -rf build
