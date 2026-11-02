# ブラウザ回帰テスト

Python 3 と Playwright 1.56、Chromium を使うスタンドアロンHTMLの回帰テストです。

```sh
python -m pip install playwright==1.56.0
python -m playwright install chromium
python tests/browser_regression.py --report /tmp/zzz-desktop.json
python tests/browser_regression.py --device android --report /tmp/zzz-android.json
python tests/browser_regression.py --device iphone --report /tmp/zzz-iphone.json
```

`CHROMIUM_PATH` でブラウザの実行ファイルを指定できます。`--engine firefox` / `--engine webkit` も指定可能ですが、それぞれのブラウザとOS依存ライブラリが必要です。
`--only agent_add_remove_history,export_names_and_controls` のように対象を絞れます。

各シナリオは独立したブラウザコンテキストとローカルHTTPサーバーで実行します。実サイトや利用者の保存データには触れません。
初回にhtml2canvas 1.4.1を公式CDNから取得し、SHA-256を確認します。本番旧版の固定コミットも移行確認用に取得し、SHA-256を確認します。Google Fonts公式リポジトリからZen Kaku Gothic Newの500/700/900を取得し、日本語の文字幅を検証します。いずれも一時フォルダへキャッシュします。

既存機能42シナリオと追加機能24シナリオ、計66シナリオを用意しています。

- 編成・重複制限・検索・凸設定・グループ増減・リセット・追加ユニット・削除・保存復元
- 62エージェント × 7段階の凸 × 5段階の音動機凸 × 3種類の保存表記（6,510通り）のコスト照合
- 全103画像・旧名と旧画像の移行・PNG生成とダウンロード
- キャラ／ボンプの追加・削除・移動、チーム交換、取消し・やり直し・履歴の分岐・上限
- 交換拒否とキャンセル、編集開始時の交換待機解除、キーボードショートカット
- タッチ移動とキャンセル、ダブルタップ、320～1440pxの表示、画面サイズ変更後の名前調整
- 保存画像の操作ボタン／ハイライト除去、長い名前の左右余白、最大9グループの出力
- 保存容量不足・2つの保存キーの一方だけが失敗する場合の取消しと復元

`--device iphone` / `--device android` はChromiumでの画面サイズ・User Agent・タッチ入力の再現です。iOS Safari／Android実機での動作を保証するものではありません。Firefox／WebKitでの実行可否と実機の検証状況は、検証報告に別記します。
