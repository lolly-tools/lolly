# Lolly karşılaştırması, araç araç

Başka bir ürün kullanıyorsan bu sayfalar Lolly'nin o ürünün yerini alıp almadığını, onunla birlikte çalışıp çalışmadığını veya işine uymayıp uymadığını söyler. Her biri diğer ürünün neyi daha iyi yaptığıyla başlar.

_Son kontrol: 28 Eylül 2026._

## Ürüne göre karşılaştır

- [Lolly ve Canva](/info/compare-canva.html) - şablonlar, gündelik tasarım ve paylaşılan marka üretimi.
- [Lolly ve Adobe](/info/compare-adobe.html) - düzenleme, dönüştürme, profesyonel çıktı ve Content Credentials.
- [Lolly ve Figma](/info/compare-figma.html) - tasarım, canlı iş birliği ve yeniden kullanılabilir varlık üretimi.
- [Lolly ve Penpot](/info/compare-penpot.html) - açık kaynaklı tasarım, paylaşılan token'lar ve kuruluş işi.
- [Lolly ve marka portalları](/info/compare-brand-portals.html) - onaylı kitaplıklar, kilitli şablonlar, kimlik, inceleme ve raporlama.
- [Lolly ve render API'leri](/info/compare-render-apis.html) - cihazında, CI'da veya bir Lolly Work sunucusunda otomatik üretim.
- [Lolly ve çevrimiçi dosya dönüştürücüleri](/info/compare-converters.html) - kendi cihazında biçim dönüştürme.

Özellik özellik karşılaştırma için [Lolly nasıl karşılaştırılır](/info/positioning.html) sayfasına bakın. Her karşılaştırma tarihlidir; artık iki üründen birine uymayan bir ifadenin düzeltilmesi gerekir.

## Ne nerede çalışır

Her karşılaştırma tek bir açık kaynak projesinin iki parçasını kapsar. **Lolly** motor, uygulamalar ve araçlardır. **Lolly Work**, [lolly-work deposunda](https://github.com/lolly-tools/lolly-work) sürdürülen kuruluş sunucusudur. İkisi de MPL-2.0'dır ve bir kuruluş hangi Lolly Work hizmetlerinin açılacağına karar verir.

::: cols
## Cihazında: Lolly

- Bağımsız kullanım için hesap yok
- Yapma, düzenleme, dönüştürme ve dışa aktarma
- İhtiyaç duyduğu araçlar ve varlıklar kaydedildikten sonra çevrimdışı çalışır
- Cihazda imzalanan Content Credentials
- İki cihaz arasında, sunucusuz özel collab'lar

## Kuruluşunun sunucusunda: Lolly Work

- Çoklu oturum açma (SSO), SCIM hesap sağlama, roller ve politikalar
- Paylaşılan kataloglar, team projects ve work collab'lar
- Onaylar, kullanım raporlama ve denetim kayıtları
- Sunucu render'ı, kurtarılabilir işler ve onaylı teslimat
- Kuruluşun kimliğiyle sunucu imzalama
:::

Bağımsız kullanım dosyaları cihazda tutar. Paylaşılan projeler, bir work collab, bir sunucu render'ı veya teslimat seçmek, o özelliğin ihtiyaç duyduğu veriyi kuruluşunun sunucusuna gönderir.

## Her karşılaştırmanın varsaydığı

Bu sınırlar bu kümedeki her sayfa için geçerlidir; bu yüzden burada bir kez belirtilir:

- **Work collab'lar bugün tek bir sunucu düğümünde çalışır.** Ölçekleri ve işletim geçmişleri köklü barındırılan ürünlerden farklıdır. [Work status and roadmap](/info/work-status.html) güncel sınırları kaydeder.
- **[lolly.work](https://lolly.work) sitesi bir demo kum havuzudur.** Kalıcı bir kuruluş dağıtımı kalıcı depolama ve bir işletme gerektirir; ikisini de [Install Lolly Work](/info/work-install.html) kapsar.
- Lolly veya kendi sunucusunda barındırılan bir Lolly Work için **koltuk başına yazılım lisansı ücreti yoktur**. Barındırma, depolama ve işletme yine de para tutar.
- **Bir imza güvenilen bir imzalayan değildir.** Bir doğrulayıcı, imzalayanı güvenilen olarak göstermeden önce bir dosyayı imzalayan sertifikaya güvenmelidir; nasıl olduğunu [Content Credentials Identity](/info/content-credentials-identity.html) açıklar.
