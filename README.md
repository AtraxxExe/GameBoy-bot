# GameBoy-bot v1.2.2 
*(Changes relative to v1.0.0)*

---

### New Commands

| Command | Description |
|---|---|
| `/about` | Shows a bot info embed with uptime, invite link, and support server button. Also auto-posts this embed when the bot joins a new server. |
| `/afk [reason]` | Toggles your AFK status. While AFK, the bot tracks direct @mentions, @everyone, and role pings; sends you a DM summary when you return and notifies the channel that the user is AFK. |
| `/automod settings/setup/ignore` | Full automated moderation system: configurable presets (light/strict), invite link blocking, and a private alert channel for flagged messages. |
| `/coinflip` | Simple coin flip command (Heads / Tails). |
| `/freegames set/remove/preview` | Subscribes a channel to hourly free game announcements (Epic Games / other sources). |
| `/giveaway create/end/cancel` | Guided giveaway wizard — posts a card embed to a chosen channel, tracks entrants via a Join button, and picks a winner when ended. |
| `/health` | Admin-only command showing bot uptime, error count, permission audit, and automod status for the server. |
| `/modcases list/close` | Reviews and closes open automod-generated moderation cases. |
| `/warn add/remove/list` | Adds/removes/lists warnings for a member with configurable auto-punishment escalation (mute → kick → ban). |
| `/vc mute/unmute/afk/remove/limit` | Voice channel moderation: server-mute, move to AFK channel, disconnect, or set a user limit. |

---

### New Features (in existing systems)

- **`/user` — warns subcommand**: Added `/user warns <user>` to view a member's warning history directly from the user info command.
- **`/user` — richer profile info**: Now shows Nitro subscription type, server boost status/date, accurate display name, and all stats via Discord API force-fetch.
- **`/purge` — free-form amount**: Replaced fixed dropdown choices (10 / 50 / 100) with a free integer input (1–100) for both bulk and user-targeted purge.
- **Bot presence on startup**: Bot now sets its streaming status directly in the `ClientOptions` (previously set after `ready`, which was unreliable).
- **On-guild-join welcome**: Bot automatically posts an `/about` embed in the system channel when it joins a new server.
- **Free games poller**: Checks for new free game offers every hour and announces them to configured channels.
- **Giveaway persistence**: Active giveaways are restored and re-ticked on bot restart.
- **Heartbeat logging**: Every 5 minutes the bot logs JSON uptime/guild count/error count to stdout for monitoring.

---

### Bug Fixes

- **Command loader crash**: Wrapped each command file `require()` in a try/catch. Previously a single broken file would crash the entire bot on startup. Now it logs a warning and continues loading the rest.
- **Voice event handler crash**: Wrapped `voiceStateUpdate` event initialisation in try/catch so a failure there no longer prevents the bot from starting.
- **Ticket creation — missing permission check**: Added a bot self-permission check (Manage Roles + Manage Channels) before attempting to create a ticket, with a user-friendly error message instead of a raw Discord API error.
- **Ticket creation — invalid category**: Added a check that the configured ticket category still exists and is valid before proceeding.
- **Ticket creation — 403 handling**: Discord 50013 / 403 errors on ticket channel creation are now caught and reported clearly.
- **Kick command — missing permissions response**: Replaced a generic "Missing permissions" reply with an actionable message explaining role hierarchy requirements.
- **Kick/ban/timeout — deferReply API call**: Replaced deprecated `{ ephemeral: true }` with `{ flags: [MessageFlags.Ephemeral] }` (required by newer discord.js).
- **Role command — same deferReply fix**: All five `deferReply` calls updated to use `MessageFlags.Ephemeral`.
- **Interaction error handler — deferred state**: Now correctly uses `editReply` for deferred interactions and wraps the entire block in try/catch to avoid secondary crashes.
- **`!talk` / prefix command — permission check missing**: Added a bot-side `ManageMessages` permission check before attempting to delete the invoking message.
- **`!talk` — mention injection**: Added `allowedMentions: { parse: [] }` to the payload so a user cannot use `!talk` to ping everyone.
- **logManager — write race condition**: Extracted log file writes into a `safeWriteLogFile()` helper with error handling; file is now recreated if missing rather than crashing.
- **Image attachment handling in welcomes/goodbyes**: Fixed a bug where `config.image.url` was used as a local file path for `AttachmentBuilder`. Now checks `config.image.filePath` first (local file), falls back to a direct URL embed if only a URL is provided.
- **Login — missing token validation**: Boot now validates the token from `botConfig.js` before calling `client.login()`; exits with a clear error message if the token is empty or invalid.

---

### Security / Privacy Improvements

- **Message content redacted from logs**: Deleted and edited message log entries no longer store the raw message content. They now record content length only (`before=N chars, after=M chars`), reducing exposure of user messages in log files.
- **Automod-deleted message guard**: Messages deleted by automod no longer trigger the `messageDelete` log handler, preventing false "deleted message" log entries for bot-enforced removals.
- **Suspicious account detection**: New-member join handler now passes through `automodManager.handleMemberAdd()` which can flag suspicious accounts (e.g. new accounts, unverified).

---

### Moderation Audit System (`moderationUtils.js` — new file)

All moderation commands (ban, kick, timeout, purge, warn) now:
- Call `audit(type, details)` to record a structured internal audit trail.
- Call `notifyAdmin(guild, embed)` to post a colour-coded notification embed to the configured private moderation channel.
- Require **Administrator** permission instead of the individual per-command permission — permission requirements are now normalised across all mod commands.

---

### Dependency / Configuration Changes

- **discord.js** bumped from `^14.26.4` → `^14.27.0`.
- **`package.json` scripts** added: `start` (`node index.js`), `deploy` (`node deploy-commands.js`), `check` (syntax check all JS files), `test` now runs `check`.
- **`engines` field** added: requires Node.js `>=18`.
- **`botConfig.js`** — new centralised config module replacing direct `process.env` reads in `index.js`. Token and clientId are now validated at boot.

---

### Visual / UX Changes

- Bot embed accent colour changed from `0x8a5cff` (purple) → `0xd6aded` (light lavender) across all commands and level-up notifications.
- Error messages across the board de-cluttered: removed redundant emoji prefixes from ephemeral replies; messages are shorter and more direct.
