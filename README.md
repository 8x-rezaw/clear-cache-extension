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

## نصب با به‌روزرسانی خودکار

**ویندوز:** این دستور را در PowerShell اجرا کنید:

```powershell
irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1 | iex
```

پوشه‌ی نصب `%LOCALAPPDATA%\ClearCacheExtension` است و مسیرش خودکار در کلیپ‌بورد کپی می‌شود.

**مک:** این دستور را در ترمینال اجرا کنید:

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash
```

بعد یک بار در کروم:

1. `chrome://extensions` را باز کنید و **Developer mode** را روشن کنید.
2. روی **Load unpacked** بزنید و پوشه‌ی نصب را انتخاب کنید (ویندوز: `%LOCALAPPDATA%\ClearCacheExtension`، مک: `~/Extensions/clear-cache-extension`).

از این به بعد نسخه‌های جدید ساعتی یک بار از گیت‌هاب دریافت می‌شوند و اکستنشن خودش را دوباره بارگذاری می‌کند؛ نیازی به دانلود دوباره نیست.

برای حذف به‌روزرسانی خودکار در ویندوز:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1))) -Uninstall
```

و در مک:

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash -s uninstall
```

## نصب دستی

1. آخرین نسخه را از بخش [Releases](../../releases) دانلود و از حالت فشرده خارج کنید.
2. پوشه را جای ثابتی بگذارید؛ اگر پاک یا جابه‌جا شود، اکستنشن از کار می‌افتد.
3. `chrome://extensions` را باز کنید، **Developer mode** را روشن کنید و با **Load unpacked** پوشه را انتخاب کنید.

در این روش برای هر نسخه‌ی جدید باید فایل‌ها را دستی جایگزین کنید.

## Install (auto-updating)

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.ps1 | iex
```

macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/8x-rezaw/clear-cache-extension/main/install.sh | bash
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the install folder (`%LOCALAPPDATA%\ClearCacheExtension` on Windows, `~/Extensions/clear-cache-extension` on macOS). The installer checks for updates hourly and the extension reloads itself when its version changes.

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
