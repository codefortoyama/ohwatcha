# ohwatcha — お祭りマップ

Vite + Leaflet のフロントエンドと、Directus（Postgres）を使った CMS で構成された地図アプリです。

## 構成
- フロントエンド: `frontend/`（Vite, Leaflet）
- CMS: `directus/`（Directus + Postgres, Docker Compose）
- インフラ雛形: `infra/`
- 構成メモ: [docs/structure.md](docs/structure.md)

## 現在の主な機能
- 地図表示（OSM / 地理院地図 各種ベースレイヤー切り替え）
- 地図透明度スライダー（初期 80%、折りたたみ表示）
- 獅子舞スポット（`current` コレクション）表示
- 施設情報（`shop` コレクション）表示
- 画面上部バナー（`banner` コレクション）表示

## ローカル開発

### 1) Directus 起動
```bash
cd directus
cp .env.sample .env
docker compose up -d
```

管理画面: `http://localhost:8055`

### 2) フロントエンド起動
```bash
cd frontend
cp .env.sample .env
npm install
npm run dev
```

開発時は `frontend/vite.config.js` の設定で `/api` が Directus にプロキシされます。

## フロントエンド環境変数（`frontend/.env`）
- `VITE_DIRECTUS_URL`  
  Directus のベース URL（末尾 `/` なし）
- `VITE_API_BASE`  
  API ベース（例: `/api`）
- `VITE_DIRECTUS_TOKEN`（任意）  
  公開権限で読めないコレクションを読む場合のトークン
- `VITE_SHISHI_MAX_AGE_HOURS`（任意）  
  `current` 表示の時間フィルタ

## ビルド
```bash
cd frontend
npm run build
```

生成物は `frontend/dist` に出力されます。

## 本番運用メモ（重要）
- 本番で `VITE_API_BASE=/api` を使う場合は、Web サーバーで `/api/*` を Directus に必ずプロキシしてください。
- これが無いと `/api/items/...` が `index.html` を返し、`Unexpected token '<'`（JSON 解析エラー）の原因になります。

## 主要ファイル
- フロントエントリ: [frontend/index.html](frontend/index.html)
- フロント実装: [frontend/src/main.js](frontend/src/main.js)
- フロント環境サンプル: [frontend/.env.sample](frontend/.env.sample)
- Vite 設定: [frontend/vite.config.js](frontend/vite.config.js)
- Directus Compose: [directus/docker-compose.yml](directus/docker-compose.yml)
