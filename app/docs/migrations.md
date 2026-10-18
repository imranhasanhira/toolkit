# Database migrations

## Reddit module (consolidated)

All Reddit-related tables, enums, indexes, foreign keys, and seed data are created in a single migration:

- `20260308120000_add_reddit_module`

This replaces the 12 individual Reddit migrations that previously existed. After pulling this change, do a one-time reset:

```bash
wasp db reset
```

No more resolve steps or manual Prisma commands needed.

## Leave Manager

Leave Manager tables are created in `20261018131500_add_lm_leave_manager`. Table names are `lm_leave_project`, `lm_leave_category`, `lm_leave_day`, `lm_government_holiday`, and `lm_settings`. `20261018141000_lm_leave_day_multi_category` lets one date hold several categories.
