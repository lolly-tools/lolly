# Lollyと他の製品の比較

Lollyは、アカウントなしで、お使いのデバイス上でブランドに沿ったファイルを作ります。**Lolly Work**はチーム向けのサーバーです。組織が運用するマシンで、サインイン、共有プロジェクト、承認、サーバーレンダリングを提供します。どちらもMPL-2.0のオープンソースです。

ほとんどのチームは、今あるツールを使い続けます。デザインアプリがデザインを提供し、DAMが引き続き正式な記録元となり、Lollyが承認済みの入力を完成したファイルに変えます。[既存のDAMとLollyを併用する](/info/use-with-dam.html)で、その組み合わせを説明しています。その背景にある考え方が、[コンテンツの主権](/info/content-sovereignty.html)です。

<!--i:eti-gauge-->
## 現在のツール

各リングは、ある製品分類が1つのニーズをどれだけ満たすかを示します。行の横の**?**を押すと根拠を、凡例の横の**?**を押すとスコアの仕組みを確認できます。

::: figure positioning-comparison
機能の比較。競合調査は、2026年8月から11月21日までのベンダーのドキュメントに基づきます。LollyとLolly Workは2026年11月21日に確認しました。採点: 0は機能なし、25は回避策あり、50は実用的だが利用条件あり、または部分的、75は強力だが注意点あり、100は中核となる強みです。
:::

::: details 2026年11月に変更したスコアの出典
- Canva: [API変更履歴](https://www.canva.dev/docs/apps/rest-apis/changelog/)、[サービスアプリ](https://www.canva.dev/blog/developers/canva-service-accounts/)、[Brand Controlsのヘルプ](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign APIの変更履歴](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/)、[Adobe Expressの料金](https://www.adobe.com/express/pricing)
- Figma: [エージェントとAIクレジット](https://help.figma.com/hc/en-us/articles/42614902212887)、[MCPサーバー](https://developers.figma.com/docs/figma-mcp-server/)
- FrontifyとBynder: [Frontifyの2026年10月リリースノート](https://news.frontify.com/163371-what-s-new-in-october-2026)、[Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- BannerbearとPlacid: [Bannerbearの料金](https://www.bannerbear.com/pricing/)、[Bannerbearの変更履歴](https://www.bannerbear.com/changelog/)、[Placidの料金](https://placid.app/pricing)
- Penpot: [自己ホストの料金](https://penpot.app/pricing/self-host)、[リリース](https://github.com/penpot/penpot/releases)
- Cloudinary: [コンテンツの来歴](https://cloudinary.com/documentation/content_provenance_and_authenticity)、[料金](https://cloudinary.com/pricing)
:::

機能と実績は別々の行です。Lollyの最初の公開リリースは2026年8月30日の1.0.1で、セキュリティはまだ独立した監査を受けておらず、導入の実績も数か月分です。現在の状況は[導入とガバナンス](/info/adoption-governance.html#status)をご覧ください。

<!--i:eti-hammer-->
## Lollyを選ぶ場面

::: cols
## Lollyが向いている場面

- イベントのタイル、バッジ、証明書、アラート、ソーシャルカードなど、同じ種類のファイルが繰り返し必要な場合
- [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)やCLIで、1つのテンプレートと値の表から、多くのファイルを作る場合
- 自由なキャンバスでも、色、書体、アセットをデザインシステムの範囲内に保つ必要がある場合
- 完成したFigma、Penpot、Illustrator、InDesign、Affinity、PDFのデザインを、編集して繰り返し使えるようにしたい場合([デザインを読み込む](/info/design-import.html))
- ファイルを自分たちのデバイスやサーバーで作る必要がある場合

## 他の製品が向いている場面

- 細かな写真のレタッチやイラスト制作を行う場合
- アプリケーションのインターフェースをデザインし、プロトタイプを作る場合
- 初日から豊富なストック素材とテンプレートのライブラリが必要な場合
- 大規模な運用で長い実績を持つマネージドサービスが必要な場合
:::

読み込んだデザインと共有デザイントークンにより、チームはLollyと専門アプリを併用でき、Lolly Workは共有アセット、レビュー、配信を管理します。

整備されたDAMを持つチームは、そのライブラリと管理者を維持するところから始めてください。[SUSEのBrandfolder導入経験](/info/suse-brandfolder.html)には、連携が導入と承認プロセスの変更管理をどう支えたかを記録しています。DAMベンダーと導入パートナーは、[パートナー向けワークフロー](/info/dam-partners.html)で同じ構成を評価できます。

**Lolly Markdown Slides**では、デッキ全体をデータとして記述し、リアルタイムでレイアウトして、編集可能なネイティブのPowerPointファイルとして書き出します。

![分割ビューのLolly Markdown Slides。左にはデッキのスライドがブロックとして並び、右にはレイアウト済みのデッキがレンダリングされる](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## ルールはツールの中にあります

Lollyは、再利用できるブランドのルールをツールに組み込みます。色、フォント、塗り足し、間隔、許可する入力です。テンプレートは、受け取る人が変更してはいけない部分を固定します。Lolly Workは、そのテンプレートにグループのアクセス権と入力ポリシーを加え、カタログへの提出と配信に承認の流れを設けます。

各出力がツールのレイアウトルールを受け継ぐため、ツールを一度確認すれば、繰り返しの制作が容易になります。文面、アップロードした画像、利用権は、引き続き確認が必要な場合があり、Lolly Workはそのために共有カタログと承認ステップを提供します。クリエイティブチームにとって、ツールは逸脱を防ぐガードレールです。データ、文面、画像は引き続きご自身で用意し、ツールがすべての結果をブランドに沿ったものに保ちます。

![制作者の仕事は、言葉を入力するだけ。書体、色、間隔は、ツールを作ったときに決まっている](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

さらに3つの違いがあります。

- **入力から完成ファイルへ。** 入力すれば完成したファイルが出力されます。「次にデザインツールから保存して手直しする」必要はありません。
- **ツールがツールを組み合わせます。** あるツールが別のツールのレンダリングを1つの完成ファイルに埋め込め、両者のコードを結合する必要はありません。
- **オープンソース。** エンジンはオープンソースで、ツール、アセット、デザイントークンは、バージョン管理に置いたりLolly Workで管理したりできるファイルです。他者のデータベース内の行ではありません。

ガードレールがあっても、大胆なデザインは可能です。このポスター品質の都市地図では、道路や水路が真のベクターパスになっています。操作はドロップダウンと2つの色欄だけで、デザインシステムの外の色は指定できません。

![デザインシステム独自の色で、端から端まで描かれたアムステルダムの環状運河と道路網。どの線も手作業ではなくテンプレートが配置する](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## 確率的に革新し、決定論的に規模を広げる

「AIによるクリエイティブ制作」の売り文句の多くは、昔からある境界線の誤った側にモデルを置いています。その境界がどこにあるかは、写字生と装飾写本の画家たちが定めました。スケッチでは自由に取り組み、何でも試せて、何も確定しません。その後、確定するための印刷機に移ります。芸術が生まれるのはスケッチで、それを届けるのが印刷機でした。刷るたびに印刷機が約束を守るからこそ、印刷された作品は信頼できたのです。

Lollyは、その印刷機です。アイデアには、モデルでも、デザイナーでも、ラフ画でも、好きなものを使ってください。ただし、1つのアイデアを多くのファイルにする段階では、誰でも読み返せる入力から、毎回同じようにレンダリングする仕組みを通します。上の比較で本当に問うているのは、その確定のステップを繰り返し再現できるようにするのは誰か、ということです。

> 創造の過程を信頼し、厳密さを持って規模を広げます。

<!--i:eti-tag-->
## ずっと無料

**お使いのデバイス上でレンダリングするものは、ずっと無料です。** エンジン、シェル、ツール、形式はオープンソースで、公開したバージョンを取り上げることはできません。Lolly Workもオープンソースです。組織が支払うのは、自ら選んだインフラと運用の費用で、自己ホストにユーザー単位やレンダリング単位のソフトウェアライセンス料はかかりません。[質問と回答](/info/faq.html)で、この約束の背景を説明しています。

<!--i:eti-map-pin-->
## コンテンツの保管場所

Lollyでの制作作業は、ご自身が所有するハードウェアで実行でき、デザイントークン、フォント、ロゴ、ツールは、手元に保持できるファイルです。Lolly Workでは、共有プロジェクト、アセット、ポリシー、監査記録は、組織が設定するストレージに置かれます。[信頼](/info/trust.html)でその重要性を説明し、[プライバシーポリシー](/info/privacy.html)と[自分で検証する](/info/verify-yourself.html)で、私たちの言葉を信じるだけでなく、その主張を確認できます。

<!--i:eti-grid-->
## ツールごとの比較

[Lollyをツールごとに比較する](/info/compare.html)では、Canva、Adobe、Figma、Penpot、ブランドポータル、レンダリングAPI、オンライン変換ツールを、それぞれ1ページずつ使ってLollyと比較し、[何がどこで動くか](/info/compare.html#what-runs-where)を示しています。
