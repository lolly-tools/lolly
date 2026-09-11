# Tarayıcı Uzantısı

**Lolly URL Screenshot** uzantısı, web uygulamasının tarayıcın içinden herhangi bir web sayfasının ekran görüntüsünü almasını sağlar. Uzantı olmadan bir URL'yi yakalamak masaüstü uygulamasını gerektirir - bir tarayıcı sayfası başka bir siteden tek başına piksel okuyamaz. Uzantı bunu, masaüstü uygulamasının kullandığı aynı yakalamayı kullanarak yapabilir.

Aynı şekilde başka bir iş daha yapar: adlandırdığın tek bir sayfayı okur, böylece Brand Studio canlı bir web sitesinden bir marka çekebilir. İkisi de aşağıda ele alınıyor.

Chromium tabanlı tarayıcılarda çalışır: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 veya üzeri.

Kurulana kadar **URL Screenshot** yine de açılır, böylece bir çekim oluşturabilirsin; aracın kontrollerinin üstündeki bir not neyin eksik olduğunu söyler.

![Dosyaya yakalama işleminin çalışacağı bir sunucu olmadığında gösterilen, URL Screenshot aracının uzantıyı öneren notu](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Beklerken her kontrol canlıdır: hedef URL, kaydırma derinliği, yerleşme gecikmesi, kırpma boşlukları ve yeniden renklendirme. Yalnızca yakalamanın kendisi bir sunucu gerektirir.

![Hedef URL, kaydırma derinliği, yerleşme gecikmesi ve kırpma boşlukları içeren, uzantı olmadan önce de kullanılabilen URL Screenshot kontrolleri](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Kurulum

### Chrome Web Store'dan

*Yakında.* Yayınlandığında tek tıkla kuracaksın, ardından Lolly'yi yeniden yükleyeceksin.

### Kendin yükle (geliştiriciler)

Uzantı, depoda `shells/chrome-extension/` altında yer alır.

1. `chrome://extensions` adresini aç.
2. **Geliştirici modunu** (sağ üstte) etkinleştir.
3. **Paketlenmemişi yükle**'ye tıkla ve `shells/chrome-extension/` klasörünü seç.
4. Lolly'yi yeniden yükle - **URL Screenshot** artık tarayıcıda çalışır.

## Nasıl çalışır

- Küçük bir betik, uzantının mevcut olduğunu Lolly'ye bildirir; böylece **URL Screenshot** aracı otomatik olarak etkinleşir - kurulum gerekmez.
- Görüntü oluşturduğunda, uzantı hedef sayfayı arka planda bir sekmede açar, DevTools Protokolü üzerinden yakalar (masaüstü uygulamasının kullandığı aynı `Page.captureScreenshot`), ardından sekmeyi kapatır ve görüntüyü geri verir.
- Tamamen tarayıcında, kendi ağında çalışır - bu yüzden `localhost` veya bir iç siteyi yakalamak da işe yarar. Yakalamanın kendisi hiçbir yere yüklenmez; tek ağ trafiği, çekmesini istediğin sayfayı yükleyen kendi tarayıcındır.

Bir yakalama çalışırken, geçici sekmede kısaca *"…bu tarayıcıda hata ayıklamaya başladı"* bildirimini görebilirsin. Bu, DevTools Protokolünün çalışmasıdır; çekim bittiğinde kendiliğinden kaybolur.

## Brand Studio için bir site okumak

Brand Studio'daki **Website** kaynağı, zaten sahip olduğun bir siteden bir marka başlatır. Chromium'da bunu okuyan uzantıdır; masaüstü uygulamasında aynı işi yerel bir getirme (fetch) yapar ve uzantısı olmayan düz bir tarayıcıda bu döşeme (tile) hiç sunulmaz.

Ona bastığında olanlar:

- Tek adres, tek sayfa. Uzantı aynı türden bir arka plan sekmesinde onu açar, işlenmiş biçimlendirmeyi (rendered markup), stil sayfası metnini ve birkaç simge ile logo görselini okur, sonra sekmeyi kapatır. Bağlantıları takip etmez ve tarama yapmaz.
- Başka yerde barındırılan stil sayfaları ve yazı tipleri (bir CDN, bir font servisi) de getirilir, çünkü sayfanın renkleri ve tipografisi bunların içinde yaşar. Çapraz kökenli istekler çerezlerin olmadan gider; aynı kökenli olanlar, sayfanın kendisinin yapacağı gibi çerezleri kullanır.
- Her şeyin bir üst sınırı vardır - sınırlı sayıda sayfa, görsel ve bayt - böylece kötü niyetli veya yarı bozuk bir sayfa askıda kalmak yerine kısmi malzeme döndürür.
- Baytlar doğrudan isteği yapan Lolly sekmesine geri gider. Renklere, tipografiye ve logolara ayrıştırma cihazında gerçekleşir; hiçbir şey yüklenmez.

Sen basmadan hiçbir şey okunmaz. Bir adres yapıştırmak yalnızca alanı doldurur.

## Kurduktan sonra

Lolly sekmesini yeniden yükle. "Uzantıyı al" istemi kaybolur ve **URL Screenshot** galeride ve Toplu (Batch) modda kullanılabilir hâle gelir.

## İzinler

`manifest.json` dosyası, sunucu erişimine ek olarak dört izin bildirir:

- `debugger` - arka plan sekmesini DevTools Protokolü üzerinden yönetir. Ekran görüntüsünü alan budur.
- `tabs` - geçici arka plan sekmesini açar ve ardından yeniden kapatır.
- `scripting` - Brand Studio Website kaynağı için, belirttiğin site içinde tek sayfalık okuyucuyu çalıştırır.
- `storage` - açtığı bir sekmenin kimliğini, yalnızca oturum depolamasında not eder; böylece tarayıcı uzantıyı okuma sırasında askıya alsa bile sekme yine de kapatılır. Bir sonraki başlangıçta temizlenir; hakkında hiçbir şey saklanmaz.
- `host_permissions: ["<all_urls>"]` - *tüm* sitelere sunucu erişimi, çünkü onu istediğin herhangi bir URL'ye yönlendirebilirsin. Chrome bunu kurulum sırasında geniş kapsamlı bir "tüm web sitelerindeki tüm verilerini oku ve değiştir" uyarısı olarak gösterir.

Bu uyarıya rağmen, yalnızca yakalamasını veya içe aktarmasını istediğin tek sayfayı okur ve gezinme verilerini okumaz veya iletmez - hiçbir şey hiçbir yere yüklenmez.

Manifest ayrıca `minimum_chrome_version: 111` ayarını yapar. Güncel sürüm 0.2.1'dir.

## Sorun giderme

- **Hâlâ "Uzantıyı al" mı görüyorsun?** Lolly sekmesini yeniden yükle - algılama sayfa yüklenirken gerçekleşir.
- **Bu sitede hiçbir şey olmuyor mu?** Uzantı yalnızca Lolly'nin kendi kökenlerinde etkinleşir. Başka bir alan adında özel bir yapı mı çalıştırıyorsun? Uzantının `manifest.json` dosyasındaki `content_scripts.matches` alanına ekle.
- **Bir yakalama başarısız mı oluyor?** URL'nin erişilebilir olduğundan ve `http://` veya `https://` ile başladığından emin ol. Bazı sayfalar otomatik yakalamayı etkin biçimde engeller.
