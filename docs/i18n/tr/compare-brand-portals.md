# Lolly ve marka portalları

_Konumlandırma güncellendi: 31 Ekim 2026. Sağlayıcı yeteneği örneği denetlendi: 28 Eylül 2026._

Kuruluşun onaylı varlıklarını Bynder, Frontify, Marq veya Brandfolder'da tutuyorsa bu sayfa o portalı Lolly ve Lolly Work ile karşılaştırır. İnsanların marka varlıklarını nasıl bulduğunu ve bunlardan nasıl yeni dosyalar yaptığını kapsar.

<!--i:eti-folder-shared-->
## Mevcut portalını koruma

Mevcut bir DAM, esas kayıt kaynağı olarak kalabilir. Lolly Work'ün katalog bağlayıcıları, kitaplığının seçilen bir bölümünü Lolly'de kullanılabilir kılar. İnsanlar burada kuruluşun kurallarına göre yeni dosyalar yapar. Erişimi, DAM'in desteklenen kaynak kısıtlamaları ve Lolly Work'ün erişime açma kuralları yönetir. Nihai çıktının incelenmesi ayrı bir karardır.

[Lolly'yi mevcut DAM'inle kullan](/info/use-with-dam.html) sorumlulukları ve sınırları açıklar. [SUSE'nin Brandfolder deneyimi](/info/suse-brandfolder.html), planlanan bir geçiş öncesinde yöneticilerin değişim yönetimini destekleyen başarılı entegrasyonu kaydeder.

Lolly'nin amacı, üretim üzerinde kontrol ve sistem seçme özgürlüğünü de içeren [içerik egemenliğidir](/info/content-sovereignty.html). Kendi kitaplığı ve onayları, bu yetenekleri kendileri işletmeyi seçen kuruluşlara hizmet eder. [DAM sağlayıcıları ve uygulama ortakları için Lolly](/info/dam-partners.html), bağlantılı iş akışının mevcut bir esas kayıt sistemine nasıl değer katabileceğini anlatır.

<!--i:eti-award-->
## Köklü bir portal neyi daha iyi yapar

Köklü portallar yönetilen barındırma, destek ve kapsamlı varlık yönetimi iş akışları sunar. [Frontify'ın kurumsal DAM'i](https://www.frontify.com/en/solution/enterprise-digital-asset-management), varlık keşfi, erişim denetimleri, onay iş akışları ve dağıtımı birleştirir. Lolly'nin yazılım bileşenleri daha yenidir. Onay zincirleri sıralıdır ve serbestçe dallanamaz. [Lolly Work durumu ve yol haritası](/info/work-status.html) kurulum sınırlarını kaydeder.

<!--i:eti-blend-->
## Nerede örtüşürler

İkisi de onaylı varlıkları, kilitli şablonları, erişim denetimini, incelemeyi ve dağıtımı kapsar. Dosyaları Lolly yapar. Şablonlar, tasarım token'ları ve izin verilen girdiler bir kişinin neyi değiştirebileceğini belirler ve render işlemi cihazında kalabilir. Lolly Work, kuruluşun kontrol ettiği altyapıda kimlik, paylaşılan depolama, politika, onaylar ve raporlama ekler.

![Settings içindeki etkin tasarım sistemi, kapak ve sayfalar olarak gösteriliyor: her aracın çizim yaparken kullandığı renkler, yazı tipleri ve logolar](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Lolly ve Lolly Work neler sunar

| İhtiyaç | Lolly + Lolly Work |
|---|---|
| Oturum açma ve sağlama | OIDC ile tek oturum açma, birden çok kimlik sağlayıcısı, SCIM 2.0 ile kullanıcı sağlama ve grup üyeliği ile mevcut oturumları iptal eden hesap devre dışı bırakma. Yalnızca SAML destekleyen bir kimlik sağlayıcısı, Keycloak gibi bir OIDC köprüsü üzerinden bağlanabilir. |
| Onaylı şablonlar | Lolly, şablonun düzenlenebilir girdilerini tanımlar; Lolly Work grup görünürlüğünü ve değerleri kilitleyen, seçenekleri kısıtlayan veya denetimleri gizleyen girdi politikalarını uygular. |
| Paylaşılan varlık kitaplığı | Örneğe ait yüklemeler, koleksiyonlar, özel meta veriler ve erişim denetimli kataloglar ile mevcut DAM ve depolama kitaplıklarını okuyan bağlayıcılar. |
| İnceleme | Sıralı onay adımları, uygun onaylayıcı grupları, yeter sayı kuralları ve görev ayrılığı; inceleme, kataloğa gönderimleri ve kuruluş hedeflerine teslimatı yönetebilir. |
| Varlık geçmişi ve kullanılabilirliği | Örneğe ait varlıklar için sürümler ve geri alma, saklama ve silmeyi askıya alma, zamanlanmış kullanılabilirlik, süre dolumu ve iptal. Bağlı sağlayıcılar kendi kaynak geçmişlerini tutar. |
| Lisanslar ve atıflar | Lolly bir dosyanın kullandığı her kaynağın lisansını kaydeder ve gereken atıfları hazırlar; [Yaratıcı haklar ve atıflar](/info/creative-rights.html) neyi kaydettiğini ve atıfların nereye yazıldığını açıklar. Haklar için izin almaz. |
| Raporlama | Varlık kullanımı ve indirme sayıları, araç ve dışa aktarma etkinliği, gösterge panoları ve denetim kaydı. Kullanımın kişiye bağlanması kurulumun telemetri politikasına uyar; varsayılan ilişkilendirme ayarı rıza gerektirir. |
| Dağıtım | Süresi dolan, iptal edilebilir bağlantılar, paylaşılan koleksiyonlar, misafir erişimi ve yapılandırılmış kuruluş hedeflerine teslimat. |
| Kamuya açık bir marka sayfası | Lolly, Lolly Design System Setup veya komut satırından statik bir [marka sayfası](/info/brand-page.html) yazar: insanlar için logolar, renkler, yazı tipleri, kurallar ve örnekler; ajanlar için token'lar, `DESIGN.md` ve beceriler. Klasörü sen barındırırsın veya bir yönetici Lolly Work'te varsayılan olarak kapalı olan [marka sayfası barındırmayı](/info/work-design-system-administration.html#host-a-brand-page) açar. |

[Katalog ve içerik](/info/work-catalog.html), [Onaylar](/info/work-approvals.html) ve [Politika ve yönetişim](/info/work-governance.html) bu özellikleri ve yapılandırmalarını anlatır.

<!--i:eti-checklist-->
## Birleşik iş akışını değerlendir

Kendi kitaplığınla kaynak erişimini, izin verilen düzenlemeleri, çıktı incelemesini ve teslimatı test etmek için [etkinlik kartı üretim sırasını](/info/dam-production.html) kullan. [Ne nerede çalışır](/info/compare.html#what-runs-where) her karşılaştırmanın ortak sınırlarını listeler. Tek başına bir kaynak bağlantısı, sağlayıcı ortaklığı veya her kiracı için uygunluk anlamına gelmez.

[Lolly'nin diğerleriyle karşılaştırması](/info/positioning.html) yetenek karşılaştırmasını içerir. Sağlayıcı adları karşılaştırılan ürünleri tanımlar. Lolly onlarla bağlantılı değildir.
