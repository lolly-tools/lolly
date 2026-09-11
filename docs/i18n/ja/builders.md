# ビルダー向け Lolly

技術ドキュメントです。ツールを作成する人、Lolly をパイプラインに統合する人、自前でホスティングする人、プラットフォームを拡張する人のためのものです。

**あなたにとって何が得られるか。** ツールを一度作れば、その依頼が二度と自分のところに戻ってこなくなります。午後の時間を食いつぶす「ちょっとこれ作ってくれない?」という繰り返しの依頼は、他の人が自分自身で正しく入力できるテンプレートになり、あなたが介在する必要はなくなります。あなたの作業成果は素の HTML/CSS/JS であり、バージョン管理されていて、差分が見えて、レビューでき、ベンダーロックインのないオープンなエンジン上で動くため、それはずっとあなたのものであり続けます。生産作業を自動化すれば、あなたの時間は一万件目の書き出し作業ではなく、面白い問題に向けられるようになります。

Lolly はプラットフォームに依存しない**エンジン**であり、複数の**シェル**(web PWA、Tauri デスクトップ/モバイル、CLI、TUI)にわたって同じレンダリングパスを実行します。ツールは**データであり、同梱されたコードではありません**――マニフェストとテンプレート、そして任意のフックで構成されているため、新しいツールはアプリの更新なしに配信できます。まずはアーキテクチャについて [Overview](/info/overview.html) から始め、その後は自分が作ろうとしているものに合ったトラックに進んでください。

このプラットフォームは初めてですか? **[Quickstart](/info/quickstart.html)** で、深く踏み込む前にブランドと最初のレンダリングを用意できます。

## アーキテクチャを理解する



- **[Overview](/info/overview.html)** - Lolly が存在する理由、エンジン/シェル/ツールの分離、ケイパビリティブリッジ、そして確定したアーキテクチャ上の方針について。
- **[Design Tokens](/info/design-tokens.html)** - ブランドが表現される DTCG トークンモデルと、ツールがそれをどのように利用するかについて。

## ツールを作成する

以下のコントロールはすべて、`tool.json` で宣言された入力から生成されたものです。マニフェストに1行書けば、ホストがウィジェットを描画し、同じモデルが CLI と URL も動かします。

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

これは5つのコントロールで終わる話ではありません。入力に `section` を指定するとホストがそれを折りたたむため、D3 Chart Studio のように入力が50個あるツールでも、開いた時点では短いコントロールの積み重ねにとどまり、残りは名前付きのグループの奥に収められます。

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Authoring Tools](/info/authoring-tools.html)** - マニフェスト、テンプレート、スタイル、フック、コンポジション、公開までを網羅した完全ガイド。
- **[Authoring Assets](/info/authoring-assets.html)** - カタログアセット、ティア、ロケール、パレット、テーマ対応アイコン、フォントについて。
- **[Host API](/info/host-api.html)** - すべてのツールが実装対象とする `HostV1` ケイパビリティブリッジ(ツールから見える唯一の API)について。
- **[URL Mode](/info/url-mode.html)** - あらゆる入力を URL パラメータとして表現する方法。予約パラメータ、コンパクトエンコーディング、パックドリンクについて。

## 実行と統合

- **[CLI](/info/cli.html)** - ヘッドレスレンダリング。GUI と同じレンダリングパスを、`--foo=bar` という argv で駆動します。
- **[TUI](/info/tui.html)** - 対話型のターミナルシェル。
- **[MCP Server](/info/mcp.html)** - AI エージェントがツールを発見し実行できるようにするネイティブエンドポイント。
- **[AI Agents](/info/ai-agents.html)** - モデルから Lolly を操作する方法:URL がそのまま API になります。
- **[Chrome Extension](/info/extension.html)** - ライブ URL を再利用可能なアセットとしてキャプチャします。

## 出荷と運用

- **[Build Guide](/info/build-guide.html)** - CLI、TUI、デスクトップ、モバイルなど、あらゆるターゲットのビルド方法。
- **[Deployment](/info/deployment.html)** - web アプリ、各アプリ、バックエンドサービスについて。それぞれがどこで動作するか。
- **[Configuration](/info/configuration.html)** - プロファイル、ブランドパック、ケイパビリティゲーティング、フィーチャーフラグ、カタログ検証について。

## 信頼とデータ

権利と著作者表示も、他の入力と何ら変わりません。Embed & Track Image は作成者、著作権、ライセンス、連絡先の各フィールドを宣言し、書き出しの際にそれらをファイル自身のメタデータと C2PA マニフェストへ書き込みます。

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - オンデバイスの C2PA 向けに CA が発行する署名について。エンジンの契約とオペレーター向けランブック。
- **[Data Transfer](/info/data-transfer.html)** - `lolly-backup` バンドルについて:エンベロープ、整合性、シェル間での保証。
- **[About](/info/about.html)** - プロジェクト、そのライセンス境界、リポジトリについて。
