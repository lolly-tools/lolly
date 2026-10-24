# はじめに

このページを読み終えるころには、ツールがあなたの色とフォントをまとい、すでにお持ちの作品もすぐ再利用できる状態になります。アカウントは不要で、作成も書き出しもお使いのデバイス上で動作します。

::: timeline
- <!--i:sparkle--> **ファイルを1つ作る。** [最初のファイルを作る](/info/make-something.html)で、数分でQRコードを作ります。
- <!--i:palette--> **ブランドを取り込む。** 1色、トークンファイル、完成したデザインのいずれかから始めます。
- <!--i:layers--> **同じものをもっと作る。** リンクを共有する、スプレッドシートを埋める、スクリプトからツールを実行する、のいずれかです。
:::

この考え方自体が初めてですか? [Lollyとは](/info/what-is-lolly.html)は5分で読める紹介で、[Lollyの仕組み](/info/how-lolly-works.html)は誰が何をするかを示します。

## ブランドを取り込む

lolly.toolsは、Lolly自身のサンプルデザインシステムである**Lolly Demo**で開きます。何を見ているかは[Lolly Demoを知る](/info/lolly-demo.html)で確認できます。ご自身のデザインシステムがこれに置き換わります。デザインシステムとは、色、フォント、いくつかのルールからなる小さなデザイントークンのセットで、すべてのツールがこれを使って描画します。一度設定すれば、作るものはすべてブランドに沿った状態で始まります。

お手元にあるものに合うルートを選んでください。

- <!--i:palette--> **1色から。** **Design System Setup**(`#/start`)を開き、デザインシステムに名前を付けて、プライマリカラーを選びます。Lollyはそこから、ライトとダークの背景、テキスト、アクセントを含む、アクセシブルな完全なパレットを導き出します。フォントを選べば、使えるブランドの完成です。
- <!--i:upload--> **トークンファイルから。** Design System Setupのルームレール下部にある**Add from…**は、DTCG、Tokens Studio、Penpotのトークンファイル、SVG、`LollyBrand`パックを受け付けます。ドロップするとパレットが埋まります。デザインシステムがまだ空のあいだは、Overviewルームの**Start from a reference**から同じピッカーを開けます。
- <!--i:pentool--> **完成したデザインから。** Designで**Import a design**を選び、`.fig`、`.penpot`、`.ai`、`.idml`、またはSVGファイルをドロップします。下の[すでにお持ちのものを取り込む](#bring-in-what-you-already-have)をご覧ください。

初めてギャラリーを開くと、短いウェルカムが同じ選択肢を示します。**Make it yours**はDesign System Setupを開き、**Bring your design**はデザインを選ぶファイルピッカーを開き、**Explore the community tools**はウェルカムを閉じます。

![新規インストール時のDesign System SetupのColoursルーム: ライブチップが1つ、入力欄が1つ、最初の決定のすべて](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

そこから先は、7つのルームで、好きな順序で好きなところまで進められます。**Overview**、**Colours**、**Type**、**Logos**、**Tokens**、**Files**、**Usage & rules**です。アプリ内のすべてのプレビューは、入力に合わせて更新されます。各ルームについては[Design System Setup](/info/brand-studio.html)で説明しています。

フォントはお使いのデバイスに保存されます。Googleフォントを選ぶと、Lollyはそのファイルをブランドのアセットとして保存するため、書体はオフラインでも持ち運べ、ツールが描画するときに何かを取得することはありません。

### デザインシステムを見る、切り替える、共有する

- **現在のものを見る。** **Settings → Design system**には、現在のデザインシステムが表紙とページとして、読み取り専用で表示されます。
- **切り替える。** **Settings → Preferences → Design systems**には、このデバイス上のすべてのデザインシステムが一覧になります。1つの組織が複数のデザインシステムを運用することも、複数のカラーウェイを持つ1つを運用することもできます。その構成は[ブランドアーキテクチャ](/info/brand-architectures.html)で整理しています。
- **共有する。** デザインシステムを`LollyBrand`パックとして書き出します。同僚がインポートすれば、同じパレット、フォント、ルールが手に入る1つのファイルです。

ビルドや組織から提供されるデザインシステムは**管理対象**で、ロックが表示され、読み取り専用のままです。変更するには、**Settings → Preferences → Design systems**から編集可能なコピーを作成します。

![Settingsのデザインシステムタブ: 現在のデザインシステムを表紙とページで表示](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

デザインシステムはDTCGトークンです。これは、Penpotが読み書きし、Tokens StudioがFigmaに持ち込む形式であるため、デザインに使うパレットとLollyが適用するパレットは1つのドキュメントになります。詳細は[デザイントークン](/info/design-tokens.html)をご覧ください。

::: details 開発者向け: コマンドラインからブランドパックを作る
チェックアウトした環境で再利用できるブランドパックを立ち上げるには、`ingest:brand`が、PenpotとTokens Studioが書き出す3つのコンテナを受け付けます。単一の`tokens.json`、`$metadata.json`付きのセットごとのファイルのディレクトリ、または`project.penpot`アーカイブです。

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate`はブランドをプロファイルとして登録し、そのカタログをビルドして検証します。既定のプロファイルを変更することはありません。新しいパックを使うには、`LOLLY_PROFILE=acme`を付けて実行します。ブランドパックとプロファイルの関係は[設定](/info/configuration.html)で説明しています。
:::

## すでにお持ちのものを取り込む

白紙から始める必要はありません。

**デザインファイル。** Figma、Penpot、Illustrator、InDesign、または任意のSVGアプリで作った完成作品は、Designで生きたレイアウトとして開きます。テキストは再入力でき、図形は図形のまま、画像はライブラリに入ります。ファイルはブラウザ内で読み込まれ、何もアップロードされません。各形式と引き継がれる内容は[デザインを取り込む](/info/design-import.html)に一覧があります。

**デッキ。** PowerPointの`.pptx`をLollyにドロップするとスライドがアセットとして保管され、**Markdown Slides**ではMarkdownから新しいデッキを書け、[デッキをリブランドする](/info/rebrand.html)ではデッキ全体をデザインシステムに移せます。

**データ。** CSVやJSONの表を貼り付けるかドロップすると、ツールの繰り返しフィールドがそこから埋まります。[Batch](/info/batch.html#make-many-versions-of-one-design)なら、1行につき完成ファイルを1つ作ります。

### 一度きりの制作物からテンプレートへ

取り込んだレイアウトは、通常のDesignセッションです。**Share with rules**でツールに変えられます。他の人が変更できる部分を選ぶと、その人たちはそこだけを入力します。

![Designのマスターを保ち、制作用コピーで入力と制限を選び、受け取る人が入力する再利用可能な.lollyツールを共有する](/info/diagrams/concepts/share-with-rules.svg)

各手順は[ルール付きでデザインを共有する](/info/create-a-tool.html)で順に説明しています。

## たくさん作る、共有する、自動化する

- <!--i:download--> **書き出し。** ツールは、各ツールが対応する形式で、SVG、PDF、PNG、JPG、WebP、動画などを作り、必要なら実際の印刷サイズで書き出せます。[ファイルを書き出す](/info/exporting.html)をご覧ください。
- <!--i:link--> **リンクを共有する。** ツールの設定はそのリンクに含まれるため、リンクはどこでも同じファイルを開き直します。
- <!--i:layers--> **1行につき1つ作る。** [Batch](/info/batch.html#make-many-versions-of-one-design)で、スプレッドシートからツールを動かします。
- <!--i:cpu--> **自動化する。** 同じレンダリングは、[CLI](/info/cli.html)からも[AIエージェント](/info/ai-agents.html)からも実行できます。

リンクは完全なリクエストです。下のグラフは誰も描いていません。種類、見出し、データ表の全体がアドレスバーに入力されたもので、同じリンクはどのデバイスでも同じグラフを描きます。

![月ごとの登録者数を示すエリアチャート。すべての値はクリックではなくクエリパラメータとして渡されている](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 次に進む先

- <!--i:people--> **[作る](/info/creators.html)**: 作成、アニメーション、録画、共有、書き出し。
- <!--i:code--> **[自動化する](/info/builders.html)**: デザインシステム、ツールの作成、コマンドライン、リンク、エージェント。
- <!--i:usercheck--> **[管理する](/info/operators.html)**: Lolly Workでチーム向けにLollyを運用する。
- <!--i:server--> **[配備する](/info/operate.html)**: LollyとLolly Workのホスティング。
- <!--i:shieldcheck--> **[信頼](/info/trust.html)**: プライバシー、セキュリティ、ファイルを自分で確認する方法。
