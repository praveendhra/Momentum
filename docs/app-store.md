# Momentum on the App Store

The iOS app is the same React app wrapped with [Capacitor](https://capacitorjs.com) (`frontend/ios/`). It's built and uploaded to App Store Connect by GitHub Actions on a macOS runner (`.github/workflows/ios-release.yml`), so no Mac is needed.

- **Store name:** Momentum: Habits & Streaks (home-screen name: Momentum). "Momentum", "Momentum: Habit Tracker" and similar were taken.
- **Bundle ID:** `com.praveendhra.momentum`
- **Devices:** iPhone only, portrait
- **Sign-in in the app:** Sign in with Apple (native sheet) and email + password. Google sign-in is web-only because Google blocks it inside app web views.
- **Account deletion:** Settings → Danger zone (required by App Store rule 5.1.1(v)).
- **Privacy policy:** https://momentum.praveendhra.com/privacy.html
- **Support:** https://momentum.praveendhra.com/support.html

## One-time setup

### 1. Create the app in App Store Connect
App Store Connect → Apps → **+** → New App:
- Platform: iOS · Name: **Momentum** (if taken: "Momentum: Habit & Workout Log") · Language: English (U.S.)
- Bundle ID: **com.praveendhra.momentum** (register it first under Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App, if it isn't listed)
- SKU: `momentum-ios`

### 1b. Turn on Sign in with Apple
- **Supabase** → Authentication → Sign In / Providers → **Apple** → enable, and put `com.praveendhra.momentum,com.praveendhra.momentum.web` in **Client IDs** (app + website). Leave the secret empty (it's only needed for Apple sign-in on the website). Save.
- **Apple:** nothing to do by hand. The app's `App.entitlements` requests the capability and automatic signing adds it to the App ID during the CI build. If the build complains, enable it manually: developer.apple.com → Identifiers → com.praveendhra.momentum → check **Sign In with Apple** → Save.

### 1b-web. Sign in with Apple on the website
The website uses Apple's popup and the same token exchange (no 6-month secret to rotate). It needs a **Services ID**:
1. developer.apple.com → Identifiers → **+** → **Services IDs** → Description `Momentum Web`, Identifier **`com.praveendhra.momentum.web`** → Register.
2. Open it, tick **Sign In with Apple** → **Configure**: Primary App ID **com.praveendhra.momentum**; Domains **`momentum.praveendhra.com`**; Return URLs **`https://momentum.praveendhra.com/`** → Next → Done → Continue → Save.
3. Supabase → Apple provider → **Client IDs**: `com.praveendhra.momentum,com.praveendhra.momentum.web` → Save.
4. The button is on: `VITE_APPLE_WEB: "1"` in `.github/workflows/deploy-pages.yml`. (Done 2026-10-22: App ID and Services ID configured, Supabase Client IDs set.)

### 1c. Account deletion revokes Sign in with Apple (Guideline 5.1.1(v))
When an Apple user deletes their account in the iOS app, Apple asks them to confirm (Face ID), and the `delete-account` Edge Function revokes the app's Apple tokens before deleting the account. Setup:
1. developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+** → name `Momentum SIWA`, tick **Sign in with Apple** → Configure → Primary App ID **com.praveendhra.momentum** → Save → Continue → Register. Download the `.p8` (one-time download) and note its **Key ID**.
2. supabase.com → Account (top-right avatar) → **Access Tokens** → Generate new token (`GitHub Actions`).
3. GitHub repo secrets: `SUPABASE_ACCESS_TOKEN`, `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_KEY_P8` (full .p8 contents), and `APPLE_TEAM_ID` (same one the iOS build uses).
4. Actions → **Deploy Supabase Edge Functions** → Run workflow. It stores the Apple secrets in Supabase and deploys `delete-account` (and `send-notifications`). It also redeploys automatically whenever `supabase/functions/` changes.

Until this is deployed, Delete account still works (it falls back to the `delete_my_account()` database function); it just can't revoke Apple tokens.

### 2. Create an App Store Connect API key
App Store Connect → Users and Access → **Integrations** → App Store Connect API → Team Keys → **+**
- Name: `GitHub Actions` · Access: **Admin** (needed so Xcode can create the distribution certificate and profile automatically)
- Download the `.p8` file (only downloadable once) and note the **Key ID** and the **Issuer ID** shown above the list.
- Your **Team ID** is on developer.apple.com → Account → Membership details.

### 3. Add GitHub secrets
GitHub → praveendhra/Momentum → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | 10-character Team ID |
| `ASC_KEY_ID` | API Key ID |
| `ASC_ISSUER_ID` | API Issuer ID |
| `ASC_KEY_P8` | Entire contents of `AuthKey_XXXXXXXXXX.p8`, including the BEGIN/END lines |

## Shipping a build
GitHub → Actions → **iOS build → TestFlight** → Run workflow → enter the version (e.g. `1.0.0`).
Or push a tag: `git tag ios-v1.0.0 && git push origin ios-v1.0.0`.

The build appears in App Store Connect → TestFlight after Apple processes it (5–30 min). Install it with the TestFlight app on your iPhone to try it, then submit it for review from the app's page.

## Store listing (copy/paste)

**Subtitle (30):** Habits, workouts & mood tracker

**Promotional text (170):** Small daily wins, made visible. Log workouts, habits, skills and mood in a tap, and watch a year of progress fill in on your heatmap.

**Description:**
> Momentum is a tracker that rewards showing up, not perfection.
>
> Most trackers reset you to zero the day you miss. Momentum counts the days you showed up: every session is a block, and you stack them one at a time.
>
> • TODAY BOARD: one tap for yes/no habits, quick forms for everything else, with progress toward each daily goal.
> • YEAR HEATMAP: every day is a block that glows brighter the more you did. Filter by category or activity, switch years, and tap any day to see what you did.
> • STREAKS THAT FORGIVE: daily streaks plus weekly streaks ("17 weeks in a row") for things you do a few times a week.
> • AUTOMATIC PERSONAL RECORDS: heaviest set, estimated 1RM, longest run, biggest session, detected the moment you log.
> • STRENGTH LOGGING: sets × reps × weight with live volume. Runs get distance and time, skills get difficulty, habits get quality.
> • MOOD INSIGHTS: daily check-ins with energy, stress and a gratitude journal. After two weeks, see which activities lift your mood.
> • MILESTONES & LIFETIME TOTALS: "194 km ≈ 4.6 marathons", "16 h ≈ 8 movies".
> • YOUR WAY: light and dark themes, kg/lb, km/mi, L/fl oz, week start and time zone, optional email reminders and a weekly summary.
> • SYNCS WITH THE WEB: same account at momentum.praveendhra.com.
>
> No ads, no tracking, nothing sold. Delete your account and all data any time in Settings.

**Keywords (100):** habit,tracker,workout,gym,streak,mood,journal,fitness,log,routine,goals,heatmap,running,reading

**Category:** Health & Fitness (secondary: Productivity) · **Age rating:** 4+ · **Price:** Free

**Support URL:** https://momentum.praveendhra.com/support.html · **Marketing URL:** https://momentum.praveendhra.com · **Privacy Policy URL:** https://momentum.praveendhra.com/privacy.html

**Listing source of truth:** `frontend/ios/fastlane/metadata/` (text), `frontend/ios/fastlane/screenshots/` (6.9" iPhone, 1320 × 2868), `frontend/ios/fastlane/age_rating.json`. Pushing changes there runs **iOS App Store listing**, which uploads them. The copy below is the original draft.

**Header and Search Results assets:** `frontend/ios/fastlane/creative/` holds the header (3840 × 1646) and search results (3840 × 2560) images plus the HTML they're rendered from. fastlane can't upload these; they're added on the version page under Header and Search Results (Upload), and save immediately.

**Review notes:** Sign in with Apple works for reviewers too, but also give Apple a demo account (email + password) with a few habits and some days of logs, e.g. create `appreview@…`, sign in, add a few habits and log them. Mention: "Sign in with the demo account. Account deletion is in Settings → Danger zone."

## App Privacy answers (App Store Connect → App Privacy)
- Data collection: **Yes**
- **Contact Info → Email Address:** App Functionality · Linked to user · Not used for tracking
- **User Content → Other User Content** (logs, notes, journal): App Functionality · Linked to user · Not used for tracking
- **Health & Fitness → Fitness** (workouts, sets, distances): App Functionality · Linked to user · Not used for tracking
- **Identifiers → User ID** (account ID): App Functionality · Linked to user · Not used for tracking
- Tracking: **No**. Third-party advertising/analytics: **None**.

## Updating the app
Any change to the web app ships to the iOS app on the next workflow run (it rebuilds `frontend` with `npm run ios:sync`). Bump the version for each App Store release; the build number increases automatically.
