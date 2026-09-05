# 点描トレーサー (Stipple Tracer)

画像を1枚渡すと、その形をなぞる「光の点描画」としてSVGを生成するツールです。
消しゴム・追加ペン・星座線での手直しにも対応しています。外部ライブラリへの依存はなく、
`index.html` 1枚だけで完結する静的サイトです。

## ローカルで確認する

ビルド不要です。`index.html` をブラウザで直接開くだけで動きます。

```bash
open index.html   # macOS
# または index.html をダブルクリック
```

## Vercelに公開する(GitHubなし・一番早い方法)

1. https://vercel.com にログイン(GitHubアカウントでのログインも可)
2. ダッシュボードの「Add New...」→「Project」
3. 「Deploy without Git」のような案内が出るので、この `stipple-tracer-repo` フォルダごと
   画面にドラッグ&ドロップ
4. そのままデプロイすれば、数十秒で公開URLが発行されます

## GitHub経由でVercelに公開する(あとで更新しやすい方法)

1. https://github.com で新しいリポジトリを作成(例: `stipple-tracer`)
2. リポジトリ画面の「Add file」→「Upload files」で、この中の
   `index.html` と `README.md` をドラッグ&ドロップしてコミット
   (ターミナルの `git` コマンドを使わなくても、ブラウザだけで完了します)
3. https://vercel.com の「Add New...」→「Project」→「Import Git Repository」で
   今作ったリポジトリを選択
4. Framework Preset は "Other"(静的サイト)のままでOK。ビルドコマンドやOutput
   Directoryも空欄で問題ありません
5. 「Deploy」を押せば公開されます。以後はGitHubリポジトリを更新するたびに
   Vercelが自動で再デプロイします

## 保存ボタンについて

「SVGを保存」ボタンは、Claudeのアーティファクトとして開いている場合はその場で保存確認が出ますが、
Vercel等の通常のWebサイトとして公開した場合は、ブラウザの通常のダウンロードとして
`stipple.svg` が保存されます(どちらの環境でも動くように作ってあります)。

## ファイル構成

```
index.html   全部入り(HTML/CSS/JS)。外部ファイルへの依存はGoogle Fontsのみ
README.md    このファイル
```
