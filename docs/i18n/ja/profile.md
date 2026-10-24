# プロフィール

お名前、連絡先、顔写真を一度設定すれば、それらを使うように作られたすべてのツールが自動で入力します。メール署名、バッジ、登壇者カードなどです。この小さな記録が**プロフィール**で、お使いのデバイス上にあります。

プロフィールには、作業しながら蓄積されるものも含まれます。保存したセッション、アップロードした画像、ローカルの活動集計です。管理は**Settings → Preferences**で行い、ツールが読み取るのは、自動入力するように作られたフィールドだけです。単独で使うならアカウントは不要で、任意の同期、共有、組織サービスには、それぞれのデータの流れがあり、以下で説明します。

## プロフィールに含まれるもの

| 項目 | 内容 |
|---|---|
| **Name** | 姓と名。 |
| **Contact** | メールアドレスと電話番号。 |
| **Location** | 都市と国。 |
| **Headshot** | 任意の写真。正方形に切り抜かれ、ローカルの画像として保持され、メール署名、引用カード、組織図などのツールで使われます。 |
| **Use my details to create** | 1つのオプトインスイッチ(オンにすると**Using my details**と表示されます)。書き出したファイルの作者クレジットとBatch実行に、詳細を含めるかどうかを決めます。自動入力には影響しません。[ツールがプロフィールを使う方法](#how-tools-use-your-profile)をご覧ください。 |
| **Preferences** | テーマ、アクセシビリティ設定、**Feature flags**でオンにしたアプリの機能。 |
| **Your work** | サムネイル付きの保存済みセッション([Projects](/info/find-your-work.html)で整理)、アップロードした画像、ローカルの活動統計。 |

必須のものはありません。空のプロフィールでも動作します。入力の手間が省けるものだけを入力してください。

![SettingsのPreferencesタブ: 設定レールと、Use my details to createスイッチ、名前・連絡先・場所のフィールドがあるYour details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

外観や絵文字からストレージやオフラインダウンロードまで、Preferencesのそれ以外のすべては[Settings](/info/dashboard.html)に整理されています。

## 自分、チーム、役割

「プロフィール」という言葉は、固定された一人の人物を連想させます。Lollyでは、むしろ作成時の文脈に近く、これを作るあいだのあなたが誰であるかです。3つの形があり、Lollyはどれも同じように扱います。

::: cols
## 自分として

既定です。あなたの名前、メールアドレス、顔写真。一度設定すれば、署名、バッジ、カンファレンスのロックアップが自動で埋まります。

## チームとして

チームの共有名、`events@…`のようなグループの受信箱、部門、チームのマークです。1人が設定して書き出し、他のメンバーが同じプロフィールを読み込むため、チームのファイルは一貫した詳細を持ちます。共有のキオスクやデモ用のノートパソコンは、1つのチームプロフィールで動かせます。

## 役割として

年に3日だけイベントマネージャーを務める人は、バッジやサインにイベントの受信箱とイベントのサブブランドを使い、その後は普段の自分に戻したいものです。その役割を保存したプロフィールファイルとして持ち、イベントのときに読み込み、終わったら脇に置いておきます。
:::

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Lolly Workを使う組織でのプロフィール
[組織のLolly](/info/organisation.html)にサインインすると、Lolly Workは、IDプロバイダーから確認済みのプロフィール項目を提供し、組織のポリシーに基づいて項目や設定を固定できます。管理対象の項目には、アプリ内でその旨が表示されます。

そのサインインは、共有プロジェクトとアセットへのアクセスも制御します。チームのプロフィールファイルはあくまでローカルのファイルであり、組織のメンバーシップを付与するものでも、ワークアカウントの代わりになるものでもありません。**Use my details to create**が制御するのは書き出しのクレジットであり、組織のサインインや監査記録ではありません。[プライバシー](/info/privacy.html#organisation-services-with-lolly-work)をご覧ください。
:::

## いくつも保持して、1つを使う

インストールごとに、一度に有効なプロフィールは1つで、アプリ内に切り替え機能はありません。代わりに、各プロフィールは持ち運べるファイルで、新しいデバイスへ移すときに使うのと同じバックアップファイルです。別の文脈に入るには、次のようにします。

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device**の**Export my data**で、現在のプロフィールを1つの`.zip`として保存します。
- <!--i:trash--> **Clear all my data**で、このインストールを空にします。
- <!--i:upload--> **Import data…**で、これから入る文脈のプロフィールファイルを読み込みます。
:::

先に消去せずにインポートすると、代わりに**マージ**されます。インポートされたセッションと画像が追加され、両方のコピーがある場合は、より新しく保存されたほうが残ります。フォルダ、お気に入り、テンプレートはお手元のものの隣に追加され、ご自身の詳細は、空のフィールドを除いて維持され、空のフィールドにはファイルの値が入ります。これは、あるチームのセッションを自分の環境に取り込むのには向いていますが、役割どうしをきれいに切り分けるのには向きません。

2つの文脈を同時に使うには、別のブラウザプロファイル、別のユーザーアカウント、または2つ目のWebアプリのインストールを使います。それぞれが、独立したLollyプロフィールを持ちます。

![インストール全体を移す2つのボタン: Export my dataは1つのzipを書き出し、Import dataはそれを読み戻す](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> 文脈ごとに1つのファイルを保持し、`LollyTools-events-2026.zip`と`LollyTools-me.zip`のように、それぞれに内容を表す名前を付けます。そのファイルがプロフィールです。

ファイルに含まれるもの、残るもの、同期を含む他の移動方法は、[作品を別のデバイスに移す](/info/find-your-work.html#move-your-work-to-another-device)で扱っています。

## ツールがプロフィールをどう使うか

**自動入力。** ツールの作者は、入力がプロフィールから取得されることを指定します(`bindToProfile: "firstname"`、`"email"`、`"headshot"`など)。ツールを開くと、その入力はプロフィールから埋められ、組織のポリシーがその入力をロックしていないかぎり、プロフィールを変えずに1つのセッションだけ上書きできます。自動入力はローカルの便宜であり、**Use my details**がオンかどうかにかかわらず行われます。

**クレジット。** 書き出すとき、詳細はファイルのメタデータ(PNG、PDFなど)に作者クレジットとして含められるため、完成したファイルに誰が作ったかを示せます。これと、Batch実行の作者は、**Use my details to create**が制御します。オフの場合、書き出しにはLollyで作られたことは記されますが、個人の作者や連絡先の行は付きません。

ツールの作者の方は、[`bindToProfile`](/info/tool-inputs.html#bindtoprofile)と[`host.profile`](/info/host-api.html#host-profile)をご覧ください。

![オプトインと明記され、オンにするまでオフのままの、Use my details to createスイッチ](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## プロフィール、デザインシステム、ケイパビリティ

Settingsには互いに近い3つの項目があり、混同しやすいものです。

- <!--i:people--> **プロフィール** - あなた、あなたのチーム、あるいは今担っている役割。名前、連絡先、顔写真、保存した作業。個人のもので、デバイスに保持され、ファイルとして持ち運べます。
- <!--i:palette--> **デザインシステム** - ブランド。すべてのツールがレンダリングに使う色、フォント、設定。個人のものではなく共有され、一貫しています。[Design System Setup](/info/brand-studio.html)をご覧ください。
- <!--i:sliders--> **ケイパビリティ** - アプリにできること。あなたが利用できる機能とツール。

プロフィールは、ファイルが誰からのものかを変え、デザインシステムはファイルの見た目を変え、ケイパビリティは何を作れるかを表します。

Lollyでは、この言葉にほかにも3つの意味があります。**コンテンツプロファイル**は、配備がどのツールとカタログを含むかを選ぶビルド設定で、その用語は[用語集](/info/glossary.html)で定義しています。`profile`リンクパラメーターは、CMYKの印刷条件など、書き出し用のカラープロファイルを選びます。[予約済みURLパラメーター](/info/url-parameters.html#print)をご覧ください。**認証済みID**は、お客様のメールアドレスを署名付き書き出しに結び付ける、任意の署名用証明書で、これらの詳細とは別のものですが、どちらが埋め込まれるかは**Use my details to create**が制御します。[Content Credentials](/info/content-credentials-identity.html)をご覧ください。

![The Verified identity card, phone-width: the certificate lifetime picker and the enrolment step beneath it - the identity profile, separate from your personal details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## プライバシー

個人のプロフィールはローカルに保存されます。詳細は、バックアップや同期のコピー、共有または書き出すコンテンツ、任意のContent Credentials登録の際に含まれることがあります。Lolly Workのインスタンスでは、サインイン、共有作業、テレメトリポリシー、監査記録は、このローカルプロフィールとは別です。**Settings → Preferences → Clear all my data**はこのデバイスを消去しますが、ストレージプロバイダーや組織が保持するコピーは消去しません。[プライバシーポリシー](/info/privacy.html)をご覧ください。
