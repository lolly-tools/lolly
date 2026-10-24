# Lollyのアーキテクチャ

![Lollyアイコン - 大きな緑と白のロリポップキャンディ](/info/icon.svg)

このページは、Lollyのコードを変更する人向けです。エンジン、シェル、ツールパックがどう組み合わさるか、それぞれがリポジトリのどこにあるか、あらゆる変更を縛る取り決めを説明します。Lollyが何をし、誰が使うのかを知りたい場合は、まず[Lollyの仕組み](/info/how-lolly-works.html)をお読みください。

さらに深く知るための補足が2つあります。[`engine/README.md`](../engine/README.md)は、コードから生成されたエンジンのモジュールごとの地図です。[脅威モデルと信頼境界](/info/threat-model.html)は、同じアーキテクチャを信頼境界として読み解いたもので、エンジンが何を信頼できないものとして扱うかについての疑問に答えるページです。

## 全体像

最上位のツールはデータです。中間のエンジンはどのプラットフォームも知りません。最下位のシェルは1つの契約を実装し、カタログが内容を供給します。

![ツールは共有エンジンにマニフェスト、テンプレート、フックを提供する。Web、Tauri、ターミナルのシェルはHostV1ケイパビリティブリッジを実装し、カタログからツールとアセットを読み込む。](/info/diagrams/concepts/platform-layers.svg)

純粋なデータとHandlebarsで記述できるなら、それは**エンジン**に属します。DOM、ファイルシステム、ネットワーク、あるいはブラウザやオペレーティングシステムのAPIに触れるなら、それは**ホスト**、つまりブリッジのシェル側に属します。エンジンはオープンソースであり、特定のブランドやプラットフォームを知るものはエンジンに入りません。

## リポジトリの構成

Lollyは1つのリポジトリです。以下のディレクトリはすべて、その中の通常のディレクトリですが、`brands/suse`は例外で、公開クローンが取得しない、SUSEのツールパックとカタログを収めた**非公開の**gitサブモジュールです。ビルドがどのパックを読むかはコンテンツプロファイル(`profiles.json`)で決まり、グローバルに切り替えるのではなく、プロセスごとに解決されます。クローンのコマンドと、非公開パックの中の変更をコミットする方法は、[ビルドガイド](/info/build-guide.html)にあります。

| ディレクトリ | 収めるもの |
|---|---|
| `engine/` | プラットフォームに依存しないコア: ローダー、ランタイム、入力、テンプレート、URLモード、単位、形式モジュール |
| `shells/` | Webアプリ、Tauriのデスクトップ・モバイルアプリ、CLI、TUI、ブラウザ拡張機能 |
| `packages/` | ツール作者向けSDK(`@lolly-tools/core`)、共有のNodeシェル部品、ドキュメントレンダラーなど |
| `community/` | ブランドに依存しないツールと、共有の絵文字パック |
| `brands/` | ブランドパック: `lolly-demo`(lolly.toolsが使うデザインシステムのLolly Demo)、`lolly-start`(空のスターター)、非公開の`suse` |
| `services/` | 任意のMCP、証明書、Penpotのサービスと、それらが共有するサーバーコード |
| `schemas/` | ツールマニフェスト、アセットエントリ、アセット参照のJSON Schema |
| `scripts/`、`tests/`、`docs/`、`api/` | ビルドとカタログのスクリプト、エンジンのテストスイート、これらのドキュメント、生成されたサーバーレスバンドル |

::: details 最初に目にするエンジンとシェルのファイル
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

リポジトリのルートに`tools/`や`catalog/`ディレクトリはありません。`packages/node-shell/src/content-roots.ts`が、`profiles.json`から、問われたときに「ツール`<id>`はどこにあるか」「カタログはどこにあるか」に答えます。実際の`tools/`と`catalog/`の組が書き込まれるのは、`dist/`、RPMのペイロード、コンテナイメージなどのビルド出力だけです。ブラウザがその2つのパスをHTTPで取得するためです。

## Lollyが動作する場所

どの環境も、同じエンジンと同じツールファイルを使います。

- **Webアプリ。** サービスワーカーがツールとアセットをキャッシュした後はオフラインで動作するプログレッシブWebアプリです。アカウントは不要で、状態は各デバイスのIndexedDBにあります。1つのレスポンシブなレイアウトがデスクトップとスマートフォンに対応し、スマートフォンではコントロールがシートになり、書き出しコントロールはフローティングピルから開きます。
- **デスクトップアプリとモバイルアプリ。** 同じWebアプリのTauriパッケージで、ネイティブのファイルダイアログ、ファイルシステムによる状態、完全なオフライン利用を備えます。
- **CLI。** `lolly <tool-id> --input=value --output=file.png`は、ヘッドレスのDOMで同じエンジンを読み込み、ファイルを書き出します。これは別の実装ではなく、別の伝送路でのURLモードです。[CLI](/info/cli.html)をご覧ください。
- **TUI。** 全画面でキーボード中心のターミナルアプリで、CLIのブリッジを再利用し、保存したセッションをディスクに保持し(アプリがインストールされていればデスクトップアプリ自身のフォルダ、そうでなければ`~/.lolly`の下)、形式がブラウザを必要とする場合にだけ、範囲を限定したヘッドレスブラウザを起動します。[TUI](/info/tui.html)をご覧ください。

![デスクトップの分割ビュー: 左にマニフェストから生成されたコントロール、右にライブキャンバス](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

同じツールをスマートフォンの幅で表示しても、別のレイアウトは要りません。コントロールが上部のシートになり、プレビューが画面を占めます。

![幅430pxの画面のオーディオグラム: 上にコントロールのシート、下に完成した正方形のアートワーク、そしてフローティングの書き出しピル](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webアプリには、**Batch**(`#/batch`、`shells/web/src/pro/`)も同梱されています。1つまたは複数のツールにわたって多数の行を一度にレンダリングする、スプレッドシート形式のグリッドで、Batchについては[BatchとMulti-edit](/info/batch.html#make-many-versions-of-one-design)で扱っています。**Settings → Capabilities**には、プラットフォームができると宣言しているすべてのことの地図があります。

![新規インストール時のBatch: ツールを待つ空の行が1つあり、データが届く前にスプレッドシート画面とRenderボタンが用意されている](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## アーキテクチャ上のコミットメント

これらの決定は確定済みです。コードベースのあらゆる他の決定を形作っているため、どれを変更するにも大きな取り組みが必要です。

### 1. 宣言的なツール、命令的な逃げ道付き

ツールは、マニフェスト(`tool.json`)、テンプレート(`template.html`)、そして任意の`hooks.js`です。**マニフェストが入力を宣言し**、テンプレートは宣言しません。入力はHandlebarsのトークンから推測されません。ほとんどのツールはマニフェストとテンプレートだけで、そのおかげで開発者でない人も作成できます。

![Street Mapのコントロール群: 都市のドロップダウン、テーマの選択、太さのスライダー、色のトリガー。どれもマニフェストの1行から描かれている](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QRのエンコードやグラフの整形など、値を計算するツールにはフックを追加します。これは、ケイパビリティブリッジが注入された状態でランタイムが呼び出す、名前付きのライフサイクル関数です。フックはセキュリティのサンドボックスではなく移植性の契約であり、時間の予算の範囲内で実行されます。フックがページのグローバルを使わないことが確認されたツールには`isolate: true`が付き、Workerで実行されます。ライフサイクルと予算は[ツールのフック](/info/tool-hooks.html)に、ページ内の実行機構が何を封じ込め、何を封じ込めないかは[脅威モデル](/info/threat-model.html)に書かれています。

### 2. ツールとアセットはバンドルされたコードではなくデータである

WebアプリとTauriアプリは、起動時にツールとアセットのカタログを取得してキャッシュし、そこにあるもので動作するため、新しいツールやアセットのためにアプリのリリースは不要です。アセットのバイト列にはSHA-256のチェックサムが付き、アセットの`id`と`version`がキャッシュの無効化を左右します。

### 3. ケイパビリティブリッジがツールの見る唯一のAPI

ツールは、テンプレートの外のDOMに触れず、`fetch`を直接呼ばず、ファイルシステムも読みません。バージョン付きの`host.*`メソッドを呼び出します。契約の正式な定義は、ツール作者向けSDKの`@lolly-tools/core`である`packages/core/src/host-v1.ts`にあり、第三者がエンジンに依存せずにこれに対してビルドできます。`engine/src/bridge/host-v1.ts`はその型を再エクスポートします。

| 必須API | 内容 |
|---|---|
| `host.profile` | ユーザーの詳細。`bindToProfile`を通じて入力を自動入力する |
| `host.assets` | カタログのクエリ、アセットの解決、ホストのピッカー |
| `host.state` | 入力スロットの保存と読み込み: WebではIndexedDB、Tauriではファイルシステム、CLIではメモリ |
| `host.clipboard` | テキストまたは画像をクリップボードに書き込む(プラットフォームごとの代替付き) |
| `host.export` | レンダリング対象のラスタライズまたはシリアライズと、デバイス上のファイル変換経路 |
| `host.log` | ホストへのレベル付きログ |

それ以外のAPIはすべて任意で追加的なものです。`tokens`、`text`、`color`、`geom`、`pdf`、`compose`、`media`、`recorder`など多数があります。ツールのマニフェストは、フックが確認せずに呼び出す任意のAPIを`requires`に列挙し、それを欠くホストはツールのマウントを拒否します。残りについては、フックが機能を検出します。`recorder`など一部は、ツールが宣言するデバイスのケイパビリティも必要とします。`packages/core/src/host-v1/apis.ts`にすべてが一覧されており、それぞれは[Host API](/info/host-api.html)に記載されています。メソッドの追加はマイナーバージョン、削除や変更はメジャーバージョンであり、v2が出てもv1は動作し続けます。

### 4. アセットIDは永久

`lolly/logo/primary`は契約です。一度公開されたIDは変更されず、再利用もされません。バイト列の変更ではアセットエントリの`version`が上がり、置き換えでは`deprecated: true`と、必要に応じて`replacedBy`が設定されるため、既存の参照は常に解決されます。これが、保存したセッションと共有リンクが何年も動き続ける理由です。

### 5. URLモードはファーストクラスである

すべての入力はURLパラメーターとして表現できるため、リンクは完成したファイルです。

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![このリンクだけで、ほかに何もなくても、完成したファイルになる](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

パラメーターを変えると、別のファイルになります。このパレット全体は、1つのシード色、ハーモニー、ステップ数からできています。

![4色相にわたる9段階、すべてリンクに含まれる単一のシード色から生成されています](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLIは、引数から同じURL状態を作って同じパイプラインを実行するため、CLIがアプリとずれることはありません。`engine/src/url-mode.ts`が解析とシリアライズを行い、予約された名前(`format`、`width`、`dpi`、`c2pa`、`z`など)はツールに渡されません。すべては[予約済みURLパラメーター](/info/url-parameters.html)に一覧があります。アセット入力は`id`で渡され、テンプレートが埋められる前に`host.assets.get()`で解決されます。

### 6. ストレージはブリッジを通る

WebアプリはIndexedDB、Tauriはファイルシステム、CLIはメモリを使います。ツールに見えるのは`host.state.save(slot, data)`と`host.state.load(slot)`だけで、`localStorage`は使いません。アカウントなしで、ツールごとに名前付きの複数のセッションを保持できます。ブリッジが唯一の接点であるため、その状態は可搬でもあります。`shells/web/src/data-transfer.ts`がそれを1つの`lolly-backup`ファイルに読み出し、他のどのインストールにもインポートできます([データ移行](/info/data-transfer.html))。[同期](/info/sync.html)は、同じバンドルを利用者が選んだストレージに送ります。

### 7. 成熟度タグは、ツールが何であるかを示す

すべてのツールは`status: official | community | experimental`を宣言します。ギャラリーはステータス順に並び、experimentalのツールは既定で書き出しに透かしを入れます。ランタイムは、呼び出し側が`watermark: false`を渡さないかぎり透かしをオンにし、デバイス上で動作するツールは対象外です。チームがカタログの周りにどんなプロセスを置いても、それはこの上に載ります。

### 8. 入力はマニフェストで型付けされる

入力は`type`を宣言します。`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table`、`file`のいずれかです。ホストは型ごとにコントロールを描画するため、ツールはコントロールのコードを書かず、どの入力にも`bindToProfile`を付けられます。特に重要なものが3つあります。

- **`asset`**は、`filter`と`allowUpload`を持ち、アセットシステムへの橋渡しです。`allowUpload: false`はスロットをライブラリのアセットに限定し、ユーザーのアップロードはライブラリの`AssetRef`と同じ形を共有します。
- **`blocks`**は、サイドパネルで編集する繰り返しのフィールドグループで、Meeting Planner、Wayfinding、Diagramsなどで使われます。描画されたブロックをクリックすると、その行にフォーカスが移ります。
- **`file`**は、Strip Hidden DataやCompressなどのデバイス上のユーティリティのために、ユーザー自身のファイルをメモリに保持します。**`vector`**は、固定個数の数値を1つのコントロールにまとめます。

### 9. テンプレートにロジックはない

テンプレートはHandlebarsで、開発者でない人にも書けるように選ばれています。`{{x}}`はエスケープされ、`{{{x}}}`は明示的なオプトインです。ロジックは`hooks.js`にあり、明示的で、レビューできます。多くのテンプレートは、フックが計算したマークアップに`{{{`を使うため、各フックは渡すものをエスケープしなければなりません。ヘルパーは`default`、`upper`、`lower`、`eq`、`markdown`、`asset`、`framing`、`media`に加え、`.ics`、`.vcf`、`.csv`の兄弟テンプレート向けの`icsStamp`、`rfcText`、`csvCell`、`arrow`です。これらは[テンプレートとレンダリング](/info/tool-rendering.html)で扱っています。

### 10. ツールはツールを合成する

ツールは、ツール同士のインポートなしに、他のツールのレンダリングを埋め込めます。合成はエンジンが解決します。マニフェストは`composes: [{ id, tool, inputs }]`を宣言して子を`{{asset <id>}}`で配置でき、ポータブルな埋め込みURL(`https://lolly.tools/tool/<id>.svg?…`)が子をローカルでレンダリングします。DesignがライブのQRコードやグラフを配置するのは、この仕組みです。SVGの子は、SVGまたはPDFの親の中でもベクターのままです。子は中間生成物であり、透かしも署名も付かず、子をレンダリングできないシェルはそのスロットを空にしますが、親は引き続きレンダリングされます。詳細は[合成とブランドオーバーレイ](/info/tool-composition.html)にあります。

## あえてやらないこと

- **テンプレートに任意のJavaScriptは使わない。** ロジックは`hooks.js`にあります。
- **必須のアセットサーバーはない。** アプリ内のAssetsにご自身のファイルを追加し、作業はセッションとして引き継ぎます。入力と設定にはリンク、アップロードも運ぶ場合には`.lolly`ファイルを使います。共有セッションは、ツールの選択画面でテンプレートにできます。管理されたカタログを求める組織は、Lolly Workのカタログ、承認、ポリシーを使うか、gitでブランドパックを管理してそこで変更をレビューできます。
- **強制的なアクセス制御はない。** 公開のアプリは既定で公開されており、成熟度タグと透かしがブランドのリスクを担います。組織のサインイン、ロール、ポリシーは、チームが望む場合にLolly Workから提供されます。
- **中央のデータベースはない。** ユーザーの状態は各デバイスにあり、任意の同期が、それを利用者が選んだストレージにコピーします。Lollyのデータベースにコピーされることはありません。
- **ツールとエンジンの間で共有されるコードの経路はない。** エンジンとコミュニティツールはオープンソースで、非公開の`brands/suse/`のようなブランドパックは、独自のツールとカタログを独自の条件で持ちます。どのツールも`engine/`からインポートしないため、分離はきれいに保たれます。

## 1回のレンダリングのライフサイクル

誰かが`https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`を開きます。

1. **起動。** WebアプリはIndexedDBを開き、ケイパビリティブリッジを構築し、ツールとアセットのカタログを同期するか、オフラインならキャッシュから読み込みます。
2. **ルーティング。** パスが`qr-code`のツールビューを選び、クエリがその初期値になります。
3. **読み込み。** `loadTool`が`tool.json`を取得してスキーマで検証し、テンプレート、スタイル、フックを取得します。
4. **リンクの解析。** `parseUrlState`がパラメーターを入力値に変換します。`?logo=lolly/logo/primary`のようなアセット参照は、未解決の`{ id }`になります。
5. **ランタイムの開始。** `createRuntime(tool, host, initialValues)`が、プロフィールデータ、既定値、リンクから入力モデルを構築し、アセット参照を解決し、フックを読み込んで`onInit`を呼び出します。
6. **レンダリング。** シェルはランタイムを購読し、モデルからコントロールを描画し、埋めたテンプレートを`#tool-canvas`に書き込みます。
7. **操作。** 入力すると`runtime.setInput`が呼ばれ、制約を適用し、`onInput`を呼び出し、テンプレートを再び埋めて再描画します。
8. **書き出し。** **Download**が`runtime.export(node, format)`を呼び、シェルの`host.export`がファイルを生成します。ラスター、DOMウォーカーによるベクター、PDF、ドキュメント、`schemas/tool.schema.json`にあるその他の形式のいずれかです。物理単位は形式ごとに変換され、メタデータとContent Credentialsは、形式が保持できる場合に埋め込まれます。experimentalのツールの透かしは、ツールではなくホストが付けます。書き出しの手順は[テンプレートとレンダリング](/info/tool-rendering.html)と[ファイルを書き出す](/info/exporting.html)で扱っています。

![?optionsで開く書き出しパネル: ファイル名と形式の組、出力サイズ、ファイルを書き出すコントロール](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

同じライフサイクルは、Tauriでも、ヘッドレスのDOMを使うCLIでも動作し、出力はファイルまたは標準出力に送られます。

## ライセンス

`engine/`、`shells/`、`services/`、`schemas/`、ドキュメントジェネレーターを含むコードは、1つの公開リポジトリ[`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)でMPL-2.0です。ドキュメントの文章はCC BY-SA 4.0です。ブランドパックは、各パックの`NOTICE.md`に独自の条件を持ちます。コミュニティツールはMPL-2.0で、非公開のSUSEパックはSUSEの専有です。ライセンスに関する全文の注記は[概要](/info/about.html)にあります。
