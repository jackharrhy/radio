#!/bin/sh
set -eu

node /app/scripts/prepare-celld-azurite.mjs
exec celld
