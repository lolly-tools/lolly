# 概要

![Lollyアイコン - 大きな緑と白のロリポップキャンディ](/info/icon.svg)

このドキュメントは、Lollyプラットフォームの目的、構造、アーキテクチャ上の決定事項をまとめたものです。プロダクトビジョンとコードベースの現状の両方を反映しています。

> **ステータス:** Lollyは**まだ完了していないクローズドパイロット**の中にある社内プロトタイプです。エンジンは決定論的で内部的に一貫していますが、プロダクトとしてはまだ初期段階です - SUSEが最初の顧客です - そして暗号化とファイル解析エンジンは現在、エンタープライズ規模に備えたSUSEの厳格なインフラ強化を受けています(これは私たちの得意分野です)。以下のアーキテクチャは、完成し認証されたプロダクトとしてではなく、テスト中の設計意図として読んでください。パイロットの運用方法と評価方法については[Adoption & Governance](/info/adoption-governance.html#status)を参照してください。

> **このページの読み方。** ここには2種類の内容が順に書かれています。前半は
> **これが存在する理由**です。問題、ポジショニング、1つのアセットがたどるライフサイクル
> を扱います。[The big picture](#the-big-picture-how-the-layers-fit)以降は
> **レイヤーがどう組み合わさるか**です。コントリビューター向けのアーキテクチャドキュメントで、engine/shell/packの
> 分離、リポジトリのレイアウト、配信対象、プラットフォームへのあらゆる変更を制約するコミットメントを扱います。プロダクトを理解するためではなくコードベースを変更するためにここに来たなら、big pictureから始めてください。
>
> このページより詳しく踏み込む2つの関連ドキュメントがあります。リポジトリ内の[`engine/README.md`](../engine/README.md)は、エンジンのモジュールごとのマップで、各モジュールが何を解析し何を書き出すかを示す生成済みの表を含みます。[Threat Model & Trust Boundaries](/info/threat-model.html)
> は同じアーキテクチャをトラストバウンダリとして読み解いたもので、エンジンが何を信頼できないものとして扱うかについての質問には、こちらのページが適しています。

---

## これが存在する理由

チームは繰り返し同じ問題に直面します。反復的なクリエイティブおよびコンテンツ制作の作業は、毎回熟練者の手を借りるほどではないほど予測可能でありながら、ガードレールなしに任せるにはあまりに品質に敏感です。その結果は、遅いスループット(専門家がボトルネックになる)、一貫性の欠如(手元にあるツールを各自が使う)、またはベンダーロックイン(テンプレートを支配するSaaS DAM)のいずれかに行き着きます。

このプラットフォームはその直接的な答えです。

> **プログラムによる大規模なクリエイティブとコンテンツ** - 従業員、ベンダー、パートナー向けに、ルールを一元管理しながら、労力ゼロでアセットを生成します。

Lollyはデザインシステムが生み出される場所ではなく、それが生産される場所です。デザインの自動販売機だと考えてください: 選択すれば、結果が出てきます。毎回必ず。エンジンは目の前のハードウェアで各フォーマットが出せる最高品質を目指して動作し、同じエンジンが、出荷先のどの環境でも同じファイルを作ります。

その結果得られるのは**豊富さ**です。あらゆるイベントに正しいサイネージが用意され、あらゆるCVEアラートが自社のスタイルに準拠し、あらゆるラベルがきれいに印刷され、あらゆるメール署名が最新の状態を保つ - これらすべてがデザインチケットなしに実現します。このプラットフォームが担うのは、反復的でオペレーション化されたクリエイティブです。あえてオーダーメイドのクリエイティブツールにはしていません - フラッグシップの制作は引き続きデザイナーが担います。

### 確率的に革新し、決定論的にスケールする

クリエイティブパイプラインにおけるAIをめぐる議論は、いつも同じ問いで行き詰まります。この作業のどの部分が機械の仕事なのか、と。これは古い問いであり、すでに答えは出ています。写字生や装飾写本の画家たちは、すでに2つの道具の間で仕事をしていました - 何も固定されず何でも試せるラフスケッチと、まさに確定してしまうがゆえに恐れられた印刷機です。芸術が生まれたのはスケッチの中でした。それを誰の手にも届けたのは印刷機でした。誰もこの2つを混同することはなく、両方とも進化を続けました - 新しいインク、新しい書体、新しい印刷機 - それぞれが、その技巧と目的に調和しながら進歩していったのです。

Lollyも同じ線引きをしています。探索は確率的に行います - モデル、デザイナー、ラフなアイデア、誰も計画していなかった場所へ行き着くプロンプト。そしてスケールは決定論的に行います - 1万件の出力に届くのは*ツール*であり、ツールは読み取り可能な入力から毎回同じようにレンダリングします。探索が自由でいられるのは、それが2回とも同じ結果に着地することに何も依存していないからです。出力が信頼を勝ち得るのは、それが当て推量ではないからです。AIによる実験を予測可能で再現性のある結果へと落とし込むことは、新しい規律ではありません。そもそも印刷物を信頼に足るものにしたのと同じ、分業の姿なのです。

> クリエイティブなプロセスを信頼し、厳密さをもってスケールする。

### 代替手段との比較

::: figure positioning-comparison
現在のクリエイティブツール群における機能の充実度、2026年8月調査。スコアリング:0=なし、25=回避策レベル、50=実装済みだが制限付きまたは部分的、75=注意点付きで強力、100=中核機能。
:::

ギャップは明白です。現在出荷されているものの中に、制約優先、オフライン対応、低スキルでも使え、社内で誰でもアクセスできる出力を提供するものはありません。Lollyにはオープンなキャンバス - **Design** - もあり、そこでは色、タイプ、アセットがブランドのグローバル設定に従うため、自由な配置であっても制約優先のままです。Lollyが**そうではない**のは、制約のないデザインスイートである、という点です。オーダーメイドのフラッグシップ制作には、デザイナーは引き続きIllustratorとFigmaを使います。バリエーションの組み立てにはこのツールを使えます。

![ライブラリ内のすべてのツールがカードとしてカテゴリ別にまとめられ、プロデューサーが1つを選んで作業を始められる様子](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**こんな用途に:** オペレーション化されたクリエイティブアセットの高速生成 - イベントタイル、名札、署名、CVEアラート、QRコード、ソーシャルカード、出荷ラベル、構造化レポート。

**こんな用途には向きません:** オーダーメイドのヒーローコンテンツ。

---

## キャンペーンのライフサイクル

Lollyが何であるかを理解する最も明快な方法は、機能一覧を眺めることではありません - 1つのアセットが人から人へと渡っていく様子を追うことです。ローカライズされた1枚のキャンペーンカードが組織の中を動いていく様子を見てみましょう。

1. **クリエイティブがルールを定める。** デザイナーがDesignツールでベーステンプレートを作成し、ブランドのタイポグラフィと色の変数をハードコードします。彼らが作っているのは1枚のカードではありません - 二度と手作業でローカライズしなくて済むように、基礎となる作業を*一度だけ*行っているのです。
2. **開発者がそれをスケールさせる。** 同じテンプレートがCLI経由で夜間パイプラインに組み込まれ、新しいチャートや新しい言語バリアントが自動的に生成されます - デザイナーがファイルを開き直すことはありません。
3. **プロデューサーはただ使うだけ。** 飛行機の中でオフラインの営業担当者が同じツールを開き、クライアントとの打ち合わせ用に完璧にオンブランドなデッキを生成します。デザインスキルもネットワークも待ち時間も不要です。

ステップ2の「新しいチャート」とは、まさにこのようなレンダリングのことです。データ文字列といくつかのパラメーターだけから、誰もデザインファイルを開くことなく生成されます。

![タイトル付きの積み上げエリアチャート。3つの系列がクールなパレットで色分けされ、軸・凡例・タイトルはすべて手動ではなくテンプレートによって配置されている](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

重要なのは、Lollyがデザイナーにとって良い、*かつ*開発者にとって良い、*かつ*営業にとって良い、という話がそれぞれ独立して成り立つことではありません。これは**リレー競走**です。クリエイティブが最初に行った仕事を開発者がスケールさせ、それが今度はプロデューサーの力になります。飛行機の中の非技術者の担当者が労せずして得られる体験は、デザイナーが定めて開発者が展開した厳密さがあってこそ*初めて可能*になるのです。

これが力を何倍にも増幅させる仕組みです。Lollyは役割ごとに別々のツールを詰め込んだ引き出しではありません - すべての役割が触れる、1つの決定論的なアセットライフサイクルであり、渡っていく手ごとに前の価値を何倍にも増やしていきます。

---

## 承認は1回、アセットは1万件

承認がファイルではなくツールに宿るため([How Lolly compares](/info/positioning.html)を参照)、スケールはもはやレビューの問題ではなくなります。ローカライズされたソーシャルカードツールを一度承認すれば、スプレッドシートから**12言語にわたる1万件のアセット**を生成できます - そのどれ1つとして、法務やブランドによる新たなコンプライアンスチェックを必要としません。すべてが生まれるもとになったテンプレートが、すでに承認されているからです。

同じ決定論的なツールが、3つの方法でその規模に到達します。いずれも同一の、事前承認済みの出力を生み出します。

- <!--i:people--> **人が、アプリの中で。** `/pro`バッチグリッド:行を貼り付けるかインポートし、1行につき1件の完成したアセットを得て、zipをダウンロードします。デザインスキルもチケットも待ち時間も不要です。
- <!--i:code--> **開発者が、コマンドラインから。** CLIは*同じ*エンジンと*同じ*レンダーパスをヘッドレスで実行するため、スクリプトや夜間パイプラインの中で1万行すべてにわたってツールを連続実行できます。ループの中で`lolly <tool> --field=…`を呼び出すだけで統合は完結します。
- <!--i:cpu--> **システムやAIエージェントが、MCP経由で。** 同じツールをプログラムから操作でき、同じ忠実度で、さらに大きな規模にも対応します - 何千ものファイルが次々と生成されていっても、機械は飽きることがないからです。

![新規インストール直後のBatchモード:ツールを待つ1つの空の行。データが届く前から、スプレッドシート全体とRenderボタンが用意されている](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

デザイナーによって一度定められた1組のブランド制約。同一の事前承認済み出力へと至る3つの経路 - そして機械による経路がもっとも遠くまでスケールします。ファイルが次々と生成される間、決して疲れることがないからです。

---

## 全体像:レイヤーがどう組み合わさるか

ここから先はすべてアーキテクチャの話です。この図はシステム全体を1つのビューにまとめたものです。上部ではツールが
データであり、中央のエンジンはどのプラットフォームについても何も知らず、その下のシェルは
1つの契約を実装し、カタログがコンテンツを供給します。

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### リポジトリのレイアウト

コンテンツはパックとしてマウントされます。`community/`、`docs/`、すべての`shells/*`、`services/*`の両方、そして`brands/suse`は、それぞれ独立したリポジトリであり、このリポジトリのgitサブモジュールとしてチェックアウトされます。親リポジトリが所有するのは`engine/`、`schemas/`、`scripts/`、`tests/`、`api/`、`brands/lolly-start/`、`profiles.json`です。チェックアウトコマンドとリポジトリ横断のワークフローについては[Build Guide » Getting the source](/info/build-guide.html)を参照してください。

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## プラットフォーム配信モデル

このプラットフォームは複数のサーフェス - Web PWA、Tauriデスクトップ/モバイル、スクリプト可能なCLI、対話型のTUI - にまたがって動作します。そのすべてが同じエンジンと同じツールファイルを使用します。

### Web (PWA) - 主要な配信経路
SUSEが管理するURLでホストされます。サービスワーカーがツールとアセットをキャッシュした後はオフラインでも動作します。ほとんどの従業員、ベンダー、パートナーがプラットフォームを利用するのはここです。アカウントは不要です - 状態はデバイスごとにIndexedDBに保存されます。

Webシェルは1つのレイアウトからレスポンシブに対応します。デスクトップでは、ツールはサイズ変更可能なコントロールサイドバーがプレビューステージの横に並び、トラックパッドネイティブなキャンバスナビゲーションを備えます(Cmd/Ctrl+ホイールまたはピンチでカーソル位置を中心にズーム、Spaceまたは中クリックドラッグでパン、`0`/`1`/`+`/`−`キーとFit/%のHUD)。モバイル(640px以下)では、コントロールは上部固定のシートになり、ドラッググリップでpeek/half/fullにスナップし(タップでも切り替わり)、その下には静的なフルスクリーンプレビューが表示されます。フローティングの**Render**ボタンを押すと、**Export**コントロールがボトムシートのポップアップで開きます。タッチではプレビュー上でピンチズームとドラッグパンが使えます。レンダーパスとエクスポートコントロールはどちらでも同一です - 変化するのはクロームだけです。

![デスクトップのスプリットビュー - マニフェストから生成されたコントロールが左側、ライブキャンバスが右側](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

同じツールをスマートフォン幅で表示した場合も、維持すべき第2のレイアウトはありません。コントロールは上部のシートになり、プレビューが画面全体を占め、レンダーピルがその上に浮かびます。

![幅430pxの画面上のオーディオグラム - 上部にコントロールシート、下部に完成した正方形のアートワーク、フローティングのレンダリングピル](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**バッチモード（`/pro`）。** Webシェルには、1つまたは複数のツールにまたがる多数の行を一度にレンダリングする、スプレッドシート形式のバッチグリッド（`shells/web/src/pro/`）も搭載されています。CSV/TSVの相互変換とスプレッドシートからの貼り付け、行ごとのテンプレート/フォーマット/サイズ/単位/DPI、ライブプレビュー付きのブロックエディタサイドパネル、折りたたみ可能なエクスポート列、行ごとの「関連性」タグバー、左側のドラッグハンドルによる行の並べ替え、2段階の削除確認、保存されたバッチセッション、`.zip`ダウンロードを備えています。これが「大量コンテンツ生成」というポジショニングを支える1対多のサーフェスです。

### Tauriデスクトップ / モバイル
Tauriによるパッケージ化されたネイティブアプリ（小さなフットプリント）。完全なオフライン利用、CLI依存ツール（PDF Smasher、Font Outliner）のファイルシステムアクセス、カメラアクセスを提供します。2026年半ばのツール強化が予定されています。

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

デスクトップユーザーは、多くのツールをターミナルから実行できます。CLIシェルは同じエンジンを読み込み、jsdom DOMを作成し、同じレンダーパスを実行してファイルを書き出します。URLモードがトランスポートであり、CLIは別個の実装ではありません。これにより、CLIとGUIの出力が同一であることが保証されます。

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

CLIに対応するインタラクティブな存在です。ツールの閲覧、入力の記入、プロジェクトの保存、エクスポートをGUIなしで行える、フルスクリーンでキーボード操作を前提としたターミナルアプリ（Ink製）です。そのホストブリッジは、DOMを使わないフォーマット（SVG/EMF/EPS/HTML + テキスト/データ）については**CLIの実装を再利用**し、さらに`~/.lolly`配下のオンディスク状態と、オプトインのインラインプレビューを追加します。それに加えて**ブラウザレンダー層**を備えています。これは、必要になったときにラスター/PDF/動画とライブURLキャプチャを生成する、スコープ限定のヘッドレスChromium（MCPサーバーがインストールするものと同一）で、Webシェルのビルド済みコピーを動かすことで出力を同一に保ち、そのフォーマットを最初にエクスポートするときにのみ起動します。そのため、`url-shot`（クロップ + 色の再設定 + ベクターPDF/SVG付き）をはじめ、あらゆるラスター/PDFツールもターミナル上で動作します。詳しくは[TUIガイド](/info/tui.html)を参照してください。

どのサーフェスを使っていても、ダッシュボードのCapabilitiesタブは、プラットフォームが実行できると宣言している内容の完全なマップであり、1つのツールも開かずにグループ化された形で読むことができます。

---

## ツールカテゴリ

ツールは、ギャラリーでのグループ化のために、マニフェスト内で`category`がタグ付けされています。

行はギャラリーのセクション順に並んでいます。`utility`セクションは、（将来追加されるものも含め）他のすべてのカテゴリの後、ギャラリー内で常に**最後**に表示されます - これはオンデバイスの「Offline Utilities」ドロワーです。

| カテゴリ | 例 | 計画中 |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

これらのセルは**在庫一覧ではなく例**です。どのツールが存在するかは、このページではなく、マウントしたプロファイルのプロパティです。ブランドパックは独自のツールを追加でき、出荷したくないコミュニティツールを除外することもできます。`catalog/tools/index.json` - マニフェストから生成され、ギャラリーが実際に読み込むレジストリ - が正式なリストです。あるプロファイルが何をマウントしているかを数えるには、ここに書かれた数を信用するのではなく、マニフェスト（`ls community/*/tool.json brands/*/tools/*/tool.json`）を数えてください。（2つのパックに存在するツールidは、勝ったパックから1回だけマウントされます。）

ツールはステータスによっても分類されます: `official`（ブランド承認済み、透かしなし）、`community`（外部からの貢献）、`experimental`（透かし入りエクスポート）。ライブラリの大部分は`official`ですが、新しめのスタジオやキャプチャ系ツールは、安定するまで`community`または`experimental`に位置することが多くなっています。どのサーフェスにもバッジが表示されるため、読者は開く前に自分が何を手に取っているかがわかります - そして、上のカテゴリのセルと同様、ステータスごとの所属はここで列挙するには変化が速すぎます。ギャラリーまたは生成されたインデックスから確認してください。

**Design**は、`render.layout: "editor"`のフリーキャンバスモードで構築された最初のツールです - テキスト、図形、画像のボックスをドラッグ、リサイズ、回転、スナップできる、UI装飾を排した直接操作サーフェスであり、他のすべてのツールと同じレンダーパスでエクスポートされます。

**Strip Hidden Data**は、最初の**オンデバイスユーティリティ**（`privacy: "on-device"`）です。*あなた*が提供したファイルを受け取り、完全にブラウザ内で処理してクリーンなコピーを返すコンテンツ変換ツールで、アップロードされることも、透かしが入ることも、来歴（プロビナンス）が刻まれることもありません。**Text Helper**が2つ目です - JSON整形、JWTデコード、Base64、URLエンコード/デコード、SHAハッシュ化など、日常的にウェブサイトへ貼り付ける作業のためのオンデバイスワークベンチです。**Compress PDF**が3つ目で、画像を再圧縮することでPDFを縮小します。これも完全にオンデバイスです。このマーカーとバッジテキスト「Runs on your device - nothing is uploaded」は、現在、変換系ツール全体をカバーしています: Strip Hidden Data、Text Helper、Compress PDF、**Convert Image**（HEIC/TIFF/AVIF → WebP/JPG/PNG）、**Convert Font**、**Redact**（画像、SVG、PDFの特定領域を破壊）、**Prompt to Image**、そしてプロファイルがマウントしている場合は**Rebrand a Deck**（`.pptx`をその場でリテーマ）です。これは、機密ファイルを単機能のウェブサイトに渡す代わりとなる、プライバシーユーティリティのカテゴリです。

![Utilitiesドロワー - すべてのカードが、すでに持っているファイルを変換するツールです](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> 注: `category`と`status`は、各`tool.json`から`catalog/tools/index.json`（ギャラリーが読み込むレジストリ）に非正規化されています。マニフェストが唯一の正となる情報源であり、インデックスは`npm run build:catalog`によって**生成**され、コミット済みのインデックスがマニフェストとずれている場合、`npm run validate:catalog`はCIを失敗させます。

---

## アーキテクチャ上のコミットメント

これらの決定は確定済みです。いずれかを変更することは大掛かりな作業であり、コードベース内の他のあらゆる決定を形作っています。

### 1. 宣言的なツール、命令的な逃げ道付き

ツールは、マニフェスト（`tool.json`）+ テンプレート（`template.html`）+ オプションの`hooks.js`で構成されます。

**入力を宣言するのはマニフェストです。** テンプレートではありません。入力はHandlebarsのトークンから推測されることはありません。マニフェストが契約であり、テンプレートは`{{id}}`によって名前付き変数を利用します。

![Street Mapのコントロールスタック - 都市ドロップダウン、テーマ選択、太さのスライダー、色のトリガー、そのすべてがマニフェストの1行から描画されています](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**フックはオプションです。** ほとんどのツールは純粋に宣言的で、マニフェスト+テンプレートだけで十分です。計算された値を必要とするツール（QRエンコード、チャートデータの整形）は、名前付きのライフサイクル関数（`onInit`、`onInput`、`onFrame` - モーションリアクティブなツール向けのフレームごとのライブカメラフック - `onLevel`、`beforeExport`、`afterExport`、`exportFile` - Strip Hidden Dataのようなオンデバイスユーティリティが使うファイルイン/ファイルアウトの変換パス - および、独自の深いラスターを持つツール向けの`exportStill`）を公開する`hooks.js`を提供します。ホストは、ケイパビリティブリッジをクロージャースコープとして注入しつつ、`new Function('host', …)`経由でフックを読み込みます。これは**ポータビリティの契約であり、セキュリティサンドボックスではありません**。フックはページのレルム内で実行され続けるため、ブラウザシェルでは`window`/`fetch`/`document`に*到達できてしまいます* - `host.*`はサポートされたポータブルなサーフェスであり、強制される境界ではありません。非同期フックの結果には時間制限があり（`onInit` 5秒、`onInput` 2秒、`beforeExport`/`afterExport` 5秒、`exportFile`/`exportStill` 10秒）、遅延した結果は破棄されますが、暴走する*同期*フックはプリエンプトできません。したがって、信頼できないサードパーティのフックコードは、Worker分離が実装されるまで安全に実行できません。

これが重要な理由: 宣言的なツールは、開発者でなくても作成できます。もしすべてのツールがWebアプリだったなら、「主力となるテンプレートを作成・保守するスキルが限られている」というリスク上の注記が、恒久的なボトルネックになってしまいます。

### 2. ツールとアセットはバンドルされたコードではなくデータである

WebアプリとTauriアプリは、起動時に既知のURLからツールとアセットのカタログを取得し、ローカルにキャッシュして、そこにあるものに対して動作します。**新しいイベントタイルや季節のアセットを追加するのに、アプリのリリースは不要です。**

アセットのバイトはCDNポイズニングを防ぐためにSHA-256でチェックサム化されています。アセットの`id` + `version`がキャッシュの無効化を駆動します。

### 3. ケイパビリティブリッジがツールから見える唯一のAPIである

ツールは、テンプレート領域の外でDOMに触れることも、`fetch`を直接呼び出すことも、ファイルシステムを読み取ることも一切ありません。バージョン管理された`host.*`メソッドを呼び出すだけです。この契約の正規の定義は`packages/core/src/host-v1.ts`にあります - これはツール作者向けSDKである`@lolly-tools/core`であり、サードパーティがエンジンに依存せずにこれを利用して開発できるようにするためのものです。`engine/src/bridge/host-v1.ts`はそれを型として再エクスポートしたものであり、エンジンおよびシェルのコードは引き続きそのパスから変更なくインポートします:

| ブリッジAPI | 機能 |
|---|---|
| `host.profile` | ユーザーの名、メール、顔写真、市区町村など。`bindToProfile`経由で入力欄を事前入力します。 |
| `host.assets` | カタログのクエリ、アセットの解決、ホスト提供のピッカーUI。 |
| `host.state` | 入力スロットの保存・読み込み。Webでは IndexedDB、Tauriではファイルシステム、CLIではメモリ。 |
| `host.clipboard` | テキストまたは画像をクリップボードに書き込みます（プラットフォームごとのフォールバック付き）。 |
| `host.export` | レンダーターゲットをラスタライズまたはシリアライズします。experimentalなツールには透かしを適用します。 |
| `host.net` | 許可リスト方式のfetch - ツールが`"network"`ケイパビリティを宣言している場合にのみ利用可能です。（現在出荷されているツールでこれを使用しているものはありません。） |

オプションの追加的なサーフェスは、シェルがそれらを提供する場合にのみ現れます。一部は**ケイパビリティによってゲートされて**おり、ツールが対応するフラグを宣言している場合にのみ公開されます: `host.compose`（他のツールのレンダーを埋め込む - `compose`）、`host.capture`（URL Screenshot用のページキャプチャ - `capture`）、`host.recorder`（録画系ツール向けのマイク/カメラ/画面キャプチャ - `microphone` / `camera` / `screen`）。残りは**機能検出方式**で、シェルが提供できる場合には常に存在し、提供できないシェルに対してはツール側がフォールバックを保持します。

カバー範囲を示すための、主要なサーフェスをいくつか紹介します - [Host API](/info/host-api.html)がそのすべてを文書化しており、`packages/core/src/host-v1.ts`が契約そのものです:

| サーフェス | 導入バージョン | 追加される機能 |
|---|---|---|
| `host.tokens` | 1.0 | DTCGデザイントークン - ブランド自身のプリミティブ |
| `host.text` | 1.0 | HarfBuzz WASMによるテキストからパスへの変換(`wasm`ケイパビリティがこれに依存するツールを示します) |
| `host.media` | 1.4 | `onFrame`フックを駆動するライブカメラフレーム。プログレッシブエンハンスメントであり、意図的に`camera`フラグでゲートされていません - そのようなツールも通常の静止画ツールとして動作します |
| `host.color` | 1.40 | 知覚的なカラー演算:ΔEOK、WCAG + APCAコントラスト、OKLabランプ、クラスブレーク、カテゴリカルパレット、ハーモニー配色(1.60)、CSS Color 4によるミキシングとグラデーションベイク(1.68)。純粋かつ同期的で、シェルは何かを独自実装するのではなくエンジンの`makeColorApi()`をアタッチするだけなので、ずれが生じません |
| `host.images` | 1.60 | デバイス上でのバイトのデコード/リサイズ/再エンコード - 変換パス(HEIC → JPEG、WebPへの圧縮、ダウンスケール)。Webシェルではレイジーファサードとして提供されるため、HEICデコーダーがブートチャンクに含まれることはありません |
| `host.geom` | 1.64 | 正確なベクタージオメトリ:パスのブーリアン演算、オフセット、ストローク→フィル変換、スプラインの低次化、単純化、ヒットテスト。こちらも純粋・同期的でエンジンからアタッチされ(`makeGeomApi()`)、失敗は例外を投げず*戻り値として返されます* |

残りも同じルールに従っており、それらと並んで文書化されています: オンデバイスでのドキュメント編集のための`pdf`（1.8）と`pptx`（1.58）、クリップ解析とオンデバイスTTS/文字起こしのための`audio`（1.71）と`speech`（1.96）、MilkDropプレースホルダー契約のための`viz`（1.72）、ディープビットおよびレイヤー化ビットマップ出力のための`codec`（1.100）と`layers`（1.102）、オンデバイスモデルのための`upscale`（1.101）と`matte`（1.103）、独自のピクセル処理を行うフックのための`raster`（1.105）、エクスポートセーフな矢印のための`connectors`（1.106）、完成したバイト列に署名するための`c2pa`（1.85）。数は増えていきますが、ルールは変わりません。

宣言可能なケイパビリティは次のとおりです: `network`、`filesystem`、`clipboard`、`camera`、`microphone`、`screen`、`ffmpeg`、`wasm`、`capture`、`compose`。（1.54で追加された`screen`は、`host.recorder`経由の画面キャプチャで、ユーザーがブラウザネイティブのUIで画面/ウィンドウ/タブを選択します。ツール自身が指定したURLをラスタライズする`capture`とは異なります。）

同じツールがブラウザ、Tauri、ヘッドレスCLIで動作するのは、各シェルがこのインターフェースを実装しているためです - ツール自身は、自分がどのシェルの中にいるかを一切知りません。

ブリッジはバージョン管理されています。メソッドの追加はマイナーバージョンです。削除やシグネチャの変更はメジャーバージョンアップとなります。v2がリリースされても、v1は動作し続けなければなりません。

### 4. アセットIDは永久に不変である

`suse/logo/primary`は契約です。一度公開されると:
- IDは決して変更されず、再利用もされません。
- バイトが変わる場合 → マニフェストの`version`を上げます。
- 新しいアセットに置き換わる場合 → `deprecated: true`を設定し、必要に応じて`replacedBy`を設定します。
- 既存の参照は常に解決されます。

これにより、保存されたツールの状態やURLで共有されたリンクは、何年経っても有効なままです。

### 5. URLモードはファーストクラスである

すべての入力は、URLパラメータとして表現できなければなりません:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![そのリンク単体で、他に何もなくても、完成したアセットになります](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLIモードは、別のトランスポート上で動くURLモードです - CLIシェルはargvからURL状態オブジェクトを構築し、**同じ**エンジンパイプラインを実行します。レンダーパスは1つしかありません。CLIは別個の実装ではないため、GUIからずれることはありません。

`url-mode.ts`が往復変換（パースとシリアライズ）を処理します。**予約済みパラメータ**の集合は、入力としてツールに渡されることは決してありません: 出力コントロール（`format`、`export`、`copy`、`filename`、`width`/`w`、`height`/`h`、`unit`、`dpi`）、印刷と来歴のダイヤル（`bleed`、`marks`、`profile`、`password`、`c2pa`、`imprint`、`durable`、`meta`、`hdr`、`depth`、`cuts`）、状態キャリア（`template`、「Shortest link」のパックされたトークンである`z`、そしてパスワードで暗号化された同等物である`zx`）です。`engine/src/url-mode.ts`内の`RESERVED`集合が正であり、テストによって固定されています。[URL Mode](/info/url-mode.html)がそのすべて、ここに列挙されていないわずかな項目も含めて文書化しています。URLモードでのアセット入力は、その`id`によってシリアライズされます。ランタイムはハイドレーション前に`host.assets.get()`経由でそれらを解決します。`width`/`height`は`unit`（デフォルトは`px`、他に`mm`/`cm`/`in`/`pt`/`pc`も可）での値です。物理単位を使う場合、`dpi`がラスター解像度を設定します。これらはキャンバスのドキュメントサイズを設定し、エクスポート寸法パネルを事前入力します。

すべての入力がリンクの中を伝わるため、パラメータを変えれば、それは別の完成アセットになります。このパレット全体は、1つのシード色、1つのハーモニー、1つのステップ数だけでできています:

![4色相にわたる9段階、すべてリンクに含まれる単一のシード色から生成されています](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. ストレージは直接ではなくブリッジ経由

Webシェル: IndexedDB。Tauri: ファイルシステム。CLI: インメモリ。ツールが目にするのは `host.state.save(slot, data)` と `host.state.load(slot)` のみです。`localStorage` は使用されません - 容量が小さすぎ、blobを保持できないためです。

ユーザーはツールごとに複数の名前付き編集スロットを保存し、後で各セッションに戻ることができます。アカウント作成は不要で、状態はデバイス単位です。ブリッジが唯一の接点であるため、そのデバイス単位の状態も*可搬*です。`shells/web/src/data-transfer.ts` は `host.profile`/`host.state`/`host.assets` を通じてすべてを読み出し、単一の `lolly-backup` zipにまとめます。これは他の環境でもインポートでき、サーバーを必要としない「新しいデバイスへの移行」のオフライン向けの答えです(完全な仕様は `docs/data-transfer.md` を参照)。SUSE ID連携(マルチデバイス同期)はこの上に構築される今後のマイルストーンです。

### 7. 成熟度タグが「ブランド承認済み」というリスクに設計上答える

すべてのツールはマニフェストで `status: official | community | experimental` を宣言します。ギャラリーはステータスでソートされます。実験的なツールは自動的にエクスポートに透かしが入ります - 透かしは `host.export.render` によって適用されるため、公式でないツール作成者がオプトアウトすることはできません。

これは、任意のツールを使うことがブランド承認を意味してしまうという認識上のリスクへの構造的な答えです。プロセス面の答え(レビューキュー、SUSE IDによるゲーティング)はこの上に重ねられます。

### 8. ツール入力はマニフェストを介して型指定される(アセットも含む)

入力は `type` を宣言します: `text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table`、`file`。ホストはマニフェストから型ごとに汎用コントロールをレンダリングします - ツール側はコントロールのコードを一切書きません。(ユーザーのプロフィールからの事前入力は型ではなく、どの入力も `bindToProfile` を持てます。)このうち3つは他より重要です:

- **`asset`**(`filter` と `allowUpload` を伴う)はグローバルなアセットシステムへの橋渡しです。`allowUpload: false` は、ライブラリのアセットのみを許可すべきスポンサータイルのロゴのようなケースで使う、ブランド強制のためのレバーです。ユーザーのアップロードはライブラリのアセットと同じ `AssetRef` 形式を使うため、ツールはどちらも同一に扱えます。
- **`blocks`** は繰り返しのフィールドグループ - 1つの入力内にあるミニテーブルで、サイドパネルで編集され、型付き/判別付きの追加メニューとブロックごとのアセットフィールドを持ちます。キャンバス上でレンダリングされたブロックをクリックすると、そのブロックの行にフォーカスします。`meeting-planner`、`chart-creator`、`event-name-badge`、`wayfinding-signage`、`color-block`、`digi-ad` で使用されています。
- **`vector`** は固定の数値集合(例えば変換行列)を1つの複合コントロールにまとめます。**`file`** は、デバイス上の変換ユーティリティ(例えば `strip-data` や `compress-pdf`)向けに、ユーザー自身のファイルをメモリ上のバイト列として保持します。

### 9. テンプレートはロジックレス(EJSではなくHandlebars)

HandlebarsはEJSよりも意図的に選ばれました:
- ロジックレス。テンプレートは非開発者でも作成できます。
- デフォルトで安全。`{{x}}` はHTMLエスケープされ、`{{{x}}}` はオプトインの生出力です。
- テンプレートに任意のJSがないため、テンプレートごとのXSS監査面がありません。

ロジックは `hooks.js` に置かれ、明示的でレビュー可能です。利用できるHandlebarsヘルパー: `{{default}}`、`{{upper}}`、`{{lower}}`、`{{eq}}`、`{{markdown}}`、`{{asset ref}}`、`{{asset ref "property"}}`(加えて、姉妹となる `.ics`/`.vcf`/`.csv` テンプレートで使われるデータフォーマットヘルパー `icsStamp`/`rfcText`/`csvCell`)。

### 10. ツールはツールを合成する

あるツールは、ツール間のインポートなしに**別の**ツールのレンダリングを埋め込むことができます - 合成はエンジンによって解決され、ツールのコードによっては行われません。表面は2つあります:

- **宣言的マニフェスト** - `composes: [{ id, tool, inputs, format?, width?, height? }]`。エンジンは指定された子をレンダリングし、その結果をロジックレステンプレート内に `{{asset <id>}}` として配置します。`event-name-badge` は現在 `qr-code` をSVGとして合成しています。
- **可搬な埋め込みURL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`。シェルはその子を**ローカルで**レンダリングします(ローカルのレンダリングが解決するまでプレースホルダーのピクセルが表示されます)。`lolly.tools` から何かがフェッチされることは決してありません。

任意のツールのレンダリングを合成できます: **SVG** の子は、親がSVGまたはPDFにエクスポートする際は真のベクターのままとなり、PNGの場合はくっきりとラスタライズされます。**PNG/JPG/WEBP** の子は画像として埋め込まれます。`compose` ケーパビリティが必要です。合成された子は中間生成物です - 透かしやプロベナンスのスタンプが入ることは決してなく、合成は段階的に劣化します: 子をレンダリングできないシェルは単にそのスロットを省略し、親は問題なくレンダリングされます。

---

## あえてやらないと決めたこと

- **テンプレートにEJSなし・任意のJSなし。** XSSの攻撃面はゼロです。ロジックは`hooks.js`に置かれます。
- **必須のアセットCMSなし。** 個人は自分のクリエイティブファイルを、アプリ内([カタログ](/info/using.html)ビューとブランドスタジオ)から直接自分のカタログへ取り込みます - サーバーも管理コンソールも不要です。作業は**セッション**として引き継がれます: 共有リンクが状態全体を保持し、同じセッションはバックアップや共同作業セッションを通じても運ばれます。デプロイメントを管理する者は、共有セッションを**テンプレート**として固定できます - リンクを開き、その値をブランドパック内のそのツールのディレクトリにテンプレートエントリとして記録し、コミットします - すると、それがそのツールの「New from template」選択肢に現れ、`?template=<id>`としてディープリンク可能になります。Gitはデプロイメント所有者の固定手段であり、制作者のものではありません。*共有され統治された*カタログを求めるなら、組織はアセットディレクトリを同じ方法で管理し、PRレビューによって更新をゲートすることも**できます** - これは利用可能な統治モデルであって、アプリの要件ではありません。
- **強制RBACなし。** オープンなアプリは既定で公開アクセスであり、ブランドリスクは成熟度タグとウォーターマークで管理します。より厳格な制御を求める組織は、独自の認証と上記のGitレビュー済みカタログを上に重ねます。
- **中央データベースなし。** すべてのユーザー状態はデバイスごとです。SUSE ID連携はロードマップにありますが、公開の前提条件ではありません。
- **共有されたツール/エンジンのコードパスなし。** エンジンはオープンソースであり、`community/`内のブランド非依存のツールも同様です。私設の`brands/suse/`のようなブランドパックは、独自の条件のもとで自身のツールとカタログを持ちます。いずれの場合も分離は強制され(`engine/`からツールコンテンツへのクロスインポートは禁止)、この分割は常にクリーンな状態を保ちます。

---

## ライフサイクル、始めから終わりまで

ユーザーが `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H` を開きます:

1. **起動。** WebシェルがIndexedDBを開き、ケーパビリティブリッジを構築し、ツールとアセットのカタログを同期します(オフライン時はキャッシュから読み込みます)。
2. **ルーティング。** URLハッシュ → `tool` ビュー、`qr-code` とURLパラメータが抽出されます。
3. **読み込み。** `loadTool('qr-code', fetchFile)` が `tool.json` をフェッチし、JSON Schemaに対して検証し、`template.html`、`styles.css`、`hooks.js` のソースをフェッチします。
4. **URL状態のパース。** `parseUrlState` がURLパラメータを初期入力値に変換します。アセット参照(`?logo=suse/logo/primary`)は軽量な `{ id, _unresolved: true }` オブジェクトとしてパースされます。
5. **ランタイム。** `createRuntime(tool, host, initialValues)` が入力モデルを構築し(プロフィールデータ、デフォルト値、初期値をマージ)、`host.assets.get()` 経由でアセット参照を解決し、フック(クロージャスコープの `host`、サンドボックス化はされていません)を読み込み、`hooks.onInit` を呼び出します。
6. **レンダリング。** シェルはランタイムを購読し、状態が変化するたびに `{ model, hydrated }` を受け取ります。モデルから入力コントロールをレンダリングし、ハイドレートされたテンプレートHTMLを `#tool-canvas` に書き込みます。
7. **操作。** ユーザーが入力欄に入力する → `runtime.setInput(id, value)` → 制約が適用される → `hooks.onInput` が呼ばれる → 再ハイドレート → 再レンダリング。キャンバスはライブで更新されます。
8. **エクスポート。** ユーザーがダウンロード(PNG)をクリック → `runtime.export(canvasNode, 'png')` → `host.export.render`(dom-to-image-more経由でラスタライズ。SVG/PDFは専用のDOMウォーキング・ベクタライザーを通ります) → blob → `host.export.download`。ツールがオプトインできるフォーマットの範囲は広く、`schemas/tool.schema.json` の `render.formats` enumがその権威です - ラスター画像とfloatラスター、ベクターとカットファイル、印刷/CMYK、モーション、編集可能なドキュメント(`pptx`、`docx`、`odt`)、パレットとデータ/テキスト出力、音声とフォントファイル。[URL Mode](/info/url-mode.html) がすべてのidと生成物を列挙しています。音声もこのenumに他と同様に含まれます(`wav`、`mp3`、`m4a`、`opus`。オーディオグラムとレコーディング系ツールが宣言します)。別途、レコーディングツールの `render.capture` モードは `host.recorder` を駆動し、その録画結果はブラウザが録画したコンテナ形式のまま完成したBlobとして届きます。(`render.export: false` を設定したツール - 例えばColor Palette、Countdown Timer、Strip Hidden Data、Text Helper、Compress PDF - はダウンロード/フォーマット/寸法コントロールを非表示にします。)物理単位はここでフォーマットごとに変換されます(PDF → 真のページポイント、ラスター → DPIに応じたピクセル、`pHYs` チャンク付き)。作者/プロベナンスのメタデータ(作者、ツール、ソース - `engine/src/metadata.ts` によって構築)はフォーマットごとに埋め込まれます: PNG iTXt、JPEG EXIF、PDF情報辞書、SVG `<metadata>`、GIFコメント。実験的なツールにはツール自身ではなくホストによって透かしが挿入されます。

![`?options` が開くエクスポートパネル: ファイル名とフォーマットの組み合わせ、出力サイズ、ファイルを書き出すコントロール](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauriでも同じライフサイクル。CLIでも同じライフサイクル - jsdomがヘッドレスDOMを提供し、出力はファイルまたはstdoutに送られます。

---

## オープンソースのステータス

**コードはMPL-2.0です。** `engine/`、`shells/*`、`services/*`、`schemas/`、`docs/`は**MPL-2.0**のもとでオープンソース化されています - ブランドツーリングのためのベンダー非依存なスキャフォールディングプラットフォームであり、出荷可能な各ユニットは[github.com/lolly-tools](https://github.com/lolly-tools)配下の独自のリポジトリに置かれています。

**ツールのコンテンツはブランドパックとして提供され**、それぞれ独自の条件を持ちます(パックの`NOTICE.md`を参照)。`community/`は公開の[`lolly-tools`](https://github.com/lolly-tools/lolly-tools)リポジトリであり、そのブランド非依存のツールもMPL-2.0です。`brands/suse/`は非公開の`suse-lolly`パックです: SUSEのツールとSUSEカタログで、ライセンス供与されたPremiumBeatの音楽を含め**SUSEの専有物**です。`brands/lolly-start/`は、このリポジトリが所有する白紙のスターターブランドです。フォントはパック内に**SIL Open Font License 1.1**のもとで同梱され、SUSEパックにはSUSEおよびSUSE Monoの書体が含まれます。

リポジトリルートの`tools/`と`catalog/`はgitignoreされた*ビュー*です: プロファイルがこれらを`community/`と有効なブランドパックから組み立てるため、すべてのスクリプトとシェルはこの2つのパスを読み取り、パックを直接読み取ることは決してありません。

この分割は強制されており - `engine/`からツールコンテンツへのクロスインポートは存在しません - プラットフォームとコンテンツの境界はクリーンに保たれます。

---

## エンジンが終わりホストが始まるところ

純粋なデータとHandlebarsで表現できるなら → **エンジン**。
DOM、ファイルシステム、ネットワーク、あるいはブラウザ/OSのAPIに触れるなら → **ホスト**。

この線引きは意図的に明確にされています。エンジンはオープンソースの部分です。SUSE、特定のプラットフォーム、実行環境について知っているものはすべてその外側に置かれます。

さらに詳しいレベルについては、[`engine/README.md`](../engine/README.md) がすべてのエンジンモジュールとそれぞれの責務を列挙しており、[脅威モデルと信頼境界](/info/threat-model.html) は同じ線がどこで信頼境界を兼ねているかを記録しています。
