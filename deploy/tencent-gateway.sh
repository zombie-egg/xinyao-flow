#!/usr/bin/env bash
set -euo pipefail
revision=${SSH_ORIGINAL_COMMAND:-}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 2
umask 077
archive=$(mktemp /home/ubuntu/xinyao-deploy.XXXXXXXX.tgz)
trap 'rm -f "$archive"' EXIT
cat > "$archive"
sudo -n /usr/local/sbin/xinyao-deploy "$archive" "$revision"
