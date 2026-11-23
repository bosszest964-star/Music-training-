#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

for python in python3.12 python3.11 python3.10 python3; do
  if command -v "$python" >/dev/null 2>&1 && "$python" -c 'import sys; sys.exit(sys.version_info[:2] not in {(3, 10), (3, 11), (3, 12)})'; then
    exec "$python" bootstrap.py
  fi
done

echo "Install Python 3.10, 3.11 or 3.12 and start again." >&2
exit 1
