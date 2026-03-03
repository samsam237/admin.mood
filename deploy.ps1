# Deploy : rebuild client/dist, commit, push → Dokploy redéploie automatiquement
Set-Location $PSScriptRoot

Write-Host "==> Build du client..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : le build a echoue. Deploy annule." -ForegroundColor Red
    exit 1
}

Write-Host "==> Ajout de client/dist au commit..." -ForegroundColor Cyan
git add client/dist

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Aucun changement detecte apres le build. Deploy annule." -ForegroundColor Yellow
    exit 0
}

$msg = Read-Host "Message de commit (Entree = 'build: update client dist')"
if (-not $msg) { $msg = "build: update client dist" }

git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : le commit a echoue." -ForegroundColor Red
    exit 1
}

Write-Host "==> Push vers origin..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : le push a echoue." -ForegroundColor Red
    exit 1
}

Write-Host "==> Done. Dokploy va redéployer automatiquement." -ForegroundColor Green
