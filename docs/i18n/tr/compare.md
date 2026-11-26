# Araç araç Lolly karşılaştırması

Bu sayfalar Lolly'nin başka bir ürünün yerini alıp almadığını, o ürünle birlikte çalışıp çalışmadığını veya işine uygun olup olmadığını anlatır. Her sayfa diğer ürünün daha iyi yaptığı şeylerle başlar.

_Son denetim: 28 Eylül 2026._

<!--i:eti-grid-->
## Ürüne göre karşılaştır

- [Lolly ve Canva](/info/compare-canva.html) - şablonlar, günlük tasarım ve ortak marka üretimi.
- [Lolly ve Adobe](/info/compare-adobe.html) - düzenleme, dönüştürme, profesyonel çıktı ve Content Credentials.
- [Lolly ve Figma](/info/compare-figma.html) - tasarım, canlı işbirliği ve yeniden kullanılabilir varlık üretimi.
- [Lolly ve Penpot](/info/compare-penpot.html) - açık kaynak tasarım, ortak token'lar ve kuruluş çalışmaları.
- [Lolly ve marka portalları](/info/compare-brand-portals.html) - onaylı kitaplıklar, kilitli şablonlar, kimlik, inceleme ve raporlama.
- [Lolly ve render API'leri](/info/compare-render-apis.html) - cihazında, CI'da veya kendi sunucunda otomatik üretim ve Bannerbear veya Placid'den [nasıl geçiş yapılacağı](/info/work-move-from-render-api.html).
- [Lolly ve çevrimiçi dosya dönüştürücüler](/info/compare-converters.html) - kendi cihazında biçim dönüştürme.

[Lolly'nin diğerleriyle karşılaştırması](/info/positioning.html) sayfasında yetenekler tek tek karşılaştırılır. Her karşılaştırma tarihlidir. Artık ürünlerden biriyle örtüşmeyen bir iddianın düzeltilmesi gerekir.

<!--i:eti-map-pin-->
## Ne nerede çalışır

Her karşılaştırma, tek bir açık kaynak projenin iki parçasını kapsar. **Lolly** motor, uygulamalar ve araçlardır. **Lolly Work**, [lolly-work deposunda](https://github.com/lolly-tools/lolly-work) sürdürülen kuruluş sunucusudur. İkisi de MPL-2.0 lisanslıdır ve hangi Lolly Work hizmetlerinin açılacağına kuruluş karar verir.

::: cols
## Cihazında: Lolly

- Bağımsız kullanım için hesap gerekmez
- Üretme, düzenleme, dönüştürme ve dışa aktarma
- Gereken araçlar ve varlıklar kaydedildikten sonra çevrimdışı çalışır
- Cihazda imzalanan Content Credentials
- İki cihaz arasında, sunucusuz özel işbirlikleri

## Kuruluşunun sunucusunda: Lolly Work

- Tek oturum açma, SCIM ile sağlama, roller ve politikalar
- Paylaşılan kataloglar, ekip projeleri ve ekip işbirlikleri
- Onaylar, kullanım raporları ve denetim kayıtları
- Sunucuda render, kurtarılabilir işler ve onaylı teslimat
- Kuruluşun kimliğiyle sunucuda imzalama
:::

Bağımsız kullanım dosyaları cihazda tutar. Paylaşılan projeler, ekip işbirliği, sunucuda render veya teslimatı seçmek, o özelliğin ihtiyaç duyduğu verileri kuruluşunun sunucusuna gönderir.

<!--i:eti-info-->
## Her karşılaştırmanın varsayımları

Bu sınırlar bu dizideki her sayfa için geçerlidir:

- **Lolly Work işbirlikleri bugün tek bir sunucu düğümünde çalışır.** Ölçekleri ve işletim geçmişleri, uzun süredir var olan barındırılan ürünlerden farklıdır. [Lolly Work durumu ve yol haritası](/info/work-status.html) güncel sınırları kaydeder.
- **[lolly.work](https://lolly.work) adresindeki site bir demo deneme ortamıdır.** Kalıcı bir kuruluş kurulumu, kalıcı depolama ve bir işletmeci gerektirir. [Lolly Work'ü kur](/info/work-install.html) ikisini de kapsar.
- Lolly veya kendi sunucunda barındırdığın Lolly Work için **kullanıcı başına yazılım lisans ücreti yoktur**. Barındırma, depolama ve işletim yine de maliyetlidir.
- **İmza, güvenilir imzalayan anlamına gelmez.** Bir doğrulayıcı, imzalayanı yalnızca dosyayı imzalayan sertifikaya güvendiğinde güvenilir olarak gösterir. [Content Credentials kimliği](/info/content-credentials-identity.html) bunun nasıl olduğunu açıklar.
