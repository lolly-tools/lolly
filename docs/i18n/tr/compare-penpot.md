# Lolly ve Penpot

_Son kontrol: 28 Eylül 2026._

Lolly ve Penpot ikisi de açık kaynaklı tasarım araçları, paylaşılan tasarım token'ları ve canlı iş birliği sunar. Lolly, cihaz üstü oluşturmayı ayrı dağıtılan kurumsal hizmeti [lolly.work](https://lolly.work) ile birleştirir.

## Ortak tasarım temelleri

[Penpot'un tasarım token'ları](https://help.penpot.app/user-guide/design-systems/design-tokens/) DTCG biçimini kullanır; Lolly de bu biçimi okur. Renkler, yazı tipi ve diğer token değerleri iki iş akışı arasında paylaşılabilir. Lolly'nin [Tasarım içe aktar](/info/design-import.html) özelliği bir `.penpot` dışa aktarımını düzenlenebilir bir yerleşim olarak açar.

Penpot için Lolly Export eklentisi Lolly tarafından geliştirilir. Cihaz üstünde, isteğe bağlı C2PA Content Credentials için Lolly'nin motorunu kullanır. İmza bütünlüğü ile imzalayana güven ayrı konulardır: doğrulayıcının, [Content Credentials Kimliği](/info/content-credentials-identity.html) sayfasında açıklandığı gibi, güvendiği bir kimliğe ihtiyacı vardır.

## Tasarım ve ekip iş akışları

[Penpot](https://penpot.app/) arayüz tasarımı, bileşenler, esnek yerleşimler, etkileşimli prototipler ve geliştirici incelemesi sunar. Barındırılan ve kendi sunucunuzda barındırılan dağıtımlar sunar; [Docker ve Kubernetes kurulum seçenekleri](https://help.penpot.app/technical-guide/getting-started/) vardır.

Lolly'nin Tasarım tuvali düzenlenebilir varlıklar oluşturur ve bir yerleşimi [kurallı bir araca](/info/create-a-tool.html) dönüştürebilir. Aynı araç tarayıcıda, masaüstü uygulamasında veya CLI'da işlenir ve veriden varyantlar üretebilir. Ekip çalışması için Lolly hem iki cihazlı doğrudan [özel collab'lara](/info/collaborate.html) hem de lolly.work üzerinden work collab'lara sahiptir; bunlar paylaşılan düzenlemeler, imleçler ve kaydedilmiş ekip oturumları içerir.

## Dağıtımlar nasıl farklılaşır

Bağımsız Lolly, hesap veya sunucu olmadan cihazda işler ve imzalar. lolly.work SSO, SCIM ile kullanıcı sağlama, paylaşılan kataloglar ve projeler, roller, onaylar, denetim kayıtları ve sunucu tarafı işleme ekler. Her iki depo da MPL-2.0 açık kaynaklıdır ve kurum tarafından çalıştırılabilir. Paylaşılan iş yapılandırılmış örneği kullanır; yerel oluşturma bağımsız olarak kullanılabilir kalır.

Seçim işe bağlıdır: Penpot'un arayüz tasarımı ve prototipleme iş akışı, Lolly'nin tekrarlanabilir varlık üretimi ya da paylaşılan token'lar ve içe aktarılan tasarımlarla bir kombinasyon. Lolly'nin work iş birliği şu anda tek bir sunucu düğümünde çalışır ve [dağıtım durumu](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) bir kurumun değerlendirmesinin parçası olmalıdır.

Penpot, sahibinin ticari markasıdır. Yukarıdaki eklenti Lolly'ye aittir. Daha geniş karşılaştırma için [Lolly nasıl karşılaştırılır](/info/positioning.html) ve [birleşik çözüme genel bakış](/info/compare.html) sayfalarına bakın.
