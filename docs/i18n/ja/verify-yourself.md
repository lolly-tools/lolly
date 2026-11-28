# 自分で検証する

このサイトの約束はすべて、アカウントなしで確認できます。ほとんどの確認に必要なのはブラウザだけで、残りにはターミナルとソースのコピーが必要です。以下の確認で示した結果が得られない場合、それはバグか、守られていない約束であり、私たちが知る必要があります。[確認に失敗した場合](#if-a-check-fails)をご覧ください。

これらの確認は、Lolly単体を対象とします。組織がLolly Workを運用している場合は、サインイン、共有コンテンツ、設定されたテレメトリー、監査記録が加わります。それらは[サーバーの公開機能](/info/server-surface.html)と[プライバシーポリシーの組織に関する節](/info/privacy.html#organisation-services-with-lolly-work)に照らして確認してください。

<!--i:eti-clock-->
## 10秒で動作を確かめる

[`/verify`](/#/verify)を開き、ページにファイルをドロップします。アップロードもアカウントも、サーバーの待ち時間もありません。ここでは、「AIに対する私たちの立場」にある[生成されたクイーンズランドの嵐](/info/ai-stance.html)を確認しています。Geminiが生成し、Lollyが開き、印を付けて変換した画像です。どのバッジも、ファイル自身のバイト列から、デバイス上で判定されています。

![スマートフォンの幅の画面に表示したLolly Verify。嵐の画像、緑のMade with Lolly判定、その下に並ぶクレデンシャルが完全でバイト列に変更がないことを示すバッジ](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

判定は、独立した事実をそれぞれ示す、いくつかのバッジで構成されます。

- <!--i:lock--> **Made with Lolly**: クレデンシャルが完全で、*かつ*Lollyによる書き出しを記録しています。
- <!--i:seal--> **The credential is intact**: 署名されたC2PAマニフェストを解析でき、そのクレーム自体の署名を検証できます。
- <!--i:hash--> **The bytes have not changed**: ファイルのハッシュが、署名されたものと今も一致しています。1ピクセルでも変更すると、このバッジは切り替わります。
- <!--i:sparkle--> **GEN AI**: このピクセルを機械が作ったことを、ファイルが明示しています。Lollyはその事実を隠さず、宣言を読み取って表示します。

履歴全体がファイルとともに移動します。ここには9つのステップが残っています。Googleが画像を生成して透かしを入れた際に記録した5つと、その後Lollyがこのページのコピーを開き、印を付けて変換した際に記録した4つです。Lolly Verifyは、それらをバイト列から直接読み取り、タイムラインとして描きます。

![Lolly Verifyが嵐の画像から読み取った変更履歴。Googleが記録した5つのステップ、続いてLollyによる4つのステップがあり、このページのWebPで終わる](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

以下の確認は、このデモを支える保証であり、どれも再現できます。[Content Credentials](/info/content-credentials-identity.html)で、それぞれの判定を説明しています。

<!--i:eti-globe-->
## ブラウザで確認する、追加ツールは不要

::: timeline
- <!--i:globe--> **1. ネットワークを確認します。** [lolly.tools](https://lolly.tools)を開き、ブラウザのDevTools(F12)を開いて**Network**に切り替え、ツールを使います。[Lolly QR Code](/t/qr-code)にWebアドレスを入力し、色を変え、PNGを書き出します。どのリクエストも`lolly.tools`に送られます。アプリのシェル、ツール自身のファイル、カタログのアセットです。分析用ホスト、CDNビーコン、フォントサービス、エラー報告エンドポイントはありません。レンダリングはローカルで行うため、ツールに入力した内容は**どのリクエストにも一切含まれません**。
- <!--i:eyeoff--> **2. 接続を切ります。** アプリを読み込み、ツールを1つか2つ開いてから、オフラインにし(機内モード、またはDevTools → Network → Offline)、再読み込みします。ギャラリーと開いたすべてのツールは、使用した形式でのレンダリングと書き出しを含め、引き続き動作します。ツールのファイルと形式のエンコーダーは、初めて使うときにキャッシュされるため、オフラインで試す前に、一度オンラインでツールを使ってください。これは、このページで最も強力な単独の確認です。外部へ通信することに依存するソフトウェアは、接続を切ると動作し続けられません。
- <!--i:check--> **3. Cookieを数えます。** DevTools → **Application**(Firefoxでは**Storage**) → Cookies → `https://lolly.tools`を開きます。一覧は空です。アプリはCookieを設定しません。コンソールに`document.cookie`を貼り付けると、`""`が返ります。任意のCA登録では、`/api/ca`をスコープとする短期間の`HttpOnly` Cookie、`lolly_ca_state`を設定しますが、これは`document.cookie`には表示されません。Lolly Workインスタンスは独自のサインイン用Cookieを使います。[プライバシー](/info/privacy.html#organisation-services-with-lolly-work)と照合してください。
- <!--i:layers--> **4. ご自身のストレージを確認します。** 同じパネルで、Lollyが保持するすべてを確認できます。20数個の通常の`localStorage`キー(テーマ、言語、サイドバーの幅、音と表示の設定、公開ツールカタログのインデックスのキャッシュコピー)と、IndexedDB内のご自身のドキュメントです。どの値も読める文字列かJSONで、難読化されていません。サイトデータを消去すると、これらのローカルレコードは削除されますが、SyncのバックアップやLolly Workインスタンスに保存されたレコードは削除されません。アプリ内の**Settings → Storage → Clear all my data**でも同じ操作ができ、ストアとキャッシュが空になる様子を確認できます。
- <!--i:lock--> **5. 脆弱性開示の連絡先が存在することを確認します。** [`/.well-known/security.txt`](/.well-known/security.txt)は、HTMLページではなく、[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)の連絡先ブロックを返します。
:::

::: details Networkタブに表示されることがあるその他の通信
使ったときだけネットワークに接続する機能もあり、それぞれ同じタブで確認できます。

- Lolly Design System Setupで**Google Font**を追加すると、初回の取得前に一度表示される、その旨を伝える同意ダイアログの後、選んだファミリーだけをGoogleから取得します。
- **ICC印刷プロファイルのプリセット**をクリックすると、ICCの公開レジストリであるcolor.orgから、そのプロファイルを取得します。
- 任意の内蔵**ラジオ**を再生すると、放送局からストリーミングします。
- **Meeting Planner**で場所を入力すると、座標とタイムゾーンを取得するため、都市ごとに一度、open-meteoのジオコーディングサービスでその場所を検索します(応答はデバイスに保存します)。入力する欄にも、その旨が表示されます。
- **Lolly URL Screenshot**は、入力したアドレスを読み込み、その様子を確認できます。

ネットワーク機能を宣言するツールが取得できるのは、マニフェストの許可リストにあるホストからだけで、その確認に失敗した場合は許可しません。現在提供されているツールには、その宣言を持つものがないため、ブラウザが強制するContent-Security-Policyによって、上記の通信先はそのホストに限定されます。[プライバシーポリシー](/info/privacy.html)には、ポリシーの更新や有効にした報告など、管理対象インスタンスの通信も含めた、すべての正式な一覧表があります。
:::

<!--i:eti-code-->
## ターミナルから確認する

**6. レンダリングエンドポイントは公開データだけを返します。** 入力内容をURLに含める唯一のサーバー機能である、ホットリンクによるレンダリングは、ここで稼働しています。リンクに入れる入力にとってそれが何を意味するかは、[プライバシーポリシー](/info/privacy.html)で説明しています。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

デプロイごとに選択します(`LOLLY_DISABLE_RENDER_GET=1`)。この変数を設定したインスタンスでは、同じ確認リクエストが`404`を返します。この違いは設定が機能している結果であり、不整合ではありません。

**7. デプロイで有効にしたサービスを確認します。** [サーバーの公開機能](/info/server-surface.html)には、任意のサービスの一覧と、詳細なリファレンスへのリンクがあります。Lolly Workでは、認証付きAPI、共同作業の接続、ストレージ、設定済みのプロバイダーも含めてください。公開のlolly.toolsへの確認リクエストでは、非公開の組織インスタンスをテストできません。

独自のインスタンスを運用している場合は、[配信環境のデプロイ](/info/deploy-delivery.html)にリリース時の確認事項があります。モデルの整合性、エッジの確認リクエストとそのサンプル一覧、表示用のレンディション、非公開のダウンロードゲートウェイ、ブラウザでの署名済みカタログです。


<!--i:eti-search-->
## ソースで確認する

デプロイされたコードが公開コードと異なれば、上記のすべてが見せかけという可能性も残ります。そこでコードを確認します。デプロイは[公開リポジトリ](https://github.com/lolly-tools/lolly)からビルドされます。

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. トラッカーも分析SDKも、どこにもありません。** 提供するコード(エンジン、ブラウザ拡張機能を含むすべてのシェル、Tauriブリッジのオーバーライドとサービスワーカー、サーバー関数、ツールパック)で、よく使われるものを検索します。

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

このスキャンは、第三者の追跡SDKを探します。ファーストパーティーの利用状況報告がないことを示すものではありません。Lolly Workは、組織のテレメトリーと、それとは別の監査ログに対応し、それぞれ専用のポリシーとテストを持ちます。

**9. 第三者のDNSリゾルバーはありません。** Lolly VerifyのSEAL確認は、DNS-over-HTTPSプロバイダー経由で問い合わせを送信しません。アプリにリゾルバーがないためです。

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 証明書サービスは発行ログを保持しません。** ID認証用のCAは、発行内容のログもIDの一覧も保持しません。標準出力への1行の記録も、Webhookも、証明書ストアもありません。その不在は検索で確認できます。

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CAは、短期間の作業状態は保持します。レート制限のバケットは、その時間枠の間、ハッシュ化したIPとメールのキーを保存し、管理対象デプロイの受付ストアは、鍵を使った識別子とリクエストのダイジェストを最大10分間保持します。詳細は[Content Credentialsのエンジニアリング](/info/content-credentials-engineering.html#protocol)をご覧ください。

<!--i:eti-flask-->
## テストによる強制

上記のソース確認は、一度限りの監査ではありません。テストスイートに固定されているため、気づかないうちに形骸化することはありません。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts)は、上記のスキャンより長いトラッカー名の一覧を確認し、次の場合はビルドを失敗させます。

- スキャン対象の提供ソースのどこかに、分析SDKまたは追跡SDKが現れた場合。アプリ、エンジン、サーバー、拡張機能、ツールパックのコード全体が対象です。
- そのソースに、第三者のDNS-over-HTTPSリゾルバーが現れた場合。
- ソース**または**生成されたサーバーバンドルに、CAの発行ログが復活した場合。
- プライバシーポリシーから、法的に必要な記述(管理者の名称、法的根拠、苦情を申し立てる権利)がなくなった場合。

クローンしたリポジトリでご自身で実行できます(Node 22.18以降。このファイルには`pnpm install`は不要です)。

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完全なスイート(`pnpm install && pnpm test`)では、[セキュリティと検証](/info/security.html)で説明する敵対的な暗号テストを含め、さらに数千件を実行します。

<!--i:eti-eye-off-->
## 外部からは検証できないこと

- **ホスティングのアクセスログ。** どのサーバーも、応答したリクエストのIPアドレス、パス、時刻を記録できます。外部からの確認リクエストでは、ログの保持期間は確定できません。運用者は、ログ記録、ローテーション、書き出しを管理し、その選択を開示する必要があります。ローカルレンダリングでは通常の編集はデバイス上にとどまります。任意のサーバーレンダリングと共有ワークスペースのサービスには、プライバシーポリシーに記載された別のデータフローがあります。
- **デプロイがこのコードを実行していること。** ソースに問題がないことと、デプロイされた動作がソースと一致することは確認でき、上記の確認はその両方を行います。Webプラットフォームには、Webデプロイのバイナリレベルのアテステーションはありません。リスクを抑える手段は、公開リポジトリ、強制されるテスト、オフラインでの確認です。改ざんされて外部へ通信するデプロイは、確認1と2の両方ですぐに失敗します。
- **ツールのフック。** 組み込みツールの任意のロジックは、サンドボックス化ではなくレビューの対象です。ツールがWorkerの使用を選ばない限り、ページ内で実行されます。lolly.toolsのすべてのツールはファーストパーティーで、提供前にレビューされます。[脅威モデル](/info/threat-model.html#trust-boundaries)では、フックの実行場所と、何がその動作を制限するかを説明しています。

<!--i:eti-warning-->
## 確認に失敗した場合

このページと実際に確認した内容の違いは、セキュリティ報告に当たります。[セキュリティと検証](/info/security.html#reporting-a-vulnerability)の非公開の窓口からお送りください。私たちは調整された脆弱性開示を行い、報告者の貢献を明記します。
