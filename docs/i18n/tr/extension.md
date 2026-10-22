# Tarayıcı Uzantısı

**Lolly URL Screenshot** uzantısı, web uygulamasının tarayıcın içinden herhangi bir web sayfasının ekran görüntüsünü almasını sağlar. Uzantı olmadan bir URL'yi yakalamak masaüstü uygulamasını gerektirir - bir tarayıcı sayfası başka bir siteden tek başına piksel okuyamaz. Uzantı bunu, masaüstü uygulamasının kullandığı aynı yakalamayı kullanarak yapabilir.

Aynı şekilde iki iş daha yapar. Bir görsel alanına yapıştırılan web adresi o sayfanın ekran görüntüsüne dönüşebilir (**Bu sayfanın ekran görüntüsünü al**) ve uzantı, adlandırdığın tek bir sayfayı okuyabilir, böylece Brand Studio canlı bir web sitesinden bir marka çekebilir. Her istek, uzantıda onayını bekler.

Chromium tabanlı tarayıcılarda çalışır: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 veya üzeri.

Kurulana kadar **URL Screenshot** yine de açılır, böylece bir çekim oluşturabilirsin; aracın kontrollerinin üstündeki bir not neyin eksik olduğunu söyler.

![Dosyaya yakalama işleminin çalışacağı bir sunucu olmadığında gösterilen, URL Screenshot aracının uzantıyı öneren notu](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Beklerken her kontrol canlıdır: hedef URL, kaydırma derinliği, yerleşme gecikmesi, kırpma boşlukları ve yeniden renklendirme. Yalnızca yakalamanın kendisi bir sunucu gerektirir.

![Hedef URL, kaydırma derinliği, yerleşme gecikmesi ve kırpma boşlukları içeren, uzantı olmadan önce de kullanılabilen URL Screenshot kontrolleri](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Kurulum

### Chrome Web Store'dan

*Yakında.* Yayınlandığında tek tıkla kuracaksın, ardından Lolly'yi yeniden yükleyeceksin.

### Kendin yükle (geliştiriciler)

Uzantı, depoda `shells/chrome-extension/` altında yer alır. Bu klasör üretim yapısıdır ve Lolly ile yalnızca `https://lolly.tools` adresinde çalışır.

1. `chrome://extensions` adresini aç.
2. **Geliştirici modunu** (sağ üstte) etkinleştir.
3. **Paketlenmemişi yükle**'ye tıkla ve `shells/chrome-extension/` klasörünü seç.
4. Lolly'yi yeniden yükle - **URL Screenshot** artık tarayıcıda çalışır.

Yerel bir geliştirme sunucusu için `pnpm run pack:chrome-extension:dev` komutunu çalıştır ve bunun yerine `dist/chrome-extension-dev` klasörünü yükle. Bu paket ayrıca `http://localhost:5173` adresini kabul eder ve adında **Development** yer alır.

## Nasıl çalışır

- Küçük bir betik, uzantının mevcut olduğunu Lolly'ye bildirir; böylece **URL Screenshot** yakalamaları başka bir kurulum gerekmeden kaydedebilir.
- Her isteği sen onaylarsın. Lolly sorduğunda uzantı kendi **Approve page request** penceresini açar; pencere isteyen siteyi, ekran görüntüsü mü yoksa sayfa içeriği mi istendiğini ve sayfa adresini gösterir. **Approve once**'a basana kadar hiçbir şey okunmaz. **Cancel** veya pencereyi kapatmak isteği sonlandırır.
- Bir site için ilk kez bir isteği onayladığında Chrome ayrıca uzantının o siteye erişip erişemeyeceğini sorar. İzin verdikten sonra Chrome bu erişimi korur, ama sonraki her istek yine kendi **Approve once** onayını ister.
- Bir onay tek bir isteği kapsar ve 30 saniye sonra sona erer. Aynı anda yalnızca bir istek bekleyebilir veya çalışabilir ve onaylanmış bir istek 55 saniye sonra durdurulur. Lolly sayfası kapanırsa veya değişirse ya da hedef sayfa başka bir siteye geçerse istek iptal edilir.
- Sen onayladıktan sonra uzantı hedef sayfayı arka planda bir sekmede açar, DevTools Protokolü üzerinden yakalar (masaüstü uygulamasının kullandığı aynı `Page.captureScreenshot`), ardından sekmeyi kapatır ve görüntüyü isteyen Lolly sekmesine geri verir.
- Tamamen tarayıcında, kendi ağında çalışır - bu yüzden `localhost` veya bir iç siteyi yakalamak da işe yarar. Sayfa tarayıcı oturumunla yüklenir, bu yüzden oturum açtığın bir sayfa sonuçta özel bilgileri gösterebilir. Yakalamanın kendisi hiçbir yere yüklenmez; tek ağ trafiği, çekmesini istediğin sayfayı yükleyen kendi tarayıcındır.

Bir yakalama çalışırken, geçici sekmede kısaca *"…bu tarayıcıda hata ayıklamaya başladı"* bildirimini görebilirsin. Bu, DevTools Protokolünün çalışmasıdır; çekim bittiğinde kendiliğinden kaybolur.

## Brand Studio için bir site okumak

Brand Studio'daki **Website** kaynağı, zaten sahip olduğun bir siteden bir marka başlatır. Chromium'da bunu okuyan uzantıdır; masaüstü uygulamasında aynı işi yerel bir getirme (fetch) yapar ve uzantısı olmayan düz bir tarayıcıda bu döşeme (tile) hiç sunulmaz.

Ona bastığında olanlar:

- Tek adres, tek sayfa. Sen onayladıktan sonra uzantı onu aynı türden bir arka plan sekmesinde açar, işlenmiş biçimlendirmeyi (rendered markup), stil sayfası metnini ve birkaç simge ile logo görselini okur, sonra sekmeyi kapatır. Bağlantıları takip etmez ve tarama yapmaz.
- Başka yerde barındırılan stil sayfaları (bir CDN, bir font servisi) de getirilir, çünkü sayfanın renkleri ve tipografisi bunların içinde yaşar. Çapraz kökenli istekler çerezlerin olmadan gider; aynı kökenli olanlar, sayfanın kendisinin yapacağı gibi çerezleri kullanır.
- Her şeyin bir üst sınırı vardır - sınırlı sayıda sayfa, görsel ve bayt - böylece kötü niyetli veya yarı bozuk bir sayfa askıda kalmak yerine kısmi malzeme döndürür.
- Baytlar doğrudan isteği yapan Lolly sekmesine geri gider. Renklere, tipografiye ve logolara ayrıştırma cihazında gerçekleşir; hiçbir şey yüklenmez.

Bir adres yapıştırmak yalnızca alanı doldurur. Okumayı başlatıp **Approve once**'a basana kadar hiçbir şey okunmaz.

## Kurduktan sonra

Lolly sekmesini yeniden yükle. "Uzantıyı al" istemi kaybolur, **URL Screenshot** (Yardımcı araçlar altında) yakalamaları bir dosyaya kaydedebilir ve araç Toplu (Batch) modda kullanılabilir hâle gelir.

## İzinler

`manifest.json` dosyası dört izin bildirir; buna ek olarak her seferinde tek bir site için istediği site erişimi vardır:

- `debugger` - arka plan sekmesini DevTools Protokolü üzerinden yönetir. Ekran görüntüsünü alan budur.
- `tabs` - geçici arka plan sekmesini açar ve ardından yeniden kapatır; ayrıca isteği onayladığından beri ne Lolly sayfasının ne de hedef sayfanın yer değiştirmediğini denetler.
- `scripting` - Brand Studio Website kaynağı için, belirttiğin site içinde tek sayfalık okuyucuyu çalıştırır.
- `storage` - açtığı bir sekmenin kimliğini, yalnızca oturum depolamasında not eder; böylece tarayıcı uzantıyı okuma sırasında askıya alsa bile sekme yine de kapatılır. Bir sonraki başlangıçta temizlenir; hakkında hiçbir şey saklanmaz.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - site erişimi; kurulumda verilmez. **Approve once**'a bastığında uzantı, Chrome'dan o istekteki tek site için erişim ister ve Chrome her site için ilk seferde sana sorar.

Yalnızca onayladığın tek sayfayı okur ve gezinme verilerini okumaz veya iletmez - hiçbir şey hiçbir yere yüklenmez.

Manifest ayrıca `minimum_chrome_version: 111` ayarını yapar. Güncel sürüm 0.4.0'dır.

## Sorun giderme

- **Hâlâ "Uzantıyı al" mı görüyorsun?** Lolly sekmesini yeniden yükle - algılama sayfa yüklenirken gerçekleşir.
- **Bu sitede hiçbir şey olmuyor mu?** Uzantı yalnızca `https://lolly.tools` adresinde, bir de geliştirme paketinde `http://localhost:5173` adresinde çalışır. Lolly'nin kendi barındırdığın bir kopyası gibi başka bir köken, o kökeni hem `manifest.json` hem de `policy.js` içinde listeleyen ayrı bir uzantı yapısı gerektirir. Yalnızca manifesti düzenlemek artık işe yaramaz.
- **Bir yakalama başarısız mı oluyor?** URL'nin erişilebilir olduğundan ve `http://` veya `https://` ile başladığından emin ol. Bazı sayfalar otomatik yakalamayı etkin biçimde engeller. **Cancel**'a bastıysan, onay penceresini kapattıysan ya da 30 saniyeden uzun beklediysen yakalamayı yeniden başlat.
