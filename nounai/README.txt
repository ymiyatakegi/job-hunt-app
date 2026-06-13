脳内メモ

開き方:
  index.html をブラウザで開いてください。

API処理を使う場合:
  1. PowerShell またはコマンドプロンプトでAPIキーを設定します。
       set OPENAI_API_KEY=your_api_key_here

  2. このフォルダで start-api.bat を実行します。

  3. ブラウザで http://localhost:8787 を開きます。

  4. 右上の「API処理」を押すと、このブラウザに保存されているメモ内容をChatGPT APIへ送って処理します。

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
  - API処理ボタンでサイト内メモをChatGPT APIへ送信

注意:
  GitHub上のページをChatGPTに見せる場合、ChatGPTが確認できるのは公開されているHTML/JS/CSSです。
  ブラウザの localStorage に保存された個別メモは、URLからは見えません。
  保存済みメモの中身をChatGPT APIに渡すには、http://localhost:8787 から開いて「API処理」を押してください。
