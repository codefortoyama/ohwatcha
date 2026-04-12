# プロジェクト構成

- `frontend/`: Vite ベースのフロントエンド
  - `index.html`: 開発とビルドのエントリポイント
  - `public/`: アイコンや Leaflet などの静的ファイル
  - `public/index.html`: Vite を使わず静的配信したい場合の単体版
  - `.env.sample`: フロントエンド用の環境変数サンプル
  - `vite.config.js`: 開発時の `/api` プロキシ設定

- `directus/`: Directus と Postgres のローカル実行定義
  - `docker-compose.yml`: Directus + Postgres の compose 定義
  - `.env.sample`: Directus 用の環境変数サンプル
  - `uploads/`: Directus のアップロード保存先
  - `extensions/`: Directus 拡張の配置先

- `infra/`: 本番向けインフラテンプレート置き場
- `scripts/`: 運用補助スクリプト
- `docs/`: 設計や運用メモ

使い方（簡易）:
1. `frontend/.env.sample` を `frontend/.env` にコピーして必要なら値を変更します。
2. `directus/.env.sample` を `directus/.env` にコピーしてシークレットを設定します。
3. フロントエンドは `cd frontend && npm install && npm run dev` で起動できます。
4. Directus は `cd directus && docker compose up -d` で起動できます。
