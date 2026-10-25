# Lolly ve işleme (rendering) API'leri

_Son kontrol: 28 Eylül 2026._

Bugün şablonlardan görselleri bir API ile üretiyorsan bu sayfa Lolly'nin aynı işi kendi cihazında, CI'da veya kendi sunucunda nasıl yaptığını söyler.

## Barındırılan render API'lerinin daha iyi yaptığı

[Bannerbear](https://www.bannerbear.com/) ve [Placid](https://placid.app/) render'ı kendi altyapıları, entegrasyonları ve desteğiyle yönetilen hizmetler olarak paketler. Bir istek gönderirsin ve sunucuları başkası çalıştırır.

## Örtüştükleri alanlar

İkisi de bir şablon artı girdileri medyaya çevirir. Lolly girdileri bir [bağlantıdan](/info/url-mode.html), [CLI](/info/cli.html) üzerinden, bir toplu iş ızgarasından veya bir sunucu uç noktasından alır.

## Lolly örtüşen işi nasıl yapar

Aynı araç, aynı girdilerden bir dizüstü bilgisayarda, bir CI işinde veya bir sunucuda render edilir. Yerel ve CI render'ı hiçbir hizmet gerektirmez.

![Batch dışa aktarma ayarları: dosya adı, varsayılan biçim, birimler, DPI ve render edilecek satır sayısı](/info/shots/use-batch-toolbar.svg)

Bir sunucuda [Lolly Work](/info/compare.html#what-runs-where), Lolly motorunu bir API'nin arkasında çalıştırır ve araç görünürlüğü ile girdi politikalarını uygular. [Recoverable render service](/info/work-renders.html) tekil işleri ve toplu işleri, idempotent gönderimi, durumu, sınırlı yeniden denemeleri, iptali ve tutulan çıktıları destekler ve kalıcı depolama yapılandırıldığında yarıda kalan iş bir yeniden başlatmadan sonra sürer.

Sunucuda hızlı bir SVG ve PNG yolu ve bir tarayıcıya ihtiyaç duyan araçlar için isteğe bağlı bir Chromium çalışanı vardır. Otomasyon hizmet belirteçleriyle giriş yapar, bitmiş çıktı [approved delivery](/info/work-delivery.html) üzerinden kuruluş hedeflerine gidebilir ve yapılandırılmış bir imzalama kimliği desteklenen çıktıya Content Credentials ekler.

## Hizmeti kim çalıştırır

Lolly ile bir birey yerelde render eder ya da bir ekip Lolly Work'ü kendi altyapısında çalıştırır. Bir sunucu işi göndermek, girdilerini ve gereken varlıkları o örneğe gönderir; bu, cihaz üzerindeki yoldan farklıdır. Kalıcı bir hizmet kalıcı bir veritabanı ve çıktı depolaması gerektirir ve tarayıcıya bağımlı araçlar Chromium çalışanı gerektirir; ikisini de [Install Lolly Work](/info/work-install.html) anlatır.

Bannerbear ve Placid, sahiplerinin ticari markalarıdır. Bu sayfa ürünlerin nerede örtüştüğünü anlatır ve ikisiyle de bağlantılı değildir.
