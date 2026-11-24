# 質問と回答

`/info/start/faq.html`でアコーディオンとして表示される、よくある質問です。

**保守の方法:** 以下の各`##`見出しが質問です。見出しの下から
次の`##`までのすべてが回答になります。回答には、このサイトの軽量なMarkdownを使います。
段落は空行で区切ります。ここで質問の追加、削除、並べ替えを行い、
`pnpm run build:info`(または`pnpm run dev:web`)を再実行します。
ビルドは、最初の`##`より上にあるすべて(このタイトルと注記)を無視します。

初めて使う人に合わせた順序です。まず裏があるのか、次に自分のファイル、続いてLollyの入手と
実行、組織、最後に開発方法を扱います。各質問のアンカーは
同じ位置の英語の質問から作られるため、翻訳でも
英語の順序を保ちます。

## なぜ無料なのですか。何か裏があるのですか。

**Lollyは自分たちのために作りました。** SUSEは、外部サービスに何も渡さずに作れる、ブランドに沿ったファイルを何千も必要としていました。そこで、すべてをデバイス上で行うツールを作り、私たちが作る他のものと同じように、オープンソースとして公開しました。毎日使っているため、保守を続けています。**義務はありません:** ここにあるものはすべて、私たちがいてもいなくても動作します。

その線引きは約束ではなく、ライセンスにあります。ローカルで動作するものはすべて、永久に無料です。公開済みのバージョンには、取り消すことのできないライセンスが付与されています。どの貢献者契約によっても、誰かの成果物のライセンスを変更することはできません。

## SUSEはどれだけを非公開にしているのですか。(つまり、いつ方針を覆すのですか。)

エンジン、シェル、スキーマ、ブランドに依存しないツールはオープンソースです。SUSEの商標とブランド固有のツールは非公開のままで、すでに分離されています。[lolly.tools](https://lolly.tools)の公開インスタンスは、Lolly独自のデザインシステムである[Lolly Demo](/info/lolly-demo.html)を使っています。

ここでは何も約束に依存していません。公開されたすべてのバージョンはオープンソースのままです。2023年に他社がエンタープライズLinuxのソースを非公開にしたとき、SUSEはそのコードを公開されたままに保つため、[OpenELA](https://openela.org)を共同で設立しました。このプロジェクトもその姿勢を受け継いでいます。

SUSEは、Lollyを自社のITシステムに接続するための社内ツールを*実際に*開発しています。それはSUSEの社内環境であり、公開開発と非公開開発を分けるものではありません。Lollyは、[Open Build Service](https://openbuildservice.org/)を使ってビルドし、安全なサプライチェーンの成果物を[SUSE Application Collection](https://apps.rancher.io/applications)から提供することも目指しています。

## なぜ「Lolly Tools」という名前なのですか。

**Lolly**なのは、自由は甘いものであり、オーストラリア、ニュージーランド、英国ではlollyがお菓子を意味するからです。

**Tools**なのは、道具は手に取るまで動かないからです。使っていないときに動くことも、使っている間にあなたを監視することもありません。

## なぜすべて緑色なのですか。

lolly.toolsは、Lolly独自のサンプルデザインシステムである[Lolly Demo](/info/lolly-demo.html)で開きます。その主な色が緑です。[Settings → Design systems](/#/settings?focus=design-systems-section)で、白紙のデザインシステムである**Lolly Starter**か、独自のものに切り替えられます。

## 自分のブランドを使えますか。

はい。**Lolly Design System Setup**(`#/start`)は、1つの色、デザイントークンのファイル、完成したデザインからデザインシステムを作ります。その後、すべてのツールがそのデザインシステムで描画します。[はじめに](/info/quickstart.html#put-your-brand-in)で3つの方法を順に説明しています。

組織やビルドが提供するデザインシステムは管理対象です。鍵が表示され、読み取り専用のままです。変更するには、編集可能なコピーを作ります。

## 昨日作ったものはどこにありますか。

**Save as**または**Save**を押した場合、作品は保存に使ったブラウザやアプリのホーム画面の**Projects**にあります。**Download**だけを押した場合、ファイルはブラウザかシステムのダウンロードにあり、通常は**Assets**にもコピーがあります。[作業中に保存する](/info/find-your-work.html#which-tools-save-as-you-work)ツールは、未保存の作品も**Projects**に保持します。[作品を探して復元する](/info/find-your-work.html)ですべてのケースを扱っています。

## タブを閉じてしまいました。作品は消えましたか。

保存した作品は**Projects**に残っています。未保存の作品は消えますが、作業中に保存するツールでは、未保存の作品も**Projects**に保持されます。次回は、離れる前に**Save as**を押してください。[タブを閉じた場合やツールを離れた場合](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)をご覧ください。

## リンクではなくファイルとして作品を共有できますか。

はい。自分の写真や長いテキストなど、リンクにすべてを含められない場合、Shareダイアログは何が欠けるかを伝え、**.lolly**ファイルを提案します。その1つのファイルに、デザイン、使っている画像、そして選択すればツールも含まれます。

何を含めるかは自分で決めます。名前や詳細情報は、プロフィールで含めることを選んだ場合だけ入ります。ライセンス付きのアートワークは、含めることを選ばないかぎり除外されます。ツールを含むファイルを開いた人には、実行する前にそのツールを信頼するかどうかを尋ねます。[作ったものを共有する](/info/using.html#sharing-your-work)をご覧ください。

## プロフィールの詳細情報は何に使われますか。

**Settings**の詳細情報は、バッジに載せる名前など、それを求めるツールにあらかじめ入力されます。情報はこのデバイス上にとどまります。含める設定をオンにしないかぎり、作ったものには何も入りません。オンにすると、選んだ詳細情報が封入され、あなたが作成元として記されます。

共有と同期は、選んだ内容だけを送信します。組織のLolly Workインスタンスでは、共有セッションと管理対象の作品もそのサーバーに送られます。[プライバシー](/info/privacy.html)をご覧ください。

## モバイルアプリやデスクトップアプリはどう入手できますか。

[Lollyをインストールする](/info/install.html)からダウンロードできます。このページにはmacOS、Windows、Linux、Androidのすべてのビルドが並び、ダウンロードしたファイルの確認方法もあります。iPhoneとiPadでは、App Storeから**Lolly Tools**を入手します。[iPhoneとiPadの節](/info/install.html#iphone-and-ipad)にリンクがあります。

誰でも、利用者に必要なツールと設定を含む独自のアプリをビルドして配布することもできます。[ビルドガイド](/info/build-guide.html)で方法を説明しています。

## LollyでWebGPUが必要と表示されます。どうすればよいですか。

ウェブアプリは、現在のブラウザのグラフィックス機能であるWebGPUで描画し、ツールを開く前にWebGPUを確認します。次の順に試してください。

1. ブラウザを最新バージョンに更新します。
2. ブラウザの設定でグラフィックスまたはハードウェアアクセラレーションをオンにし、ブラウザを再起動します。
3. テスト済みのブラウザを試します。[対応環境](/info/supported-environments.html)に一覧があります。
4. Mac、iPhone、iPadでは、代わりに[アプリをインストールします](/info/install.html)。

## LollyでFigma、Penpot、Illustrator、InDesignのファイルを編集してレンダリングできますか。

はい。**Design**ツールを開き、**Import a design**をクリックします。ネイティブのFigma **.fig**(Save local copy)、Penpotの書き出し **.penpot**、Illustrator **.ai**または**.pdf**、InDesign **.idml**または**.indd**、Affinityドキュメント、Photoshop **.psd**、PowerPoint **.pptx**、CAD **.dxf**、**あらゆるSVG**を読み込めます([読み込めるすべての形式](/info/design-import.html#what-comes-in-from-each-app))。アカウントも、プラグインも、デザインアプリのライセンスも必要ありません。

![Lolly Designの開いたキャンバス: Import a designはツールバーのLollyメニュー内にある](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

レイヤーは編集可能なボックスとして読み込まれます。テキストは入力し直せるまま、図形は図形のまま保たれ、画像はライブラリに加わります。レイアウトを保存すると、**Share with rules**で、Lollyを持つ誰もが内容を入れ替えられるツールにできます。[デザインをインポートする](/info/design-import.html)をご覧ください。

## インターネットなしで2人が同じデザインを編集できますか。

はい。1人が招待(リンク、QRコード、短いコード)を共有し、もう1人が承諾します。両方のデバイスが、参加状況とフォーカスリングを備えた同じセッションをリアルタイムで保持します。間にサーバーがないため、スマートフォンのホットスポットを含め、共有しているどのネットワークでも動作します。[一緒に作業する](/info/collaborate.html)をご覧ください。異なるネットワークにいる同僚には、組織のLolly Workインスタンスが、認証された仕事用のコラボを提供します。

## 機能フラグとは何ですか。

機能フラグは、Lollyの一部をオンまたはオフにします。単独で使う場合は、個人の設定を選べます。Lolly Workを使う組織は、ポリシーに従って既定値を設定したり、特定のスイッチを非表示にしたりできます。管理対象のコントロールにはラベルが付きます。[組織でLollyを使う](/info/organisation.html)をご覧ください。

![単独で使うアプリの個人用機能フラグ。組織のポリシーで特定のスイッチを管理できる](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## ユーティリティはツールとどう違いますか。

ユーティリティは、PDFの圧縮、写真の変換、隠れたデータの削除など、すでに持っているファイルに対する1つの作業を手早く行います。多くは何もアップロードせず、お使いのデバイス上で動作します。通常なら適当なウェブサイトに任せる作業を、Lolly内で済ませられます。契約書を圧縮したり、位置情報が残った旅行の写真を変換したり、オンラインのフォーマッターにトークンを貼り付けたりするために、保持期間、法域、ビジネスモデルが不明なサイトへファイルを渡す必要はないはずです。[Lolly Utilities](/info/utilities.html)に一覧があり、[私たちが同意したことのない取引](/info/status-quo.html)でその背景を説明しています。

![Utilitiesビュー: Lolly Strip Hidden Data、Compress PDF、Convert Imageなど、デバイス上で行う作業が1か所にまとまっている](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 組織でSSO、共有プロジェクト、承認を使えますか。

はい。同じオープンソースプロジェクトの組織向けサーバーである**Lolly Work**で使えます。別に動作し、IDプロバイダーを通じたシングルサインオン、SCIMプロビジョニング、グループ権限、共有プロジェクトとアセット、仕事用のライブコラボ、承認、監査記録を追加します。日常のアプリは引き続き単独で動作します。

[組織でLollyを使う](/info/organisation.html)では、サインインと共有された作品の見つけ方を説明しています。[デプロイ](/info/deployment.html#organisation-services-with-lolly-work)では、Lolly Workの設定を説明しています。共有コンテンツと組織の記録は、そのインスタンスのプライバシーと保持のポリシーに従います。

## Lollyの導入ではどのようなハードルがありますか。

主なハードルは技術ではなく、チームが作品を作る方法の変化です。管理されたツール群を使いたいチームには、デザインシステムと最初のテンプレートを作る人が必要です。それでも、誰でも初日からLolly Designで独自のツールを作れ、gitは必要ありません。既存のプロセスは、出力がブランドに沿っていなくても機能し続けます。目に見える出力を1つうまく置き換え、変更前後を並べると、計画を示すより早く導入の価値を伝えられます。

[導入とガバナンス](/info/adoption-governance.html)では、役割ごとの導入支援、試験導入の測定方法、ガバナンスのプロセスの例を説明しています。

## Lollyは「バイブコーディング」で作られたのですか。

Lollyは、AIによるコーディング支援、調査支援、そして多くの箇所でAIによるコンテンツ作成支援を使って開発されました。パブリッククラウドの最先端AI企業のものも含め、複数のモデルとベンダーを使っています。アーキテクチャを作り、意図を持ってコードを選び整え、体験のアートディレクションを行ったのは人間です。

Lollyの依存関係に深刻度HighまたはCriticalの脆弱性情報があると、CIをブロックします。まだ修正できないものは、理由を文書化した承認済みの例外としてのみ保留されます。[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions)には現在の各例外が、[リリースノート](https://github.com/lolly-tools/lolly/releases)には各リリースに含まれる例外が記載されています。SECURITY.mdには脆弱性の報告方法もあります。

ビルド時のチェックでは、誰にとってもわかりやすい文章にするため、コードのコメント、アプリ、このドキュメントにある、機械が書いたように読める表現も拒否します。その副作用として、検出器がどの文章をモデルが書いたかを見分けにくくなる可能性があります。それを意図したわけではありません。

何よりも、Lollyは世界中の専門家による何十年ものオープンソースの成果の上に成り立っています。

**生成AIの利用開示:**

- **LLMが書いたコード:** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next、Codex Sol(この一覧は増える可能性があります)
- **LLMによる調査:** Gemini 3.1、Fable、Codex Astra
- **ドキュメント:** Sonnet 5
- **オープンソースライブラリ:** それぞれの作者をSBOM、コメント、ファイルヘッダーに記載しています

この一覧には、Lollyに同梱されたモデルは含まれていません。

**人間の担当:**
- **アイデア出し、レビュー、フィードバック:** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot Community、Tim Hildred(すべてを網羅した一覧ではありません)
- **アーキテクチャ、アートディレクション & 低品質な生成物の後始末:** Andy Fitzsimon

## SUSEブランドのツールはどこにありますか？

別の非公開リポジトリにあります。公開リポジトリをクローンしてもSUSEのブランドパックは取得されないため、そこからのビルドでは、別のものを選ばないかぎり、中立の`lolly-start`プロファイルが使われます。このプロファイルには、ブランドに依存しないコミュニティのツールと、独自の内容を設定する空のブランドが含まれています。[lolly.tools](https://lolly.tools)は`lolly-demo`プロファイルでビルドされ、Lolly独自のデザインシステムである[Lolly Demo](/info/lolly-demo.html)で開きます。SUSEは商標を保護するため、独自のインスタンスを運用しています。

## Lollyのロゴは何味ですか？

ライムという人も、ミントという人も、時にはリンゴという人もいます。Lollyが甘さを用意し、あなたが味を作ります。

## Lollyでいうコンテンツ主権とは何ですか？

コンテンツをどのように作成、管理、保存し、自分が選んだシステム間で移動するかを、自分で決められることです。Lollyは、ローカルでの制作、編集可能な作品、持ち運べるツールに対応しています。Lolly Workは、組織が管理する共有サービスを追加します。それでも、ソースのライセンス、利用できる依存関係、ワークフロー内のデータの流れは考慮する必要があります。[コンテンツ主権とは？](/info/content-sovereignty.html)では、管理できる各項目とその限界を説明しています。

## 既存のDAMを使い続けられますか？

はい。対応するDAMを正本の管理元として使い続けながら、Lolly Workで選んだアセットをLollyのツールに接続できます。ソースへのアクセス、許可する編集、利用権、完成した出力の承認は、それぞれ別の判断です。[既存のDAMとLollyを使う](/info/use-with-dam.html)ではその構成を説明し、[SUSEのBrandfolder活用事例](/info/suse-brandfolder.html)では導入時の成功例を記録しています。
