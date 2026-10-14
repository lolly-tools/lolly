# Lolly ve marka portalları

_Son kontrol: 28 Eylül 2026._

Lolly ve [lolly.work](https://lolly.work) birlikte, ekiplerin marka portallarını kullandığı oluşturma ve yönetişim iş akışlarını kapsar: onaylı varlıklar, kilitli şablonlar, erişim denetimi, inceleme ve dağıtım. İnsanların marka varlıklarını nasıl bulacağını ve yenilerini nasıl üreteceğini seçerken bu birleşik çözümü Bynder, Frontify, Marq veya Brandfolder ile karşılaştırın.

## Oluşturma ve kurumsal hizmetler

Dosyaları Lolly'nin motoru ve uygulamaları üretir. Şablonlar, tasarım token'ları ve izin verilen girdiler bir kişinin neyi değiştirebileceğini belirler; işleme (rendering) kişinin kendi cihazında kalabilir. Bağımsız Lolly hesap gerektirmez.

lolly.work aynı projedeki kurumsal hizmettir; [ayrı bir depoda](https://github.com/lolly-tools/lolly-work) geliştirilir ve Lolly ile birlikte dağıtılır. Kimlik, paylaşılan depolama, ilke, onay ve raporlama ekler. Her iki parça da MPL-2.0 ile açık kaynaklıdır. Bu ayrım, bireyin Lolly'yi bağımsız kullanmasına, kurumun ise birleşik çözümü kendi denetimindeki altyapıda çalıştırmasına olanak tanır.

## Birleşik çözümün sağladıkları

| İhtiyaç | Lolly + lolly.work |
|---|---|
| Oturum açma ve kullanıcı sağlama | OIDC ile tek oturum açma, birden çok kimlik sağlayıcı, SCIM 2.0 ile kullanıcı sağlama ve grup üyeliği, ayrıca mevcut oturumları iptal eden hesap devre dışı bırakma. Yalnızca SAML kullanan bir kimlik sağlayıcı, Keycloak gibi bir OIDC köprüsü üzerinden bağlanabilir. |
| Onaylı şablonlar | Lolly, şablonun düzenlenebilir girdilerini tanımlar; lolly.work grup görünürlüğünü ve değerleri kilitleyen, seçenekleri kısıtlayan veya denetimleri gizleyen girdi ilkelerini uygular. |
| Paylaşılan varlık kütüphanesi | Örneğe ait yüklemeler, koleksiyonlar, özel üstveri ve erişim denetimli kataloglar; ayrıca mevcut DAM ve depolama kütüphanelerini okuyan bağlayıcılar. |
| İnceleme | Sıralı onay adımları, yetkili onaylayıcı grupları, yeter sayı (quorum) kuralları ve görev ayrılığı; inceleme, katalog gönderimlerini ve kurum hedeflerine teslimatı yönetebilir. |
| Varlık geçmişi ve erişilebilirlik | Örneğe ait varlıklar için sürümler ve geri alma, saklama ve bekletme (hold), zamanlanmış kullanıma açma, süre bitimi ve iptal. Bağlı sağlayıcılar kendi kaynak geçmişlerini korur. |
| Raporlama | Varlık kullanım ve indirme sayıları, araç ve dışa aktarma etkinliği, panolar ve denetim izi. Kullanım atfı dağıtımın telemetri ilkesine bağlıdır; varsayılan atıf ayarı onay gerektirir. |
| Dağıtım | Süreli, iptal edilebilir bağlantılar, paylaşılan koleksiyonlar, konuk erişimi ve yapılandırılmış kurum hedeflerine teslimat. |

[lolly.work operatör kılavuzları](https://github.com/lolly-tools/lolly-work/tree/main/docs) bu özellikleri ve yapılandırmalarını anlatır. Bunlar, Lolly'nin etrafına başka bir sistem kurmayı gerektiren özellikler değil, kullanıma hazır yeteneklerdir.

## Portal iş akışı seçmek

Köklü portallar yönetilen barındırma, destek ve kapsamlı DAM iş akışları sunar. Örneğin [Frontify'ın kurumsal DAM'i](https://www.frontify.com/en/solution/enterprise-digital-asset-management) varlık keşfini, erişim denetimlerini, onay iş akışlarını ve dağıtımı bir araya getirir. İhtiyacınız olan inceleme ve haklar iş akışını tam olarak karşılaştırın: Lolly üstveri, erişim ve kullanıma açma denetimleri sağlar; hukuki onay ve lisans yükümlülükleri ise yine kurumun kendi sürecini gerektirir. Onay zincirleri sıralıdır; keyfi dallanan iş akışlarını modellemez.

Lolly yığını daha gençtir ve [lolly.work durum sayfası](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) dağıtım sınırlarını kaydeder. Özellikle herkese açık lolly.work sitesi bir değerlendirme alanıdır (sandbox). Kalıcı bir kurumsal dağıtım için kalıcı depolama ve bir operatör gerekir. Kendi sunucunuzda barındırmak için koltuk başına yazılım lisans ücreti yoktur; altyapı ve yönetim yine de maliyetlidir.

Mevcut bir DAM de gerçeğin tek kaynağı olarak kalabilir. lolly.work'ün katalog bağlayıcıları onaylı varlıklarını Lolly'de kullanılabilir kılar; insanlar yeni dosyaları burada kurumun kuralları çerçevesinde üretir. Bu bir entegrasyon tercihidir; kurum bu iş akışlarını kendisi yönetmek istediğinde Lolly'nin kendi kütüphanesi ve onayları kullanılabilir.

Yetenek karşılaştırması için [Lolly nasıl karşılaştırılır](/info/positioning.html), bu serinin geri kalanı için [Lolly karşılaştırması, araç araç](/info/compare.html) sayfalarına bakın. Satıcı adları karşılaştırılan ürünleri belirtir; Lolly bunlarla bağlantılı değildir.
