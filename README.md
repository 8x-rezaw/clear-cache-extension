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

1. آخرین نسخه را از بخش [Releases](../../releases) دانلود و از حالت فشرده خارج کنید، یا مخزن را clone کنید.
2. پوشه را جای ثابتی بگذارید (مثلاً Documents)؛ اگر پاک یا جابه‌جا شود، اکستنشن از کار می‌افتد.
3. `chrome://extensions` را باز کنید و **Developer mode** را روشن کنید.
4. روی **Load unpacked** بزنید و پوشه‌ای را که `manifest.json` در آن است انتخاب کنید.

### به‌روزرسانی

فایل‌های نسخه‌ی جدید را جایگزین کنید (یا `git pull` بزنید) و در `chrome://extensions` روی دکمه‌ی رفرش اکستنشن بزنید.

## Install

1. Download the latest release and unzip it, or clone this repository.
2. Keep the folder in a permanent location.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing `manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `browsingData` | Clearing cache, cookies and site storage |
| `history` | Clearing address bar suggestions for a single site |
| `scripting`, host access | Running the pop-up blocker on web pages |
| `webNavigation` | Closing ad tabs that a page opens or redirects to another site |
| `declarativeNetRequest` | Blocking requests to known ad networks |
| `storage` | Remembering blocker settings and allowed sites |
| `activeTab` | Reading the current tab's address |

No data leaves your browser.

## Updating the filter lists

```bash
python3 tools/build-rules.py
```

## License

The bundled [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font is licensed under the SIL Open Font License (`fonts/OFL.txt`).

Files in `rules/` are generated from [EasyList](https://easylist.to) (GPLv3 / CC BY-SA 3.0), [uBlock filters](https://github.com/uBlockOrigin/uAssets) (GPLv3), [Peter Lowe's list](https://pgl.yoyo.org/adservers/) and [PersianBlocker](https://codeberg.org/KhodeKiaa/PersianBlocker) (AGPLv3), and remain under their respective licenses.
