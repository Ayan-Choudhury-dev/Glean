#!/bin/sh
# Render the nginx config from the template so GLEAN_TOKEN can come from the
# environment. Without a token the gate is disabled, which is the pre-existing
# (open) behaviour — say so loudly instead of failing silently.
set -e

if [ -z "$GLEAN_TOKEN" ]; then
  echo "WARNING: GLEAN_TOKEN is empty — the API is open to anyone who can reach it." >&2
fi

envsubst '${GLEAN_TOKEN}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
