# ohwatcha — お祭りマップ

このリポジトリは、Vite ベースのフロントエンド（`frontend/`）と Directus を用いたヘッドレス CMS バックエンド（`directus/`）で構成される小規模な地図アプリです。

詳しい構成図や補足は [docs/structure.md](docs/structure.md) を参照してください。

**目次（抜粋）**
- フロントエンド: `frontend/` (Vite + Leaflet)
- バックエンド: `directus/` (Directus + Postgres, Docker Compose)
- インフラ用テンプレ: `infra/`

## ローカル開発

### フロントエンド
1. `frontend/.env.sample` をコピーして `frontend/.env` を作成してください（必要に応じて `VITE_DIRECTUS_URL` を変更）。
2. 依存をインストールします:

```bash
cd frontend
npm install
```

3. 開発サーバを起動します:

```bash
npm run dev
```

開発時は Vite のプロキシで `/api` を Directus に転送する設定が有効です（設定は `frontend/vite.config.js` を参照）。

### Directus（ローカル）
1. `directus/.env.sample` をコピーして `directus/.env` を作成し、`DIRECTUS_KEY` / `DIRECTUS_SECRET` / 管理者情報などを設定してください。
2. Directus を起動します:

```bash
cd directus
docker compose up -d
```

3. 管理画面はデフォルトで `http://localhost:8055` で利用可能です。

## ビルドと配布

フロントエンドのビルド:

```bash
cd frontend
npm run build
```

出力先は `frontend/dist` です。静的配布や CDN 配置の際は `public/` 内のファイルも確認してください。

## 運用上の注意と推奨
- シークレット（`.env`）は必ず `.gitignore` に入れて管理してください。リポジトリには `*.sample` ファイルのみ置きます。
- 本番ではリバースプロキシ（nginx）で `/api` を Directus にプロキシする同一オリジン構成を推奨します。
- 画像やアセットはキャッシュ・サイズ削減（CDN や画像リサイズ）を検討してください。

## 主要ファイル
- フロントエントリ: [frontend/index.html](frontend/index.html)
- 静的単体版: [frontend/public/index.html](frontend/public/index.html)
- フロント環境サンプル: [frontend/.env.sample](frontend/.env.sample)
- Vite 設定: [frontend/vite.config.js](frontend/vite.config.js)
- Directus Compose: [directus/docker-compose.yml](directus/docker-compose.yml)
- プロジェクト構成: [docs/structure.md](docs/structure.md)

## 便利なコマンド

```bash
# Directus を起動
cd directus && docker compose up -d

# フロントの依存インストールと開発
cd frontend && npm install && npm run dev

# フロントのビルド
cd frontend && npm run build
```

---

README の内容を実運用や CI に合わせてさらに詳述できます。CI の追加や `docker-compose.prod.yml` / nginx テンプレートを作成しましょう。 
