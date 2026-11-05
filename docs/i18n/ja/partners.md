# パートナーとの協業

イベントポスターのスポンサーロゴ、メーカー名の下に載る販売代理店の提案、共同発表、取引先と一緒に書く事例紹介など、2つのブランドを掲げる制作物は多くあります。このページは双方のためのものです。パートナーに自社ブランドを共有するときに何を送るか、受け取ったブランドで作業する方法、パートナーのマークを配置する方法、スポンサーやイベントのロゴウォールの作り方、そして Lolly がまだ行わないことを扱います。

このページでは、2つの言葉を一貫して同じ意味で使います。**リードブランド**は、制作物を作るデザインシステムの持ち主であるブランドで、**パートナー**は、その制作物に載るもう一方のブランドです。どちらの側でも制作物を作れます。[ブランドアーキテクチャ](/info/brand-architectures.html#co-branding)では、共同ブランディングが、組織がブランドを構成するほかの方法とどう関係するかを説明しています。

## 現在の Lolly での2つのブランドの扱い

- **1つの制作物は1つのデザインシステムで描かれます。** リードブランドの色、書体、ハウスルールが適用されます。パートナーのマークは作品として入ります。Assets の画像か、デザインシステムに保存したカスタムマークです。
- **ブランドはファイルとして渡ります。** デザインシステムファイル(`.lolly`)にはトークン、フォント、ロゴが入ります。**Share with rules** で作った再利用可能なツールは、完成した1つのレイアウトと、許可した入力項目を運びます。ブランドスキルは別々のファイルとして渡ります。
- **Lolly が確認するのはリードブランドのルールだけです。** クリアスペースや最小サイズといったパートナーのルールは Lolly には分からないため、パートナー自身のガイドラインで確認してください。

## パートナーに自社ブランドを共有する

### 送るものを選ぶ

| 送るもの | 方法 | パートナーが受け取るもの | 向いているケース |
| --- | --- | --- | --- |
| デザインシステムファイル | [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) 上部のバーの **Export** | トークン、フォント、ロゴ、テーマ設定。パートナーが切り替えて使えるデザインシステムとして届きます | 御社のブランドで多くの制作物を作るパートナー |
| 再利用可能なツール | Design の **Share with rules**([Share a design with rules](/info/create-a-tool.html)) | 完成した1つのレイアウトと、許可した入力項目(パートナーの名前やロゴなど)。ファイルには確定した色、フォント、画像が入っているため、パートナー自身のデザインシステムで固定のアートワークの見た目が変わることはありません | 各パートナーが記入する、共同ブランドのチラシ、バッジ、バナー |
| ブランドスキル | **Skills** ルーム:**Download skill (.zip)** または **Copy as one file** | 御社の文書化された基準。パートナーの担当者とエージェント向け | 上記のどちらかと併せて、作業の一部をエージェントが行う場合 |
| トークン | スタジオの **More** メニューの **Tokens (.json)** | フォントやロゴを含まない、プレーンなデザイントークンの文書 | パートナー独自のデザインツールやビルド |

![Lolly Demo の Design System Setup を Skills ルームで開いたところ。上部のバーに Export、Tokens (.json) を選んだ More メニュー、選択したスキルの横に Download skill (.zip) と Copy as one file](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

追加したフォントはデザインシステムファイルの中に入って渡るため、そのライセンスでファイルを他者に渡してよいかを確認してください。再利用可能なツールは、ライセンス上保留されている画像を含める前に、確認を求めます([プレビューと共有](/info/create-a-tool.html#preview-and-share))。

### 共同ブランドのテンプレートを作る

再利用可能なツールでは、パートナーが変更できるのは許可した部分だけなので、すべてのパートナーの制作物が御社のレイアウトのままになります。

1. Design で、自社のデザインシステムを使って制作物を作ります。パートナーのロゴを入れる場所に画像ボックスを描き、レイアウトに必要な余白をボックスの周りに残します。
2. File メニューから **Share with rules** を選びます。画像ボックスを選択して **Make editable** を選びます。その **Rules** で、差し替えアップロードを許可し、最小ピクセルサイズと受け付けるアップロード形式(可能なら SVG)を設定します。ボックス自体の **Image fit** を **Contain (fit inside)** に設定すると、横長や縦長のロゴもボックスの中に収まります。
3. パートナーの名前や提案内容も、文字数の上限付きで編集可能にします。
4. **Preview** を押して、とても横長のロゴ、とても縦長のロゴ、長い名前を試します。
5. **Share .lolly** を選び、パートナー向けの案内を書きます。どの版のロゴをアップロードするか(明るい背景用のフルカラーの横型ロゴなど)を示します。

![共同ブランドのイベントカードでの Share with rules。パートナーのロゴ用ボックスが選択されて編集可能になっており、その Rules では、480 x 110 ピクセル以上の PNG または SVG の画像アップロードを許可している](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

パートナーはファイルを Lolly にドロップし、信頼の確認画面を確かめ、入力項目を埋めて、許可された形式をダウンロードします([完成したツールを使う](/info/create-a-tool.html#use-the-finished-tool))。Lolly はロゴを、描いたボックスの中に収めます。パートナー自身のクリアスペースのルールは読み取らないため、ボックスの周りに残した余白が、そのままロゴの余白になります。

### ブランドスキルをエージェントに渡す

スキルは人とエージェントのための手引きで、Lolly が確認するのはハウスルールです。

- Design System Setup で **Skills** ルーム(`#/start?area=skills`)を開き、スキルを選んで **Download skill (.zip)** を押します。フォルダー内のカタログリンクは御社の Lolly を指し、`lolly.json` にはコピーの出どころが記録されます。**Copy as one file** は、同じテキストをチャット画面向けにクリップボードへコピーします。
- ターミナルからは、`lolly system skill <name> --into=<dir>` で同じフォルダーが書き出されます([ローカルのエージェントツール用のフォルダー](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool))。
- `internal` と印を付けたスキルは、`public` のスキルと並んで自分のマシンに一覧表示されるため、どれを送るかを選んでください([公開スキルと内部スキル](/info/brand-skills.html#public-and-internal-skills))。
- 独自のスキルを持たないデザインシステムには、Lolly がトークンとハウスルールから書くベースラインがあり、ルームにはそのベースラインも一覧表示されます。
- コピーは自動では更新されません。スキルの新しいリビジョンを公開したら、フォルダーをもう一度送ってください。

## 受け取ったブランドで作業する

デザインシステムファイルを受け取るパートナー向けです。

1. **ファイルを開く。** ファイルを Lolly にドロップするか **Open** を押します。Design System Setup の **Add from…** でもファイルを受け付けます。何かが書き込まれる前に、プレビューでファイルの中身が一覧表示されます。デザインシステムファイルは、リードブランドの名前で別のデザインシステムを追加して有効にしますが、自分のデザインシステムは端末に残ります。代わりに、アプリをリードブランド自身の Lolly に接続するファイルの場合は、端末全体への影響が先に一覧表示されます。この種のファイルについては[組織で Lolly を使う](/info/organisation.html)をご覧ください。
2. **ブランドを見て回る。** Design System Setup では、**Board** にデザインシステムの中身、**Logos** にそのマーク、**Rules** に Lolly が確認するハウスルールが一覧表示されます。**Skills** には、Lolly がトークンとルールから書くベースラインが表示されます。リードブランド自身のスキルは、送られてくれば別のファイルとして届きます。
3. **ブランドを切り替える。** **Settings → Preferences → Design systems** で端末全体のデザインシステムを切り替えられ、**Settings → Design system** には切り替え用の表紙の帯があります。切り替える前に、1つのブランドの制作物を仕上げてください。
4. **自分のマークを配置する。** ロゴを **Assets** にアップロードすると、どのデザインシステムでも使えます。または、リードブランドのデザインシステムに**カスタムマーク**として追加します(**Logos** ルーム、**Custom marks**)。この場合はそのデザインシステムのファイルとともに渡ります。鍵が表示されているデザインシステムは読み取り専用なので、そこでは Assets を使ってください。確認項目は[パートナーのマークを配置する](#place-a-partner-s-mark)にあります。
5. **書き出す前に確認する。** Design の書き出しパネルにある **Before you export** カードに、リードブランドのハウスルールに照らした指摘がレイヤーごとに一覧表示されます([Before you export](/info/design.html#before-you-export))。**Design system** カードには、ファイルに記録されたデザインシステムが表示されます。
6. **作業を送り返す。** 書き出したファイル、または編集可能なデザインを `.lolly` として送ります([作品を共有する](/info/using.html#sharing-your-work))。デザインは有効なデザインシステムで開くため、リードブランドは自分たちのデザインシステムを有効にした状態で、あなたの作品を開くことになります。

デザインシステムファイルは、書き出した日のブランドのコピーであり、コピーが自動で更新されることはありません。リードブランドから新しいファイルが届いたら、同じ方法で新しいファイルを開いてください。その後、**Settings → Preferences → Design systems** でどのデザインシステムが有効かを確認し、古いほうが不要になったら、そこから古いコピーを削除します。

![Settings の Design systems。Lolly Demo が有効で、Lolly Starter には端末全体を切り替える Use ボタンがあり、Open or import a file でデザインシステムファイルを読み込める](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

## パートナーのマークを配置する

| 方法 | 手順 | 向いているケース |
| --- | --- | --- |
| Assets の画像 | **Assets** のアップロード欄にファイルをドロップし、ツールの画像フィールドで選ぶか、Design でレールの追加メニューの **Image** から選びます | 単発の制作物。アップロードは端末に属するため、どのデザインシステムが有効でも使えます |
| カスタムマーク | **Logos** ルーム、**Custom marks**:マークの名前を入力し、**Choose file…** を押します | よく一緒に仕事をするパートナー。マークはデザインシステムに属し、そのファイルとともに渡ります |
| 完成したロックアップ | 描画ツールで両方のマークからロックアップを作り、カスタムマークとして追加します | 「with」や「in partnership with」のロックアップを繰り返し使う場合 |

書き出す前に、マークを確認してください。

- **正しいファイル。** パートナーから提供されたファイルを使い、あれば SVG を使います。Web ページやスライドからコピーしたロゴは、印刷するとぼやけます。
- **背景に合った版。** 暗い背景や複雑な背景には、パートナーのガイドラインに用意されていれば、反転版や1色版を使います。
- **縦横比。** 画像ボックスの **Image fit** を **Contain (fit inside)** に設定すると、マークが引き伸ばされることはありません。
- **クリアスペースとサイズ。** パートナーのガイドラインが求める余白をマークの周りに残し、マークを最小サイズ以上に保ちます。Lolly はどちらも測定しません。
- **どのブランドが主役か。** 主役となるブランドについての両ブランドのガイドラインに従うように、2つのマークのサイズを決めます。
- **権利。** Lolly はカタログのアセットに記録されたライセンスを表示します。自分でアップロードしたファイルにはライセンスの記録がなく、詳細には *Licence not recorded* と表示されるため、パートナーからの使用許可は自分の記録として保管してください([クリエイティブの権利とクレジット](/info/creative-rights.html))。

![共同ブランドのカードでの Before you export。デザインシステムは Lolly Demo で、パートナーのロゴはデザインシステムのアセット外の画像として記され、4つのハウスルールには記載事項がない](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

書き出しの[デザインシステムの記録](/info/exporting.html#the-design-system-record)には、リードブランドのデザインシステムとカラーウェイが入ります。パートナーのブランドは記録されません。

### 各ブランドのスキルをエージェントに渡す

エージェントが作業を行う場合は、リードブランドのスキルとパートナーのスキルをそのまま渡し、どちらのブランドがリードするかをエージェントに伝えてください。各ブランドのスキルは、それぞれの名前と ID を保ちます。Lolly は2つのブランドのスキルを統合することも、どちらを優先するかを決めることもせず、確認するのはリードブランドのハウスルールだけです。

## スポンサーとイベントのロゴウォール

[ロゴウォール](/#/tool/logo-wall)ツールは、たくさんのロゴを均等なグリッドに並べます。スポンサーボード、パートナー向けスライド、プレスのバックドロップ用です。イベントでは通常、主催者がリードブランドです。ウォールは主催者のデザインシステムで作り、各スポンサーのロゴは作品としてウォールに載ります。

![濃い緑の背景に3つの階層で並んだスポンサーウォール。すべてのロゴが白で描かれ、Gold partners が2社、Silver partners が3社、Community partners が5社、各階層は専用の見出しの下にあり、下の階層ほど一段小さい](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Logo Wall を開き、**Logos** にロゴをドロップします。ロゴごとに専用のコントロールが用意されます。
2. 各ロゴに「Gold partners」のような **Tier** を付けます。各階層は、階層が最初に現れた順に、専用の見出しの下で独自の行を持ちます。**Tier headings** で見出しを非表示にできます。**Tier sizes** を **Step down** にすると、下の階層ほど1行に1つ多くのロゴが収まるため、上の階層ほど大きく見えます。**Presence** と **Size %** で、階層内の1つのロゴをさらに微調整できます。
3. **Balance sizes** はオンのままにします。Logo Wall は各ロゴを視覚的な重さに基づいてサイズ調整するため、重いロゴは小さく、軽いロゴは大きくなり、各階層が均等に見えます。
4. **Trim margins** は、各ロゴをアートワークの範囲に切り詰めます。ロゴのファイルに所有者が求めるクリアスペースがすでに含まれている場合は、このオプションをオフにします。
5. **Remove white backgrounds** は、スライドからコピーしたロゴによくある白いボックスを取り除きます。
6. **Layout** で **Columns**、間隔、パディングを設定します。**Background** は、デザインシステムのサーフェスカラーから始まります。
7. 1色のウォールにするには、**Render all as vector** をオンにして **Ink colour** を選ぶか、1つのロゴの **Filter** を **Greyscale** に設定します。1色版は、各スポンサーのガイドラインで認められている場合にだけ使ってください。
8. プレスのバックドロップには、**Step & repeat** で **Grid**、**Brick**、**Checker** のいずれかを選び、**Rows** の数を設定します。

ウォールは PNG、SVG、PDF、または印刷用の CMYK PDF として書き出せます。書き出しパネルで、縦長の 1080 x 1920 のストーリーや A4 のページなど、別のサイズや形を設定すると、キャンバスにはその形を埋めるようにウォールが配置し直され、1行のロゴ数が増減します。書き出されるのは、キャンバス上のウォールそのものです。ウォールをポスターに載せるには、Design でレールの追加メニューから **Image** を選び、フレームを描いて、ピッカーの **Tools** タブで Logo Wall を選びます([デザインの中のツール](/info/design.html#tools-inside-a-design))。ロゴの間にキャプションを入れたい場合は、Design で **Dynamic layout** を **grid** に設定すると、ロゴごとに1つの画像ボックスが用意されます([Design のレイアウト](/info/design-layout.html#dynamic-layouts))。

ターミナルでは、`lolly run logo-wall logos/*.png --output=wall.svg` で画像のフォルダーからウォールを作成でき、`logo` 列と `tier` 列を持つ CSV で階層付きのウォールを作成できます。SVG と PNG にはブラウザーが不要です([階層付きのスポンサーウォール](/info/cli-rendering.html#a-sponsor-wall-with-tiers))。

Logo Wall はスポンサーのルールを一切知りません。Tier と Presence が設定するのはロゴ同士の相対的なサイズであり、スポンサーの最小サイズではなく、隣り合うロゴ間のクリアスペースを確認する仕組みもありません。完成したウォールは、印刷または表示するサイズで、各スポンサーのガイドラインに照らして確認してください。

## Lolly がまだ行わないこと

- 制作物は1つのデザインシステムで描かれます。パートナーの色、書体、ルールは制作物の中のデザインシステムではなく、パートナーのマークは画像です。
- パートナーのルールは保持も確認もされません。クリアスペース、最小サイズ、1色や反転といった許可される処理がこれに当たります。Lolly が確認するのはリードブランドのハウスルールだけです。
- パートナーキットはまだありません。これは、他のブランドの作品の中で使うためにパートナーのロゴ、色、ルールを収める軽量のパックを指します。
- Lolly は、「with」「in partnership with」「by」といった形式のために、2つのマークからロックアップを生成することはしません。完成したロックアップをカスタムマークとして追加してください。
- 有効なデザインシステムは端末全体で1つのため、2つのブランドを並べて開くことはできません。
- デザインシステムファイルは、書き出し時点のブランドのコピーであり、コピーが自動で更新されることはありません。アプリから書き出したデザインシステムファイルにはブランドスキルが含まれないため、スキルは別のファイルとして送ってください。
- 書き出しに記録されるのは、リードブランドのデザインシステムとカラーウェイであり、パートナーのブランドではありません。

## 次に進む先

- **[ブランドアーキテクチャ](/info/brand-architectures.html)**:共同ブランディング、ホワイトラベル、そのほかの形態と、それぞれで Lolly で行うこと。
- **[Share a design with rules](/info/create-a-tool.html)**:固定レイアウトと、選んだ入力項目を持つ再利用可能なツール。
- **[ブランドスキル](/info/brand-skills.html)**:スキルの書き方、読み方、エージェントへの渡し方。
- **[Lolly Design System Setup](/info/brand-studio.html)**:ロゴ、カスタムマーク、デザインシステムの端末間での移動。
- **[クリエイティブの権利とクレジット](/info/creative-rights.html)**:Lolly が描画する作品について記録する内容。
