# Tarayıcı uzantısı

Bir web sayfası başka bir web sitesinin piksellerini okuyamaz. Chromium tabanlı bir tarayıcıda (Chrome 111'den itibaren Chrome, Edge, Brave, Arc veya Opera), ücretsiz **Lolly URL Screenshot** uzantısı, Lolly web uygulamasının masaüstü uygulamasıyla aynı yakalama yöntemini kullanarak bir sayfanın ekran görüntüsünü almasını sağlar. Uzantı yüklüyken:

- **[Lolly URL Screenshot](/t/url-shot)**, hazırladığın sayfayı dosya olarak kaydeder;
- bir görsel yuvasına yapıştırılan web adresi, **Screenshot this page** ile o sayfanın ekran görüntüsüne dönüşebilir;
- [Lolly Design System Setup](/info/brand-studio.html) içindeki **Website** kaynağı, bir tasarım sistemi başlatmak için tek bir sayfayı okuyabilir.

Her isteği sen onaylarsın ve masaüstü uygulaması aynı işleri uzantı olmadan yapar.

<!--i:eti-checklist-->
## Yüklemeden önce

Uzantı olmadan da **Lolly URL Screenshot** açılır ve bir görüntü hazırlayabilirsin. Aracın denetimlerinin üst kısmındaki bir not, neyin eksik olduğunu belirtir.

![Dosyaya yakalama işlemini çalıştıracak bir ana ortam olmadığında URL Screenshot aracında gösterilen, uzantıyı öneren not](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Her denetim uzantı olmadan çalışır: hedef URL, kaydırma derinliği, bekleme süresi, kırpma payları ve yeniden renklendirme. Yalnızca yakalama işlemi uzantı gerektirir.

![Lolly URL Screenshot denetimleri: hedef URL, kaydırma derinliği, bekleme süresi ve kırpma payları; hepsi uzantı yüklenmeden kullanılabilir](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Yükle

**Chrome Web Store'dan:** yakında. Yayımlandığında uzantı tek tıklamayla yüklenir.

**Kendin yükle (geliştiriciler).** Uzantının kaynak kodu, depodaki `shells/chrome-extension/` yolundadır. Paketleme adımı, üretim paketini bu klasörden oluşturur. Bu paket yalnızca `https://lolly.tools` adresindeki Lolly ile çalışır.

1. `pnpm run pack:chrome-extension` komutunu çalıştır. Paketi `dist/chrome-extension/` içine oluşturur.
2. `chrome://extensions` adresini aç.
3. **Developer mode** seçeneğini aç (sağ üstte).
4. **Load unpacked** düğmesine tıkla ve `dist/chrome-extension/` klasörünü seç.
5. Lolly sekmesini yeniden yükle. Sayfa yüklendiğinde Lolly uzantıyı algılar ve "Get the extension" istemi kaybolur. **Lolly URL Screenshot** (Utilities altında) artık yakalamaları dosyaya kaydedebilir ve Lolly Batch modunda çalışır.

::: details Yerel geliştirme sunucusu veya kaynak klasörü için
Yerel geliştirme sunucusu için `pnpm run pack:chrome-extension:dev` komutunu çalıştır ve bunun yerine `dist/chrome-extension-dev` yükle. Bu paket `http://localhost:5173` adresini de kabul eder ve adında **Development** bulunur.

`shells/chrome-extension/` klasörünün kendisini yüklemek de PNG ekran görüntüleri için çalışır. Bu klasörde, paketleme adımının eklediği sayfa taraması yoktur. Bu klasörden alınan bir SVG, şekiller değil, ekran görüntüsü içerir.
:::

<!--i:eti-user-check-->
## Lolly bir istekte bulunduğunda ne olur

![Lolly sekmesi tek bir sayfa ister ve uzantının onay penceresinde Approve once düğmesine basarsın. Bir arka plan sekmesi açılır, sayfayı okur ve kapanır. Ardından Lolly sekmesi sonucu alır.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly ister.** Küçük bir betik, Lolly'ye uzantının mevcut olduğunu bildirir; böylece ek kurulum olmadan yakalama veya sayfa okuma başlatılabilir.
2. **Sen onaylarsın.** Uzantı kendi **Approve page request** penceresini açar. İstekte bulunan siteyi, ekran görüntüsü mü yoksa sayfa içeriği mi istediğini ve sayfanın adresini gösterir. **Approve once** düğmesine basana kadar hiçbir şey okunmaz. **Cancel** düğmesi veya pencereyi kapatmak isteği sonlandırır.
3. **Chrome her site için bir kez sorar.** Bir site için ilk kez istek onayladığında Chrome da uzantının o siteye erişip erişemeyeceğini sorar. İzin verdiğinde Chrome bu erişimi korur, ancak sonraki her istek yine ayrı bir **Approve once** onayı gerektirir.
4. **Sayfa bir arka plan sekmesinde okunur.** Uzantı hedef sayfayı bir arka plan sekmesinde açar, DevTools Protocol üzerinden yakalar (masaüstü uygulamasının kullandığı aynı `Page.captureScreenshot`), sekmeyi kapatır ve sonucu istekte bulunan Lolly sekmesine geri verir.

::: details SVG yakalama nasıl çalışır
**SVG** için uzantı, ekranın resmini çekmek yerine sayfayı tarar. Uzantıyla paketlenen bir betik, arka plan sekmesinde sayfanın düzenini okur ve sayfayı şekillere ve dış çizgilere dönüştürülmüş metne çevirir. Dosya her boyutta net kalır ve her parçası düzenlenebilir kalır. Sayfadaki resimler resim olarak kalır. Sayfanın tuval, video veya SVG'nin ifade edemediği bir efektle çizdiği her şey, aynı anın ekran görüntüsünden kopyalanır. Lolly, sonucu o ekran görüntüsüyle karşılaştırarak denetler. İkisi çok fazla farklılık gösterdiğinde SVG bunun yerine ekran görüntüsünü içerir.

Metni sayfanın kendi yazı tipiyle dış çizgilere dönüştürmek için uzantı, sayfanın yüklediği yazı tipi dosyalarını Lolly'ye verir. Chrome, bir yazı tipinin baytlarını uzantının okuyabileceği bir yerde tutmaz; bu yüzden uzantı, sayfadan her yazı tipini yeniden ister. Tarayıcın genellikle önbelleğinden yanıt verir ve sayfanın kendi güvenlik politikası bu istek için de geçerlidir.
:::

Bir onay tek bir isteği kapsar ve 30 saniye sonra sona erer. Aynı anda yalnızca bir istek bekleyebilir veya çalışabilir ve onaylanmış bir istek 55 saniye sonra durur. Lolly sayfası kapanır veya değişirse ya da hedef sayfa başka bir siteye geçerse istek iptal edilir.

::: warning Yakalamalar tarayıcı oturumunu kullanır
Sayfa, tarayıcı oturumunla yüklenir; bu yüzden oturum açtığın bir sayfa sonuçta özel bilgiler gösterebilir.
:::

Yakalama, tarayıcında ve ağında çalışır; bu yüzden `localhost` ve kurum içi siteler de çalışır. Yakalama sunucuya yüklenmez. Tek ağ trafiği, tarayıcının istediğin sayfayı ve SVG için o sayfanın yazı tipi dosyalarını ikinci kez yüklemesidir.

Yakalama çalışırken geçici sekmede kısa süreliğine *"…started debugging this browser"* bildirimi görebilirsin. Bildirim DevTools Protocol'den gelir ve çekim bittiğinde kaybolur.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Lolly Design System Setup için bir siteyi okuma

Lolly Design System Setup içindeki **Website** kaynağı, mevcut sitenden bir tasarım sistemi başlatır. Chromium tarayıcısında sayfayı uzantı okur. Masaüstü uygulamasında sayfayı uygulamanın kendisi getirir. Uzantısı olmayan bir tarayıcıda Website kartı sunulmaz.

- **Tek adres, tek sayfa.** Onayladıktan sonra uzantı, sayfayı aynı türde bir arka plan sekmesinde açar, render edilmiş işaretlemeyi, stil sayfası metnini ve birkaç simge ve logo görselini okur, ardından sekmeyi kapatır. Uzantı bağlantıları izlemez veya siteyi taramaz.
- **Başka yerde barındırılan stil sayfaları** (bir CDN veya yazı tipi hizmeti) da getirilir, çünkü sayfanın renklerini ve yazı tiplerini içerirler. Farklı kaynaklara yapılan istekler çerezlerin olmadan gider. Aynı kaynağa yapılan istekler, sayfanın yapacağı gibi çerezlerini kullanır.
- **Her şey sınırlıdır**: stil sayfası ve görsel sayısı ile bayt miktarı sınırlanır; böylece kötü amaçlı veya kısmen bozuk bir sayfa, takılıp kalmak yerine kısmi malzeme döndürür.
- **Ayrıştırma cihazında yapılır.** Baytlar doğrudan istekte bulunan Lolly sekmesine döner ve bu sekme onları renklere, yazı tiplerine ve logolara dönüştürür.

Bir adresi yapıştırmak yalnızca alanı doldurur. Okumayı başlatıp **Approve once** düğmesine basana kadar hiçbir şey okunmaz.

<!--i:eti-lock-->
## İzinler

Uzantının `manifest.json` dosyası dört izin bildirir, ayrıca her seferinde tek bir site için site erişimi ister. `minimum_chrome_version: 111` değerini ayarlar ve güncel sürüm 0.5.0'dır.

| İzin | Ne için kullanılır | Ne zaman verilir |
|---|---|---|
| `debugger` | Arka plan sekmesini, ekran görüntüsünü alan ve SVG için sayfa taramasını çalıştıran DevTools Protocol üzerinden yönetir. | Yükleme sırasında |
| `tabs` | Geçici arka plan sekmesini açıp sonrasında kapatır ve onayından bu yana ne Lolly sayfasının ne de hedef sayfanın başka bir adrese geçmediğini denetler. | Yükleme sırasında |
| `scripting` | Website kaynağı için belirttiğin sitenin içinde tek sayfalık okuyucuyu çalıştırır. | Yükleme sırasında |
| `storage` | Açtığı sekmenin kimliğini yalnızca oturum depolamasına kaydeder; böylece tarayıcı okuma sırasında uzantıyı askıya alsa bile sekme kapanır. Sonraki başlangıçta temizlenir; seninle ilgili hiçbir şey saklanmaz. | Yükleme sırasında |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Site erişimi, yükleme sırasında verilmez. **Approve once** düğmesine bastığında uzantı, Chrome'dan o istekteki tek siteye erişim ister. | Chrome sana sorduktan sonra, o site için bir isteği ilk kez onayladığında |

Uzantı yalnızca onayladığın sayfayı okur. Gezinme verilerini okumaz veya göndermez.

<!--i:eti-help-->
## Sorun giderme

- **Hâlâ "Get the extension" mı görüyorsun?** Lolly sekmesini yeniden yükle.
- **Bu sitede hiçbir şey olmuyor mu?** Uzantı yalnızca `https://lolly.tools` adresinde ve geliştirme paketinde ek olarak `http://localhost:5173` adresinde çalışır. Kendi barındırdığın bir Lolly kopyası gibi başka bir kaynak, o kaynağı hem `manifest.json` hem de `policy.js` içinde listeleyen ayrı bir uzantı derlemesi gerektirir. Yalnızca manifest dosyasını düzenlemek işe yaramaz.
- **Yakalama başarısız mı oluyor?** URL'nin erişilebilir olduğunu ve `http://` veya `https://` ile başladığını denetle. Bazı sayfalar otomatik yakalamayı engeller. **Cancel** düğmesine bastıysan, onay penceresini kapattıysan veya 30 saniyeden fazla beklediysen yakalamayı yeniden başlat.
