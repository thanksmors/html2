#!/bin/sh
# Serve the gallery on one origin so theme/recipe changes sync instantly
# across every open tab (Firefox partitions file:// storage per folder,
# which blocks cross-folder sync when files are opened by double-click).
cd "$(dirname "$0")/.." && exec python3 -m http.server "${1:-8907}"
