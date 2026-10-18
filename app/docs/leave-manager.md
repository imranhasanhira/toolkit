# Leave Manager

Leave Manager is a per-user calendar for marking leave against categories, with quotas and government holidays. The screen is the same one used in poffice: category bar, month grid, and the projects / categories / holidays column. Toolkit only adds login, the app permission check, and the shared header.

The route is `/leave-manager`. The permission key is `leave-manager`. Admins can open it without a grant. Other users need a `UserAppPermission` row, which the admin matrix can toggle.

## Data

Tables are prefixed `lm_` so they do not collide with other apps.

| Model | Table | What it stores |
| --- | --- | --- |
| `LmLeaveProject` | `lm_leave_project` | A named calendar. Unique name per user. Color, archive flag, and a one-time defaults flag. |
| `LmLeaveCategory` | `lm_leave_category` | Name, color, start and end, quota, archive. `projectId` null means every project. Unique name per user and scope. |
| `LmLeaveDay` | `lm_leave_day` | One row per category on a date inside a project. The same date can hold several categories, and can also exist in another project. |
| `LmGovernmentHoliday` | `lm_government_holiday` | Name, optional note, and date. Project-only, or shared by every project. |
| `LmSettings` | `lm_settings` | One row per user. `holidaysSeeded` stops the default holiday list from coming back after it is deleted. |

The first visit creates a project named Default, seeds Vacation, Sick Leave, Personal, and Work From Home for the current year, and seeds the built-in holiday list once.

## Behavior

- Marking a day requires a selected category. A day outside that category’s date range is rejected.
- The same day can hold more than one category. Clicking adds the selected category, or removes only that category if it is already there. The calendar uses one style for every leave day: full-day color when no day has two categories, and a horizontal line per category when any day does. A line runs across consecutive days of that category, and several lines stack. Holidays stay a full-day red cell in both styles. Hovering the day lists the names. A long-press does the same on a phone.
- The calendar opens on Month, showing 13 months. D, W, and M each have a count for how many days, weeks, or months to show. Y always shows 12 months, January through December. The arrows move one day, week, month, or year. In Day and Week view the days run across the row. Per line sets how many days fit before the next row.
- A Weekends checkbox includes Saturday and Sunday when marking a day or a range. Holidays stay unmarked either way.
- Quota is a warning, counted per category. Marking still succeeds when the quota is already used up.
- Range marking skips holidays. It also skips weekends unless Weekends is checked.
- Adding a holiday clears leave already marked on those dates. A global holiday clears them in every project.
- Archiving the last active project is rejected.
- Deleting a global category or holiday removes it from every project.

Operations live in `src/leave-manager/operations.ts`. Each one calls `requireAppAccess` for `APP_KEYS.LEAVE_MANAGER` before it reads or writes.
