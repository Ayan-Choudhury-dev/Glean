# FAQ

Short answers to the questions that come up most. Nothing here is aspirational:
if something is not built, it says so.

### Where is my data stored?

In a SQLite database inside the app's private storage on your phone
(`expo-sqlite`). Pantry items, the shopping list, and consumption history all
live there. There is no cloud copy.

### Do I need an account?

No. There is no sign-up, no email, no login. On first launch you enter a name
and a pantry name, and that is it.

### Does Glean send anything to a server?

Not by default. Two exceptions, both visible in the code:

- On launch it requests the latest release tag from the GitHub API to check for
  updates (`lib/updates.ts`). No identifying data is sent.
- If *you* configure a self-hosted backend under **Profile → Self-hosted
  backend**, the app pushes your pantry to that URL.

### What happens if I uninstall the app?

The database is deleted with the app. Uninstalling is the only reset there is.
Export a CSV first if you care about the contents.

### How do I move my data to a new phone?

Two options:

1. **CSV.** Settings → **Export** writes `glean-inventory.csv` and opens the
   share sheet; move it to the new phone, then paste its contents into the
   **Import CSV** box on the new device. The file has four columns —
   `Name,Quantity,Category,Location` — so photos, barcodes, shopping-list
   entries, and consumption history are **not** included.
2. **Add member.** Run the bundled Docker backend, connect the old phone and
   upload, then on the new phone enter the same address and choose **Use the
   pantry from the server**. This carries the full dataset.

### What is the self-hosted backend, and what is it not?

It is Postgres + PostgREST + nginx in Docker, serving a read-only dashboard and a
`/rest/v1/*` API. It is **not** a hosted service and has **no authentication**:
the anon key can be any non-empty string, Row Level Security is disabled, and
anyone who can reach the URL can read and write everything. Keep it on your LAN,
behind Tailscale, or add TLS and real auth before exposing it. Details in
[SELF_HOSTING.md](SELF_HOSTING.md).

### Is sync realtime?

No. Changes are pushed as you make them, but a second device only sees them
after a manual **Restore from server**. Conflicts resolve last-write-wins.

### Why does barcode scanning ask for the camera?

The scanner uses `expo-camera`. `android.permission.CAMERA` is declared in
`app.json`, and the permission is requested when you open the scanner, not at
launch. Decline it and everything else still works — you can type barcodes in by
hand. `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are explicitly blocked.

### Why are there two APKs?

They are per-ABI splits. `arm64-v8a` is the 64-bit build for phones from roughly
2017 onward; `armeabi-v7a` is the 32-bit build for older hardware. Each contains
native libraries for one architecture only, so each is roughly half the size of
a combined APK. Emulator ABIs (`x86`, `x86_64`) are not built.

### Which APK should I download?

`arm64-v8a` first. If Android says "App not installed", use `armeabi-v7a`.

### Why is there no iOS build?

No `ios/` directory is committed, no Apple Developer account is set up, and the
app has never been built or run on Apple hardware. The iOS configuration in
`app.json` exists, and `npx expo prebuild --platform ios` would generate the
project, but the result is **unverified**.

### How do I update?

The app checks GitHub releases on launch. When a newer version exists it shows a
dialog with a **Download** button that opens the release page. Download the APK
and install it over the old one — the database survives, as long as the signing
key has not changed. There is no in-app installer.

### Why not use Expo Go?

Glean depends on native modules (`expo-sqlite`, `expo-camera`,
`expo-image-picker`, `expo-haptics`, `expo-sharing`, `expo-file-system`) that
Expo Go does not include. Build a dev client with `npx expo run:android`.

### Can I use it on the web?

Not the real app. The self-hosted backend serves a read-only dashboard; running
the Glean UI in a browser would need `expo-sqlite` web support and shims for the
native modules. Not started.

### Where are restock suggestions and multi-user households?

Both are behind flags in `constants/config.ts` and both are off for the solo v1
release. The code paths exist but are not exposed.

### What license is Glean under?

Apache License 2.0. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE). The F-Droid
metadata declares `License: Apache-2.0`.

### Where do I report a bug?

https://github.com/Ayan-Choudhury-dev/Glean/issues
