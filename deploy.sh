#!/usr/bin/env bash
# Deploy : rebuild client/dist, commit, push → Dokploy redéploie automatiquement
set -e
cd "$(dirname "$0")"

echo "==> Build du client..."
npm run build

echo "==> Ajout de client/dist au commit..."
git add client/dist

if git diff --cached --quiet; then
    echo "Aucun changement detecte apres le build. Deploy annule."
    exit 0
fi

read -rp "Message de commit (Entree = 'build: update client dist') : " msg
msg=${msg:-"build: update client dist"}

git commit -m "$msg"

echo "==> Push vers origin..."
git push

echo "==> Done. Dokploy va redeployer automatiquement."
