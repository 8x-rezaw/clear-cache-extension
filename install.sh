#!/bin/bash
# Installs Clear Cache from GitHub and keeps it up to date (macOS).
#   curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash
# Uninstall:
#   curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash -s uninstall
set -euo pipefail

REPO="https://github.com/8x-rezaw/clear-cache-extension.git"
DIR="$HOME/Extensions/clear-cache-extension"
LABEL="io.github.8x-rezaw.clear-cache-extension"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-}" = "uninstall" ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "به‌روزرسانی خودکار حذف شد."
  echo "برای حذف کامل، اکستنشن را در chrome://extensions حذف کنید و این پوشه را پاک کنید:"
  echo "  $DIR"
  exit 0
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "git نصب نیست. ابتدا این دستور را اجرا کنید و بعد دوباره نصب را امتحان کنید:"
  echo "  xcode-select --install"
  exit 1
fi

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only --quiet
else
  mkdir -p "$(dirname "$DIR")"
  git clone --quiet --depth 1 "$REPO" "$DIR"
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/git</string><string>-C</string><string>$DIR</string>
    <string>pull</string><string>--ff-only</string><string>--quiet</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "نصب شد: $DIR"
echo
echo "یک بار در کروم:"
echo "  ۱. chrome://extensions را باز کنید و Developer mode را روشن کنید."
echo "  ۲. Load unpacked را بزنید و این پوشه را انتخاب کنید: $DIR"
echo "     (در پنجره‌ی انتخاب پوشه، Cmd+Shift+G را بزنید و مسیر بالا را وارد کنید.)"
echo
echo "از این به بعد نسخه‌های جدید ساعتی یک بار دریافت و خودکار اعمال می‌شوند."
