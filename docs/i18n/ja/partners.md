# パートナーと作業する

2つのブランドを載せた作品は数多くあります。イベントポスターのスポンサーのロゴ、メーカー名を冠した販売代理店の提案、共同発表、供給業者とともに書いた導入事例などです。このページは、双方を対象にしています。

このページでは、作品の制作に使うデザインシステムのブランドを**主導ブランド**、作品に載るもう一方のブランドを**パートナー**と呼びます。どちらの側でも作品を制作できます。[ブランド構成](/info/brand-architectures.html#co-branding)では、共同ブランディングとほかのブランドの組み合わせを比較しています。

<!--i:eti-info-->
## 現在のLollyでの2つのブランドの扱い

- **作品はそれぞれ1つのデザインシステムで描画されます。** 主導ブランドの色、書体、組織のルールが適用されます。パートナーのマークは、Assetsの画像、またはデザインシステムに保持した独自のマークとして、アートワークに加えます。
- **ブランドはファイルで受け渡します。** デザインシステムのファイル(`.lolly`)は、トークン、フォント、ロゴを含みます。**Share with rules**で作った再利用可能なツールは、許可した入力を備えた、完成済みのレイアウトを1つ含みます。ブランドスキルは、独立したファイルで受け渡します。
- **ブランドはアドレスを持つこともできます。** [ブランドページ](/info/brand-page.html)は、パートナーが読めるようにロゴ、色、書体、ルールを公開し、パートナーのツール向けにトークンとスキルも提供します。
- **Lollyが確認するのは主導ブランドのルールだけです。** Lollyは、余白や最小サイズなどのパートナーのルールを知らないため、パートナーのガイドラインと照合してください。Lolly Workのパートナープログラムでは、各社のパートナーキットにそのルールが保持され、Lolly Designはキットに照らしてその会社のマークを確認します。
- **パートナープログラム全体はLolly Workで運用できます。** 販売代理店、流通業者、その他のパートナーに、自社のLolly Work上で自社ブランドの作品を作ってもらう場合、パートナープログラムは、選んだツール、ファイル、テンプレートだけを各パートナー企業に提供します。プログラムは、その企業のロゴと詳細情報を保持し、テンプレートに入力し、各ファイルに企業を記録します。[パートナープログラムを運用する](/info/manage/run-a-partner-programme.html)は、運用チーム向けのガイドです。

<!--i:eti-folder-shared-->
## パートナーとブランドを共有する

### 送るものを選ぶ

| 送るもの | 方法 | パートナーが受け取るもの | 適した用途 |
| --- | --- | --- | --- |
| デザインシステムのファイル | [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices)上部のバーの**Export** | トークン、フォント、ロゴ、テーマの設定を、切り替えて使えるデザインシステムとして受け取れます | 自社ブランドで多くの作品を作るパートナー |
| 再利用可能なツール | Lolly Designの**Share with rules**([ルール付きでデザインを共有する](/info/create-a-tool.html)) | 名前やロゴなど、許可された入力を備えた完成済みのレイアウトを1つ受け取れます。ファイルには解決済みの色、フォント、画像が含まれるため、パートナー自身のデザインシステムで固定のアートワークのスタイルが変わることはありません | 各パートナーが入力する、共同ブランドのチラシ、バッジ、バナー |
| ブランドスキル | **Skills**ルームの**Download skill (.zip)**または**Copy as one file** | パートナーの担当者とエージェント向けの、文書化された基準 | 上記のどちらかで、エージェントが作業の一部を行う場合 |
| ブランドページ | Lolly Design System Setupの**Publish a brand page**、または`lolly system publish`で、ホストするフォルダを書き出します([ブランドページ](/info/brand-page.html)) | 現在のロゴ、色、書体、ルールを1つのアドレスで参照でき、ツール向けのトークンとスキルも受け取れます。ロゴとフォントファイルは、権利が許す場合に表示され、ページには除外されたものが一覧表示されます | ファイルを送らない相手との共有 |
| トークン | スタジオの**More**メニューの**Tokens (.json)** | フォントやロゴを含まない、プレーンなデザイントークンのドキュメント | パートナー独自のデザインツールやビルド |

![Lolly DemoのLolly Design System SetupでSkillsルームを開いた状態: バーにExport、開いたMoreメニューにTokens (.json)、選択したスキルの横にDownload skill (.zip)とCopy as one fileがある](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning フォントもファイルに含まれます
追加したフォントはデザインシステムのファイルに含まれるため、そのファイルを配布できるライセンスか確認してください。
:::

再利用可能なツールは、ライセンスで制限されている画像を含める前に確認を求めます([プレビューと共有](/info/create-a-tool.html#preview-and-share))。

### 共同ブランドのテンプレートを作る

再利用可能なツールでは、どのパートナーの作品も設定したレイアウトに収まります。パートナーが変更できるのは、許可した部分だけです。

1. Lolly Designで、自分のデザインシステムを使って作品を作ります。パートナーのロゴを置く場所に画像ボックスを描き、レイアウトに必要な余白をボックスの周囲に残します。
2. Fileメニューから**Share with rules**を選びます。画像ボックスを選択し、**Make editable**を選びます。その**Rules**で画像を差し替えるアップロードを許可し、最小ピクセルサイズと受け付ける形式(可能ならSVG)を設定します。ボックスの**Image fit**を**Contain (fit inside)**にすると、横長や縦長のロゴもボックス内に収まります。
3. パートナーの名前や提供内容も編集可能にし、文字数の上限を設定します。
4. **Preview**を押し、非常に横長のロゴ、非常に縦長のロゴ、長い名前で試します。
5. **Share .lolly**を選び、アップロードするロゴのバージョンをパートナー向けの説明に書きます。たとえば、明るい背景用のフルカラーの横長ロゴなどです。

![共同ブランドのイベントカードでShare with rulesを使用: パートナーのロゴボックスが選択され、編集可能になっており、Rulesでは480×110ピクセル以上のPNGまたはSVG画像のアップロードが許可されている](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

パートナーはファイルをLollyにドロップし、信頼を確認するメッセージを読んで、入力を埋め、許可された形式でダウンロードします([完成したツールを使う](/info/create-a-tool.html#use-the-finished-tool))。Lollyは、描いたボックスの内側にロゴを収めます。Lollyはパートナーの余白のルールを読み取らないため、ロゴの周囲の余白は、ボックスの周りに残した分だけです。

### ブランドのスキルをエージェントに渡す

スキルは人とエージェントに指針を示します。Lollyは組織のルールを確認します。

- Lolly Design System Setupで**Skills**ルーム(`#/start?area=skills`)を開き、スキルを選んで**Download skill (.zip)**を押します。フォルダ内のカタログリンクはお使いのLollyを指し、`lolly.json`にはコピーの入手元が記録されます。**Copy as one file**は、チャット画面に貼り付けられるよう、同じテキストをクリップボードにコピーします。
- ターミナルでは、`lolly system skill <name> --into=<dir>`で同じフォルダを書き出せます([ローカルのエージェントツール用のフォルダに入れる](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool))。
- 自分のマシンでは、`internal`と指定されたスキルも`public`のスキルとともに一覧に表示されるため、送るものを選んでください([公開スキルと内部スキル](/info/brand-skills.html#public-and-internal-skills))。
- 独自のスキルがないデザインシステムでは、Lollyがトークンと組織のルールから基本となるスキルを作り、ルームに表示します。
- コピーは自動で更新されません。スキルの新しい改訂版を公開したら、フォルダを送り直してください。

<!--i:eti-download-->
## 受け取ったブランドで作業する

デザインシステムのファイルを受け取ったパートナー向けの説明です。主となるブランドが自社のLolly Workでパートナープログラムを運用している場合は、代わりにそこへサインインします。ホームには、自社のカードと自社向けに公開されたテンプレートが表示されます([パートナーに見えるもの](/info/manage/run-a-partner-programme.html#what-partners-see))。

1. **ファイルを開きます。** ファイルをLollyにドロップするか、**Open**を押します。Lolly Design System Setupの**Add from…**でも取り込めます。何かを書き込む前に、プレビューでファイルの内容が一覧表示されます。デザインシステムのファイルは、主となるブランドの名前で別のデザインシステムを追加し、有効にします。自分のデザインシステムはデバイスに残ります。主となるブランド独自のLollyへアプリを接続するファイルの場合は、まずデバイス全体への影響が表示されます。この種類のファイルについては[組織でLollyを使う](/info/organisation.html)で説明しています。
2. **ブランドの内容を見ます。** Lolly Design System Setupの**Board**にはデザインシステムの内容、**Logos**にはマーク、**Rules**にはLollyが確認する組織のルールが表示されます。**Skills**には、Lollyがトークンとルールから作る基本となるスキルが表示されます。主となるブランド独自のスキルは、そのブランドが送る場合、別のファイルとして届きます。
3. **ブランドを切り替えます。** **Settings → Preferences → Design systems**で、デバイス全体のデザインシステムを切り替えます。**Settings → Design system**にも、切り替え用のカバーが並んでいます。1つのブランドの作品を仕上げてから切り替えてください。
4. **自社のマークを配置します。** ロゴを**Assets**にアップロードすると、すべてのデザインシステムで使えます。または、主となるブランドのデザインシステムに**カスタムマーク**として追加すると(**Logos**ルームの**Custom marks**)、そのデザインシステムのファイルに含まれます。鍵が表示されているデザインシステムは読み取り専用なので、その場合はAssetsを使ってください。確認事項は[パートナーのマークを配置する](#place-a-partner-s-mark)にあります。
5. **書き出す前に確認します。** Lolly Designでは、書き出しパネルの**Before you export**カードに、主となるブランドの組織のルールに照らした確認結果がレイヤーごとに表示されます([書き出す前に](/info/design.html#before-you-export))。**Design system**カードには、ファイルに記録されるデザインシステムが表示されます。
6. **作品を送り返します。** 書き出したファイル、または編集可能なデザインを`.lolly`として送ります([作品を共有する](/info/using.html#sharing-your-work))。デザインはその時点で有効なデザインシステムで開くため、主となるブランド側は、自社のデザインシステムを有効にしてから受け取ったデザインを開きます。

::: note デザインシステムのファイルは更新されません
デザインシステムのファイルは、書き出した日のブランドのコピーです。このコピーが更新されることはありません。
:::

主となるブランドから新しいファイルが届いたら、同じ方法で開きます。その後、**Settings → Preferences → Design systems**で有効なデザインシステムを確認し、古いコピーが不要になったらそこで削除します。

![SettingsのDesign systems: Lolly Demoが有効になっており、Lolly StarterのUseボタンでデバイス全体を切り替えられ、Open or import a fileでデザインシステムのファイルを取り込める](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## パートナーのマークを配置する

| 方法 | 手順 | 適した用途 |
| --- | --- | --- |
| Assets内の画像 | **Assets**のアップロード領域にファイルをドロップし、ツールの画像欄、またはLolly Designのレールの追加メニューにある**Image**から選びます | 一度限りの作品。アップロードした画像はデバイスに属するため、どのデザインシステムが有効でも使えます |
| カスタムマーク | **Logos**ルームの**Custom marks**でマークの名前を入力し、**Choose file…**を選びます | 頻繁に協業するパートナー。マークはデザインシステムに属し、そのファイルに含まれます |
| 完成したロックアップ | 描画ツールで両方のマークからロックアップを作り、カスタムマークとして追加します | 繰り返し使う「with」や「in partnership with」のロックアップ |

::: check 書き出す前にマークを確認する
- **正しいファイル。** パートナーから提供されたファイルを使い、SVGがあればそれを選びます。ウェブページやスライドからコピーしたロゴは、印刷するとぼやけます。
- **背景に合うバージョン。** 暗い背景や複雑な背景では、パートナーのガイドラインに用意されていれば、反転版や単色版を使います。
- **縦横比。** 画像ボックスの**Image fit**を**Contain (fit inside)**にすると、マークの縦横比が崩れません。
- **余白とサイズ。** マークの周りにパートナーのガイドラインで求められる余白を残し、指定された最小サイズを上回る大きさにします。Lollyはどちらも測定しません。
- **どのブランドを主とするか。** どちらを主とするかについて両ブランドのガイドラインに従い、2つのマークの大きさを決めます。
- **権利。** Lollyはカタログアセットに記録されたライセンスを表示します。自分でアップロードしたファイルにはライセンスの記録がなく、詳細には*Licence not recorded*と表示されます。パートナーから得たマークの使用許可は、自分の記録と一緒に保管してください([作品の権利とクレジット](/info/creative-rights.html))。
:::

![共同ブランドのカードのBefore you export: デザインシステムはLolly Demoで、パートナーのロゴはデザインシステムのアセットに含まれない画像として記載され、組織の4つのルールには指摘事項がない](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

書き出したファイルの[デザインシステムの記録](/info/exporting.html#the-design-system-record)には、主となるブランドのデザインシステムとカラーウェイが記載されます。パートナーのブランドは記録されません。ただし、Lolly Workのパートナープログラムでは、その作品の対象となるパートナー企業とプログラムも記載されます。

### 各ブランドのスキルをエージェントに渡す

エージェントが作業する場合は、両ブランドのスキルをそのまま渡し、どちらのブランドを主とするか伝えます。各ブランドのスキルは、それぞれの名前とIDを保ちます。Lollyは2つのブランドのスキルを統合せず、どちらを優先するかも決めません。

<!--i:eti-grid-->
## スポンサーやイベントのロゴウォール

[Lolly Logo Wall](/#/tool/logo-wall)ツールは、スポンサーボード、パートナー紹介のスライド、記者会見用の背景に使うロゴを均等なグリッドに並べます。イベントでは通常、主催者が主となるブランドです。ウォールは主催者のデザインシステムで作り、各スポンサーのロゴをアートワークとして配置します。

![濃い緑の背景に、すべてのロゴを白で描いた3段階のスポンサーロゴウォール: Goldパートナー2社、Silverパートナー3社、Communityパートナー5社が、それぞれの見出しの下に並び、下の段階ほど一段小さくなる](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Lolly Logo Wallを開き、**Logos**にロゴをドロップします。各ロゴに専用のコントロールが付きます。
2. 各ロゴに「Gold partners」などの**Tier**を設定します。各段階は最初に登場した順に並び、それぞれの見出しの下に専用の行が設けられます。**Tier headings**で見出しを非表示にできます。**Tier sizes**を**Step down**にすると、下の段階ほど1行に収めるロゴが1つずつ増え、上の段階がより大きく見えます。**Presence**と**Size %**は、段階内の個々のロゴを調整します。
3. **Balance sizes**はオンのままにします。Lolly Logo Wallは各ロゴの視覚的な重さでサイズを決めるため、重く見えるロゴは小さく、軽く見えるロゴは大きくなり、各段階が均等に見えます。
4. **Trim margins**は各ロゴをアートワークの範囲に切り抜きます。ロゴのファイルに所有者が求める余白がすでに含まれている場合は、このオプションをオフにします。
5. **Remove white backgrounds**は、スライドからコピーしたロゴによく付いている白い背景のボックスを取り除きます。
6. **Layout**で**Columns**、間隔、パディングを設定します。**Background**の初期値は、デザインシステムのサーフェスの色です。
7. 単色のウォールにするには、**Render all as vector**をオンにして**Ink colour**を選ぶか、個々のロゴの**Filter**を**Greyscale**にします。単色版は、各スポンサーのガイドラインで許可されている場合だけ使ってください。
8. 記者会見用の背景では、**Step & repeat**で**Grid**、**Brick**、**Checker**のいずれかを選び、**Rows**の数を設定します。

ウォールはPNG、SVG、PDF、または印刷用のCMYK PDFで書き出します。書き出しパネルで1080 x 1920の縦長ストーリーやA4ページなど、別のサイズと形状を設定すると、キャンバスはその形状を満たすように、各行のロゴ数を増減してウォールを配置し直します。書き出される内容はキャンバスと一致します。ポスターにウォールを入れるには、Lolly Designのレールの追加メニューで**Image**を選び、フレームを描いて、ピッカーの**Tools**タブでLolly Logo Wallを選びます([デザイン内のツール](/info/design.html#tools-inside-a-design))。ロゴの間にキャプションを入れる場合は、Lolly Designで**Dynamic layout**を**grid**にし、各ロゴを1つずつ画像ボックスに収めます([Lolly Designのレイアウト](/info/design-layout.html#dynamic-layouts))。

ターミナルでは、`lolly run logo-wall logos/*.png --output=wall.svg`で画像フォルダからウォールを作れます。`logo`列と`tier`列を持つCSVを使うと、段階のあるウォールになります。SVGとPNGにはブラウザは不要です([段階のあるスポンサーロゴウォール](/info/cli-rendering.html#a-sponsor-wall-with-tiers))。

スポンサーが[ブランドページ](/info/brand-page.html)を公開している場合、`lolly run logo-wall --logos-from=<address or folder>`で背景に合う最新のロゴを取得し、そのページの使用に関する記述を出力できます。スポンサーごとにこのフラグを繰り返します。

Lolly Logo Wallは、スポンサーのルールを認識しません。TiersとPresenceは互いの相対的なサイズを設定するもので、スポンサーの最小サイズを設定するものではなく、隣り合うロゴ間の余白も確認されません。完成したウォールを、印刷または表示するサイズで各スポンサーのガイドラインと照合してください。

<!--i:eti-hammer-->
## Lollyがまだ対応していないこと

- 1つの作品は1つのデザインシステムで描かれます。パートナーの色、書体、ルールが作品内でデザインシステムになるわけではなく、パートナーのマークは画像です。
- Lolly Workのパートナープログラム以外では、パートナーのルールはアプリで保持も確認もされません。余白、最小サイズ、単色や反転など許可された処理が該当します。
- パートナーキットは、別のブランドの作品で使うパートナーのロゴ、色、ルールをまとめた軽量のパックです。アプリに取り込めるのは、Lolly Workのパートナープログラム経由だけです。それ以外では、キットの確認をターミナルで実行します。`lolly check --kit=<file>`はLolly Designドキュメント内のパートナーのマークを測定します([再現結果を確認する](/info/cli-decks.html#check-the-recreation))。
- Lollyは、「with」「in partnership with」「by」の構成で2つのマークからロックアップを生成しません。完成したロックアップをカスタムマークとして追加してください。
- デバイス全体で有効なデザインシステムは1つなので、2つのブランドを並べて開くことはできません。
- アプリから書き出したデザインシステムのファイルにはブランドのスキルが含まれないため、別のファイルとして送ってください。
- ブランドページから取得したロゴは行内の画像になり、その行にページの情報は残りません。ページの公開者は表示されないため、アドレスを自分で確認してください。
- ホストされているウェブアプリは、Content Security Policyで指定されたホストだけを許可しているため、別のブランドのページを取得できません。ターミナルでロゴを取得するか、ファイルを保存して**Assets**に追加してください。

<!--i:eti-map-pin-->
## 次に進むページ

- **[ブランドアーキテクチャ](/info/brand-architectures.html)**: 共同ブランド、ホワイトラベルなどの構成と、それぞれに対応するLollyでの操作。
- **[パートナープログラムを運用する](/info/manage/run-a-partner-programme.html)**: 自社のLolly Workでパートナーが利用できるものと、プログラムの設定、運用方法。
- **[ルール付きでデザインを共有する](/info/create-a-tool.html)**: 固定されたレイアウトと選択した入力を持つ再利用可能なツール。
- **[ブランドのスキル](/info/brand-skills.html)**: スキルの作成、読み取り、エージェントへの受け渡し方法。
- **[Lolly Design System Setup](/info/brand-studio.html)**: ロゴ、カスタムマーク、デバイス間でのデザインシステムの移動。
- **[ブランドページ](/info/brand-page.html)**: 1つのアドレスでブランドを公開し、パートナーのページからロゴを取得する方法。
- **[作品の権利とクレジット](/info/creative-rights.html)**: Lollyが描く作品について記録する内容。
