# <YOUR_APP_NAME>

Built with [Wasp](https://wasp.sh), based on the [Open Saas](https://opensaas.sh) template.

## Reddit Bot

The **Reddit Bot** app does lead generation from Reddit: discover posts by subreddit or keyword, classify them with project keywords, and manage leads (status, TSV export). It uses a per-user Reddit credit system (admin top-up, deduction per API call), manual and scheduled exploration, and project-scoped posts, jobs, and schedules. Full documentation: [docs/reddit-bot.md](docs/reddit-bot.md) (concepts, data models, user flows with sequence diagrams, backend API, admin UI).

## App-specific permissions

Access to each app (SokaFilm, Online Judge, Reddit Bot) is gated by a **per-user, per-app permission matrix**. There is no global middleware: every app action/query calls `requireAppAccess`. Admins have all apps; other users only see and use apps an admin has granted them. Full documentation: [docs/app-permissions.md](docs/app-permissions.md) (concepts, data models, user flows with sequence diagrams, backend API, admin matrix, adding a new app).

## Development

### Running locally

- Make sure you have the `.env.client` and `.env.server` files with correct dev values in the root of the project.
- Run the database with `wasp start db` and leave it running.
- Run `wasp start` and leave it running.
- [OPTIONAL]: If this is the first time starting the app, or you've just made changes to your entities/prisma schema, also run `wasp db migrate-dev`.
