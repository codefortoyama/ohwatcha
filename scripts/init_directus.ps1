$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $projectRoot "directus/docker-compose.yml"
$envFile = Join-Path $projectRoot "directus/.env"
$sampleEnvFile = Join-Path $projectRoot "directus/.env.sample"

if (!(Test-Path $envFile)) {
    Write-Host "directus/.env が見つからないため、directus/.env.sample をコピーしてください。"
    Write-Host "例: Copy-Item $sampleEnvFile $envFile"
    exit 1
}

docker compose --env-file $envFile -f $composeFile up -d

Write-Host "Directus の起動コマンドを実行しました。 http://localhost:8055 を確認してください。"
