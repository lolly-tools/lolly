# Lolly ve Penpot

_Son kontrol: 28 Eylül 2026._

Ekibin Penpot'ta tasarım yapıyorsa Lolly, Penpot'un yanında çalışır: ikisi de açık kaynaktır ve ikisi de aynı tasarım token'larını okur. Bu sayfa her birinin hangi iş için olduğunu söyler.

## Penpot'un daha iyi yaptığı

[Penpot](https://penpot.app/) gerçek zamanlı düzenleme ve canlı imleçlerle arayüz tasarımı, bileşenler, esnek düzenler, etkileşimli prototipler ve geliştirici incelemesi sağlar. [Docker ve Kubernetes kurulum seçenekleriyle](https://help.penpot.app/technical-guide/getting-started/) barındırılan ve kendi sunucusunda barındırılan dağıtımlar sunar. Bir uygulama tasarlamak için araç Penpot'tur.

## Örtüştükleri alanlar

[Penpot'un tasarım token'ları](https://help.penpot.app/user-guide/design-systems/design-tokens/), Lolly'nin de okuduğu DTCG biçimini kullanır; böylece renkler, yazı ve diğer token değerleri ikisi arasında taşınır. Lolly'nin [Import a design](/info/design-import.html) özelliği bir `.penpot` dışa aktarmasını düzenlenebilir bir düzen olarak açar ve Lolly'deki **Send to Penpot** bir tasarımı `.penpot` arşivi olarak geri gönderir. Lolly ayrıca cihazda isteğe bağlı Content Credentials eklemek için Lolly'nin motorunu kullanan [Lolly Export plugin for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export) eklentisini sürdürür.

## Lolly örtüşen işi nasıl yapar

Lolly'nin Design tuvali düzenlenebilir varlıklar yapar ve bir düzeni [kurallı bir araca](/info/create-a-tool.html) dönüştürebilir. Aynı araç tarayıcıda, masaüstü uygulamasında veya CLI'de render edilir ve veriden varyantlar yapar. Bağımsız Lolly hesap veya sunucu olmadan cihazda render eder ve imzalar. Bir [özel collab](/info/collaborate.html) iki cihazı doğrudan eşler.

## Bir kuruluşla

Lolly Work; çoklu oturum açma (SSO), SCIM hesap sağlama, paylaşılan kataloglar ve projeler, roller, onaylar, denetim kayıtları, work collab'lar ve sunucu render'ı ekler. İki depo da MPL-2.0'dır ve bir kuruluş ikisini de çalıştırabilir. [What runs where](/info/compare.html#what-runs-where) iki parçayı yan yana koyar.

İkisini de kullanabilirsin: arayüz tasarımı ve prototipleme için Penpot, tekrarlanabilir dosyalar için Lolly; paylaşılan token'lar ve içe aktarılan tasarımlarla birleştirilmiş.

Penpot, sahibinin ticari markasıdır. Bu sayfa iki ürünün nerede örtüştüğünü anlatır ve Penpot ile bağlantılı değildir.
