# Security

## Reporting a problem

Please report vulnerabilities privately: open a **security advisory** on GitHub
(Repository → Security → Advisories) or email the maintainer listed on the GitHub
profile. Do not open a public issue for a vulnerability.

## Supported versions

The latest release only.

## The self-hosted backend is intentionally open

The bundled backend (`backend/`) is a single-tenant, self-hosted service. Its
schema **disables Row Level Security and has no authentication**: anyone who can
reach the API can read and write every row.

This is a deliberate trade-off for a server you run yourself, not a bug. Keep it
on a trusted network (LAN or VPN). Before exposing it to the internet, put TLS
and real authentication in front of it.

## Data on the phone

The app stores everything in a local SQLite database. There is no account and no
telemetry. Uninstalling the app removes the data. If the user connects a server,
changes are pushed to it over the address they configured.
