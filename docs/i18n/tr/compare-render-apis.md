# Lolly ve işleme (rendering) API'leri

_Son kontrol: 28 Eylül 2026._

Lolly şablonlardan ve verilerden varlıkları cihazınızda, CI'da veya [lolly.work](https://lolly.work)'ün sunucu API'si üzerinden üretir. Birleşik çözüm, otomatik işlemenin yanı sıra bir kurumun üretim işlerinin etrafındaki kimlik, ilke ve teslimatı da kapsar.

## Örtüştükleri alanlar

[Bannerbear](https://www.bannerbear.com/) ve [Placid](https://placid.app/), şablonlardan API'ler ve entegrasyonlar aracılığıyla görseller ve diğer medyayı üretir. Lolly de aynı şablon artı girdi yaklaşımını kullanır; iş göndermenin yolları [URL modu](/info/url-mode.html), [CLI](/info/cli.html), toplu işlem ızgarası (batch grid) ve sunucu uç noktalarıdır.

## lolly.work'ün sağladıkları

lolly.work, Lolly projesindeki ayrı dağıtılan kurumsal hizmettir. Lolly motorunu bir API arkasında çalıştırır, araç görünürlüğü ve girdi ilkelerini uygular, işlenmiş dosyaları ve imzalı paylaşım bağlantılarını sunar. [Kurtarılabilir işleme hizmeti](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) tekil işleri ve toplu işleri, idempotent gönderimi, durumu, sınırlı yeniden denemeleri, iptali ve saklanan çıktıları destekler. Kalıcı depolama yapılandırıldığında kesintiye uğrayan iş, sunucu yeniden başlatıldıktan sonra devam edebilir.

Sunucu, hızlı bir SVG/PNG işleme yolu ve tarayıcı gerektiren araçlar için isteğe bağlı bir Chromium çalışanı kullanır. Otomasyon hizmet token'larıyla kimlik doğrular ve tamamlanan çıktı [yönetilen teslimat](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) aracılığıyla kurum hedeflerine gönderilebilir. Yapılandırılmış bir imzalama kimliği, desteklenen sunucu çıktısında C2PA imzalamayı etkinleştirir.

## Hizmeti kim çalıştırır

Bannerbear ve Placid işlemeyi kendi altyapıları ve entegrasyonlarıyla yönetilen hizmetler olarak paketler. Lolly ile bir birey yerel olarak işleyebilir veya bir ekip lolly.work'ü kendi altyapısında çalıştırabilir. Her iki Lolly deposu da MPL-2.0 açık kaynaklıdır; kendi sunucunuzda barındırmanın işleme başına yazılım lisans ücreti yoktur, ancak hesaplama, depolama ve operasyon planlanması gereken maliyetler olarak kalır.

Herkese açık lolly.work sitesi bir değerlendirme alanıdır (sandbox); üretim barındırma taahhüdü değildir. Kalıcı bir hizmet için kalıcı veritabanı ve çıktı depolaması gerekir; tarayıcıya bağımlı araçlar Chromium çalışanına ihtiyaç duyar. [Kurulum kılavuzu](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) ve [durum sayfası](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) bu gereksinimleri ve mevcut sınırları açıklar.

Yerel ve CI işleme, kurumsal hizmet olmadan da kullanılabilir. Bir sunucu işi göndermek girdilerini ve gerekli varlıkları o örneğe gönderir; bu, cihaz üstü yoldan farklıdır. [Birleşik çözüme genel bakış](/info/compare.html) sayfasına bakın.

Bannerbear ve Placid, sahiplerinin ticari markalarıdır. Bu sayfa çözümlerin nerede örtüştüğünü anlatır ve hiçbiriyle bağlantılı değildir.
