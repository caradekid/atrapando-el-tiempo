# Atrapando el tiempo x Caradekid
# Builds the menu bar app (live wallpaper) with the screen saver bundled inside.
# Needs only the Xcode Command Line Tools (xcode-select --install).

APP      := build/AtrapandoElTiempo.app
SAVER    := build/AtrapandoElTiempo.saver
APP_NAME := Atrapando el Tiempo
VERSION  ?= 1.0.0
DMG      := build/Atrapando-el-Tiempo-$(VERSION).dmg
MIN_OS   := 13.0
ARCHS    := arm64 x86_64
SWIFT    := swiftc -O -swift-version 5
APP_SRC  := $(wildcard native/App/*.swift)
SAVER_SRC:= $(wildcard native/Saver/*.swift)
WEB      := $(wildcard web/*.js web/*.css web/index.html)

.PHONY: all app saver run install install-saver dmg clean

all: app

saver: $(SAVER)
app: $(APP)

$(SAVER): $(SAVER_SRC) native/Saver/Info.plist $(WEB)
	rm -rf $@ && mkdir -p $@/Contents/MacOS $@/Contents/Resources/web build/obj
	for a in $(ARCHS); do \
	  $(SWIFT) -target $$a-apple-macos$(MIN_OS) -emit-library -module-name AtrapandoElTiempoSaver \
	    -framework ScreenSaver -framework WebKit -o build/obj/saver-$$a $(SAVER_SRC) || exit 1; \
	done
	lipo -create $(foreach a,$(ARCHS),build/obj/saver-$(a)) -output $@/Contents/MacOS/AtrapandoElTiempo
	cp native/Saver/Info.plist $@/Contents/Info.plist
	cp web/index.html web/gl.js web/engine.js web/app.js web/styles.css $@/Contents/Resources/web/
	[ -f assets/thumbnail.png ] && cp assets/thumbnail*.png $@/Contents/Resources/ || true
	echo '{}' > $@/Contents/Resources/config.json

$(APP): $(APP_SRC) native/App/Info.plist $(WEB) $(SAVER)
	rm -rf $@ && mkdir -p $@/Contents/MacOS $@/Contents/Resources/web build/obj
	for a in $(ARCHS); do \
	  $(SWIFT) -target $$a-apple-macos$(MIN_OS) -module-name AtrapandoElTiempo \
	    -framework AppKit -framework WebKit -framework ServiceManagement \
	    -o build/obj/app-$$a $(APP_SRC) || exit 1; \
	done
	lipo -create $(foreach a,$(ARCHS),build/obj/app-$(a)) -output $@/Contents/MacOS/AtrapandoElTiempo
	cp native/App/Info.plist $@/Contents/Info.plist
	cp web/index.html web/gl.js web/engine.js web/app.js web/styles.css $@/Contents/Resources/web/
	[ -f assets/AppIcon.icns ] && cp assets/AppIcon.icns $@/Contents/Resources/ || true
	cp -R $(SAVER) $@/Contents/Resources/
	codesign --force --sign - $@ >/dev/null 2>&1 || true

run: app
	open $(APP)

# Installs to /Applications when writable, otherwise to ~/Applications.
install: app
	@dest=/Applications; [ -w "$$dest" ] || { dest="$(HOME)/Applications"; mkdir -p "$$dest"; }; \
	rm -rf "$$dest/$(APP_NAME).app" "$$dest/Tourbillon.app"; \
	cp -R $(APP) "$$dest/$(APP_NAME).app" && echo "Installed in $$dest/$(APP_NAME).app" && \
	open "$$dest/$(APP_NAME).app"

install-saver: saver
	mkdir -p "$(HOME)/Library/Screen Savers"
	rm -rf "$(HOME)/Library/Screen Savers/Tourbillon.saver" "$(HOME)/Library/Screen Savers/$(APP_NAME).saver"
	cp -R $(SAVER) "$(HOME)/Library/Screen Savers/$(APP_NAME).saver"

# Distributable disk image: the app, a shortcut to Applications and a first-open guide.
dmg: app
	rm -rf build/dmg "$(DMG)" && mkdir -p build/dmg
	cp -R $(APP) "build/dmg/$(APP_NAME).app"
	/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $(VERSION)" "build/dmg/$(APP_NAME).app/Contents/Info.plist"
	/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $(VERSION)" "build/dmg/$(APP_NAME).app/Contents/Resources/AtrapandoElTiempo.saver/Contents/Info.plist"
	codesign --force --sign - "build/dmg/$(APP_NAME).app" >/dev/null 2>&1 || true
	ln -s /Applications build/dmg/Applications
	cp "dist/How to open.txt" "build/dmg/How to open.txt"
	hdiutil create -volname "$(APP_NAME)" -srcfolder build/dmg -ov -format UDZO "$(DMG)" >/dev/null
	@echo "Built $(DMG)"

clean:
	rm -rf build
