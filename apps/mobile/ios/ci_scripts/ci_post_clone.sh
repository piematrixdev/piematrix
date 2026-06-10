#!/bin/sh

#
# ci_post_clone.sh — Xcode Cloud post-clone step.
#
# Xcode Cloud checks out the repo but does NOT install JavaScript
# dependencies or CocoaPods (we intentionally keep node_modules/ and
# ios/Pods/ out of git). This script bootstraps everything the build
# needs:
#   1. Node (via Homebrew) for the Expo / React Native tooling
#   2. JS dependencies for the npm-workspaces monorepo (npm ci at root)
#   3. CocoaPods (pod install in apps/mobile/ios)
#   4. A pinned NODE_BINARY so the "Bundle React Native code" build
#      phase can find node regardless of the build shell's PATH.
#
# It runs from the ci_scripts/ directory; the repo root is provided by
# Xcode Cloud in $CI_PRIMARY_REPOSITORY_PATH.
#

set -e

echo "▸ ci_post_clone: starting"

# ── Resolve paths ─────────────────────────────────────────────────
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
MOBILE_IOS_DIR="$REPO_ROOT/apps/mobile/ios"

echo "▸ repo root: $REPO_ROOT"

# ── 1. Node via Homebrew ──────────────────────────────────────────
# Xcode Cloud images ship Homebrew. Pin to Node 20 LTS (engines: >=18).
echo "▸ Installing Node 20…"
brew install node@20
brew link --overwrite --force node@20

# Apple-silicon Homebrew prefix; fall back to Intel location if needed.
export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"

echo "▸ node $(node --version) / npm $(npm --version)"

# ── 2. JS dependencies (npm workspaces, installed at repo root) ────
echo "▸ Installing JS dependencies (npm ci)…"
cd "$REPO_ROOT"
npm ci

# ── 3. CocoaPods ──────────────────────────────────────────────────
echo "▸ Installing CocoaPods…"
brew install cocoapods

echo "▸ pod install…"
cd "$MOBILE_IOS_DIR"
pod install

# ── 4. Pin NODE_BINARY for the RN bundling build phase ────────────
# .xcode.env does `export NODE_BINARY=$(command -v node)`. The build
# phase runs in a fresh shell, so write the resolved path explicitly
# into the (git-ignored) local override to guarantee it's found.
echo "export NODE_BINARY=$(command -v node)" > "$MOBILE_IOS_DIR/.xcode.env.local"

echo "▸ ci_post_clone: complete"
