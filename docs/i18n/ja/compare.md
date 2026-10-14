# Lolly をツール別に比較

Lolly は、デバイス上での単一の変換から、ガバナンスの効いた組織のアセット制作まで、クリエイティブ作業をカバーします。これらのページでは、各製品が対応するワークフロー、デプロイ方法、そしてソリューションを選ぶ際に重要となる制約を比較します。

_最終確認日: 2026年9月28日。_

## 1つのプロジェクト、別々にデプロイされる2つの部分

**Lolly** は、作成・編集・変換・書き出しを行うためのエンジン、アプリ、ツールです。お使いのデバイス上で動作し、必要なアセットが揃えばオフラインでも動作し、単体で使う場合はアカウントが不要です。

**[lolly.work](https://lolly.work)** は、このプロジェクトの組織向けサービスで、[lolly-work リポジトリ](https://github.com/lolly-tools/lolly-work)で保守されています。SSO、SCIM プロビジョニング、ロールとポリシー、共有カタログとプロジェクト、承認、work コラボレーション、利用状況レポート、監査記録、サーバーレンダリングを提供します。どちらの部分も MPL-2.0 のオープンソースです。組織は lolly.work を Lolly と併せてホストし、有効にするサービスを決定します。

比較の対象は **Lolly + lolly.work** です。組織向けサービスを必要とする機能は明示しています。単体で使う場合、ファイルはデバイス上に保たれます。共有プロジェクト、work コラボレーション、サーバーレンダリング、配信を選択すると、該当するデータが設定済みのサービスに送信されます。公開されている lolly.work サイトはサンドボックスです。組織向けのデプロイについては、[デプロイガイド](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)と[現在のステータス](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)を参照してください。

## ワークフロー別に比較

- [Lolly と Canva](/info/compare-canva.html) - テンプレート、日常的なデザイン、共有ブランド制作。
- [Lolly と Adobe](/info/compare-adobe.html) - 編集、変換、プロフェッショナル向け出力、Content Credentials。
- [Lolly と Figma](/info/compare-figma.html) - デザイン、リアルタイムコラボレーション、再利用可能なアセット制作。
- [Lolly と Penpot](/info/compare-penpot.html) - オープンソースのデザイン、共有トークン、組織のワークフロー。
- [Lolly とブランドポータル](/info/compare-brand-portals.html) - 承認済みライブラリ、ロックされたテンプレート、ID、レビュー、レポート。
- [Lolly とレンダリング API](/info/compare-render-apis.html) - お使いのデバイス上、CI、または lolly.work を介した自動生成。
- [Lolly とオンラインファイルコンバーター](/info/compare-converters.html) - お使いのデバイス上でのフォーマット変換。

機能ごとの比較については、[Lolly の比較](/info/positioning.html)を参照してください。各比較には日付が付いています。いずれかの製品の現状と一致しなくなった記述は、修正が必要です。
