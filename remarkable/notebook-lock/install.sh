#!/usr/bin/env bash
# Install or remove the Notebook Lock mod on a reMarkable 2 running XOVI.
#
#   ./install.sh                 install over USB (10.11.99.1)
#   ./install.sh 192.168.1.50    install over Wi-Fi
#   ./install.sh --remove [host] remove the mod (your lock list is kept)
set -euo pipefail

remove=false
if [[ "${1:-}" == "--remove" ]]; then
    remove=true
    shift
fi
host="${1:-10.11.99.1}"
dest="/home/root/xovi/exthome/qt-resource-rebuilder"
here="$(cd "$(dirname "$0")" && pwd)"

if $remove; then
    ssh "root@$host" "rm -f '$dest/notebookLock.qmd'"
    echo "Removed. Restarting the UI..."
else
    ssh "root@$host" "mkdir -p '$dest'"
    scp "$here/notebookLock.qmd" "root@$host:$dest/notebookLock.qmd"
    echo "Copied. Restarting the UI with XOVI..."
fi

# xochitl may only restart 4 times in 10 minutes before the tablet reboots,
# so clear the counter first.
ssh "root@$host" "systemctl reset-failed xochitl; /home/root/xovi/start" || true

echo
echo "Done. To check for patch errors:"
echo "  ssh root@$host 'journalctl -u xochitl --since \"-2min\" --no-pager | grep -iE \"qmldiff|Error while\"'"
