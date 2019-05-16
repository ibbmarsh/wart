#!/bin/sh

set -e

if [ "$NODE_ENV" == "" ] \
  || [ "$GOOGLE_AUTH_CLIENT" == "" ]; then
  echo "You need to set NODE_ENV and GOOGLE_AUTH_CLIENT before running!"
  exit 1
fi

echo "window.server_env = \"$NODE_ENV\";" > build/server_env.js
echo "window.google_client = \"$GOOGLE_AUTH_CLIENT\";" >> build/server_env.js
# For everywhere except dev, REST calls just go to the same domain.
echo "window.rest_uri = \"\";" >> build/server_env.js

exec "$@"
