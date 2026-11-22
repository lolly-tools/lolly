# ファイルを書き出す

**Export | Save**ピルの左側にある**Export**を押し、ファイル名の横で形式を選んで**Download**を押します。ファイルはお使いのデバイスで作成されます。

ファイルには、キャンバスに表示されている内容が入ります。形式メニューに並ぶのは、このブラウザでこのツールが作成できる形式だけです。

ほとんどの作業は、次の3つの形式のいずれかで対応できます。

| 用途 | 選ぶ形式 | 理由 |
|---|---|---|
| 画面、メッセージ、スライド | **PNG** | どのアプリでも開けます。ツールが透明な背景に対応していれば、その透明度を保ちます |
| 完成したページや印刷物全般 | **PDF** | 表示どおりに印刷できる実際のページサイズです。対応するツールでは、**Print PDF**が印刷機向けのCMYK版になります |
| どのサイズでも鮮明である必要があるアートワーク | **SVG** | ベクターの図形です |

::: check 使用するサイズでファイルを確認する
送信前に、対象の画面でファイルを開くか、実際のサイズで印刷してください。
:::

::: details Lolly Workでの承認と配信(任意)
[Lolly Workを運用する組織](/info/organisation.html)は、メンバーに表示する形式と書き出し設定を選べます。承認が必要な場合、**Download**は**Request approval**に置き換わります。お使いのインスタンスに表示されるポリシーに従ってください。

Lolly Workでは、設定済みのS3、WebDAV、HTTPの送信先へのファイル配信も可能です。承認ステップ、配信の受領記録、監査記録を伴います。この配信では、組織のサービスにファイルが送られます。通常のダウンロードはお使いのデバイス上で完結します。個人のSend先と組織の配信は、それぞれ別に設定します。

運用者は[組織の配信ガイド](/info/work-delivery.html)に沿って設定します。キューに入るサーバーレンダリングやバッチは、[CLIのバッチと自動化](/info/cli-automation.html#organisation-jobs-with-lolly-work)をご覧ください。
:::

<!--i:eti-cpu-->
## 書き出しの仕組み

ファイルを生成する経路は3つです。多くのツールは**キャンバスをレンダリング**します。テキストとデータの形式(HTML、Markdown、TXT、JSON、CSV、ICS、VCF)は、**ツールの内容から生成**します。*Lolly Strip Hidden Data*などのプライバシーユーティリティは、**選択したファイルを変換**します。処理はお使いのデバイス上で行われます。結果にはキャンバス、透かし、追加のメタデータは含まれません。

![完成したファイルに至る3つの書き出し経路: キャンバスのレンダリング、内容からのテキストやデータの生成、選択したファイルのデバイス上での変換。](/info/diagrams/concepts/three-export-paths.svg)

書き出しパネルに用意するアクションは、ツールの作者が決めます。既定ではCopy、Download、Saveです。

- <!--i:download--> **Download**はファイルを保存します。後から見つからなくなった場合は、[ダウンロードしたファイルを探す](/info/find-your-work.html#find-a-file-you-downloaded)をご覧ください。
- <!--i:photos--> **Copy**は画像をクリップボードにコピーします。画像をコピーできないブラウザでは、Copyは代わりにファイルをダウンロードし、そのことを知らせます。
- <!--i:folder--> **Save**は現在のデザインをProjectsに保存し、ファイルのダウンロードは行いません。**Download**の横の**Save as**では、保存先を指定します([保存と再開](/info/using.html#saving-continuing)をご覧ください)。
- <!--i:link--> **Share**はShareダイアログを開きます。デザインを再現するリンク、開いたときの動作の切り替え(全画面表示、書き出しパネル、開いたときのダウンロードまたはコピー)、状態をコンパクトなトークンにまとめる任意の**Shortest link**があります([URLモード](/info/url-mode.html)をご覧ください)。

書き出しパネルの**Send to**カードは、接続したサービスにファイルを送ります。Google Drive、Nextcloud、S3バケット、Dropbox、OneDriveに送った後は、**Create a share link**で再アップロードせずにそのサービス上のリンクを作成できます。Shareダイアログの**Share through your cloud**セクションは、`.lolly`ファイルの送信とリンクの作成を1回の操作で行います。リンクパネルには、リンクを開ける人、ファイルの保存場所、リンクの有効期限が表示されます。Shareダイアログの**Links you've shared**では、共有を停止できます。Nextcloudのリンクには、パスワードと有効期限を設定できます。S3のリンクの有効期間は1〜7日で、途中で停止できません。Lollyはファイルのコピーもサインイントークンもサーバーに保持しません。各サービスが受け取る情報は[プライバシー](/info/privacy.html#every-network-request-the-app-can-make)に記載しています。

![書き出しパネル: 形式、サイズ、Copy / Download / Save / Shareのアクション](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

QR Codeのリンクを含むLolly Designの画像ボックスなど、別のツールのレンダリングをデザインに埋め込んだ場合、親の書き出しにその入れ子のレンダリングが描かれます。SVGとPDFではベクターを保ち、PNG、JPG、WebPではラスタライズされます。埋め込まれたレンダリング自体には透かしも来歴も付きません。付くのは完成したファイルだけです。HTML、Markdown、TXTの書き出しには、合成したレンダリングを含めることはできません。

<!--i:eti-file-->
## 形式を選ぶ

**Download**の下に、ファイル名と形式メニューが`name.format`という1組で並びます。

![ファイル名欄と形式ピッカーが一体となり、書き出すファイルが1組のname.formatとして表示される](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

まずファイルの用途を考えます。各カードには、その用途に合う形式が並んでいます。

::: figure exporting-format-chooser
6つの用途と、各用途に適した形式。
:::

デザインシステムの書体で組んだワードマークは、すべての文字をアウトラインのパスにしてSVGに書き出します。ファイルはどの大きさでも鮮明さを保ちます。

別の言語のテキストは、利用できるフォントによって処理が変わります。デザインシステムのフォントに該当する文字がある場合、SVGとPDFは字形を整え、右から左の行も含めて読み順にアウトラインとして描きます。該当する文字を持つフォントがない場合、Lollyは[フォールバックフォント](/info/fallback-fonts.html)を使い、書き出しカードにそのフォントを表示します。どのフォールバックフォントも対応していないテキストは、SVGではライブテキストのまま残り、閲覧者のフォントで描かれます。PDF、EPS、WMF、および**Outline fonts**をオンにしたEMFでは、そのテキストは画像になります。文字の見た目はページ上と同じですが、選択も検索もできません。書き出しカードには、該当する文字体系が表示されます。文字をベクターテキストとして残すには、その文字を含むフォントを追加してください。

![Auroraという極細で字間の広いワードマーク。表のSVGの行で説明する純粋なベクターアートワークの例](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 各形式とその用途
| 必要なもの | 使用する形式 | 理由 |
|---|---|---|
| 拡大縮小しても鮮明なロゴやアートワーク | **SVG** | ベクターなので拡大縮小でき、小さく、編集も可能です。ベクターの書き出しで描けないエフェクトは画像として埋め込みます |
| OfficeやWindowsアプリ用のベクター | **EMF** | ライブテキストを含む編集可能なベクターとしてPowerPointやWordに貼り付けられます。Google DriveではGoogle Drawingsで開きます |
| 印刷やデザインアプリ用のベクター | **EPS**、または**EPS (CMYK)** | Illustratorや印刷工程で使うPostScriptベクターです |
| カッティングマシン用のベクター | **DXF** | レーザーカッター、ビニールプロッター、CNC向けのミリメートル単位のアウトラインパスです |
| 編集可能なスライドデッキ | **PowerPoint** (PPTX) | テキストと図形をネイティブで編集でき、画像とベクターも取り出せる状態で保持します |
| 編集可能なテキストドキュメント | **Word** (DOCX)または**OpenDocument** (ODT) | ワードプロセッサーで編集を続けられる段落と見出しです(Lolly Doc Studio) |
| InDesign用のレイアウト | **InDesign IDML (static subset)** | テキスト、長方形、楕円、画像を含み、アートボードごとに1つの見開きになります(Lolly Design) |
| 編集可能なPenpotドキュメント | **Penpot** | ボード、図形、テキスト、リンクされたトークンを含みます |
| 写真や汎用の画像 | **PNG**(可逆)または**JPG**(より小さい) | 幅広く使えるラスターです |
| 小さい最新形式の画像 | **WebP**または**AVIF** | 圧縮率が高く、透明度も保てます |
| 印刷物 | **PDF**、または**Print PDF** (CMYK) | 実際のページサイズです。印刷機にはCMYKを使います |
| 印刷機用のラスター | **Print TIFF** (CMYK) | RIP用のDeviceCMYKピクセルです |
| ウェブ用のアニメーション | **GIF** | どこでも再生できますが、ファイルは大きくなります |
| フルカラーで本物の透明度を持つアニメーション | **APNG** | パレットに制限のないアニメーションPNGです |
| 最小サイズのアニメーションファイル | **Animated WebP** | フルカラーと透明度を保ち、GIFやAPNGより小さくなります |
| 拡大縮小できるベクターのアニメーション | **Animated SVG** | 自己完結型で、ブラウザや`<img>`内で任意のサイズでループ再生します(Lottie Ad) |
| 編集可能な状態を保つアニメーション | **dotLottie** | Lolly Designのタイムラインから図形、パス、外側の変形キーを含めます |
| Premiereへの引き継ぎ | **Premiere XML + media** | Premiere用の時間指定されたクリップと元のメディアです(Lolly Design) |
| SNSや共有用の動画 | **MP4**または**WebM** | ファイルサイズに対して最も高い品質です([動画](#video)をご覧ください) |
| キャプション | **SRT**または**VTT** | 動画プレーヤー用の時間指定テキストです(Captions、Audiogram、Record) |
| 放送用字幕 | **TTML**または**SCC** | IMSC1.1の時間指定テキスト、またはCEA-608のポップオン字幕です(Captions。[放送用字幕](#broadcast-captions)をご覧ください) |
| 研修コース | **SCORM (LMS)** | バージョン付きのウェブサイト、SCORM、xAPIのパッケージです([SCORM](#scorm-course-packages)をご覧ください) |
| リッチテキストやメール署名 | **HTML** | 書式を保ってメールクライアントに貼り付けられます |
| ブラウザで再生するアニメーション | **HTML** | Lolly DesignのタイムラインやSnippetから作る、1つのファイルに収まるプレーヤーです([動画](#video)をご覧ください) |
| プレーンな内容 | **MD**または**TXT** | テキストだけです |
| カレンダーの予定 | **ICS** | どのカレンダーアプリにも取り込めます |
| 連絡先カード | **VCF** | アドレス帳に取り込めます |
| 再インポート用の構造化データ | **JSON**または**CSV** | ツールの内容を書き出し、再び取り込めます |
| ファビコン | **ICO** | 複数サイズのサイトアイコンです。**ZIP**では複数の形式をまとめられます |
:::

### 透明度

対応するツールには、**No BG**などの背景を透明にする切り替えがあります。PNG、WebP、AVIF、SVG、APNG、Animated WebPは透明度を保ち、GIFはくっきりした境界を保ちます。JPGとPDFは常に不透明になります。TIFFは白い背景に統合され、[HDR](#hdr-bright-colours)の経路では黒い背景に統合されます。

<!--i:eti-crop-->
## サイズと印刷の単位

書き出しにはツール本来のピクセルサイズを使います。ツールに**dimensions**がある場合は、幅、高さ、**unit**を設定します。

- **px**(既定値)は、正確なピクセル数です。
- **mm, cm, in, pt**と**pc**は物理的なサイズです。物理単位では**DPI**(既定値は300)も指定します。**PDF**は、そのサイズの実際のページになります。**ラスター**は、そのDPIに応じたピクセル数になり、解像度を記録します。**SVG**は、ピクセルのviewBoxとともに物理単位を保ちます。

高解像度のラスターが必要なら、幅と高さを大きく入力するか、物理単位を選んでDPIを高くします(ピクセル = サイズ × DPI)。幅`210`、高さ`297`、単位`mm`を指定するとA4ページになります。

![寸法を210×297 mmにした行。物理単位を選んだため、DPI欄が表示されている](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## 時間指定のあるコンポジションからの静止画

Lolly Designの[Sequence](/info/sequence-editor.html)タイムラインなど、時間指定のあるコンポジションから静止画を書き出す場合は、**プレイヘッド位置のフレーム**を使います。画像にしたい位置にプレイヘッドを置き、書き出してください。

複数の時点の画像が必要な場合は、出力サイズの横の**Frames**欄を使います。この欄は、時間指定のあるコンポジションと静止画形式(PNG、JPG、WebP、SVG、PDF)の組み合わせでのみ表示されます。`1`ならプレイヘッドのフレームを取得します。数を増やすと、シーケンス全体に均等に分散した、その数の静止画を取得できます。

- PNG、JPG、WebP、SVGは、`<name>-01.png`、`-02.png`のような名前で、1つのZIPにまとめて返されます。
- PDFは、指定した枚数のページを含む1つのドキュメントとして返されます。

各静止画はタイムラインを分割した各区間の中央から取るため、最初の画像が登場時のフェードの途中になったり、最後の画像がクリップ終了後の空白になったりすることはありません。

::: figure exporting-contact-sheet
Frames: 4では、シーケンスを4つの等しい区間に分け、それぞれの中央を取得します。
:::

Framesは、ストーリーボード、レビュー用コンタクトシート、編集した動画から切り出すSNSのカルーセルに使います。枚数は最大64です。欄にそれ以外を入力すると、`1`に戻ります。各フレームは通常の静止画なので、クレデンシャル、Imprint、物理単位、DPIは1回の書き出しと同様に動作します。書き出しリンク、CLI、MCPでは、`cuts=`で同じシートを指定できます([コンタクトシート](/info/url-export.html#contact-sheets)をご覧ください)。

<!--i:eti-copy-->
## 多数のファイルを一度に扱う

Lollyには、大量の作業に対応する方法が3つあります。

::: cols
## 表から1つのドキュメントを作る
表の入力をページに分割するツールは、各行を1ページにします。スプレッドシートから表を貼り付けると、1つのPDFになります。行を修正するには、スプレッドシートを編集して再度貼り付けます。参照用のツールはBattlecardsです。オープンソースの`community`フォルダにあり、lolly.toolsには掲載されていません。
## CSVの1行から1ファイルを作る
**Batch**(`#/batch`)はCSVを受け取り、名札や証明書などを1行につき1つ書き出し、ZIPにまとめて渡します。[Lolly Batch](/info/batch.html#make-many-versions-of-one-design)をご覧ください。
## 複数のデザインに同じ編集を加える
**Lolly Multi-edit**は、保存済みのセッションを複数並べて開き、それぞれに同じ変更を加えます。[Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together)をご覧ください。
:::

Booklet、Print Sheet、Lolly Doc Studio、Lolly Markdown Slidesなど、複数のページを持つツールでは、PNG、JPG、WebP、SVGなどの単一画像形式は、1ページにつき1ファイルとして書き出されます。複数ある場合はZIPにまとめられます。Print Sheetは、シート全体とカットマークを、選択したDPIで保持します。

**Projects**の**Render folder**は、フォルダとサブフォルダにあるすべての保存済みセッションを、入れ子構造の1つのZIPに書き出します。**Render selection**は、複数選択した項目に同じ処理を行います。各保存済みセッションは、それぞれ独立したファイルにレンダリングされます。Projectsでは、保存済みセッションをツールのリンクとして再共有することもでき、そのリンクを開くと同じ設定でセッションが再開します。

<!--i:eti-pen-->
## 他のアプリで編集を続けられるファイル

形式によっては、作品を画像としてではなく、編集可能な内容として他のアプリに渡せます。

### PowerPoint (PPTX)

Lolly Design、Lolly Markdown Slides、Booklet、Lolly Doc Studio、Lolly Chart、Diagrams、Flow Chart、Agendaは、1ページを1スライドにしてPowerPointデッキを書き出します。各ページは、同僚が編集したり取り出したりできるネイティブのオブジェクトに分かれます。

- <!--i:font--> **テキスト**は、レイアウトのフォントサイズ、色、太さ、イタリック、配置を保った、編集可能なPowerPointのテキストボックスになります。Lolly Designのデッキでは、スライドマスターがなくても、すべてのテキストランにブランドの書体を設定します。
- <!--i:pentool--> ロゴやアイコンなどの**ベクター**はSVG画像として埋め込まれ、PowerPointで*Convert to Shape*を実行できます。
- <!--i:photos--> **画像**は、元の解像度の独立した画像として渡されます。切り抜いたヒーロー画像も、切り抜きの背後に画像全体が残ります。画像に適用したフィルターや描画モードは、画像に焼き込まれます。
- <!--i:layers--> **背景、枠線、罫線**は、長方形や線の図形になります。Lolly Designの円、楕円、ピルは、ネイティブの編集可能な図形のまま残ります。

![PowerPointを選んだ書き出しパネル: 各ページが1スライドになり、テキストと図形は編集可能なまま残る](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

レイアウトは近似です。複雑なフィルターやマスクを使った領域など、ウォーカーがネイティブで表現できないものは画像として埋め込まれます。デッキのスライドサイズは1つで、最初のページから決まります。

PowerPointから取り込むこともできます。[デッキをリブランドする](/info/rebrand.html)ではデッキに自分のデザインシステムを適用し、[デザインをインポートする](/info/design-import.html)ではLolly Designでデッキを開きます。

### Penpot

SVGを書き出せるツールの多くは、**Penpotファイル**(`.penpot`)も書き出せます。

| 作成したもの | Penpotでの状態 |
|---|---|
| テキスト | 編集可能なテキストオブジェクト |
| 図形、パス、グラデーション、画像 | 編集可能なベクター図形 |
| デザインシステムのトークンに由来する色やフォント | 有効なトークンリンク。トークンを編集すると、それを継承するすべての図形が追従します |
| デザイン全体 | Assetsパネル内の再利用可能なコンポーネント |
| 複雑なイラストやライブキャンバス | 埋め込み画像。周囲の内容は編集可能なままです |

Lolly Designから書き出すと、各フレームはPenpotのボードになります。デザインシステムの色とタイポグラフィはAssetsパネルに、トークン一式はTokensパネルに入ります。Penpotは独自のコピーを保持します。Penpotで編集したトークンは、[Lolly Design System Setup](/info/brand-studio.html)でインポートすると戻せます。

![Penpotを選んだ書き出しパネル: .penpotファイルと、ダウンロードの横のSend to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

ファイルを開くには、Penpotを起動してプロジェクトを選び、**Import**を選びます。書き出しパネルからPenpotにサインインした場合は、**Send to Penpot**でファイルをインポートできます。

### Word、OpenDocument、InDesign

**Lolly Doc Studio**は、段落と見出しを編集できる**Word** (DOCX)と**OpenDocument** (ODT)を書き出します。Wordファイルは、ドキュメントのスタイルを通じてブランドのフォントと文字色を設定し、選択したページサイズを使います。SVGを描画できないアプリ用に、SVGロゴに加えてPNGも含めます。

**Lolly Design**は**InDesign IDML (static subset)**を書き出します。テキスト、長方形、楕円、PNGまたはJPEG画像を含み、アートボードごとに1つの見開きになります。対応するインライン書式は編集可能なままで、画像は`Links`に含まれ、座標はInDesignのポイントに変換されます。再リンク、フォントの置換、折り返しの変化への対応が必要になる場合があります。エフェクト、アニメーション、組版されたストーリー、未対応の形状があると、書き出しは停止し、それらを列挙したレポートが表示されます。IDMLは元のドキュメントを保持しません。完成したアートワークはPDFで送ってください。

### タイムライン: dotLottieとPremiere

Lolly Designのタイムラインから、**dotLottie**はLottieツールで編集できるアニメーションを書き出します。保持される内容は[Lottieアニメーション](/info/sequence-editor.html#lottie-animations)に記載しています。**Premiere XML + media**は、時間指定されたクリップと元のメディアをPremiere用にまとめます。[Premiere XMLの交換](/info/sequence-editor.html#premiere-xml-exchange)をご覧ください。

### SCORM(コースパッケージ)

Settings → Preferences → Feature flagsで**Training and courses**をオンにするまで、コースの書き出しは無効です。

次に、対応するツール、プロジェクトフォルダ、または選択範囲から**Export course**を選びます。Lolly Designでは、**SCORM (LMS)**を選んで**Download**を押すと、同じコースのワークフローが開きます。Lollyは作品を保存し、確認用にコースの内容と順序を表示してから、モジュールとその書き出しダイアログを開きます。

- <!--i:layers--> 各ソースの出力形態を選びます。静止ページ、モーションを動画にしたもの、音声、ダウンロード可能なリソースから選べます。モジュールにレッスン本文と、代わりに読めるテキストを追加します。
- <!--i:clock--> 学習者用プレーヤーをプレビューし、説明とキャプションを確認します。無音のアニメーションを含め、モーションは動画として組み込まれます。
- <!--i:document--> Website、SCORM 1.2、SCORM 2004 4th Edition、実験的なxAPIターゲットから選びます。内容とZIPのサイズを確認し、確認済みのバージョンを保存してダウンロードします。
- <!--i:check--> 修了するには、すべての必須レッスンを確認済みにして、Finishを選ぶ必要があります。

![Lolly DesignのデッキでSCORM (LMS)を選択した書き出しパネル](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

パッケージには完成した内容が含まれ、Lollyアカウントは不要です。WebsiteのZIPはHTTP(S)ホストに配置し、LMSのZIPは変更せずにインポートします。コースを共有する前に、配信先でテストしてください。複数の保存済み作品からコースを作る場合は、[研修コースを作成する](/info/training-creators.html)をご覧ください。

### 放送用字幕

Captionsツールは**TTML**と**SCC**も書き出せます。どちらもSRTやVTTファイルと同じキュー一覧から生成するため、文言と時刻が一致します。

- **TTML**はIMSC1.1 Text Profileを使用し、メディア時間の時刻と、下部中央の1つの領域を持ちます。Lollyのキャプションは開始、終了、テキストのみを保持するため、キャプションごとの色、フォント、位置は含まれません。
- **SCC**は、チャンネル1のCEA-608ポップオン字幕を、ドロップフレームタイムコード付きの毎秒29.97フレームで記録します。北米の基本文字に加え、特殊文字と拡張文字に対応します。キャプションに文字セット外の文字があると、書き出しを停止して、その文字を知らせます。各キャプションは32列で折り返され、最大15行です。開始時刻までに読み込めないキャプションは、数フレーム遅れます。
- ロールアップ字幕とペイントオン字幕は書き出されません。

::: note SCCは放送用ツールで未確認です
ハードウェアデコーダーでも試していません。納品前に、ご自身の処理工程でファイルをテストしてください。
:::

### DXF(カット用ファイル)

Lolly Asset Export、Diagrams、Growth、Lolly Logo Wall、QR Code、Street Map、Wayfinding、Wordmarkは、レーザーカッター、ビニールプロッター、CNCソフトウェアが読み込めるAutoCAD R12交換形式の**DXF**を書き出します。形状はミリメートル単位のアウトラインパスとして書き込まれ、テキストもアウトライン化されます。色は最も近いAutoCAD Color Indexに対応付けられ、通常はその値でカッターの動作が決まります。DXFは線画専用です。写真やフィルターを使った領域にはカットパスがないため、警告とともに除外されます。ラスターの内容を残すにはSVGかPDFを使ってください。[フォールバックフォント](/info/fallback-fonts.html)を含め、どのフォントも対応していないテキストがあると、書き出しは停止し、そのテキストを引用したメッセージが表示されます。

Street Mapのデザインはすべてストロークなので、すべての道路と運河がカットパスになります。

::: showcase
![クリーム色の背景にインクで描いたパリのStreet Mapのレンダリング。純粋な線画なので、カッターに渡してもすべてのストロークが保たれる](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

スクロールすると、カメラが形状から引いていきます。パスは7つ、ピクセルはありません。カッターも同じファイルを読み込みます。
:::

<!--i:eti-stamp-->
## 印刷

**Print PDF**は、指定した印刷条件に合わせてCMYKを書き込みます。既定は**Coated FOGRA39**です。測定済みのインク値を持つブランドのスウォッチは、その値を保ちます。それ以外の色は印刷プロファイルを通じて変換します。既定ではLolly独自のCoated FOGRA39プロファイルを使い、自分のプロファイルの**Embed**行を選んだ場合はそのプロファイルを使います。グレーと黒は黒版だけに残るため、小さな文字に見当ずれが起きません。FOGRA51、SWOP、GRACoLは標準のデバイス変換を使います。黒い文字は下の色にオーバープリントされるため、印刷機でわずかなずれがあっても文字の周囲に白い縁が出ません。**Print TIFF**は、RIP用のDeviceCMYKピクセルを書き込みます。両方ともColour profileコントロールに従います([カラープロファイル](#colour-profiles))。Print TIFFと**EPS (CMYK)**は、Print PDFと同じ印刷プロファイルを通じて色分解します。

印刷形式には、**Print marks & bleed**専用のカードがあります。ミリメートル単位の塗り足しと、Crop、Registration、Bleed、Colour bars、Stamp detailsを設定できます。Stamp detailsは余白に日付、ツール、名前を印刷します。アラビア文字、中国語、キリル文字、絵文字など、余白のフォントにない文字を名前やツール名が含む場合は、同じグレーの画像として描かれます。書き出しカードには、該当する文字体系が表示されます。

*Booklet*などのツールは、表紙、必要なページ数に流し込まれる本文、裏表紙からなる**複数ページのPDF**を作ります。各ページは、A4、US Letter、A5の実際の縦向きPDFページです。どのブロックも、新しいページから始めるよう指定できます。これらはトンボや塗り足しマークのないRGBドキュメントです。そのようなマークは単一ページのPrint PDFで使います。Lolly DesignのPDFでは、スライドごとに縦向きのページを作り、その下にスピーカーノートを置く**Notes handout**も選べます。

**書き出す前。** パネル下部の**Before you export**カードには、印刷所が確認する内容が表示されます。形式、サイズ、塗り足し、仕上がり領域と塗り足し領域、インク使用率、版数、ページ数が並び、見出しの横に判定が示されます。このカードが書き出しを止めることはありません。Lolly Designではこのカードが常に表示され、デザインシステムに設定された組織のルールをレイヤーごとに確認した結果や、ドキュメントのテキストの文章に関する指標など、独自のチェックが含まれます([書き出す前に](/info/design.html#before-you-export))。Lolly Designでは、**Print preflight**をオンにすると、これらの印刷チェックが追加されます。他のツールでは、Settings → Preferences → Feature flagsで**Print preflight**をオンにします。既定ではオフですが、Lolly Workのデプロイ環境ではメンバー向けに有効にできます。

**書き出した後。** Lollyは完成したファイルを読み戻し、選択した設定と照合します。形式、ピクセルサイズまたはページサイズ、クリップの長さ、背景の透明度、CMYKカラー、HDR、Content Credentials、PDFまたはZIPのパスワードが対象です。相違点はすべて書き出しカードに記載されます。各測定値は設定値ではなく、ファイルから取得します。ファイルから確認できない属性は、一致とは数えません。コマンドラインでは、`--export-report`で比較結果の全体を書き出せます([CLIでレンダリングする](/info/cli-rendering.html)をご覧ください)。

::: details コマンドラインでのPDFアクセシビリティチェック
**PDFアクセシビリティチェック。** PDFの場合、コマンドラインは`--export-report`ファイルの`pdfAccessibility`に、32項目のアクセシビリティチェックも出力します。各チェックには、ID、平易な説明、結果、ファイル内で問題が見つかった場所が含まれます。

- **Passed**: 対象を確認し、問題は見つかりませんでした。
- **Failed**: 問題が見つかりました。該当するページ番号やタグが列挙されます。
- **Not applicable**: 表がないファイルに対する表のチェックなど、確認する種類の対象がファイルにありませんでした。ファイルの状態を評価する結果ではありません。
- **Needs a person**: 6項目はプログラムでは判断できません(読み順、色のコントラスト、点滅、スクリプト、時間制限、繰り返されるリンク)。

この一覧は判定ではありません。PDFがPDF/UAに適合することや、支援技術を使う人がそのPDFを利用できることを示すものではありません。人がスクリーンリーダーでファイルを確認する必要があります。現時点では、書き出し処理がまだタグを書き込まないため、Lolly自身のPDFもタグのチェックに不合格となります。チェックはお使いのデバイス上でファイルを読み、何も変更しません。パスワードが必要なファイルは、合格ではなく未チェックと表示されます。受け取ったPDFを確認するには、[Lolly Strip Hidden Data](/info/utilities.html)にドロップしてください。**PDF accessibility checks**に同じ一覧が表示されます。
:::

Lolly Designのインスペクターのチェックと、Lolly Design System Setupのブランド比較は、デザインを調べます。この2つのカードはファイルを調べます。

::: details 料金表からの費用計算
プリフライトの下では、費用カードが同じ数量を金額に換算します。プリフライトカードがオフでも動作します。必要なものは2つです。料金表で価格を付けられる作業(版、用紙、面積、ページ、バリエーションの行、出力ファイルが対象で、単純なロゴのPNGではカードは表示されません)と、印刷会社が提供するJSON形式の価格一覧である**料金表**です。既定のビルドには料金表が含まれず、アプリ内から読み込む方法もありません。料金表は、デプロイ環境に同梱されるカタログアセットとして、またはセルフホストの運用者やコントロールプレーンが有効にする任意の料金表拡張を通じて届きます。料金表がなければ、何も表示されません。

各金額は、入力した単価にLollyが数えた数量を掛けたものです。例として`4 plate × €35.00`があります。合計には、根拠として料金表の発行者と単価の日付が表示されます。既定の通貨も仮の価格もありません。ファイル自体に関する記述は、伝聞の形を保ちます。*「ファイルの記載: … Lollyはこれを検証していません。」*

金額を算出できない場合は、表を埋めるのではなく、表を非表示にします。

- 料金表に価格のない項目があると、**合計は一切表示されず**、価格未設定の項目数を示す見出しだけになります。
- 数量が上限の場合、小計にも**「最大」**を付けます。
- 有効期限を過ぎた単価では、*Use these rates anyway*を押すまで**数量のみ**を表示します。押した後も、金額に有効期限が併記されます。
- **リンク**から開いた場合、このデバイスで表示を求めるまで金額は非表示です。CLIは`--rate-card=<file.json>`をローカルファイルとして受け取り、リンクのパラメーターとしては受け取りません。

カードは書き出しのすべての段階で除外され、ファイルを変えることはありません。これは算術計算であり、見積もりではありません。見積もりを出せるのは印刷会社だけです。
:::

<!--i:eti-film-->
## モーションと音声

### 動画

アニメーションを扱うツールは、**MP4**と**WebM**を書き出します。共有された`?format=`リンクが、このブラウザで作成できないコンテナを指定している場合は、もう一方のコンテナに切り替わり、ファイル名もそれに合わせます。**Start after**はキャンバスを静止させ、アニメーションとフォントが落ち着いてから録画を始めます。**Duration**は完成するクリップの長さを設定します。**Motion blur**(Off、Draft quality、Standard、Highと**Shutter angle**)は速い動きをぼかし、レンダリングにかかる時間を長くします。ブラウザが対応していれば、**Record live**は画面共有を通じて、画面上のプレビューをリアルタイムで録画します。

![アニメーションの書き出しのタイミング設定: Start after、Duration、Shutter angle付きのMotion blur、Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality**ではSmaller file、Balanced、Best qualityを選びます。**Advanced**を開くと、**Codec**、**Frame rate**、**Rate mode**、**Hardware acceleration**が表示されます。ツールにキャプションがある場合、**Captions**で**Embedded track**、または動画に添える**Sidecar .vtt + .srt**を選びます。リンクでは、品質、コーデック、フレームレート、長さ、開始までの待ち時間を、`vq`、`codec`、`fps`、`seconds`、`wait`として含めます([URLパラメーター](/info/url-parameters.html))。

動画の書き出しには音声も残ります。ツールはクリップに**BGM**を重ねられます。音声アセットをクリップの長さに合わせてループまたはトリミングし、フェード、音量、映像自身の音声に合わせたダッキングを設定します。録音・録画ツールは、ライブ音声をファイルに含めます。

Lolly Designのクリックで進めるデッキも動画として書き出せます。Presentメニューの**Export slides as video**は、MP4を選択した書き出しシートを開きます。各スライドは個別に設定した表示時間だけ再生され、未設定なら書き出しシートのDurationを使います。スライド間では、デッキのスライドトランジションがディゾルブとして再生されます。ドキュメントは変わりません。

時間指定のあるLolly DesignドキュメントやSnippetからの**HTML**は、1つのファイルに収まるプレーヤーです。アニメーションの上に再生、シーク、音声のコントロールが付き、対応するフォント、画像、音声が埋め込まれます。ファイルはオフラインで再生できます。シーンのあるLolly Designの映像には、シーンのメニューも付きます。動画、Lottie、3Dのクリップを含むシーケンスは、まだHTMLとして書き出せません。動画として書き出してください。

### アニメーション画像

**GIF**はどこでも再生でき、チャットやメールに適しています。動画より大きく、色数は少なくなります。**APNG**と**Animated WebP**はフルカラーと透明度を保ちます。**Lottie Ad**は**Animated SVG**も書き出せます。CSSキーフレームを埋め込んだベクターのフレームで、任意のサイズに拡大縮小でき、ブラウザのタブや`<img>`でコーデックなしでループ再生します。テキストはアウトライン化されます。各フレームがビットマップより重いため、既定のフレームレートは低めです。いずれも音声はありません。

### 音声

音声だけを書き出せるツールもあります。**Lolly Voice Recorder**は、ライブのレベルメーターを表示しながらマイクで録音し、お使いのデバイス上でエンコードして**MP3**、**WAV**、**M4A (AAC)**、**Opus (WebM)**として保存します。`wav`、`mp3`、`m4a`、`opus`は通常の形式IDなので、音声の書き出しもPNGと同様に共有でき、スクリプトから扱えます。

アセットピッカーは、BGM用にMP3やFLACからMIDIやトラッカーモジュールまで、多くの音声形式を受け付けます。一覧は[形式](/info/formats.html)にあります。[Lolly Rondocodeの曲](/info/rondocode.html)は、クリップで指定した長さで再生されます。

<!--i:eti-palette-->
## 色とHDR

Lollyは最新のCSSの色をすべて読み取り、知覚に基づいて色を計算し、読み取り側が開ける色空間で各ファイルを書き込みます。画面用はsRGB、印刷用はCMYK、HDR用はRec.2100 PQです([エンジン内の色](/info/colour-engine.html))。**Wide colour / HDR**に設定したLolly Designドキュメントには、独自のルールが適用されます。[広色域とHDRの編集](/info/hdr-editing.html)をご覧ください。

### カラープロファイル

書き出すファイルにはカラープロファイルが付くため、印刷所で使うアプリ、Photoshop、ブラウザなど、色管理に対応するアプリは、見えていたとおりの色として読み取れます。サムネイルとプレビューは、サイズを抑えるためにプロファイルを付けません。

- **PNGとJPG**には、プレビューの描画に使う色空間である**sRGB**のICCプロファイルが埋め込まれます。ピクセルにタグを付けるだけで、再エンコードはしません。
- **Print PDF (CMYK)**は、*OutputIntent*に印刷条件を宣言し、CMYKインクをどう解釈すべきかを印刷所に伝えます。
- **Print TIFF (CMYK)**は、タグのないDeviceCMYKピクセルを書き込み、TIFFメタデータに印刷条件を記録します。TIFFには印刷プロファイルを埋め込めないため、**Embed**行を選んでも記録されるのはプロファイル名だけです。
- **TIFF (RGB)**は、保存用やエディターとの往復用の非圧縮sRGB版です。ブラウザではTIFFをプレビューできないため、どちらのTIFFもデスクトップ専用です。
- **SVG**、**EMF**、**EPS**、**DXF**はプロファイルを埋め込まないベクターです。SVGの色はsRGB、EMFとEPSはデバイスRGB、**EPS (CMYK)**はDeviceCMYKを書き込み、DXFはAutoCAD Color Indexを使います。SVG、EPS、DXFはテキストをパスにアウトライン化します。EMFはOfficeやGoogle Slidesでテキストをライブで編集可能な状態に保ち、その形式で表現できないテキストランだけをアウトライン化します。書き出しパネルの**Outline fonts**オプションは、リンクの`_text=outline`やコマンドラインの`--text=outline`と同じく、すべてをパスにします。SVGはCSSの内側と外側のボックスシャドウも再現します。

::: details PDF/X-4と独自の印刷プロファイル
Lollyには、FograのFOGRA39特性データに合わせて作成し、CC0で公開したCMYKプロファイルが1つ同梱されています。既定の印刷条件では、このプロファイルで色を変換します。このプロファイルはICCバージョン4.3で、PDF/X-4が受け入れるのは4.2までのため、埋め込まれません。そのため、名前付きの印刷条件では、PDF/X-4への適合を宣言せずに出力インテントを書き込みます。

独自のCMYKプロファイルを読み込み、Colour profileコントロールでその**Embed**行を選びます。プロファイルはファイルの*DestOutputProfile*として埋め込まれ、ファイルの残りの部分が許す場合にPDF/X-4への適合が宣言されます。宣言する印刷条件は、そのプロファイルから読み取ります。登録名がプロファイルで確認できればその名前を使い、それ以外はプロファイル自身の名前の下に`Custom`を使います。

出力インテントを保ちつつ適合の宣言を控える要因は3つあります。CMYK処理で変換できなかったRGBアートワーク、`prov`の校正用余白のクレジットテキスト(埋め込まれていない標準フォントで描画)、そして**Strong**パスワードです。PDF/X-4は暗号化を禁止しているためです。すべてのPDFには、ページボックス、XMP、ドキュメントID、プロファイル付きのsRGB出力インテントというPDF/X-4メタデータも含まれます。
:::

### 特色インクをプロセスカラーで印刷する

デザインシステムは、色にPantoneやHLCなどの特色インクを指定できます。その場合、**Print PDF**はその色を専用の版で印刷します。Lolly Demoは、白のSugarとDaylight、黒のVoidを除くすべての色に特色インクを指定しています。Lolly Demoで作ったPrint PDFは、ほとんどの色を特色版で、黒を墨版で印刷します。

通常の4色のファイルにするには、書き出しパネルのProfileカードで**Print spot inks as process**にチェックを入れます。各特色インクは、デザインシステムがその色に指定したCMYKの配合を使い、シアン、マゼンタ、イエロー、ブラックで印刷されます。独自の配合がない色には、アートワーク内の他の色と同じように、印刷プロファイルの変換が適用されます。これで、ファイルには4つのプロセス版だけが含まれます。この選択肢は既定ではオフです。チェックボックスは**Print PDF**でのみ、かつデザインシステムが色に特色インクを指定している場合にのみ表示されます。

加工はインクではありません。箔押し、エンボス、デボス、部分ニス、ソフトタッチ、型抜き、筋入れ、ミシン目は、チェックを入れてもそれぞれの名前付きの版を保持します。加工をプロセスカラーで印刷すると、その黒いマスクがページに印刷されてしまうためです。

**Before you export**カードと`lolly preflight`は、ファイルに含まれる版を数えます。チェックが入っている場合、4つのプロセス版と加工版を数え、特色インクはプロセスカラーで印刷され、版は追加されないと伝えます。チェックが入っていない場合、デザインシステムが指定する特色インクごとに、最大1つの特色版を数えます。料金表はこの数に基づいて料金を計算するため、ファイルに含まれない特色版に料金を付けることはありません。

**Print TIFF**と**EPS (CMYK)**には名前付きの版がないため、この選択にかかわらず、すべてのインクをプロセスカラーで印刷します。この2つの形式では、カードと`lolly preflight`は4つのプロセス版を数え、特色版や加工版を数えることはありません。加工は黒いマスクとして墨版に入り、カードはこれをエラーとして報告します。

リンクでは`_spots=process`、コマンドラインでは`--spots=process`、[MCPサーバー](/info/mcp.html)では`spots: "process"`、ターミナルアプリでは**Spot inks**行で、同じファイルを指定できます。この選択についての情報はファイルには含まれず、インクだけが変わります。

### HDR (明るい色)

書き出しパネルの**HDR**カードは、通常のアートワークをHDR画面向けに明るくします。編集を通してHDRの原本を保持するには、[広色域とHDRの編集](/info/hdr-editing.html)をご覧ください。

通常の書き出しはsRGBです。彩度の高いブランドカラーの明るさは、画面の通常の白と同じです。HDRディスプレイはそれより明るく表示できます。**HDR**カードは、ブランドカラーと白いテキストをピーク輝度に向けて引き上げます。暗い部分は暗いままです。

![書き出しパネルのHDRカードをオンにし、その下にWhite / Reach / Dark lift / Focusのダイヤルを表示した状態](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **形式。** PNG、JPG、AVIF、TIFFです。WebPは8ビットで、動作するHDRデコード経路がなく、ベクターとPDFにはHDRモデルがありません。
- **既定ではオフです。** ピクセルを変更するためです。カードにチェックを入れるか、共有リンクに`hdr=1`を渡します。
- **ダイヤル。** **White** (ピーク輝度の上限、400〜2000ニト)、**Reach** (明るさの引き上げをどこまで暗い階調に広げるか)、**Dark lift** (暗部をどれだけ明るくするか。`0`なら暗いまま)、**Focus** (引き上げ時に色の豊かさをどれだけ保つか)があります。これらは1つの値で渡されます。`hdr=1600-60-0-50`は、White 1600、Reach 60、Dark lift 0、Focus 50です。
- **書き込まれる内容。** PNGには、`cICP`チャンク付きの16ビットRec.2100 PQが書き込まれます。JPGはISO 21496-1ゲインマップJPEGで、通常のSDR画像にゲインマップが付加されます。AVIFは`colr`ボックスが書き換えられます。TIFFには、`cicp`タグを持つ生成されたICC v4プロファイルとともにPQピクセルが書き込まれます。TIFFは黒の上に平坦化されます。PQでは白が10,000ニトのコードであり、すべての縁の周りに光輪ができてしまうためです。引き上げは知覚的な明度(OKLab)に従い、色相を保つため、ブランドの緑はミント色になることなく明るくなります。
- **明るさが表示される環境。** HDRディスプレイ上のカラーマネジメント対応ビューアーです。AppleデバイスのPreview、Quick Look、Safari、またはHDRモニター上のChromeが該当します。SDR画面では通常の画像が表示されます。
- **ターミナルから。** [CLI](/info/cli.html)で`--hdr=1`と`--export=png`または`--export=jpg`を使うと、ブラウザなしで、同じエンジンのエンコーダーから同じPNGとゲインマップJPEGを書き出します。AVIFとTIFFは、今のところWebからの書き出しのみです。

::: warning 多くのプラットフォームはHDR信号を取り除きます
アップロードを再エンコードするプラットフォームでは、画像が暗くなったり、色が薄くなったりすることがあります。自分のサイト、ビデオウォール、明るいパネルで表示するデッキなど、表示先を管理できる場所でHDRを使ってください。
:::

<!--i:eti-badge-check-->
## ファイルに含まれるもの

完成したファイルには、複数の記録を含められます。ピクセルとは別に保持され、ファイルの再保存、スクリーンショット、メタデータの除去によって消えるものもあります。2つの印はピクセル内に存在します。

::: figure exporting-what-travels
各記録が存在する場所、既定でオンかどうか、それぞれを制御するリンクパラメーター。
:::

書き出しパネルでは、**Licence**、**Source credits**、**Password**、**C2PA Credentials**、**Lolly Imprint**、**Durable credential**が1つの**Content protection**グループにまとまり、選んだ形式で使えるカードだけが表示されます。リンクやドキュメントですでにライセンスが宣言されている場合や、出典について判断が必要な場合、グループは自動で開きます。**Design system**カードはグループの外にあり、どの書き出しでも表示されます。

![PNGの書き出しでContent protectionグループを開いた状態。該当するカードだけが表示される](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 来歴 & 透かし

形式に該当するフィールドがある場合、書き出しには**来歴メタデータ**が含まれます。ソフトウェア、ソース、ツール名、プロフィールのクレジット行が、PNGのiTXt、JPEGのEXIF、PDFのinfo、SVGの`<metadata>`、GIFのコメントに書き込まれます。記録するのは作者の情報だけです。何もアップロードされません。**Experimental**ツールは、目に見える透かしも付けます。透かしはホストが適用するため、ツールを編集しても取り除けません。

**Lolly Imprint**は、目に見えないピクセルの透かしで、**既定でオンです**。再圧縮しても残るため、コピーでもLolly製であると認識できます。これは手掛かりであり、暗号学的な保証ではなく、個人データも含みません。JPEG XL、PNG、JPG、WebP、AVIF、TIFF、BMPと、LollyがPDFやPPTXにレンダリングするラスターに書き込まれ、埋め込んだ画像には書き込まれません。Imprintを含めない場合は、**Lolly Imprint**のチェックを外すか、`imprint=0`を渡します。AVIFでの再エンコード後の残存性は、まだ調整されていません。[Lolly Verify](/#/verify)はお使いのデバイス上でImprintを検出します。[Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)をご覧ください。

**Durable credential**は、デバイス上のニューラルモデルで、TrustMark形式を使ってLollyのidをピクセルに書き込みます。これにより、「Lollyで作成」のつながりがメタデータの除去や再エンコード後も残り、TrustMark対応ツールで読み取れます。書き出しごとにニューラル処理が1回必要で、モデルの初回ダウンロードも必要なため、**既定ではオフです**。PNG、JPG、WebP、AVIF、TIFFに対応しています。パネルでチェックを入れるか、`durable=1`を渡します。デスクトップアプリとモバイルアプリでは、オフラインでモデルを取得するオリジンがないため、このカードは表示されません。

**Licence。** 他の人が作品をどう利用できるかを選びます。既定は*None (all rights reserved)*で、CC0 1.0、Public Domain Mark 1.0、Creative Commons 4.0ライセンス(BY、BY-SA、BY-NC、BY-NC-SA、BY-ND、BY-NC-ND)を選べます。ライセンス名とその要約へのリンクが、ファイルのライセンスメタデータ(形式に存在する場合はEXIF、XMP、RIFF)とContent Credentialに入ります。この選択はドキュメントに保存され、リンクでは`licence=`で渡されます。Lollyは選んだライセンスを書き込みます。Lollyが条項を確認したり、その遵守を強制したりすることはありません。Claimなど、独自のライセンスフィールドを持つツールは、代わりにそのフィールドを保持します。

### デザインシステムの記録

書き出しは、ファイルを作成したデザインシステムを記録します。その名前、描画元の公開バージョン(作業中のバージョンではない場合)、描画に使った[カラーウェイ](/info/colourways.html)です。密度など、デザインシステムが宣言するその他のテーマの選択も同じように記録されます。ライトかダークかの選択は、画像自体で分かるため含まれません。

**書き込まれる前に記録を確認できます。** 既定でチェックが入っている**Design system**カードには、*Records: Acme · Colourway: Beach*など、ファイルに含まれる正確な文言と説明が表示されます。デザインシステムの名前は所有者が入力したもので、カードにはそのまま表示されます。その書き出しに記録を含めない場合は、カードのチェックを外します。Lolly Designのドキュメントパネルでは、*Embedded in exports*の下に同じ文言が表示されます。

**説明にはツールの横にカラーウェイが記載されます。** カードにチェックが入っていると、*"Made with https://lolly.tools : Chart"*は*"Made with https://lolly.tools : Chart (Beach colourway)"*になります。デザインシステム自体の名前は記録に残り、説明には入りません。ツール名のない説明や、ツールが独自の入力から書いた説明は変わりません。`tokenAxes`でカラーウェイを無視するツールはカラーウェイを記録せず、PDF校正のクレジット(`prov`印刷マーク)も同じ規則に従います。

::: details 記録に含まれるブランドスキル、ブランドページ、パートナー企業
**エージェントの指針となったブランドスキル。** エージェントが作品を作成し、読んで従った[ブランドスキル](/info/brand-skills.html)を明示した場合、記録には*Guided by: acme-brand 1.0*のように、各スキルとそのリビジョンも一覧で含まれます。この文言は、そのスキルが作業の指針になったことを意味します。Lollyが作品をスキルに照らして検証することはありません。一覧が追加されるのは、エージェント自身が申告した場合だけです。現在、これは[MCPサーバー](/info/mcp.html)の`lolly_render`の`brandSkills`引数に当たるため、アプリや共有リンクで作った作品には含まれません。Content Credentialは一覧を`brandSkills`として保持します。各スキルのid、名前、リビジョン、SHA-256ハッシュを含む1つのJSON値です。XMPパケットとSVGメタデータは、同じ値を`lolly:BrandSkills`として保持します。記録から書き出されるPDFには、スキルごとに1つのキーワードが加わります。説明は変わりません。内部スキルのテキストが記録されることはありません。同じスイッチで、記録の残りとともに一覧を除外できます。**Design system**カード、`_madewith=0`、`--no-madewith`、`madeWith: false`です。MCPサーバーがブラウザでファイルを描画する場合(PDF、JPEGなど、ブラウザを使わない経路では書き出せない形式)、ファイル自体のメタデータには一覧が含まれません。その場合、一覧を保持できるのはContent Credentialだけです。記録を残すには`c2pa`を渡します。クレデンシャルがない場合、レンダリング時にブランドスキルが記録されなかったことを警告します。

**公開者が有効にした場合のブランドページ。** デザインシステムの公開者は、書き出しに[ブランドページ](/info/brand-page.html#lead-back-from-your-files)のアドレスを記録するかどうかを選べます。設定はデザインシステムごとで、既定ではオフです。有効にすると、カードは*Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*のように、同じ行にアドレスを追加します。カードのチェックを外すと、他の記録とともにアドレスも除かれます。記録に含まれるのはアドレスだけで、ページについての他の情報は含まれません。ファイルの他の部分は変わりません。アドレスのないデザインシステムは、従来と同じファイルを書き出します。

**アドレスはパックには引き継がれません。** 署名済みファイルの記録は、署名者自身の記録と見なされます。アドレスを選んでいない人のために、そのアドレスの記録が自動でオンになってはならず、パックが他の人のファイルを自分の選んだページに誘導できてはなりません。`.lolly`パック、デザインシステムのコピーやフォーク、**Try these colours**、復元されたバックアップ、1回の実行用に渡されたトークンファイルは、いずれも設定がオフの状態で取り込まれます。自分でアドレスを入力して、設定をオンにできます。管理対象のデザインシステムだけは例外で、管理者がソーストークンに設定したアドレスを保持します。詳しくは、[ファイルからリンクを戻す](/info/brand-page.html#lead-back-from-your-files)をご覧ください。

**Lolly Workのパートナープログラムにおけるパートナー企業。** パートナー企業向けに作った作品は、*Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*のように、同じ行に企業とプログラムを記録し、ファイルには企業情報のリビジョンも含めます。記録には、個人、連絡先情報、住所、通貨は含まれません。企業のパートナーキットが添付されている場合、行には*, kit revision 2*のようにキットのリビジョンが加わり、クレデンシャルにはキットのidとリビジョンが含まれますが、色や規則は含まれません。カードのチェックを外すと、他の記録とともにパートナーも除かれます。PDFには*Partner: Northwind IT*というキーワードが加わり、[Lolly Verify](/info/what-verify-checks.html#partner)は記録を**Partner**として表示します([ファイル内のパートナー記録](/info/manage/partner-programmes.html#the-partner-record-in-files))。
:::

**記録を読み戻す。** [Lolly Verify](/#/verify)は、ファイルのクレデンシャル詳細に、記録を**Design system**として、ブランドスキルがある場合は**Guided by**として表示します。ブランドページは、[署名者によるアドレスの記録](/info/what-verify-checks.html#brand-page)として独立して表示されます。*Recreate with these settings*は、記録されたバージョンとカラーウェイでツールを開き直します。このデバイスに同じidと名前のデザインシステムがあれば、リンクは記録されたデザインシステムで開きます。それ以外の場合は、有効なデザインシステムで開きます。

::: details 何がどこに書き込まれるか、どの実行で記録が省かれるか
| 場所 | 書き込まれる内容 |
|---|---|
| Content Credential | `tools.lolly.export`アサーション内の`designSystem` (id)、`designSystemLabel`、`designVersion`、`themes`。それぞれプレーンテキストの値で、`themes`は選択肢のJSONリストです。公開者が有効にした場合は`brandPage`も含まれます |
| PNG、JPEG、WebP、JXL | ファイルのXMPパケット内に、名前空間`https://lolly.tools/ns/export/1.0/`の`lolly:`プロパティとして同じ値が入ります。公開者が有効にした場合は`lolly:BrandPage`も含まれます |
| SVG | `<metadata>`ブロック内の同じ`lolly:`プロパティ |
| PDF | *Design system: Acme*、*Colourway: Beach*などのキーワードと、公開者が有効にした場合は*Brand page: https://acme.example/brand/acme/* |
| 説明フィールドがあるすべての形式 | ツールの横にカラーウェイを記した説明 |

カードが表示されるのは、記録する内容があり、その形式が記録を保持できる場合だけです。CSV、JSON、カレンダーファイルなどのテキストやデータの形式にはメタデータがなく、EPS、EMF、DXF、BMPには記録用のフィールドがありません。HTML、Markdown、CSSはContent Credentialにだけ記録を保持するため、これらの形式ではカードに説明行が表示されず、**C2PA Credentials**がオフの間はカードも非表示になります。デザインシステムが指定しないフィールドは、ファイルに含まれません。

共有リンクでは`_madewith=0`で記録をオフにします([URLパラメーター](/info/url-parameters.html))。コマンドラインは`--no-madewith`、[MCPサーバー](/info/mcp.html)の`lolly_render`は`madeWith: false`を受け取り、ターミナルアプリの書き出しパネルには**Design system**行があります。コマンドラインは、ツールのレンダリング時と、`lolly run`が保存済みLolly Designセッションから書き出す各ファイルについて、完成したファイルに含まれる文言を標準エラー出力に表示します。MCPのレンダリングでは、ファイルの横に文言を表示します。どちらもファイルから文言を読み戻します。コマンドラインがブラウザなしで描画するPNGにはファイルメタデータがないため、その記録はクレデンシャルだけに含まれます。デバイス上のユーティリティは、メタデータを追加しません。

**Design system**カードがない実行では、記録は省かれます。Lolly Batchの実行、Projectsからのフォルダの書き出し、3Dコレクションの書き出し、ターミナルアプリでのCSVバッチ、Projectsのフォルダや選択項目の書き出し、すべてをレンダリングするビューが該当します。デザインシステムを記録するには、ツールから1つのファイルを書き出します。
:::

### Content Credentials (C2PA)

書き出しには、**Content Credentials**を含められます。ファイルを何が、いつ、どこで作ったかを記録する署名付きの[C2PA](https://c2pa.org)マニフェストです。ファイルのバイト列のハッシュに結び付けられるため、その後の編集を検出できます。Lollyは、どのC2PAリーダーでも確認できる標準のマニフェストを書き込みます。

![チェックが入ったC2PA Credentialsカード。チェックボックスの横にクレデンシャルの有効期間が表示される](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **既定でオンです。** ほぼすべてのツールで、**C2PA Credentials**カードにチェックが入っています。1回の書き出しだけ無効にするにはチェックを外すか、リンクに`c2pa=off`を渡します。その場合、ファイルにはクレデンシャルが含まれず、カタログのロゴなど、クレデンシャル付きのアートワークをインラインで含むSVGでは、そのアートワークのクレデンシャルも失われます。Lolly Imprintとファイルの他のメタデータは残ります。ツールはマニフェストで適用を辞退できます。
- **形式。** PDF (RGBとPrint)、PNGとAPNG、JPG、GIF、SVGとSVGZ、TIFF (RGBとPrint)、WebP (静止画とアニメーション)、AVIF、MP4、WebM、HTML、Markdown、CSS、音声コンテナーのMP3、WAV、M4A、OGG/Opus、FLACです。ZIPは対応する各ファイルに付与し、Animated SVGもこの方法でクレデンシャルを取得します。MP4、AVIF、M4Aは標準のBMFFバインディングを、MP3はID3v2マッピングを使うため、`c2patool`などのリーダーで検証できます。WebMとOGG/Opusにはまだ標準のマッピングがないため、LollyはマニフェストをMatroskaの添付ファイルとOpusTagsフィールドに格納し、Lolly独自の検証機能で確認します。SVGZは圧縮されたSVGです。C2PA仕様には圧縮形式の定義がないため、クレデンシャルは圧縮前のSVGに書き込まれます。Lollyの検証機能はファイルをそのまま読み、`c2patool`はファイルを展開(`gunzip`)した後で同じクレデンシャルを読みます。ICO、EPS、EMF、DXF、BMP、PPTX、Office形式、その他のテキストやデータの形式には、C2PAコンテナーがありません。
- **記録する内容。** ファイルを作ったツールとアプリ、署名時刻、ファイルを書き出したシェルです。画像、SVG、PDFとして書き出したLolly Designのページでは、ページを描画したレンダラー(`tools.lolly.export`アサーションの`route`。GPUページレンダラーは`gpu`、ベクターとして書き込まれる描画操作は`operations`、ブラウザ独自のレンダラーは`compatibility`)と、そのレンダラーのバージョン(`renderer`。GPUレシピ、`design-draw-v`とそのバージョン、または`dom-to-image`と`dom-walker`)を記録します。**Design system**カードにチェックが入っている間は、[デザインシステムとカラーウェイ](#the-design-system-record)も記録します。有効な設定のうち、メニューの選択、数値、スイッチ、色はそのまま、入力された内容(タイトル、名前、メモ、リンク、日付)はフィンガープリントだけを記録するため、文言はファイルに含まれません。プロフィールに結び付いたフィールド、無効なコントロール、ブラウザのバージョン、OSの詳細は省かれます。名前とメールアドレスが作者として表示されるのは、Settings → Preferences → Your detailsの**Use my details to create**がオンのときだけです。書き出しに配置されるソースは、素材として含まれます。独自のContent Credentialを持つページ上の各画像は、ページの構成要素として、そのクレデンシャルと、そこで宣言されたAIソース種別とともに記録されます。これはPNG、JPEG、WebP、AVIF、TIFF、SVG、PDFに当てはまり、GIF、APNG、アニメーションWebP、MP4、WebMでも、書き出し範囲の少なくとも1フレームに画像が描画される場合に当てはまります。Darkroom、Filter、Asset Exportなどのツールが変更する1枚の画像は、代わりにファイルの親として記録され、まず開かれ、その後にツールが画像に行った操作が記録されます。他の素材には、絵文字などの[クレジット付きの作品](#source-credits)、動画や音声の書き出しに含まれる[Lolly Rondocodeの曲](/info/rondocode.html#songs-in-the-credential)、動画や音声の書き出しに含まれる[保存済みの曲](/info/generated-music.html#what-a-track-records)があります。保存済みの曲ごとに、名前、曲に記録されている場合はライセンス、レシピのSHA-256、エンジンのバージョン、アルゴリズムによるメディアであることが含まれます。保存済みの曲の制作者(保存時のプロフィール名)は、自分の名前と同じように、**Use my details to create**がオンの間だけ追加されます。書き出し前にパネルに制作者が表示されるのも、その場合だけです。
- **承認が記録されている場合の承認情報。** [Lolly Work](/info/work-approvals.html#review-an-exported-file)で承認されたファイルは、このクレデンシャルに対する2つ目の署名済み記録を持てます。承認id、判断の日付、審査されたファイルのダイジェストです。名前、メールアドレス、グループ、コメント、承認チェーン名は含まれません。申請ダイアログでは既定でチェックが入っており、1回の申請だけチェックを外すことも、インスタンス全体でオフにすることもできます。署名者が判断を表明したことを記録するもので、作品が何らかの基準を満たすことを示すものではありません。
- **[インテント](/info/visual-intent.html#what-goes-in-the-file)から作ったファイルで、何を求められたか。** 目的、表示面、ツール、言語、規則と語彙のバージョン、インテントのダイジェストです。機会、対象者、地域、プロンプトは、そのレンダリングを実行する人やエージェントがプロンプトの文言の記録を求めないかぎり、フィンガープリントのみです。この記録を持つのは、インテントから始まったレンダリングだけです。実行時に何を記録したかが示され、記録を省くこともできます。
- **受け取った人に見えるもの。** Adobeのアプリ、`c2patool`、contentcredentials.org/verifyなどのC2PAツールは、マニフェストを読んで申告を表示します。Lollyは信頼リストの証明書ではなく、デバイス上で作った鍵で署名するため、ビューアーは*未検証*のクレデンシャルとして報告します。構造と改ざんの検出は有効ですが、署名者を保証する人はいません。これを変えるには、Settings → Preferences → Content Credentialsで**verified identity**を登録します。[Content Credentialsの本人確認](/info/content-credentials-identity.html)をご覧ください。
- **ファイルを確認する。** 任意のファイルを[Lolly Verify](/#/verify)にドロップするか、`lolly validate <file>`を実行すると、Lollyが作ったファイルか、その後変更されたかを最初に示すレポートが、デバイス上で得られます。Lolly Verifyはクレデンシャル以外も確認します。[Lolly Verifyが確認する内容](/info/what-verify-checks.html)をご覧ください。
- **プライバシー。** 署名鍵は書き出しのために作られ、デバイスの外に出ることはありません。申告に含まれるのは、来歴メタデータにすでにある内容だけです。自分のファイルを変換するプライバシーユーティリティはクレデンシャルを追加せず、*Lolly Strip Hidden Data*は他のメタデータと同じようにC2PAマニフェストを削除します。Rondocodeユーティリティは新しい音声を作るため、書き出す内容に署名します([Lolly Rondocodeの曲](/info/rondocode.html#files-from-the-rondocode-utility))。音楽ジェネレーターは、ダウンロードするすべてのWAVやM4Aに署名します。クレデンシャルには、Lollyの音楽ジェネレーターがその曲を作ったことと、音楽に適用されるCC BY 4.0ライセンスがクレジットとともに記録されます([曲が記録する内容](/info/generated-music.html#what-a-track-records))。
- **他の機能との関係。** パスワード保護されたPDFには、どちらの強度でもContent Credentialsを含められません。クレデンシャルは、DPI、EXIF、カラープロファイル、PDF/Xメタデータ、印刷マークの後で、完成したバイト列に対して最後に追加されます。

### ソースのクレジット

他の人の作品を配置した書き出しは、そのソースをクレデンシャルに記録します。よくあるのは、選んだ絵文字セットの絵文字です。作品、制作者、ライセンス、正確なバイト列の入手元、変更内容が、すべてファイルに含まれます。SVGをテンプレートに使うツール内のテキストは、システム独自の絵文字を保持するため、そこにはクレジットが付きません。ダウンロード前に、**Source credits**行はソースが配布時に求める条件を示します。ダウンロード後は、配布されたバイト列を読み戻してから、クレジットがファイルに含まれていると伝えます。色を変更して共有しようとしているCC BY-SAの字形など、選択が必要なライセンスには、選択肢のカードが表示されます。ダウンロードが妨げられることはありません。[創作物の権利とクレジット](/info/creative-rights.html)では、文言、確認済みのライセンス、自分のものとして残る内容を説明しています。

<!--i:eti-lock-->
## パスワード保護

Lollyには2種類のロックがあり、どちらもデバイス上で行います。書き出しパネルの**Password**カードで両方を設定します。

![PDFの書き出しでPasswordカードを展開した状態。パスワード欄と2段階のロック強度が表示される](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDFを開くためのパスワード**は、入力すると2段階の強度を選べます。

- **Weak**: 40ビットRC4です。印刷マークや塗り足しのないRGBの`pdf`と、ASCIIのみのパスワードが対象です。他の文字が含まれるパスワードはStrongに切り替わります。この強度では、そのようにロックされたファイルをリーダーが開けないためです。先頭の32文字だけが使われます。
- **Strong**: AES-256 (PDF 2.0)です。Print PDFと、バッチZIP内の各PDFにも適用されます。StrongでロックされたPrint PDFは、CMYK、マーク、出力インテントを保持しますが、PDF/X-4の宣言は取り除かれます。

::: warning Weakは抑止であり、保護ではありません
機密ファイルには**Strong**を使ってください。
:::

**ロック付きZIP**は、ZIPの書き出し、Projectsからのフォルダのダウンロード、バッチに適用され、1つのパスワードで2段階の強度を選べます。**Weak** (ZipCrypto、抑止用)と**Strong** (AES-256)です。パスワードはすべての格納ファイルを保護します。中にあるPDFも、それ自体がAES-256でロックされるため、ZIPを展開した後もPDFのロックは残ります。ダウンロード開始時に入力を求められます。パスワードが空欄なら、ロックはかかりません。

**どちらの強度でも、入力したパスワードはリンクに含まれません。** `?password=`リンクからファイルを受け取る場合、Lollyは値を読み取り、直ちにアドレスから削除します。ファイルが対応できないロックをリンクが要求した場合、ファイルは書き出されず、その理由が表示されます([`password`](/info/url-parameters.html)をご覧ください)。

**パスワード付きの共有リンク**は、開く前に受け取った人にパスワードを求めます。リンクの状態は、パスワードから導出した鍵(PBKDF2)を使い、AES-256で暗号化されます。渡されるのは暗号文だけで、復号は受け取った人のブラウザで行われます。リンクを配信するサーバーがパスワードやデザインを見ることはありません。**Share**ダイアログでオンにします。暗号化されたリンクはLollyでのみ開き、埋め込み画像としては開けません。[URLモード](/info/url-mode.html)をご覧ください。

<!--i:eti-monitor-->
## スマートフォンでは

書き出しコントロールは、フローティング表示の**Export**ボタンから開く**Export**シートにあります。同じ形式、サイズ、コピー、ダウンロード、共有が、タッチ操作に適したサイズで表示されます。

<!--i:eti-code-->
## リンクとCLI用の形式id

以下は、URLの`format=`パラメーターとCLIの`--export=`フラグの値です([URLパラメーター](/info/url-parameters.html)と[CLI](/info/cli.html)をご覧ください)。ツールのメニューには、そのツールが作れる形式だけが表示されます。

| 種類 | id |
|---|---|
| ラスター | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| ベクター | `svg` · `svgz` (gzip圧縮されたSVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (カット用ファイル) |
| ページとドキュメント | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpotデザインファイル) · `scorm` (コースパッケージ、ZIP) |
| モーション | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| 音声 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (Lolly RondocodeからのMIDIノート) |
| テキストとデータ | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMPパレット) |
| バンドルとパッケージ | `zip` · `rpm`と`tar.gz` (レンダリングを封入したLinuxパッケージ) |

一部のidはツール独自の書き出しコードによるものです。`ase` (Lolly Palette LabのAdobe Swatch Exchange)、`exr`と`hdr` (Lolly Darkroomのハイダイナミックレンジのラスター)が該当します。**Convert Font**は、渡されたフォントファイルから`ttf`、`otf`、`woff`を書き出すため、リンクだけではツールにレンダリングするものがありません。
