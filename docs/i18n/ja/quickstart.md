# 始める

ツールにご自身の色とフォントを設定し、すでにある作品を再利用します。アカウントは不要で、制作と書き出しはお使いのデバイス上で行われます。

::: steps
- <!--i:eti-sparkles--> **[ファイルを1つ作る](/info/make-something.html)** すべての手順を見ながら、数分でQRコードを作れます。
- <!--i:eti-palette--> **[ブランドを取り入れる](#put-your-brand-in)** 1つの色、トークンファイル、完成したデザインから始めます。
- <!--i:eti-folder-move--> **[作品を取り込む](#bring-in-what-you-already-have)** すでにあるデザイン、デッキ、データを、デバイス上で読み込みます。
- <!--i:eti-repeat--> **[同じものを増やす](#make-many-share-and-automate)** リンクを共有したり、スプレッドシートに入力したり、スクリプトからツールを実行したりします。
:::

[Lollyとは？](/info/what-is-lolly.html)は、5分で読める紹介です。[Lollyの仕組み](/info/how-lolly-works.html)では、誰が何をするかを説明します。

<!--i:eti-palette-->
## ブランドを取り入れる

lolly.toolsは、Lolly自身のサンプルデザインシステムである**Lolly Demo**で開きます([Lolly Demoの紹介](/info/lolly-demo.html))。ご自身のデザインシステムがLolly Demoに置き換わります。デザインシステムは、すべてのツールが描画に使う小さなデザイントークンのセット(色、フォント、いくつかのルール)です。一度設定すれば、作るものはすべて最初からブランドに沿ったものになります。

お持ちのものに合う方法を選んでください。

- <!--i:palette--> **1つの色。** **Design System Setup**画面(`#/start`)を開き、デザインシステムに名前を付け、主となる色を選びます。Lollyはその色から、ライトとダークの背景、テキスト、アクセントを含む、アクセシビリティに配慮したパレットを作ります。フォントを選べば、使えるブランドができます。
- <!--i:upload--> **トークンファイル。** Lolly Design System Setupの上部にある**Add from…**は、DTCG、Tokens Studio、Penpotのトークンファイル、SVG、`LollyBrand`パックを読み込みます。ファイルからパレットが埋まります。デザインシステムが空の間は、Boardの**Start from a reference**でも同じピッカーが開きます。
- <!--i:pentool--> **完成したデザイン。** Lolly Designで**Import a design**を選び、Figma、Penpot、Illustrator、InDesign、Affinity、Photoshop、PowerPoint、SVGのファイルをドロップします([すべての形式](/info/design-import.html#what-comes-in-from-each-app))。下の[すでにあるものを取り込む](#bring-in-what-you-already-have)をご覧ください。

初めてギャラリーを開くと、上部の挨拶が次の手順を1つ提示します。lolly.toolsでは、**Start making**がLolly DesignでLaunchポスターを開きます。新規インストールでは、**Make it yours**がLolly Design System Setupを開きます。そのボタンの下にある**Bring a file**は、デザイン用のファイルピッカーを開き、先の2つの選択肢のもう一方がリンクとして表示されます。これらのいずれか、または閉じるボタンを使うと、挨拶は以後表示されなくなります。

![新しいデザインシステムでのLolly Design System SetupのColoursルーム: 1つのライブチップ、1つの入力欄、最初に決めることのすべて](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

8つのルームを好きな順序で使って、デザインシステムをさらに整えられます。**Board**、**Colours**、**Type**、**Logos**、**Tokens**、**Files**、**Rules**、**Skills**です。入力すると、アプリ内のすべてのプレビューが更新されます。[Lolly Design System Setup](/info/brand-studio.html)で各ルームを説明しています。

フォントはお使いのデバイス上に保持されます。選んだGoogle Fontはブランドアセットとして保存されるため、書体はオフラインでも使え、ツールの描画時に何かを取得することはありません。

### デザインシステムの表示、切り替え、共有

- **使用中のものを確認する。** **Settings → Design system**は、使用中のデザインシステムを、表紙とページの形で読み取り専用で表示します。
- **切り替える。** **Settings → Preferences → Design systems**には、このデバイス上のすべてのデザインシステムが並びます。1つの組織が複数のデザインシステムを使うことも、複数のカラーウェイを持つ1つのデザインシステムを使うこともできます。[ブランドの構成](/info/brand-architectures.html)で、その構成を示しています。
- **共有する。** デザインシステムを`LollyBrand`パックとして書き出します。同僚がその1つのファイルをインポートすれば、同じパレット、フォント、ルールを使えます。

ビルドや組織から提供されるデザインシステムは**管理対象**です。鍵のマークが付き、読み取り専用になります。変更するには、**Settings → Preferences → Design systems**で編集可能なコピーを作ります。

![SettingsのDesign systemタブ: 使用中のデザインシステムを表紙とページで表示](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

デザインシステムはDTCGトークンで構成されます。Penpotが読み書きし、Tokens StudioがFigmaに取り込む形式です。デザインに使うパレットとLollyが適用するパレットは、同じ1つのドキュメントです。詳しくは[デザイントークン](/info/design-tokens.html)をご覧ください。

::: details 開発者向け: コマンドラインでブランドパックを作る
`ingest:brand`は、チェックアウトしたコード内に再利用可能なブランドパックを作ります。PenpotとTokens Studioが書き出す3種類のコンテナーに対応しています。単一の`tokens.json`、セットごとのファイルと`$metadata.json`を含むディレクトリ、または`project.penpot`アーカイブです。

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate`は、ブランドをプロファイルとして登録し、そのカタログをビルドして検証します。既定のプロファイルは変更しません。新しいパックを使うには、`LOLLY_PROFILE=acme`を指定して実行します。ブランドパックとプロファイルの関係は、[設定](/info/configuration.html)で説明しています。
:::

<!--i:eti-folder-move-->
## すでにあるものを取り込む

**Lolly Designのファイル。** Figma、Penpot、Illustrator、InDesign、またはSVGを扱うアプリで作った作品を、編集可能なレイアウトとしてLolly Designで開けます。テキストは書き換えられるまま、図形は図形のまま残り、画像はライブラリに入ります。ファイルはブラウザ内で読み込まれ、何もアップロードされません。[デザインをインポートする](/info/design-import.html)に、各形式と保持される内容をまとめています。

**デッキ。** PowerPointの`.pptx`をLollyにドロップすると、スライドがアセットとして保存されます。**Lolly Markdown Slides**では、Markdownから新しいデッキを作れます。[デッキのブランドを変更する](/info/rebrand.html)では、デッキに自分のデザインシステムを適用します。

**データ。** CSVまたはJSONの表を貼り付けるかドロップすると、ツールの繰り返しフィールドに入力されます。[Lolly Batch](/info/batch.html#make-many-versions-of-one-design)は、行ごとに完成したファイルを1つ作ります。

### 一度限りの作品からテンプレートへ

インポートしたレイアウトは、通常のLolly Designセッションです。**Share with rules**で、そのセッションをツールに変えられます。他の人が変更できる部分を選ぶと、使う人はその部分だけに入力します。

![Lolly Designのマスターを残し、制作用のコピーで入力項目と制限を選び、受け取った人が入力できる再利用可能な.lollyツールとして共有する](/info/diagrams/concepts/share-with-rules.svg)

[ルール付きでデザインを共有する](/info/create-a-tool.html)で、手順を1つずつ説明しています。

<!--i:eti-repeat-->
## まとめて作り、共有し、自動化する

- <!--i:download--> **書き出す。** ツールはSVG、PDF、PNG、JPG、WebP、動画などを作成し、必要に応じて実際の印刷サイズで出力します。使える形式はツールごとに異なります。[ファイルを書き出す](/info/exporting.html)をご覧ください。
- <!--i:link--> **リンクを共有する。** ツールの設定はリンクに含まれるため、どこでも同じファイルを開き直せます。
- <!--i:layers--> **1行につき1つ作る。** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)で、スプレッドシートからツールを動かします。
- <!--i:cpu--> **自動化する。** [CLI](/info/cli.html)や[AIエージェント](/info/ai-agents.html)からも、同じレンダリングを実行できます。

リンクには、リクエストに必要な情報がすべて含まれます。下のグラフの種類、見出し、データ表は、アドレスバーに入力したものです。

![デザインシステムの色で描いた、チャネル別の月間登録数の棒グラフ。すべての値はクリックではなくクエリパラメーターで渡されたもの](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## 次に進むページ

- <!--i:people--> **[作る](/info/creators.html)**: 制作、アニメーション、録音や録画、共有、書き出し。
- <!--i:code--> **[自動化する](/info/builders.html)**: デザインシステム、ツール制作、コマンドライン、リンク、エージェント。
- <!--i:usercheck--> **[管理する](/info/operators.html)**: Lolly Workを使ってチーム向けにLollyを運用する方法。
- <!--i:server--> **[デプロイする](/info/operate.html)**: LollyとLolly Workのホスティング。
- <!--i:shieldcheck--> **[信頼性](/info/trust.html)**: プライバシー、セキュリティ、自分でファイルを検証する方法。
