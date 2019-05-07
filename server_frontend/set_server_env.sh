#!/bin/sh

set -e

if [ "$NODE_ENV" == "" ]; then
  echo "You need to set NODE_ENV before running!"
  exit 1
fi

echo "window.server_env = \"$NODE_ENV\";" > build/server_env.js

exec "$@"
