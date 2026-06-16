# Secrets rotation — required

The file `src/backend/Explorea/Explorea.Server/appsettings.json` was committed to
this repository with **live secrets**:

- PostgreSQL password for `explorea_local`
- JWT signing key
- Gmail SMTP app password (`fvel gdop kylq lgaw`)
- Cloudinary API key + secret
- Gemini API key
- Facebook App Secret

Anyone who has cloned, forked, or scraped the repo at any point has these
values. Git history makes this irreversible — even if we delete the file now,
the values are still recoverable from previous commits.

## What you must do

1. **Rotate every secret in the providers' dashboards.** New values, not edits:
   - Postgres: `ALTER USER postgres WITH PASSWORD '…';`
   - JWT: generate 32+ random bytes
   - Gmail: revoke the app password, generate a new one
   - Cloudinary → Settings → API Keys → regenerate
   - Google Cloud Console → APIs & Services → Credentials → Gemini key
   - Facebook Developers → App → Settings → Basic → reset App Secret
2. **Keep `appsettings.json` for local convenience but stop committing real
   secrets to it.** Either:
   - Use `dotnet user-secrets` (per developer, never goes to git):
     ```
     cd src/backend/Explorea/Explorea.Server
     dotnet user-secrets init
     dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=…"
     dotnet user-secrets set "JwtSettings:SecretKey" "…"
     ```
   - Or use `appsettings.Development.json` (already in `.gitignore` by VS
     default template — verify) with the real values.
3. **In production / CI**, supply secrets via environment variables. ASP.NET
   Core binds them automatically using `__` as separator:
   `JwtSettings__SecretKey=…`, `ConnectionStrings__DefaultConnection=…`.
4. Use `appsettings.template.json` (committed) as the shape reference.

After step 1, the leaked values are useless. Steps 2–4 prevent the next leak.
