# 自分で検証する

このサイトのすべての約束は、アカウントなしで確認できます。ほとんどの確認はブラウザだけで行え、それ以外はターミナルとソースのコピーが必要です。以下の確認で示された結果にならない場合、それはバグか破られた約束であり、私たちはその連絡を求めています。[確認に失敗した場合](#if-a-check-fails)をご覧ください。

最も手早いものから始めてください。ファイルをVerifyにドロップします。そこからさらに進み、ツールを使いながらネットワークを監視し、接続を切って作業を続け、Cookieを数え、ソースを読んでください。

これらの確認は、Lolly単体を対象にしています。組織がLolly Workを運用している場合、サインイン、共有コンテンツ、設定されたテレメトリ、監査記録が加わります。それらは[サーバーサーフェス](/info/server-surface.html)と[プライバシーポリシーの組織の節](/info/privacy.html#organisation-services-with-lolly-work)に照らして確認してください。

## 10秒で動作を見る

[`/verify`](/#/verify)を開いて、ページにファイルをドロップします。アップロードも、アカウントも、サーバーを待つこともありません。ここでは、Our AI Stanceの[生成されたクイーンズランドの嵐](/info/ai-stance.html)を確認しています。Geminiが生成し、Lollyが開き、印を付けて変換した画像です。すべてのバッジは、ファイル自身のバイト列から、デバイス上で算出されました。

![スマートフォン幅の画面での Verify - 嵐の画像、緑色の Made with Lolly の判定、その下に積み重なったクレデンシャル無傷およびバイト不変のバッジ](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

判定は、独立した事実を示す小さなバッジの集まりです。

- <!--i:lock--> **Made with Lolly**: クレデンシャルが無傷で、*かつ*Lollyでの書き出しが記録されている。
- <!--i:seal--> **The credential is intact**: 署名付きのC2PAマニフェストが解析でき、その主張の署名が検証できる。
- <!--i:hash--> **The bytes have not changed**: ファイルのハッシュが、署名されたものとまだ一致している。1ピクセルでも変えると、このバッジが反転する。
- <!--i:sparkle--> **GEN AI**: 機械がこれらのピクセルを作り、ファイルがそう述べている。Lollyはその宣言を隠さず、読み戻します。

履歴の全体は、ファイルとともに運ばれます。ここでは9つのステップが残っています。Googleが画像を生成して透かしを入れたときに記録した5つと、Lollyがこのページのコピーを開き、印を付け、変換したときに記録した4つです。Verifyはそれらをバイト列から直接読み取り、タイムラインとして描きます。

![Verify が嵐の画像から読み出す変更履歴 - Google による5ステップの後、Lolly による4ステップが続き、このページの WebP で終わる](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

これがデモです。以下の確認は、その土台にある保証であり、いずれも再現できます。すべての判定は[Content Credentials](/info/content-credentials-identity.html)で説明しています。

## ブラウザだけで、ツール不要

::: timeline
- <!--i:globe--> **1. ネットワークを監視する。** [lolly.tools](https://lolly.tools)を開き、ブラウザのDevTools(F12)を開いて**Network**に切り替え、ツールを使います。[QR Code](/t/qr-code)にWebアドレスを入力し、色を変え、PNGを書き出します。すべてのリクエストは`lolly.tools`にとどまります。アプリシェル、ツール自身のファイル、カタログのアセットです。分析ホスト、CDNのビーコン、フォントサービス、エラー報告のエンドポイントはありません。ツールに入力したものは、レンダリングがローカルなので、**どのリクエストにも**現れません。
- <!--i:eyeoff--> **2. 接続を切る。** アプリを読み込み、ツールを1つか2つ開いてから、オフラインにして(機内モード、またはDevTools → Network → Offline)再読み込みします。ギャラリーと開いたすべてのツールが、使った形式でのレンダリングや書き出しを含め、動作し続けます。ツールのファイルと形式のエンコーダーは、初めて使ったときにキャッシュされるため、オフラインで試す前に、一度オンラインでツールを使ってください。これはこのページで最も強力な単独の確認です。外部に通信するソフトウェアは、接続を切られると生き残れません。
- <!--i:check--> **3. Cookieを数える。** DevTools → **Application**(Firefoxでは**Storage**)→ Cookies → `https://lolly.tools`。リストは空です。アプリはCookieを設定しません。コンソールに`document.cookie`を貼り付けると、`""`が返ります。任意のCA登録は、`/api/ca`に限定された有効期間の短い`HttpOnly`のCookie、`lolly_ca_state`を設定しますが、`document.cookie`には表示されません。Lolly Workインスタンスは独自のサインイン用Cookieを使います。[プライバシー](/info/privacy.html#organisation-services-with-lolly-work)と照らして確認してください。
- <!--i:layers--> **4. ご自身のストレージを読む。** 同じパネルで、Lollyが保持するすべてが目の前に表示されます。数十個の通常の`localStorage`キー(テーマ、言語、サイドバーの幅、サウンドとビューの設定、公開ツールカタログのインデックスのキャッシュ)と、IndexedDB内のご自身のドキュメントです。すべての値は読める文字列またはJSONで、難読化されたものはありません。サイトデータを消去するとこれらのローカルの記録は削除されますが、同期のバックアップや、Lolly Workインスタンスが保持する記録は削除されません。**Settings → Storage → Clear all my data**はアプリ内から同じことを行い、ストアとキャッシュが空になるのを確認できます。
- <!--i:lock--> **5. 連絡先の開示が存在することを確認する。** [`/.well-known/security.txt`](/.well-known/security.txt)は、HTMLページではなく、[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)の連絡先ブロックで応答します。
:::

::: details Networkタブで他に目にするかもしれないもの
一部の機能は、使ったときにだけネットワークに接続し、それぞれが同じタブで確認できます。

- Design System Setupで**Googleフォント**を追加すると、その1つのファミリーがGoogleから取得されます。そのことを説明する同意ダイアログが、最初の取得の前に一度表示されます。
- **ICCプレスプロファイルのプリセット**をクリックすると、そのプロファイルがcolor.orgにあるICCの公開レジストリから取得されます。
- 任意の組み込み**ラジオ**を再生すると、放送局からストリーミングされます。
- **Meeting Planner**で場所を入力すると、その場所の座標とタイムゾーンを求めて、open-meteoのジオコーディングサービスで検索されます。都市ごとに一度で(回答はお使いのデバイスに保存されます)、入力欄にその旨が書かれています。
- **URL Screenshot**は、入力したアドレスを読み込みます。それが仕事であり、その動作を目で確認できます。

ネットワークのケイパビリティを宣言するツールは、そのマニフェストが許可リストに載せたホストからのみ取得でき、その検査は安全側で失敗します。現在出荷されているツールで宣言しているものはないため、上記の一覧を各ホストに限定しているのは、ブラウザが強制するContent-Security-Policyです。[プライバシーポリシー](/info/privacy.html)には、ポリシーの更新や有効なレポートなど、管理対象インスタンスの通信を含め、これらすべての正式な表があります。
:::

## ターミナルから

**6. レンダリングのエンドポイントは、公開データのみで応答します。** 入力されたものをURLに入れるサーバー機能は1つだけで、ホットリンクのレンダリングがここで有効です。リンクに入れる入力に何が起こるかは、[プライバシーポリシー](/info/privacy.html)で説明しています。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

各配備が選択します(`LOLLY_DISABLE_RENDER_GET=1`)。それを設定しているインスタンスでは、同じプローブが`404`を返します。その違いは設定が機能している結果であり、不整合ではありません。

**7. 配備が有効にしているサービスを確認する。** [サーバーサーフェス](/info/server-surface.html)には、任意のサービスと、その詳しい参照へのリンクが一覧になっています。Lolly Workの場合は、認証付きAPI、コラボレーション接続、ストレージ、設定されたプロバイダーも含めてください。公開のlolly.toolsを調べても、組織の非公開インスタンスの検査にはなりません。

ご自身でインスタンスを運用している場合は、そのためのリリースチェックが[配信のデプロイ](/info/deploy-delivery.html)にあります。モデルの整合性、エッジのプローブとそのサンプル一覧、表示用レンディション、非公開のダウンロードゲートウェイ、ブラウザでの署名付きカタログです。


## ソースコードの中で

上記のすべては、配備されたコードが公開コードと違っていれば、見せかけにすぎなくなります。そこで、コードを確認してください。配備は[公開リポジトリ](https://github.com/lolly-tools/lolly)からビルドされます。

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. トラッカーも分析SDKも、どこにもありません。** 出荷されるコード(エンジン、ブラウザ拡張機能を含むすべてのシェル、Tauriブリッジのオーバーライド、サービスワーカー、サーバー関数、ツールパック)を、よくある犯人で検索します。

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

このスキャンが探すのは、サードパーティの追跡SDKです。自社による利用状況の報告がないことは示しません。Lolly Workは、組織のテレメトリと別の監査ログに対応しており、それぞれ独自のポリシーとテストがあります。

**9. サードパーティのDNSリゾルバーはありません。** VerifyのSEAL検査は、アプリにリゾルバーがないため、DNS-over-HTTPSプロバイダー経由でルックアップを送ることがありません。

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 証明書サービスは、発行ログを保持しません。** IDのCAは、何を発行したかのログも、IDの台帳も保持しません。標準出力の行も、ウェブフックも、証明書ストアもありません。その不在は、検索して確認できます。

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CAは、有効期間の短い作業状態は保持します。レート制限のバケットは、その期間だけハッシュ化されたIPとメールのキーを保持し、管理対象配備の受付ストアは、鍵付き識別子とリクエストのダイジェストを最長10分間保持します。詳細は[Content Credentialsのエンジニアリング](/info/content-credentials-engineering.html#protocol)にあります。

## テストによる強制

上記のソースの確認は、一度きりの監査ではありません。テストスイートに固定されているため、静かに腐ることはありません。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts)は、上記のスキャンより長いトラッカー名の一覧を検査し、次の場合にビルドを失敗させます。

- 走査する出荷ソース(アプリ、エンジン、サーバー、拡張機能、ツールパックのコード)のどこかに、分析または追跡SDKが現れた場合
- そのソースに、サードパーティのDNS-over-HTTPSリゾルバーが現れた場合
- CAの発行ログが、ソースまたは生成されたサーバーバンドルに戻ってきた場合
- プライバシーポリシーから、法的に求められる記述(管理者の明記、法的根拠、苦情を申し立てる権利)が失われた場合

クローン内でご自身で実行してください(Node 22.18以降。このファイルに`pnpm install`は不要です)。

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

フルスイート(`pnpm install && pnpm test`)は、[Security & Verification](/info/security.html)に記載されている敵対的暗号テストを含め、さらに数千件のテストを実行します。

## 外部からは確認できないこと

- **ホスティングのアクセスログ。** リクエストに応答するサーバーは、IPアドレス、パス、時刻を記録できます。外部からのプローブでは、ログがどのくらいの期間保持されるかは確認できません。ログの記録、ローテーション、エクスポートは運用者が管理し、その選択を開示しなければなりません。ローカルでのレンダリングは通常の編集をお使いのデバイスにとどめ、任意のサーバーレンダリングと共有ワークスペースのサービスには、プライバシーポリシーが説明する別のデータの流れがあります。
- **その配備がこのコードを実行していること。** ソースがクリーンであることと、配備された動作がそれと一致することは確認でき、上記の確認はその両方を行います。Web配備のバイナリレベルの証明は、Webプラットフォームが提供するものではありません。緩和策は、公開リポジトリ、強制されるテスト、オフラインでの確認です。外部に通信する改ざんされた配備は、確認1と2の両方でただちに失敗します。
- **ツールのフック。** 組み込みツールの任意のロジックは、サンドボックス化ではなくレビューされています。ツールがWorkerにオプトインしないかぎり、ページ内で実行されます。lolly.tools上のすべてのツールは自社製で、出荷前にレビューされています。フックがどこで実行され、何が制限するかは、[脅威モデル](/info/threat-model.html#trust-boundaries)に示されています。

## チェックが失敗した場合

このページと、実際に観察されるものとの違いは、セキュリティ報告にあたります。[セキュリティと検証](/info/security.html#reporting-a-vulnerability)にある非公開の窓口から送ってください。私たちは協調的な開示を実践し、報告者に謝意を表します。
