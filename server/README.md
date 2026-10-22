# InkDynamics — user presets on a server

`presets.php` is a small reference endpoint for `UserPresetStore`'s `httpAdapter` (InkDynamics 4.0): it keeps a list of
user presets per *collection* as a flat JSON file, so the same personal pens can be used from any browser or device.
Without it, the calibration lab keeps the presets in the browser (`localStorageAdapter`) — nothing to set up.

## Setting it up (PHP 8.1+, no extensions beyond the standard ones)

1. Copy `presets.config.sample.php` to `presets.config.php` (do not commit the copy).
2. Make a long random write token, keep it safe, and put its **hash** in `token_hash`:
   `php -r "echo password_hash('the-token', PASSWORD_DEFAULT), PHP_EOL;"`
3. Prefer a `data_dir` outside the web root. If it stays in `server/data/`, the `.htaccess` there denies it on Apache
   (on other servers, deny that folder yourself).
4. In the lab: **★ My Presets → Kept in: A server**, the endpoint (`server/presets.php`), the token → **Connect**.
   The token is kept for that browser tab only (sessionStorage).

## Protocol

| Request | Body | Answer |
|---|---|---|
| `GET presets.php?c=<collection>` | — | `{"presets":[…]}` (needs the token if `read_needs_token`) |
| `POST presets.php?c=<collection>` with `Authorization: Bearer <token>` and `Content-Type: application/json` | `{"presets":[…]}` | `{"presets":[…]}` as kept |

The whole list is replaced on each save (a list of personal presets is small); writes are atomic (a lock, a temporary
file, a rename). Every preset is checked as in the library: a name (≤ 80 characters, control characters removed), one
of the 4 instruments, an optional core preset of that instrument, and only known settings, clamped to their ranges
(`js/core/SettingsParser.js`, `INK_SETTING_KEYS`). Errors are short codes (`token`, `origin`, `size`, `invalid`,
`limit`, `collection`, `storage`, `not_configured`).

Collections (`c`): `a-z`, `0-9`, `_`, `-`, up to 32 characters (default `default`).

## Security notes

- Only the token's hash is stored; a wrong token waits ¼ s before answering.
- Calls from a browser are accepted from this same site and from `allowed_origins` only.
- No pen setting is ever executed: settings are data (numbers, a few words, colours).
- Inkwell 20 does **not** use this endpoint: a signed-in person's pens live in their Inkwell account, through
  Inkwell's own API (sessions, CSRF, rate limits).
