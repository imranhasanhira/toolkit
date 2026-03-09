# Database migrations

## Reddit module (consolidated)

All Reddit-related tables, enums, indexes, foreign keys, and seed data are created in a single migration:

- `20260308120000_add_reddit_module`

This replaces the 12 individual Reddit migrations that previously existed. After pulling this change, do a one-time reset:

```bash
wasp db reset
```

No more resolve steps or manual Prisma commands needed.
