# Lollyのアーキテクチャ

![Lollyのアイコン - 緑と白の大きな棒付きキャンディー](/info/icon.svg)

このページは、Lollyのコードを変更する人に向けたものです。エンジン、シェル、ツールパックがどう組み合わさるか、それぞれがリポジトリのどこにあるか、すべての変更が守るべき方針を説明します。Lollyで何ができ、誰が使うのかを知るには、まず[Lollyの仕組み](/info/how-lolly-works.html)をお読みください。

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md)は、エンジンをモジュールごとに説明する、コードから生成された文書です。[脅威モデル & 信頼境界](/info/threat-model.html)では、同じアーキテクチャを信頼境界の観点から捉え、エンジンが何を信頼しないものとして扱うかを説明しています。

<!--i:eti-layers-->
## 全体像

最上位には、データとしてのツールがあります。中央のエンジンは、どのプラットフォームにも依存しません。最下位のシェルが1つの契約を実装し、カタログがコンテンツを提供します。

![ツールがマニフェスト、テンプレート、フックを共通のエンジンに提供します。Web、Tauri、ターミナルのシェルがHostV1機能ブリッジを実装し、カタログからツールとアセットを読み込みます。](/info/diagrams/concepts/platform-layers.svg)

純粋なデータとHandlebarsで記述できるものは、すべて**エンジン**に属します。DOM、ファイルシステム、ネットワーク、ブラウザやOSのAPIに触れるものは、すべてブリッジのシェル側である**ホスト**に属します。エンジンはオープンソースです。特定のブランドに依存するものは、エンジンに入れません。

<!--i:eti-folder-shared-->
## リポジトリの構成

Lollyは1つのリポジトリで構成されています。以下のディレクトリは、`brands/suse`を除き、すべて通常のディレクトリです。これは、SUSEのツールパックとカタログを含む**非公開**のgitサブモジュールで、公開リポジトリのクローンでは取得されません。コンテンツプロファイル(`profiles.json`)が、ビルドで読み込むパックを指定します。各プロセスが自身のプロファイルを解決し、全体を切り替えるスイッチはありません。[ビルドガイド](/info/build-guide.html)には、クローンのコマンドと、非公開パック内の変更をコミットする方法があります。

| ディレクトリ | 内容 |
|---|---|
| `engine/` | プラットフォームに依存しないコア: ローダー、ランタイム、入力、テンプレート、URLモード、単位、形式モジュール |
| `shells/` | Webアプリ、Tauriのデスクトップアプリとモバイルアプリ、CLI、TUI、ブラウザ拡張機能 |
| `packages/` | ツール作者向けSDK(`@lolly-tools/core`)、Nodeシェルの共通部分、ドキュメントレンダラーなど |
| `community/` | ブランドに依存しないツールと、共通の絵文字パック |
| `brands/` | ブランドパック: `lolly-demo`(lolly.toolsで使うデザインシステム、Lolly Demo)、`lolly-start`(空のスターター)、非公開の`suse` |
| `services/` | 任意のMCP、証明書、Penpotサービスと、それらが共有するサーバーコード |
| `schemas/` | ツールのマニフェスト、アセットのエントリー、アセット参照のJSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | ビルドとカタログのスクリプト、エンジンのテストスイート、このドキュメント、生成されたサーバーレスのバンドル |

::: details 最初に見るエンジンとシェルのファイル
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

::: note リポジトリのルートに`tools/`や`catalog/`ディレクトリはありません
`packages/node-shell/src/content-roots.ts`は、`profiles.json`をもとに「ツール`<id>`がどこにあるか」と「カタログがどこにあるか」を解決します。実際の`tools/`と`catalog/`の組は、`dist/`、RPMのペイロード、コンテナイメージなどのビルド出力にだけ書き込まれます。ブラウザがこの2つのパスをHTTP経由で取得するためです。
:::

<!--i:eti-monitor-->
## Lollyが動く場所

どの環境でも、同じエンジンと同じツールファイルを使います。

- **Webアプリ。** プログレッシブWebアプリです。サービスワーカーがツールとアセットをキャッシュすると、オフラインで動作します。アカウントは不要で、状態は各デバイスのIndexedDBに保存されます。1つのレスポンシブレイアウトがデスクトップとスマートフォンに対応します。スマートフォンでは、コントロールがシートになり、書き出しコントロールはフローティングピルから開きます。
- **デスクトップアプリとモバイルアプリ。** 同じWebアプリをTauriでパッケージ化したものです。ネイティブのファイルダイアログ、ファイルシステムへの状態の保存、完全なオフライン利用に対応します。
- **CLI。** `lolly <tool-id> --input=value --output=file.png`は、ヘッドレスDOMで同じエンジンを読み込み、ファイルを書き出します。異なる転送経路でURLモードを使うものです。[CLI](/info/cli.html)をご覧ください。
- **TUI。** 全画面表示の、キーボード操作を中心とするターミナルアプリです。CLIのブリッジを再利用し、保存したセッションをディスクに保持します。デスクトップアプリがインストールされている場合はそのフォルダに、そうでない場合は`~/.lolly`の下に保存します。形式上必要な場合にだけ、用途を限定したヘッドレスブラウザを起動します。[TUI](/info/tui.html)をご覧ください。

![デスクトップの分割ビュー: 左側にマニフェストから生成したコントロール、右側にライブキャンバス](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

スマートフォンの画面幅では、コントロールのシートが上部にあり、プレビューが画面全体に広がります。

![幅430pxの画面のオーディオグラム: 上部にコントロールのシート、下部に完成した正方形のアートワークと、フローティングの書き出しピル](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webアプリには**Batch**(`#/batch`、`shells/web/src/pro/`)も含まれています。スプレッドシート形式のグリッドで、1つまたは複数のツールにわたる多くの行を一度にレンダリングします。[BatchとLolly Multi-edit](/info/batch.html#make-many-versions-of-one-design)をご覧ください。**Settings → Capabilities**には、プラットフォームが対応を宣言しているすべての機能が一覧で表示されます。

![新規インストール直後のBatch: ツールの指定を待つ空の行が1つあり、データを入れる前からスプレッドシートとRenderボタンが表示されています](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## アーキテクチャの基本方針

これらは確定した決定です。コードベース内のほかのすべての決定がこれらに依存するため、1つを変えるだけでも大がかりな作業になります。

### 1. 宣言的なツールと、命令的な処理を使う手段

ツールは、マニフェスト(`tool.json`)、テンプレート(`template.html`)、任意の`hooks.js`で構成されます。**マニフェストが入力を宣言します**。テンプレートのHandlebarsトークンから入力を推論することはありません。ほとんどのツールはマニフェストとテンプレートだけで構成されるため、開発者でなくても作成できます。

![Street Mapのコントロールスタック: 都市のドロップダウン、テーマの選択、太さのスライダー、色の呼び出し。すべてマニフェストの行から生成されています](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QRエンコードやグラフの整形など、値を計算するツールはフックを追加します。フックは名前付きのライフサイクル関数で、ランタイムが機能ブリッジを注入して呼び出します。フックは移植性のための契約であり、セキュリティサンドボックスではありません。決められた制限時間内で実行されます。フックがページのグローバル変数に依存しないと確認されたツールには`isolate: true`が付けられ、Workerで実行されます。[ツールのフック](/info/tool-hooks.html)には、ライフサイクルと制限時間が記載されています。[脅威モデル](/info/threat-model.html)では、ページ内の実行機構が何を封じ込め、何を封じ込めないかを説明しています。

### 2. ツールとアセットは、バンドルされたコードではなくデータです

WebアプリとTauriアプリは、起動時にツールとアセットのカタログを取得してキャッシュし、キャッシュされた内容で動作します。新しいツールやアセットの追加に、アプリのリリースは不要です。アセットのバイト列はSHA-256のチェックサムで検証されます。アセットの`id`と`version`が、キャッシュの無効化を決めます。

### 3. ツールが使うAPIは機能ブリッジだけです

ツールは、自身のテンプレートの外にあるDOMに触れず、`fetch`を直接呼び出さず、ファイルシステムも読みません。バージョン付きの`host.*`メソッドを呼び出します。この契約は、ツール作者向けSDKである`@lolly-tools/core`内の`packages/core/src/host-v1.ts`に定義されています。第三者は、エンジンに依存せずSDKを使って開発できます。`engine/src/bridge/host-v1.ts`は、その型を再エクスポートします。

| 必須API | 機能 |
|---|---|
| `host.profile` | ユーザーの情報。`bindToProfile`を通して入力を事前に埋める |
| `host.assets` | カタログの検索、アセットの解決、ホストのピッカー |
| `host.state` | 入力スロットの保存と読み込み: WebではIndexedDB、Tauriではファイルシステム、CLIではメモリ |
| `host.clipboard` | プラットフォームに応じたフォールバック付きで、テキストや画像をクリップボードに書き込む |
| `host.export` | レンダリング対象のラスタライズまたはシリアライズと、デバイス上でのファイル変換経路 |
| `host.log` | ホストへのレベル別のログ出力 |

ほかのすべてのAPIは任意で、追加する形になっています。`tokens`、`text`、`color`、`geom`、`pdf`、`compose`、`media`、`recorder`など多数あります。マニフェストの`requires`には、フックが事前確認なしで呼び出す任意のAPIを列挙します。そのいずれかを持たないホストは、ツールのマウントを拒否します。それ以外は、フックが機能の有無を確認します。`recorder`などの一部のAPIは、ツールが宣言するデバイスの機能も必要とします。`packages/core/src/host-v1/apis.ts`にすべての一覧があり、[Host API](/info/host-api.html)でそれぞれを説明しています。メソッドの追加ではマイナーバージョンが変わります。削除や変更ではメジャーバージョンが変わり、v2がリリースされてもv1は動作し続けます。

### 4. アセットIDは永続です

`lolly/logo/primary`は契約です。公開されたIDは変更せず、再利用もしません。バイト列が変わると、アセットのエントリーの`version`を上げます。置き換える場合は、`deprecated: true`と、必要に応じて`replacedBy`を設定します。既存の参照は常に解決されるため、保存したセッションや共有リンクは何年も動作し続けます。

### 5. URLモードは中心的な機能です

すべての入力をURLパラメーターで表せるため、リンクが完成したファイルになります。

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![ほかに何も含まない、そのリンクだけで完成したファイルになります](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

パラメーターを変えると、別のファイルが得られます。このパレットは、1つの基準色、配色の調和、段階数からできています。

![4つの色相それぞれに9段階。すべてリンクに含まれる1つの基準色から生成されています](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLIは、引数から同じURL状態を組み立て、同じ処理経路を実行するため、アプリと動作がずれることはありません。`engine/src/url-mode.ts`がURL状態を解析、シリアライズします。予約済みの名前(`format`、`width`、`dpi`、`c2pa`、`z`など)がツールに渡されることはありません。[予約済みURLパラメーター](/info/url-parameters.html)にすべての一覧があります。アセット入力は`id`で受け渡され、テンプレートを埋める前に`host.assets.get()`を通して解決されます。

### 6. ストレージへのアクセスはブリッジを通します

WebアプリはIndexedDB、Tauriはファイルシステム、CLIはメモリを使います。ツールが使うのは`host.state.save(slot, data)`と`host.state.load(slot)`だけで、`localStorage`は使いません。アカウントなしで、ツールごとに複数の名前付きセッションを保持できます。ブリッジだけが接点なので、状態も持ち運べます。`shells/web/src/data-transfer.ts`は、状態を1つの`lolly-backup`ファイルとして書き出します。このファイルは、ほかのどのインストール環境にもインポートできます([データの移行](/info/data-transfer.html))。[同期](/info/sync.html)は、同じバンドルをユーザーが選んだストレージに送ります。

### 7. 成熟度タグがツールの位置付けを示します

すべてのツールが`status: official | community | experimental`を宣言します。ギャラリーはステータス順に並べます。実験的なツールは、既定で書き出しに透かしを入れます。呼び出し側が`watermark: false`を渡さないかぎり、ランタイムは透かしをオンにします。デバイス上で処理するツールは対象外です。チーム独自のカタログ管理プロセスは、これらのタグをもとに運用します。

### 8. 入力の型はマニフェストで指定します

入力は`type`を宣言します。`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table`、`file`のいずれかです。ホストが型ごとのコントロールを描画するため、ツール側でコントロールのコードを書く必要はありません。どの入力にも`bindToProfile`を付けられます。特に重要なのは、次の3つの型です。

- **`asset`**は、`filter`と`allowUpload`を備えた、アセットシステムへのブリッジです。`allowUpload: false`は、スロットをライブラリのアセットに限定します。ユーザーのアップロードも、ライブラリと同じ`AssetRef`の構造を使います。
- **`blocks`**は、サイドパネルで編集する繰り返しのフィールドグループです。Meeting Planner、Wayfinding、Diagramsなどで使います。レンダリングされたブロックをクリックすると、その行にフォーカスが移ります。
- **`file`**は、Lolly Strip Hidden DataやCompressなど、デバイス上で動作するユーティリティのために、ユーザー自身のファイルをメモリに保持します。**`vector`**は、固定された一組の数値を1つのコントロールにまとめます。

### 9. テンプレートはロジックを持ちません

テンプレートはHandlebarsなので、開発者でなくても書けます。`{{x}}`はエスケープし、`{{{x}}}`はエスケープしないことを明示的に選ぶ記法です。ロジックは`hooks.js`に置かれ、そこでレビューできます。多くのテンプレートは、フックが生成したマークアップに`{{{`を使うため、各フックは渡す内容をエスケープする必要があります。ヘルパーには`default`、`upper`、`lower`、`eq`、`markdown`、`asset`、`framing`、`media`があり、対応する`.ics`、`.vcf`、`.csv`テンプレート向けに`icsStamp`、`rfcText`、`csvCell`、`arrow`もあります。[テンプレートとレンダリング](/info/tool-rendering.html)で説明しています。

### 10. ツールはツールを合成します

ツール間でインポートを行わずに、別のツールのレンダリングを埋め込めます。エンジンが合成を解決します。マニフェストは`composes: [{ id, tool, inputs }]`を宣言し、`{{asset <id>}}`で子ツールを配置できます。持ち運べる埋め込みURL(`https://lolly.tools/tool/<id>.svg?…`)が子ツールをローカルでレンダリングします。Lolly Designはこの方法でライブのQRコードやグラフを配置します。子がSVGなら、親がSVGやPDFでもベクターのままです。子は中間生成物なので、透かしやスタンプは付きません。子をレンダリングできないシェルはスロットを空のままにし、親はそのままレンダリングされます。詳しくは[合成とブランドオーバーレイ](/info/tool-composition.html)をご覧ください。

<!--i:eti-scissors-->
## 採用しなかったこと

- **テンプレートに任意のJavaScriptを入れません。** ロジックは`hooks.js`に置きます。
- **アセットサーバーを必須にしません。** ユーザーはアプリのAssetsに自分のファイルを追加し、セッションとして作品を引き渡します。入力と設定には共有リンクを使い、アップロードしたファイルも渡す場合は`.lolly`ファイルを使います。共有セッションは、ツールの選択画面でテンプレートにできます。管理されたカタログを必要とする組織は、Lolly Workのカタログ、承認、ポリシーを使うか、ブランドパックをgitで管理し、そこで変更をレビューできます。
- **アクセス制御を強制しません。** オープンなアプリは、既定で公開されています。成熟度タグと透かしでブランド上のリスクを示します。チームが必要とする場合、Lolly Workが組織のサインイン、ロール、ポリシーを提供します。
- **中央データベースはありません。** ユーザーの状態は各デバイスに保存され、任意の同期機能はユーザーが選んだストレージにコピーします。Lollyのデータベースにコピーすることはありません。
- **ツールとエンジンの間でコードの経路を共有しません。** エンジンとコミュニティのツールはオープンソースです。非公開の`brands/suse/`などのブランドパックには、独自の条件のもとでツールとカタログが含まれます。どのツールも`engine/`からインポートしないため、分離が明確に保たれます。

<!--i:eti-refresh-->
## 1回のレンダリングのライフサイクル

ユーザーが`https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`を開きます。

1. **起動。** WebアプリがIndexedDBを開き、機能ブリッジを構築し、ツールとアセットのカタログを同期します。オフラインの場合はキャッシュから読み込みます。
2. **ルーティング。** パスが`qr-code`のツールビューを選び、クエリを初期値にします。
3. **読み込み。** `loadTool`が`tool.json`を取得し、スキーマに照らして検証し、テンプレート、スタイル、フックを取得します。
4. **リンクの解析。** `parseUrlState`がパラメーターを入力値に変換します。`?logo=lolly/logo/primary`のようなアセット参照は、未解決の`{ id }`になります。
5. **ランタイムの開始。** `createRuntime(tool, host, initialValues)`がプロフィールデータ、既定値、リンクから入力モデルを構築し、アセット参照を解決し、フックを読み込み、`onInit`を呼び出します。
6. **レンダリング。** シェルがランタイムを購読し、モデルからコントロールを描画し、値を埋めたテンプレートを`#tool-canvas`に書き込みます。
7. **操作。** 文字を入力すると`runtime.setInput`が呼ばれ、制約を適用し、`onInput`を呼び出し、テンプレートに再び値を埋めて描画し直します。
8. **書き出し。** **Download**が`runtime.export(node, format)`を呼び出し、シェルの`host.export`がファイルを生成します。ラスター、DOMウォーカーからのベクター、PDF、ドキュメント、または`schemas/tool.schema.json`にあるその他の形式です。物理単位は形式ごとに変換されます。メタデータとContent Credentialsは、その形式が保持できる場合に埋め込まれます。実験的なツールの透かしは、ツールではなくホストが付けます。[テンプレートとレンダリング](/info/tool-rendering.html)と[ファイルを書き出す](/info/exporting.html)で、書き出しの手順を説明しています。

![?optionsで開く書き出しパネル: ファイル名と形式の組、出力サイズ、ファイルを書き出すコントロール](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauriでも、ヘッドレスDOMを使うCLIでも、同じライフサイクルが実行されます。CLIでは出力がファイルまたは標準出力に送られます。

<!--i:eti-stamp-->
## ライセンス

`engine/`、`shells/`、`services/`、`schemas/`、ドキュメント生成ツールを含むコードはMPL-2.0で、1つの公開リポジトリ[`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)にあります。ドキュメントの文章はCC BY-SA 4.0です。ブランドパックには、それぞれの`NOTICE.md`に独自の条件があります。コミュニティのツールはMPL-2.0で、非公開のSUSEパックはSUSEのプロプライエタリです。[概要](/info/about.html)にライセンスに関する注記の全文があります。
