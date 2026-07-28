#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
COMPOSE_FILE="$ROOT/integrations/envoy/test/compose.yaml"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
}
trap cleanup EXIT INT TERM

docker compose -f "$COMPOSE_FILE" up -d --build --wait certgen valkey lookup transit-fixture application oati-authz envoy
docker compose -f "$COMPOSE_FILE" run --rm --no-deps runner

RECEIPTS=$(docker compose -f "$COMPOSE_FILE" exec -T valkey valkey-cli --raw XLEN oati:gateway:receipts)
REPLAY_KEYS=$(docker compose -f "$COMPOSE_FILE" exec -T valkey sh -c "valkey-cli --scan --pattern 'oati:gateway:replay:*' | wc -l")
USAGE_KEYS=$(docker compose -f "$COMPOSE_FILE" exec -T valkey sh -c "valkey-cli --scan --pattern 'oati:gateway:usage:*' | wc -l")

if [ "$RECEIPTS" -lt 3 ] || [ "$REPLAY_KEYS" -lt 2 ] || [ "$USAGE_KEYS" -lt 1 ]; then
  printf '%s\n' "Valkey assertions failed: receipts=$RECEIPTS replay_keys=$REPLAY_KEYS usage_keys=$USAGE_KEYS" >&2
  exit 1
fi

printf '%s\n' "Envoy integration passed: receipts=$RECEIPTS replay_keys=$REPLAY_KEYS usage_keys=$USAGE_KEYS"
