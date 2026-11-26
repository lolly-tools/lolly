# ツールごとにLollyを比較する

これらのページでは、Lollyが他の製品を置き換えられるか、その製品と併用できるか、あるいはあなたの作業に合わないかを説明します。各ページは、他の製品が優れている点から始まります。

_最終確認日: 2026年9月28日。_

<!--i:eti-grid-->
## 製品別に比較する

- [LollyとCanva](/info/compare-canva.html) - テンプレート、日常のデザイン、チームでのブランド制作。
- [LollyとAdobe](/info/compare-adobe.html) - 編集、変換、プロ向けの出力、Content Credentials。
- [LollyとFigma](/info/compare-figma.html) - デザイン、ライブの共同作業、再利用できるアセットの制作。
- [LollyとPenpot](/info/compare-penpot.html) - オープンソースのデザイン、共有トークン、組織での作業。
- [Lollyとブランドポータル](/info/compare-brand-portals.html) - 承認済みのライブラリ、ロックされたテンプレート、ID管理、レビュー、レポート。
- [LollyとレンダリングAPI](/info/compare-render-apis.html) - デバイス、CI、自分のサーバーでの自動生成と、BannerbearやPlacidからの[移行方法](/info/work-move-from-render-api.html)。
- [Lollyとオンラインのファイル変換サービス](/info/compare-converters.html) - お使いのデバイス上での形式変換。

[Lollyの比較](/info/positioning.html)には、機能ごとの比較があります。各比較には日付が付いています。いずれかの製品の現状に合わなくなった記述は、修正する必要があります。

<!--i:eti-map-pin-->
## 何がどこで動くか

どの比較も、1つのオープンソースプロジェクトの2つの部分を扱います。**Lolly**は、エンジン、アプリ、ツールです。**Lolly Work**は、[lolly-workリポジトリ](https://github.com/lolly-tools/lolly-work)で保守される組織向けのサーバーです。どちらもMPL-2.0で、どのLolly Workサービスを有効にするかは組織が決めます。

::: cols
## お使いのデバイス上: Lolly

- 単独での利用にアカウントは不要
- 作成、編集、変換、書き出し
- 必要なツールとアセットを保存すればオフラインで動作
- デバイス上で署名されるContent Credentials
- サーバーを使わない、2台のデバイス間のプライベートコラボ

## 組織のサーバー上: Lolly Work

- シングルサインオン、SCIMプロビジョニング、ロール、ポリシー
- 共有カタログ、チームプロジェクト、Workのコラボ
- 承認、利用状況のレポート、監査記録
- サーバーレンダリング、復旧可能なジョブ、承認された配信
- 組織のIDによるサーバー署名
:::

単独での利用では、ファイルはデバイス上にとどまります。共有プロジェクト、Workのコラボ、サーバーレンダリング、配信を選ぶと、その機能に必要なデータが組織のサーバーに送られます。

<!--i:eti-info-->
## すべての比較の前提

この一連のページすべてに、次の制限が適用されます。

- **Lolly Workのコラボは、現在、単一のサーバーノードで動作します。** その規模と運用実績は、長年運用されてきたホスティング型の製品とは異なります。[Lolly Workの現状とロードマップ](/info/work-status.html)に現在の制限を記載しています。
- **[lolly.work](https://lolly.work)のサイトは、デモ用のサンドボックスです。** 組織で継続的に運用するには、永続ストレージと運用担当者が必要です。[Lolly Workのインストール](/info/work-install.html)では、その両方を説明しています。
- LollyにもセルフホストのLolly Workにも、**利用者ごとのソフトウェアライセンス料はありません**。ホスティング、ストレージ、運用には引き続き費用がかかります。
- **署名があっても、署名者が信頼されるとは限りません。** 検証側が署名者を信頼済みと表示するのは、ファイルの署名に使った証明書を信頼している場合だけです。[Content CredentialsのID](/info/content-credentials-identity.html)で、その仕組みを説明しています。
