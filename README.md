# Clear Cache

اکستنشن کروم برای پاک کردن کش، کوکی‌ها، حافظه‌ی سایت‌ها و پیشنهادهای نوار آدرس، به‌همراه مسدودکننده‌ی پنجره‌های تبلیغاتی.

A Chrome extension to clear cache, cookies, site storage and address bar suggestions, with an ad and pop-up blocker.

## امکانات

- پاک کردن کش، Cache Storage و Service Worker، کوکی‌ها و Local Storage
- انتخاب بازه‌ی زمانی: ۱ ساعت، ۲۴ ساعت، ۱ هفته یا همه
- پاک کردن فقط برای سایت فعلی
- پاک کردن پیشنهادهای نوار آدرس (تاریخچه) با یک دکمه‌ی جدا
- مسدود کردن شبکه‌های تبلیغاتی و مخفی کردن تبلیغ‌های داخل صفحه، بر پایه‌ی فهرست‌های EasyList، uBlock filters، Peter Lowe و PersianBlocker
- اجرای قوانین پیشرفته (مثل مخفی کردن بر اساس متن) و اسکریپت‌های ضدتبلیغ مخصوص هر سایت
- مسدود کردن تب‌ها و پنجره‌های تبلیغاتی و ریدایرکت تب فعلی به سایت تبلیغاتی
- شناسایی پنجره‌های هشدار جعلی و دکمه‌های «بستن» تقلبی که به صفحه‌ی تبلیغاتی می‌برند
- امکان باز کردن دستی یا مجاز کردن هر سایت
- حالت روشن و تیره
- میانبر `Alt+Shift+C`

## نصب

دو روش دارید. روش اول پیشنهاد می‌شود، چون نسخه‌های جدید خودکار نصب می‌شوند و لازم نیست هر بار چیزی دانلود کنید.

| | نصب خودکار | نصب دستی |
|---|---|---|
| به‌روزرسانی | خودکار، ساعتی یک بار | دستی، با دانلود هر نسخه |
| نیازمندی | ویندوز: هیچ — مک: git | هیچ |

> **اگر قبلاً نسخه‌ای را دستی نصب کرده‌اید:** قبل از نصب خودکار، در `chrome://extensions` روی کارت Clear Cache دکمه‌ی **Remove** را بزنید. کروم اکستنشن را فقط از پوشه‌ای اجرا می‌کند که هنگام نصب انتخاب شده؛ اگر نسخه‌ی قدیمی را حذف نکنید، همان نسخه باقی می‌ماند.

### ویندوز — نصب خودکار

**۱. اجرای اسکریپت نصب**

منوی Start را باز کنید، **PowerShell** را جست‌وجو و اجرا کنید (دسترسی Administrator لازم نیست) و این دستور را بزنید:

```powershell
irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1 | iex
```

اسکریپت آخرین نسخه را در این پوشه نصب می‌کند و مسیرش را در کلیپ‌بورد کپی می‌کند:

```
%LOCALAPPDATA%\ClearCacheExtension
```

(مثلاً `C:\Users\<نام کاربری>\AppData\Local\ClearCacheExtension`)

> دستور `curl ... | bash` مخصوص مک است و در ویندوز خطای `'bash' is not recognized` می‌دهد؛ در ویندوز فقط از دستور بالا استفاده کنید.

**۲. افزودن به کروم (فقط یک بار)**

1. در کروم آدرس `chrome://extensions` را باز کنید.
2. در گوشه‌ی بالا **Developer mode** را روشن کنید.
3. روی **Load unpacked** بزنید.
4. پوشه‌ی `AppData` مخفی است و در پنجره‌ی انتخاب پوشه دیده نمی‌شود. روی نوار آدرس بالای پنجره کلیک کنید، با `Ctrl+V` مسیری را که در کلیپ‌بورد کپی شده بچسبانید و Enter بزنید.
5. روی **Select Folder** بزنید.
6. روی کارت اکستنشن باید آخرین شماره‌ی نسخه را ببینید.

**حذف به‌روزرسانی خودکار**

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1))) -Uninstall
```

بعد اکستنشن را در `chrome://extensions` با **Remove** حذف کنید و پوشه‌ی `%LOCALAPPDATA%\ClearCacheExtension` را پاک کنید.

### مک — نصب خودکار

**۱. اجرای اسکریپت نصب**

برنامه‌ی **Terminal** را باز کنید و این دستور را بزنید:

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash
```

اگر git نصب نباشد، اسکریپت پیام می‌دهد؛ ابتدا `xcode-select --install` را اجرا کنید و بعد دوباره دستور بالا را بزنید.

اسکریپت آخرین نسخه را در این پوشه نصب می‌کند:

```
~/Extensions/clear-cache-extension
```

**۲. افزودن به کروم (فقط یک بار)**

1. در کروم آدرس `chrome://extensions` را باز کنید.
2. در گوشه‌ی بالا **Developer mode** را روشن کنید.
3. روی **Load unpacked** بزنید.
4. در پنجره‌ی انتخاب پوشه `Cmd+Shift+G` را بزنید، `~/Extensions/clear-cache-extension` را وارد کنید و Enter بزنید.
5. روی **Select** بزنید.
6. روی کارت اکستنشن باید آخرین شماره‌ی نسخه را ببینید.

**حذف به‌روزرسانی خودکار**

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash -s uninstall
```

بعد اکستنشن را در `chrome://extensions` با **Remove** حذف کنید و پوشه‌ی `~/Extensions/clear-cache-extension` را پاک کنید.

### به‌روزرسانی خودکار چطور کار می‌کند

- ویندوز با یک Scheduled Task و مک با یک LaunchAgent، ساعتی یک بار (و هنگام ورود به سیستم) نسخه‌ی روی گیت‌هاب را بررسی می‌کنند و اگر جدیدتر بود فایل‌ها را جایگزین می‌کنند.
- خود اکستنشن هر ۳۰ دقیقه بررسی می‌کند که نسخه‌ی روی دیسک عوض شده یا نه و در این صورت خودش را دوباره بارگذاری می‌کند.
- یعنی هر نسخه‌ی جدید حداکثر حدود یک ساعت و نیم بعد از انتشار، بدون هیچ کاری اعمال می‌شود. پوشه‌ی نصب را جابه‌جا یا پاک نکنید.

### نصب دستی (بدون به‌روزرسانی خودکار)

1. فایل zip آخرین نسخه را از بخش [Releases](../../releases) دانلود کنید.
2. آن را از حالت فشرده خارج کنید و پوشه‌ی `clear-cache-extension` را جای ثابتی بگذارید؛ اگر پاک یا جابه‌جا شود، اکستنشن از کار می‌افتد.
3. در `chrome://extensions` حالت **Developer mode** را روشن کنید، روی **Load unpacked** بزنید و همین پوشه را انتخاب کنید.

برای هر نسخه‌ی جدید باید zip تازه را دانلود کنید، فایل‌های پوشه را جایگزین کنید و در `chrome://extensions` روی دکمه‌ی رفرش اکستنشن بزنید.

### مشکلات رایج

| مشکل | راه‌حل |
|---|---|
| بعد از نصب خودکار، کروم هنوز نسخه‌ی قدیمی را نشان می‌دهد | نسخه‌ی قبلی از پوشه‌ی دیگری نصب شده. آن را **Remove** کنید و با **Load unpacked** پوشه‌ی نصب خودکار را انتخاب کنید. |
| در ویندوز خطای `'bash' is not recognized` | از دستور PowerShell بخش ویندوز استفاده کنید، نه دستور مک. |
| پوشه‌ی `AppData` در پنجره‌ی انتخاب دیده نمی‌شود | مسیر را در نوار آدرس پنجره بچسبانید (بخش ویندوز، مرحله‌ی ۴). |
| خطای `Cannot load extension with file or directory name _metadata` | پوشه‌ی `_metadata` داخل پوشه‌ی اکستنشن را پاک کنید و **Retry** بزنید. این مشکل معمولاً وقتی پیش می‌آید که پوشه در iCloud یا OneDrive باشد؛ پوشه‌های نصب خودکار بیرون از این سرویس‌ها هستند. |
| روی سایتی چیزی که تبلیغ نیست مخفی شده یا سایت درست کار نمی‌کند | از پاپ‌آپ اکستنشن «برای این سایت خاموش کن» را بزنید. |

## Installation (English)

**Windows** — run in PowerShell (no admin needed):

```powershell
irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1 | iex
```

**macOS** — run in Terminal (requires git; install it with `xcode-select --install` if missing):

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash
```

Then, once: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the install folder — `%LOCALAPPDATA%\ClearCacheExtension` on Windows (paste the path into the picker's address bar; it is copied to the clipboard), `~/Extensions/clear-cache-extension` on macOS (press `Cmd+Shift+G` in the picker). If an older copy is already installed, **Remove** it first.

Updates are checked hourly and the extension reloads itself when its version changes. To uninstall, run the same command with `-Uninstall` (Windows: `& ([scriptblock]::Create((irm <url>))) -Uninstall`) or `bash -s uninstall` (macOS), then remove the extension in Chrome.

Manual install: download the zip from [Releases](../../releases), unzip it to a permanent folder and load it with **Load unpacked**.

## Permissions

| Permission | Why |
|---|---|
| `browsingData` | Clearing cache, cookies and site storage |
| `history` | Clearing address bar suggestions for a single site |
| `scripting`, host access | Running the pop-up blocker on web pages |
| `webNavigation` | Closing ad tabs that a page opens or redirects to another site |
| `declarativeNetRequest` | Blocking requests to known ad networks |
| `storage` | Remembering blocker settings and allowed sites |
| `alarms` | Checking for a newer version on disk |
| `activeTab` | Reading the current tab's address |

No data leaves your browser.

## Updating the filter lists

```bash
python3 tools/build-rules.py
```

## License

This project is licensed under the GNU General Public License v3.0 (`LICENSE`).

The bundled [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font is licensed under the SIL Open Font License (`fonts/OFL.txt`).

Files in `rules/` are generated from [EasyList](https://easylist.to) (GPLv3 / CC BY-SA 3.0), [uBlock filters](https://github.com/uBlockOrigin/uAssets) (GPLv3), [Peter Lowe's list](https://pgl.yoyo.org/adservers/) and [PersianBlocker](https://codeberg.org/KhodeKiaa/PersianBlocker) (AGPLv3), and remain under their respective licenses.
