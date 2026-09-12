# 自分で検証する

Lolly のプライバシーとセキュリティのページには主張があります。アナリティクスなし、トラッキングなし、ファイルはデバイスから出ない、システム全体で Cookie は1つだけ、といったものです。このページは違います。それらを信じてくれとは求めません。正確なコマンドまたはクリック手順と、実際に表示される出力を伴った手順の一覧です。ここにあるすべての主張は数分で反証可能で、そのほとんどは何もインストールせずに確認できます。

このページのいずれかのチェックで示された結果が得られない場合、それはバグか破られた約束のどちらかです。[報告してください](#if-a-check-fails)。いずれの場合も、破られた約束にふさわしい重大度で対応します。

## 10秒で動作を見る

手順の前に、結果を先にお見せします。[`/verify`](/#/verify) を開いてファイルをドロップしてください - アップロードなし、アカウント不要、サーバー待ちもありません。ここでは、AI に関する立場のページの[生成されたクイーンズランドの嵐の画像](/info/ai-stance.html)をチェックしています。Lolly が開き、リサイズし、エクスポートした Gemini 画像です。以下のバッジはすべて、ファイル自身のバイト列からデバイス上で計算されたものです。

![スマートフォン幅の画面での Verify - 嵐の画像、緑色の Made with Lolly の判定、その下に積み重なったクレデンシャル無傷およびバイト不変のバッジ](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

判定は1つのバッジではなく、独立した事実それぞれを示す小さなバッジの集まりです。

- <!--i:lock--> **Made with Lolly** - クレデンシャルが無傷で*かつ* Lolly によるエクスポートが記録されていることを示します。
- <!--i:seal--> **クレデンシャルは無傷です** - 署名された C2PA マニフェストが解析でき、その署名自体が検証できることを示します。
- <!--i:hash--> **バイト列は変更されていません** - ファイルのハッシュが署名時のものと一致していることを示します。1ピクセルでも変更するとこのバッジは反転します。
- <!--i:sparkle--> **GEN AI** - これらのピクセルは機械によって生成されたもので、ファイルにそう記載されていることを示します。Lolly はその主張を隠すのではなく、そのまま読み取って表示します。

そして履歴全体がファイルとともに移動します。ここには9つのステップが残っています - Google が画像を生成し電子透かしを入れる際に記録した5ステップと、その後 Lolly がこのページ上でコピーを開き、マークし、変換する際に記録した4ステップです - あなたのデバイス上でバイト列から直接読み出され、タイムラインとして表示されます。これは[AI に関する立場のページ](/info/ai-stance.html)の C2PA タイムラインと同じ画像を、同じ方法で検証したものです。

![Verify が嵐の画像から読み出す変更履歴 - Google による5ステップの後、Lolly による4ステップが続き、このページの WebP で終わる](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

とはいえ、それは信頼の主張そのものではありません - あくまでデモです。このページの残りが信頼の主張です。上記のバッジはすべて再現可能であり、その裏付けとなる保証をどう再現するかをここで示します。

## ブラウザだけで、ツール不要

**1. ネットワークを見る。** [lolly.tools](https://lolly.tools) を開き、ブラウザのDevTools（F12）を開いて **Network** タブに切り替え、ツールを使ってみてください - [QR Code](/t/qr-code) にURLを入力する、色を変える、PNGをエクスポートする、など。すべてのリクエストは `lolly.tools` に留まります。アプリシェル、ツール自体のファイル、カタログアセット。アナリティクスホストも、CDNビーコンも、フォントサービスも、「エラーレポート」用エンドポイントもありません。ツールに入力した内容は**どのリクエストにも一切現れません** - レンダリングはローカルで行われます。

正直な例外 - どれもオプトインで、ユーザーが起動し、発生した瞬間に同じNetworkタブで確認できます。ブランドエディタで**Googleフォント**を追加すると、そのファミリーだけをGoogleから取得します。最初のフェッチの前に一度だけ、その旨をはっきり伝える同意ダイアログを経てのことです。**ICC印刷プロファイルのプリセット**をクリックすると、そのプロファイルをICCの公開レジストリ（color.org）から取得します。オプションの内蔵**ラジオ**を再生すると局からストリーミングされます。**Meeting Planner** で場所を入力すると、座標とタイムゾーンを取得するためにopen-meteoのジオコーディングサービスに都市ごとに一度だけ問い合わせます（回答はお使いの端末に保存されます）。この開示はまさに入力欄のその場に表示されます。そして**URL Screenshot**は、入力したURLを読み込むのが仕事そのものであり、それはあなたの目の前で起こります。ネットワーク機能を宣言したツールは、そのマニフェストが許可リストに載せたホストにしかアクセスできず、その仕組みはフェイルクローズです。現在出荷されているツールでこれを宣言しているものはないため、上記のホスト一覧を実際に守っているのはブラウザが強制するContent-Security-Policyです。[プライバシーポリシー](/info/privacy.html)がこれらすべての正規の一覧表を保持しており、その原則は「その表にないネットワークアクセスは発生しない」というものです。

**2. コンセントを抜く。** アプリを読み込んでツールを1つか2つ開いた後、オフラインにしてください - 機内モードでも、DevTools → Network → Offlineでも構いません。リロードします。ギャラリーと、すでに開いたツールはすべて動き続けます。使用済みの形式でのレンダリングとエクスポートも含めてです - ツールのファイルと形式のエンコーダーは初回使用時にキャッシュされるため、オフラインでテストする前に一度オンラインでそのツールを試してください。これはこのページ中で最も強力な単独の検証です。ホームに電話をかけるソフトウェアは、コードを切られたら生き残れません。

**3. クッキーを数える。** DevTools → **Application**（Firefoxでは**Storage**） → Cookies → `https://lolly.tools`。一覧は空です - アプリはクッキーを一切設定しません。あるいはコンソールに `document.cookie` を貼り付けると、`""` が返ります。（システム全体で唯一存在するクッキーである `lolly_ca_state` は、オプションのアイデンティティサインイン中に最大10分間だけ存在し - サインイン完了の瞬間に削除され - `/api/ca` にスコープされ、`HttpOnly` です。詳細は[プライバシーポリシー](/info/privacy.html)に正確に記載されています。）

**4. 自分自身のストレージを読む。** 同じApplicationパネルで、Lollyが保持するものはすべて目の前で検査できます - 十数個ほどのプレーンな `localStorage` キー（テーマ、言語、サイドバー幅、サウンドと表示の設定、加えて公開ツールカタログのインデックスのキャッシュコピー）と、IndexedDBに保存されたあなた自身のドキュメントです。すべての値は読み取り可能な文字列またはJSONです - 難読化されているものは何もなく、読みにくくするためにエンコードされているものもありません。**Profile → Clear all my data** で消去できます。ブラウザ側でサイトデータを消去しても同じことです。サーバー側に残るコピーが存在しないためです。

**5. 開示連絡先が存在することを確認する。** [`/.well-known/security.txt`](/.well-known/security.txt) は、HTMLページではなく[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)の連絡先ブロックで応答します。

## ターミナルから

**6. レンダーエンドポイントは公開データのみで応答します。** ユーザーが入力した内容をURLに含める唯一のサーバー機能であるホットリンクレンダリングはここで稼働しており、リンクに入力した内容が何を意味するかは[プライバシーポリシー](/info/privacy.html)に記載されています。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

このスイッチはデプロイごとに設定されます(`LOLLY_DISABLE_RENDER_GET=1`): これを設定したインスタンスでは、同じプローブが`404`を返します - この違いはフラグが機能している証拠であり、不整合ではありません。

**7. サーバー表面は列挙可能です。** [Server Surface](/info/server-surface.html) には存在するすべてのサーバー側ルートが列挙されており、そのページにないエンドポイントはLollyの一部ではないという原則があります。`curl`で試してみてください。他には何も見つかりません。

## ソースコードの中で

デプロイされたコードが公開コードと異なっていれば、上記のすべてはやはり芝居になってしまいます。だからコードを確認してください - このデプロイは[公開リポジトリ](https://github.com/lolly-tools/lolly)からビルドされています。

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. トラッカーもアナリティクスSDKも、どこにもありません。** 出荷されるコード - エンジン、すべてのシェル（ブラウザ拡張、Tauriブリッジのオーバーライド、サービスワーカーを含む）、サーバー関数、ツールパック - を、お馴染みの容疑者たちについて検索してください。

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. サードパーティのDNSリゾルバーはありません。** VerifyのSEALチェックは、DNS-over-HTTPSプロバイダー経由で名前解決を行うことは決してありません - Webアプリにはそもそもリゾルバー自体が存在しません。

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 証明書サービスは何も保持しません。** アイデンティティCAには発行ログがありません - メールアドレスも、タイムスタンプも、Webhookもありません。この不在はgrepで確認できます。

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## テストによって強制されている、約束ではなく

上記の3つのソースチェックは一度きりの監査ではありません - テストスイートに固定されており、静かに劣化することはできません。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) は、以下のいずれかが起きるとビルドを失敗させます。

- スキャン対象の出荷ソース - アプリ、エンジン、サーバー、拡張、ツールパックのコードすべて - のどこかにアナリティクスやトラッキングのSDKが現れる
- そのソースにサードパーティのDNS-over-HTTPSリゾルバーが現れる
- CAの発行ログが復活する - ソース内、または生成されたサーバーバンドル内のどちらでも
- プライバシーポリシーが法的に必須の記載事項（管理者名、法的根拠、苦情申し立ての権利）を失う

クローン内で自分自身で実行してください(Node 22.18+、このファイルには`pnpm install`は不要です):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

フルスイート(`pnpm install && pnpm test`)は、[Security & Verification](/info/security.html)に記載されている敵対的暗号テストを含め、さらに数千件のテストを実行します。

## 外部から検証できないこと - 率直に言うと

このようなページは、自らの限界を名指しすることで信頼を得ます。

- **ホスティングのアクセスログ。** リクエストに応答するサーバーであれば、どれもリクエスト（IP、パス、タイムスタンプ）を記録できます。ホストが何を保持し何を保持しないかは検証できません。それは私たちにとっても、プロバイダーの公開されている挙動を超えて確認できるものではありません。だからこそアーキテクチャは、あなたのコンテンツを回線に一切乗せない設計になっています。端末から出ていかないものは、誰にも記録されようがありません。
- **デプロイがこのコードを実行していること。** ソースがクリーンであること、そしてデプロイされた挙動がそれと一致していることは検証できます（上記のチェックは両端をカバーしています）が、Webデプロイのバイナリレベルの証明は、Webプラットフォームが提供する仕組みではありません。緩和策は、公開リポジトリ、強制されたテスト、そしてオフラインチェックです - 外部と通信するよう改ざんされたデプロイは、チェック1と2で即座に失敗します。
- **ツールフックはデフォルトではサンドボックス化されていません。** ツールのオプションのロジックはレビュー済みで、そのページ自身のレルム内で実行されます。lolly.tools上のすべてのツールはファーストパーティであり、出荷前にレビューされています。Worker分離は現在、ツールごとのオプトインとして提供されています - マニフェストで`isolate: true`を設定したツールは、そのフックをオフスレッドで実行します - そのため外部から検証できない範囲は狭まりつつありますが、デフォルトの経路は依然として同一レルム内であり、レビューが依然として管理手段です。これは隠されているのではなく明言されています - 常にそう述べてきた[design boundaries](/info/security.html)のセクションを参照してください。

## チェックが失敗した場合

このページと観測された挙動との間に食い違いがあれば、それはセキュリティ報告です。私たちは正直、それを聞かないよりは聞きたいと思っています。[fitzy+security@suse.com](mailto:fitzy+security@suse.com)、いずれかの[lolly-toolsリポジトリ](https://github.com/lolly-tools)の**Report a vulnerability**ボタン、または[`/.well-known/security.txt`](/.well-known/security.txt)内の連絡先まで。協調的開示と報告者へのクレジットが標準方針です - 詳細は[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md)にあります。
