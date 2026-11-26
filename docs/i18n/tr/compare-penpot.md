# Lolly ve Penpot

_Son denetim: 28 Eylül 2026._

Ekibin Penpot'ta tasarım yapıyorsa Lolly, Penpot ile birlikte çalışır. İkisi de açık kaynaklıdır ve aynı tasarım token'larını okur. Bu sayfa her birinin hangi iş için olduğunu anlatır.

<!--i:eti-award-->
## Penpot neyi daha iyi yapar

[Penpot](https://penpot.app/), gerçek zamanlı düzenleme ve canlı imleçlerle arayüz tasarımı, bileşenler, esnek düzenler, etkileşimli prototipler ve geliştirici incelemesi sunar. [Docker ve Kubernetes kurulum seçenekleriyle](https://help.penpot.app/technical-guide/getting-started/) barındırılan ve kendi sunucunda barındırabileceğin kurulumlar sunar. Bir uygulama tasarlamak için araç Penpot'tur.

<!--i:eti-blend-->
## Nerede örtüşürler

[Penpot'un tasarım token'ları](https://help.penpot.app/user-guide/design-systems/design-tokens/), Lolly'nin de okuduğu DTCG biçimini kullanır; böylece renkler, yazı tipleri ve diğer token değerleri ikisi arasında taşınır. Lolly'nin [Bir tasarımı içeri aktar](/info/design-import.html) özelliği, `.penpot` dışa aktarmasını düzenlenebilir bir düzen olarak açar ve Lolly'deki **Send to Penpot**, bir tasarımı `.penpot` arşivi olarak geri gönderir. Lolly ayrıca, cihazda isteğe bağlı Content Credentials eklemek için Lolly motorunu kullanan [Penpot için Lolly Export eklentisini](https://github.com/lolly-tools/lolly-plugins-penpot-export) geliştirir ve bakımını yapar.

<!--i:eti-lolly-->
## Lolly ortak işi nasıl yapar

Lolly Design tuvali düzenlenebilir varlıklar yapar ve bir düzeni [kuralları olan bir araca](/info/create-a-tool.html) dönüştürebilir. Aynı araç tarayıcıda, masaüstü uygulamasında veya CLI'da render eder ve verilerden varyantlar yapar. Bağımsız Lolly, hesap veya sunucu olmadan cihazda render eder ve imzalar. Bir [özel işbirliği](/info/collaborate.html) iki cihazı doğrudan eşler.

<!--i:eti-building-->
## Bir kuruluşla

Lolly Work; tek oturum açma, SCIM ile sağlama, paylaşılan kataloglar ve projeler, roller, onaylar, denetim kayıtları, ekip işbirlikleri ve sunucuda render ekler. İki depo da MPL-2.0 lisanslıdır ve bir kuruluş ikisini de çalıştırabilir. [Ne nerede çalışır](/info/compare.html#what-runs-where) iki parçayı yan yana gösterir.

İkisini de kullanabilirsin: arayüz tasarımı ve prototipleme için Penpot, tekrarlanabilir dosyalar için Lolly.

Penpot, sahibinin ticari markasıdır. Bu sayfa iki ürünün nerede örtüştüğünü anlatır ve Penpot ile bağlantılı değildir.
