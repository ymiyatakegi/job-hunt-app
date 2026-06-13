脳内メモ

開き方:
  index.html をブラウザで開いてください。

ChatGPT API連携を使う場合:
  1. PowerShell またはコマンドプロンプトで APIキーを設定します。
       set OPENAI_API_KEY=your_api_key_here

  2. このフォルダで start-api.bat を実行します。

  3. ブラウザで http://localhost:8787 を開きます。

  APIキーは index.html には保存しません。
  server.js が OPENAI_API_KEY を使って OpenAI API に中継します。

保存:
  メモはこのブラウザの localStorage に自動保存されます。
  同じPC・同じブラウザで開くと続きから使えます。

できること:
  - タイトル、用途説明、文面の保存
  - 更新日時の自動更新
  - 文面の文字数と行数の表示
  - 文面だけをそのままコピー
  - メモ全体をコピー
  - ESエピソード、評価メモ、新規色分けの管理
  - 色分け、検索、更新日、更新回数で一覧整理
  - 入力情報から近いメモを探す簡易AIエージェント
  - server.js 起動時は、保存済みメモと入力内容をChatGPT APIへ送って整理
