# Q&A

よくある質問です。`/info/start/faq.html`のアコーディオンとして表示されます。

**メンテナンス方法:** 以下の `##` 見出しがそれぞれ質問であり、その下
(次の `##` まで)が回答です。回答はサイトの他の部分と同じ軽量マークダウンを使います -
段落は空行で区切ってください。ここで質問を追加、削除、並べ替えたうえで
`pnpm run build:info`(または `pnpm run dev:web`)を再実行してください。
最初の `##` より上(このタイトルとこの注記)はビルドでは無視されます。

順序は初めて使う人の順序です。まず注意点、次にファイル、
次にLollyの入手と実行、次に組織、最後にどのように作られたかです。
各質問のアンカーは、同じ位置にある英語の質問から作られるため、
翻訳でも英語の順序が保たれます。

## なぜ無料なのですか？何か裏があるのでは？

**私たちはLollyを自分たちのために作りました。** SUSEは、外部サービスに何も渡さずに作る、ブランドに沿った数千のファイルを必要としていました。そこで、そのすべてをデバイス上で行うツールを作り、私たちが作るすべてのものと同じようにオープンソースとして公開しました。私たちは毎日使うので、メンテナンスを続けています。**義務はありません。** ここにあるものはすべて、私たちがいてもいなくても動作します。

その線引きは約束ではなく、ライセンスに引かれています。ローカルで動作するものはすべて、永久に無料です。リリース済みのバージョンは取り消せないようにライセンスされており、誰かの作品を再ライセンスできるコントリビューター契約もありません。

## SUSE はどこまでを非公開にしているのですか？（つまり、いつ梯子を外されるのか）

エンジン、シェル、スキーマ、ブランドに依存しないツールはオープンソースです。非公開のままなのは、SUSEの商標とブランド付きのツールで、すでに切り分けられています。[lolly.tools](https://lolly.tools)の公開インスタンスは、Lolly自身のデザインシステムである[Lolly Demo](/info/lolly-demo.html)で動作しています。

ここには約束に頼るものは何もありません。リリース済みのすべてのバージョンはオープンソースのままで、留保されるのは商標だけです。2023年に別の企業がエンタープライズLinuxのソースを非公開にしたとき、SUSEはそのコードをオープンに保つために[OpenELA](https://openela.org)を共同設立しました。このプロジェクトが受け継ぐのは、その同じ姿勢です。

率直に言えば、SUSEはLollyを自社のITシステムにつなぐ社内ツールを*構築しています*。これはSUSE社内の構成であり、公開開発と非公開開発の分離ではありません。Lollyは[Open Build Service](https://openbuildservice.org/)でのビルドも目指しており、安全なサプライチェーン成果物を[SUSE Application Collection](https://apps.rancher.io/applications)から提供します。

## なぜ「Lolly Tools」という名前なのですか？

**Lolly** は、自由が甘いものだからであり、またオーストラリア、ニュージーランド、イギリスでは lolly がお菓子を意味するからです。

**Tools** は、道具というものが、手に取られるまでじっと動かないからです。使っていないときに動くことはなく、使っている間にあなたを見張ることもありません。

## なぜすべて緑色なのですか?

lolly.toolsは、Lolly自身のサンプルのデザインシステムである[Lolly Demo](/info/lolly-demo.html)で開き、そのリードカラーは緑です。これはサンプルであり、ルールではありません。空のデザインシステムである**Lolly Starter**や、ご自身のものには、[Settings → Design systems](/#/settings?focus=design-systems-section)で切り替えられます。

## 自分のブランドを使えますか?

はい。**Design System Setup**(`#/start`)は、1色、デザイントークンファイル、完成したデザインのいずれかからデザインシステムを作り、その後はすべてのツールがそのデザインシステムで描画します。3つのルートは[はじめに](/info/quickstart.html#put-your-brand-in)で順に説明しています。

組織やビルドが提供するデザインシステムは管理対象で、ロックが表示されて読み取り専用のままです。変更するには、編集可能なコピーを作成できます。

## 昨日作ったものはどこにありますか？

**Save as**または**Save**を押した場合、それはホーム画面の**Projects**に、保存したブラウザまたはアプリの中にあります。**Download**だけを押した場合は、ファイルはブラウザまたはシステムがダウンロードを保存する場所にあり、通常は**Assets**にもコピーがあります。[作業しながら保存する](/info/find-your-work.html#which-tools-save-as-you-work)ツールは、未保存の作業も**Projects**に保持します。すべてのケースは[作品を探して復元する](/info/find-your-work.html)で扱っています。

## タブを閉じてしまいました。作業内容は消えましたか？

保存した作業は**プロジェクト**にそのまま残っています。保存していない作業は失われますが、作業しながら保存するツールは例外で、それらも**プロジェクト**に保持されます。次回はツールを離れる前に**名前を付けて保存**を押してください。[タブを閉じた場合やツールを離れた場合](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)をご覧ください。

## 作品をリンクではなくファイルとして共有できますか？

はい。写真や長いテキストなど、リンクがすべてを運べない場合、共有ダイアログは何が欠けるかを伝え、代わりに**.lolly**ファイルを提案します。デザイン、それが使う画像、ご希望ならツール自体を収めた1つのファイルです。

どこまで渡すかはお客様が決めます。お名前や詳細は、プロフィールでオプトインした場合にのみ含まれ、ライセンス付きの作品は、含めると選ばないかぎり保留されます。ツールを含むファイルを開く人には、ツールを実行する前に、そのツールを信頼するかどうかが尋ねられます。[作品を共有する](/info/using.html#sharing-your-work)をご覧ください。

## プロフィールの詳細は何に使われますか?

**Settings**の詳細は、バッジの名前など、それを求めるツールに自動入力されます。それらはこのデバイスにとどまります。オプトインもオンにした場合は、選んだ詳細が、お客様を作成者として、作成したものに封入されます。詳細を含めると選ばないかぎり、何も含まれません。

共有と同期が送るのは、お客様が選んだ内容だけです。組織のLolly Workインスタンスでは、共有セッションと管理対象の作業もそのサーバーに送られます。[プライバシー](/info/privacy.html)をご覧ください。

## モバイル版やデスクトップ版のアプリはどうすれば入手できますか？

[Lollyをインストールする](/info/install.html)からダウンロードしてください。このページには、macOS、Windows、Linux、Androidのすべてのビルドが一覧になっており、ダウンロードしたファイルの確認方法も示されています。iPhoneとiPadは、App Storeから**Lolly Tools**を入手します。リンクは[iPhoneとiPadの節](/info/install.html#iphone-and-ipad)にあります。

誰でも、利用者に必要なツールと設定を備えた、独自のアプリのコピーをビルドして配布することもできます。方法は[ビルドガイド](/info/build-guide.html)に示しています。

## LollyにWebGPUが必要だと表示されます。どうすればよいですか?

Webアプリは、現在のブラウザが備えるグラフィックス機能であるWebGPUで描画し、ツールを開く前にその有無を確認します。次の順に試してください。

1. ブラウザを最新バージョンに更新します。
2. ブラウザの設定でグラフィックスまたはハードウェアアクセラレーションをオンにして、ブラウザを再起動します。
3. テスト済みのブラウザを試します。[対応環境](/info/supported-environments.html)に一覧があります。
4. Mac、iPhone、iPadでは、代わりに[アプリをインストール](/info/install.html)します。

## Lolly は Figma、Penpot、Illustrator、InDesign のファイルを編集してレンダリングできますか？

はい。**Design**を開いて**Import a design**をクリックしてください。ネイティブのFigma **.fig**(Save local copy)、Penpotの**.penpot**エクスポート、Illustratorの**.ai**または**.pdf**、InDesignの**.idml**(File → Export → InDesign Markup)、**任意のSVG**を受け付けます。アカウントもプラグインもデザインアプリのライセンスも不要です。

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

レイヤーは編集可能なボックスとして届きます。テキストは再入力でき、図形は図形のまま、画像はご自身のライブラリに入ります。保存してから**Share with rules**を使うと、そのレイアウトを、Lollyを持つ誰でも入力し直せるツールに変えられます。[デザインを取り込む](/info/design-import.html)をご覧ください。

## インターネットなしで、2 人が同じデザインを一緒に作業できますか？

はい。一方がリンク、QRコード、短いコードで招待を共有し、もう一方が承諾します。すると両方のデバイスが、プレゼンスやフォーカスリングを含め、同じセッションをライブで保持します。間にサーバーがないため、地下室のスマートフォンのホットスポットを含め、共有されたどのネットワークでも動作します。[一緒に作業する](/info/collaborate.html)をご覧ください。ネットワークが異なる同僚とは、組織のLolly Workインスタンスが認証付きのワークコラボを提供します。

## フィーチャーフラグとは何ですか？

機能フラグは、Lollyの一部をオンまたはオフにします。単独で使う場合は、個人の設定をご自身で選びます。Lolly Workを使う組織は、ポリシーに基づき、既定値の設定や一部のスイッチの非表示ができ、管理対象のコントロールにはその旨が表示されます。[組織でLollyを使う](/info/organisation.html)をご覧ください。

![単独のアプリでの個人の機能フラグ。組織のポリシーは一部のスイッチを管理できる](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## ユーティリティはツールとどう違うのですか？

ユーティリティは、すでにお持ちのファイルに対して、PDFの圧縮、写真の変換、非表示データの削除といった手早い作業を1つ行います。その多くは何もアップロードせずにお使いのデバイス上で動作します。人が普通は無作為なウェブサイトに任せる作業が、Lollyの中にとどまるように存在しています。契約書の圧縮、位置情報が残ったままの旅行写真の変換、オンラインの整形ツールへのトークンの貼り付けのために、保持、管轄、事業モデルが不明なサイトにファイルを渡すべきではありません。ユーティリティは[ユーティリティ](/info/utilities.html)に一覧があり、その背景にある話は[私たちが同意した覚えのない取引](/info/status-quo.html)に書かれています。

![Utilitiesビュー: Strip Hidden Data、Compress PDF、Convert Image、その他のデバイス上の作業が1か所に並ぶ](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 組織でSSO、共有プロジェクト、承認を使えますか?

はい、同じオープンソースプロジェクトの組織向けサーバーである**Lolly Work**を使います。これは別に動作し、IDプロバイダーによるシングルサインオン、SCIMによるプロビジョニング、グループ権限、共有プロジェクトとアセット、ライブのワークコラボ、承認、監査記録を加えます。日常的に使うアプリは、単独でも引き続き動作します。

サインインと共有作業の見つけ方は[組織でLollyを使う](/info/organisation.html)で、設定方法は[デプロイ](/info/deployment.html#organisation-services-with-lolly-work)で扱っています。共有コンテンツと組織の記録は、そのインスタンスのプライバシーポリシーと保持ポリシーに従います。

## Lolly を導入する際に、どのようなハードルが想定されますか？

変わるのは、多くの場合、技術ではなく制作する側のあり方です。管理されたツール群を求めるチームには、デザインシステムと最初のテンプレートを作成する担当者が必要ですが、誰でも初日から、gitなしでDesignで自分のツールを作り始められます。そして既存のプロセスは、その出力がブランドから外れていても動き続けるため、目に見える成果物を1つ、前後を並べてうまく変換するほうが、計画書よりも早く説得できます。

役割別のオンボーディング、パイロットの測り方、ガバナンスのプロセスの例は[導入とガバナンス](/info/adoption-governance.html)で扱っています。

## Lollyは「バイブコーディング」で作られたのですか?

Lollyは、AIによるコーディング支援、AIによる発見の支援、そして多くの箇所ではAIによるコンテンツ支援を使い、パブリッククラウドの最先端企業のものを含む、複数のモデルとベンダーを組み合わせて開発されました。アーキテクチャは人間が作り、コードは意図をもって人間が選び抜き、体験は人間がアートディレクションしました。

Lollyの依存関係に高または重大のアドバイザリがあると、CIがブロックされます。まだ修正できないアドバイザリは、書面の理由を付けた承認済みの例外としてのみ留め置かれます。現在留め置かれている各例外は[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions)に、各リリースが抱えるものは[リリースノート](https://github.com/lolly-tools/lolly/releases)に一覧があります。SECURITY.mdには、脆弱性の報告方法も記載されています。

ビルド内のチェックでは、すべての読者にとって平易な文章を保つため、コードのコメント、アプリ、これらのドキュメントにおいて、機械が作ったように読める表現も拒否します。副作用として、どの文章をモデルが書いたかを検出器が見分けにくくなる可能性があります。私たちはそれを狙ったわけではありません。

何より、Lollyは、世界中の専門家による数十年にわたるオープンソースの成果の上に成り立っています。

**生成AIに関する開示:**

- **LLMが書いたコード:** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next、Codex Sol(この一覧は増えることがあります)
- **LLMによる発見:** Gemini 3.1、Fable、Codex Astra
- **ドキュメント:** Sonnet 5
- **オープンソースライブラリ:** それぞれの作者。SBOM、コメント、ファイルヘッダーに明記されています

このリストには、Lollyにバンドルされているモデルは含まれていません。

**人間によるもの:**
- **発案、レビュー、フィードバック:** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpotコミュニティ、Tim Hildred(これですべてではありません)
- **アーキテクチャ、アートディレクション、スロップの掃除係:** Andy Fitzsimon

## SUSE ブランドのツールはどこへ行ったのですか？

それらは別の非公開リポジトリにあります。公開クローンはSUSEのブランドパックをまったく取得しないため、そこからのビルドは、別のものを選ばないかぎり、中立的な`lolly-start`プロファイルを使います。ブランドに依存しないコミュニティツールと、ご自身で埋める空のブランドです。[lolly.tools](https://lolly.tools)は`lolly-demo`プロファイルでビルドされ、Lolly自身のデザインシステムである[Lolly Demo](/info/lolly-demo.html)で開きます。SUSEは、自社の商標を守るため、独自のインスタンスを運用しています。

## あの Lolly のロゴは何味ですか？

ライムだという人もいれば、ミントだという人も、ときにはアップルだという人もいます。Lolly は甘さを届けます。味を決めるのはあなたです！
