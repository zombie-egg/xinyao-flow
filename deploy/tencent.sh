#!/usr/bin/env bash
set -euo pipefail

# Application releases only: never migrate, seed, restore, or restart PostgreSQL.
archive=${1:?archive required}
revision=${2:?revision required}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$archive" == /home/ubuntu/xinyao-deploy.*.tgz ]] || exit 2
exec 9>/run/lock/xinyao-deploy.lock
flock -w 1200 9
release="/opt/xinyao-releases/$(date +%Y%m%d-%H%M%S)-$revision"
mkdir -p "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
docker run --rm --network host --env-file /etc/xinyao/app.env \
  -e NEXT_TELEMETRY_DISABLED=1 -v "$release:/src" -w /src \
  node:22-bookworm bash -euc 'npm ci --include=dev --no-audit --no-fund; npm run db:generate; npm run build'
test -s "$release/.next/BUILD_ID"
printf '%s\n' "$revision" > "$release/REVISION"

# Retain the original release and switch only after a successful build.
if [[ ! -L /opt/xinyao-source ]]; then
  initial="/opt/xinyao-releases/initial-$(date +%Y%m%d-%H%M%S)"
  mv /opt/xinyao-source "$initial"
  ln -s "$initial" /opt/xinyao-source
fi
previous=$(readlink -f /opt/xinyao-source)
ln -s "$release" /opt/xinyao-source.next
mv -Tf /opt/xinyao-source.next /opt/xinyao-source
systemctl restart xinyao-app
for attempt in $(seq 1 60); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:8080/login >/dev/null; then
    echo "Deployed $revision; previous release retained: $previous"
    exit 0
  fi
  sleep 2
done
ln -s "$previous" /opt/xinyao-source.next
mv -Tf /opt/xinyao-source.next /opt/xinyao-source
systemctl restart xinyao-app
echo 'New release failed its health check; restored previous release.' >&2
exit 1
