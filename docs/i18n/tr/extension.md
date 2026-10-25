# Tarayıcı uzantısı

Bir web sayfası başka bir web sitesinin piksellerini okuyamaz; bu yüzden Lolly web uygulamasının bir sayfanın ekran görüntüsünü alması için yardıma ihtiyacı vardır. Chromium tabanlı bir tarayıcıda (Chrome 111'den itibaren Chrome, Edge, Brave, Arc veya Opera) ücretsiz **Lolly URL Screenshot** uzantısı, masaüstü uygulamasının kullandığı aynı yakalamayı kullanarak bu yardımı sağlar. Kurulduğunda:

- **[URL Screenshot](/t/url-shot)**, oluşturduğun sayfayı bir dosya olarak kaydeder;
- bir görsel yuvasına yapıştırılan bir web adresi, **Screenshot this page** ile o sayfanın ekran görüntüsüne dönüşebilir;
- [Design System Setup](/info/brand-studio.html) içindeki **Website** kaynağı, bir tasarım sistemi başlatmak için bir sayfayı okuyabilir.

Her isteği sen onaylarsın ve masaüstü uygulaması aynı işleri uzantı olmadan yapar.

## Kurmadan önce

Uzantı kurulana kadar **URL Screenshot** yine açılır; böylece bir çekim oluşturabilirsin. Aracın denetimlerinin üstündeki bir not neyin eksik olduğunu söyler.

![Dosyaya yakalama işleminin çalışacağı bir sunucu olmadığında gösterilen, URL Screenshot aracının uzantıyı öneren notu](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Beklerken her denetim çalışır: hedef URL, kaydırma derinliği, yerleşme gecikmesi, kırpma boşlukları ve yeniden renklendirme. Yalnızca yakalamanın kendisi uzantıya ihtiyaç duyar.

![Hedef URL, kaydırma derinliği, yerleşme gecikmesi ve kırpma boşlukları içeren, uzantı olmadan önce de kullanılabilen URL Screenshot kontrolleri](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Kurulum

**Chrome Web Store'dan:** yakında. Uzantı yayımlandığında tek tıkla kurarsın.

**Kendin yükle (geliştiriciler).** Uzantı depoda `shells/chrome-extension/` altında yaşar. O klasör yalnızca `https://lolly.tools` adresindeki Lolly ile çalışan üretim derlemesidir.

1. `chrome://extensions` aç.
2. **Developer mode** seçeneğini aç (sağ üstte).
3. **Load unpacked** düğmesine tıkla ve `shells/chrome-extension/` klasörünü seç.
4. Lolly sekmesini yenile. Algılama sayfa yüklendiğinde olur; böylece "Get the extension" istemi kaybolur. **URL Screenshot** (Utilities altında) sonra yakalamaları bir dosyaya kaydedebilir ve Batch modunda kullanılabilir olur.

Yerel bir geliştirme sunucusu için `pnpm run pack:chrome-extension:dev` komutunu çalıştır ve bunun yerine `dist/chrome-extension-dev` klasörünü yükle. Bu paket ayrıca `http://localhost:5173` adresini kabul eder ve adında **Development** yer alır.

## Lolly sorduğunda ne olur

![Lolly sekmesi bir sayfa ister ve uzantının onay penceresinde Approve once düğmesine basarsın. Bir arka plan sekmesi açılır, sayfayı okur ve kapanır. Sonra Lolly sekmesi sonucu alır.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly sorar.** Küçük bir betik Lolly'ye uzantının mevcut olduğunu söyler; böylece bir yakalama veya sayfa okuması başka bir kuruluma gerek olmadan başlayabilir.
2. **Sen onaylarsın.** Uzantı kendi **Approve page request** penceresini açar. İsteyen siteyi, ekran görüntüsü mü sayfa içeriği mi istediğini ve sayfa adresini gösterir. **Approve once** düğmesine basana kadar hiçbir şey okunmaz. **Cancel** veya pencereyi kapatmak isteği sonlandırır.
3. **Chrome site başına bir kez sorar.** Bir site için bir isteği ilk onayladığında Chrome ayrıca uzantının o siteye erişip erişemeyeceğini sorar. İzin verdiğinde Chrome o erişimi tutar, ancak sonraki her istek yine kendi **Approve once** onayını gerektirir.
4. **Sayfa bir arka plan sekmesinde okunur.** Uzantı hedef sayfayı bir arka plan sekmesinde açar, DevTools Protocol aracılığıyla yakalar (masaüstü uygulamasının kullandığı aynı `Page.captureScreenshot`), sekmeyi kapatır ve sonucu isteyen Lolly sekmesine verir.

Bir onay tek isteği kapsar ve 30 saniye sonra sona erer. Aynı anda yalnızca bir istek bekleyebilir veya çalışabilir ve onaylanmış bir istek 55 saniye sonra durur. Lolly sayfası kapanırsa veya değişirse ya da hedef sayfa başka bir siteye geçerse istek iptal edilir.

Yakalama tarayıcında, ağında çalışır; bu yüzden `localhost` ve iç siteler çalışır. Sayfa tarayıcı oturumunla yüklenir; bu yüzden oturum açtığın bir sayfa sonuçta özel bilgi gösterebilir. Yakalama yüklenmez: tek ağ trafiği, istediğin sayfayı yükleyen kendi tarayıcındır.

Bir yakalama çalışırken geçici sekmede kısa süre bir *"…started debugging this browser"* bandı görebilirsin. Bu, çalışan DevTools Protocol'dür ve çekim bittiğinde bant kalkar.

## Design System Setup için bir siteyi okuma

Design System Setup içindeki **Website** kaynağı, zaten sahip olduğun bir siteden tasarım sistemi başlatır. Chromium tarayıcıda sayfayı uzantı okur. Masaüstü uygulamasında sayfayı uygulamanın kendisi getirir. Uzantısız bir tarayıcıda Website karosu sunulmaz.

- **Bir adres, bir sayfa.** Onayladıktan sonra uzantı sayfayı aynı türden bir arka plan sekmesinde açar, işlenmiş işaretlemeyi, stil sayfası metnini ve bir avuç simge ile logo görselini okur, sonra sekmeyi kapatır. Bağlantıları izlemez veya tarama yapmaz.
- **Başka yerde barındırılan stil sayfaları** (bir CDN veya yazı tipi hizmeti) de getirilir, çünkü sayfanın renkleri ve yazısı onlarda yaşar. Çapraz kaynak istekleri çerezlerin olmadan gider; aynı kaynak istekleri, sayfanın kendisinin yapacağı gibi onları kullanır.
- **Her şey sınırlıdır**, stil sayfası ve görsel sayısında ve baytlarda bir sınırla; böylece düşmanca veya yarı bozuk bir sayfa takılmak yerine kısmi malzeme döndürür.
- **Ayrıştırma cihazında olur.** Baytlar doğrudan isteyen Lolly sekmesine geri gider; o da onları renklere, yazıya ve logolara çevirir.

Bir adres yapıştırmak yalnızca alanı doldurur. Okumayı başlatıp **Approve once** düğmesine basana kadar hiçbir şey okunmaz.

## İzinler

Uzantının `manifest.json` dosyası, bir seferde bir site için istediği site erişimine ek olarak dört izin bildirir. `minimum_chrome_version: 111` ayarlar ve geçerli sürüm 0.4.0'dır.

| İzin | Ne için | Ne zaman verilir |
|---|---|---|
| `debugger` | Ekran görüntüsünü alan DevTools Protocol aracılığıyla arka plan sekmesini sürer. | Kurulumda |
| `tabs` | Geçici arka plan sekmesini açar ve sonradan kapatır ve onayından beri ne Lolly sayfasının ne de hedef sayfanın taşınmadığını denetler. | Kurulumda |
| `scripting` | Website kaynağı için adını verdiğin sitenin içinde tek sayfalık okuyucuyu çalıştırır. | Kurulumda |
| `storage` | Açtığı bir sekmenin kimliğini yalnızca oturum depolamasına not eder; böylece tarayıcı uzantıyı okuma ortasında askıya alırsa sekme yine kapanır. Sonraki başlangıçta temizlenir; hakkında hiçbir şey saklanmaz. | Kurulumda |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Site erişimi, kurulumda verilmez. **Approve once** düğmesine bastığında uzantı, o istekteki tek site için Chrome'dan erişim ister. | O site için bir isteği ilk onayladığında, Chrome sana sorduktan sonra |

Uzantı yalnızca onayladığın tek sayfayı okur. Gezinme verini okumaz veya göndermez ve hiçbir şey yüklenmez.

## Sorun giderme

- **Hâlâ "Get the extension" görüyor musun?** Lolly sekmesini yenile.
- **Bu sitede hiçbir şey olmuyor mu?** Uzantı yalnızca `https://lolly.tools` ve geliştirme paketinde `http://localhost:5173` üzerinde çalışır. Kendi sunucusunda barındırılan bir Lolly kopyası gibi başka bir kaynak, o kaynağı hem `manifest.json` hem `policy.js` içinde listeleyen uzantının kendi derlemesini gerektirir. Yalnızca manifest'i düzenlemek çalışmaz.
- **Bir yakalama mı başarısız oluyor?** URL'nin erişilebilir olduğunu ve `http://` veya `https://` ile başladığını denetle. Bazı sayfalar otomatik yakalamayı engeller. **Cancel** düğmesine bastıysan, onay penceresini kapattıysan veya 30 saniyeden uzun beklediysen yakalamayı yeniden başlat.
