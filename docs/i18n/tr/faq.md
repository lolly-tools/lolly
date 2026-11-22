# Sorular & yanıtlar

`/info/start/faq.html` üzerinde akordeon olarak render edilen sık sorulan sorular.

**Nasıl güncellenir:** aşağıdaki her `##` başlığı bir sorudur. Başlığın altındaki her şey,
sonraki `##` başlığına kadar yanıttır. Yanıtlar sitenin hafif Markdown biçimini kullanır:
paragrafları boş bir satırla ayır. Soruları burada ekle, kaldır veya yeniden sırala ve
`pnpm run build:info` (veya `pnpm run dev:web`) komutunu yeniden çalıştır.
Derleme, ilk `##` üzerindeki her şeyi (bu başlığı ve bu notları) yok sayar.

Sıralama ilk kez kullanan birine göredir: önce işin iç yüzü, sonra dosyaların, ardından Lolly'yi edinme
ve çalıştırma, sonra kuruluşlar ve son olarak nasıl yapıldığı. Her sorunun bağlantı çapası
aynı konumdaki İngilizce sorudan oluşturulur; bu yüzden çeviri
İngilizce sırayı korur.

## Neden ücretsiz? İşin içinde ne var?

**Lolly'yi kendimiz için yaptık.** SUSE'nin dış hizmetlere hiçbir şey vermeden hazırlanmış, markaya uygun binlerce dosyaya ihtiyacı vardı. Biz de bunların hepsini cihazda yapan bir araç geliştirdik ve yaptığımız diğer her şey gibi açık kaynak olarak yayımladık. Her gün kullandığımız için bakımını sürdürüyoruz. **Hiçbir yükümlülük yok:** buradaki her şey biz olsak da olmasak da çalışır.

Bu sınır bir sözle değil, lisansla çizilir: yerel olarak çalışan her şey sonsuza kadar ücretsizdir. Yayımlanmış bir sürüm, geri alınamayacak şekilde lisanslanır. Hiçbir katkı sözleşmesi kimsenin çalışmasını yeniden lisanslayamaz.

## SUSE ne kadarını gizli tutuyor? (yani bizi ne zaman yarı yolda bırakacak)

Motor, kabuklar, şemalar ve markadan bağımsız araçlar açık kaynaktır. SUSE'nin ticari markaları ve markalı araçları gizli kalır ve zaten ayrılmıştır. [lolly.tools](https://lolly.tools) adresindeki herkese açık örnek, Lolly'nin kendi tasarım sistemi olan [Lolly Demo](/info/lolly-demo.html)'yu kullanır.

Burada hiçbir şey bir söze dayanmaz: yayımlanmış her sürüm açık kaynak kalır. Başka bir şirket 2023'te kurumsal Linux kaynaklarını kapattığında SUSE, o kodu açık tutmak için [OpenELA](https://openela.org)'nın kurucu ortaklarından biri oldu. Bu proje o duruşu sürdürür.

SUSE, Lolly'yi kendi BT sistemlerine bağlamak için kurum içi araçlar *geliştiriyor*. Bu, SUSE'nin kurum içi düzenidir; herkese açık ve gizli geliştirme arasında bir ayrım değildir. Lolly ayrıca [Open Build Service](https://openbuildservice.org/) üzerinden derlenmeyi ve güvenli tedarik zinciri çıktılarının [SUSE Application Collection](https://apps.rancher.io/applications) tarafından sunulmasını hedefler.

## Neden adı "Lolly Tools"?

**Lolly**, çünkü özgürlük tatlıdır ve Avustralya, Yeni Zelanda ve Britanya'da lolly şekerleme demektir.

**Tools**, çünkü bir araç sen eline alana kadar yerinde durur. Kullanmadığında çalışmaz ve kullanırken seni izlemez.

## Neden her şey yeşil?

lolly.tools, ana rengi yeşil olan, Lolly'nin kendi örnek tasarım sistemi [Lolly Demo](/info/lolly-demo.html) ile açılır. [Settings → Design systems](/#/settings?focus=design-systems-section) içinden boş bir tasarım sistemi olan **Lolly Starter**'a veya kendi tasarım sistemine geç.

## Kendi markamı kullanabilir miyim?

Evet. **Lolly Design System Setup** (`#/start`), tek bir renkten, bir tasarım token'ları dosyasından veya bitmiş bir tasarımdan tasarım sistemi oluşturur. Sonra her araç senin tasarım sisteminle çizer. [Başla](/info/quickstart.html#put-your-brand-in) üç yolu da adım adım anlatır.

Kuruluşunun veya derlemenin sağladığı bir tasarım sistemi yönetilen bir sistemdir. Kilit gösterir ve salt okunur kalır. Birini değiştirmek için düzenlenebilir bir kopya oluştur.

## Dün yaptığım şey nerede?

Eğer **Save as** veya **Save** düğmesine bastıysan işin, kaydettiğin tarayıcı ya da uygulamanın ana ekranındaki **Projects** içindedir. Yalnızca **Download** düğmesine bastıysan dosya tarayıcının veya sisteminin indirilenlerindedir ve genellikle **Assets** içinde de bir kopyası bulunur. [Çalışırken kaydeden](/info/find-your-work.html#which-tools-save-as-you-work) araçlar, kaydedilmemiş işleri de **Projects** içinde tutar. [İşini bul ve kurtar](/info/find-your-work.html) her durumu anlatır.

## Sekmeyi kapattım. İşim kayboldu mu?

Kaydedilmiş işler hâlâ **Projects** içindedir. Çalışırken kaydeden araçlar dışında kaydedilmemiş işler kaybolur; bu araçlar onları da **Projects** içinde tutar. Bir dahaki sefere ayrılmadan önce **Save as** düğmesine bas. Bkz. [Sekmeyi kapattıysan veya araçtan ayrıldıysan](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## İşimi bağlantı yerine dosya olarak paylaşabilir miyim?

Evet. Bir bağlantı, kendi fotoğrafların veya uzun metinler gibi her şeyi taşıyamadığında Share iletişim kutusu nelerin eksik kalacağını söyler ve bir **.lolly** dosyası sunar. O tek dosya tasarımı, kullandığı görselleri ve seçersen aracı içerir.

Ne kadarının taşınacağına sen karar verirsin. Adın ve bilgilerin yalnızca profilinde izin verirsen eklenir. Dahil etmeyi seçmediğin sürece lisanslı görseller eklenmez. Araç taşıyan bir dosyayı açan kişiye, araç çalışmadan önce ona güvenip güvenmediği sorulur. Bkz. [İşini paylaşma](/info/using.html#sharing-your-work).

## Profil bilgilerim ne işe yarar?

Bilgilerin, **Settings** içinden bunları isteyen araçlara önceden doldurulur; örneğin bir rozetteki adı. Bu cihazda kalırlar. İzin seçeneğini açmadığın sürece yaptığın şeylere hiçbir bilgi girmez. Açtığında seçtiğin bilgiler mühürlenerek eklenir ve seni kaynak olarak belirtir.

Paylaşım ve Sync yalnızca seçtiğin içeriği gönderir. Bir kuruluşun Lolly Work örneğinde paylaşılan oturumlar ve kurumsal kurallara tabi işler de o sunucuya gider. Bkz. [Gizlilik](/info/privacy.html).

## Mobil veya masaüstü uygulamalarını nasıl edinirim?

[Lolly'yi yükle](/info/install.html) sayfasından indir. Sayfa macOS, Windows, Linux ve Android için her derlemeyi listeler ve indirdiğin dosyayı nasıl kontrol edeceğini gösterir. iPhone ve iPad'de **Lolly Tools**'u App Store'dan edinirsin. Bağlantı [iPhone ve iPad bölümündedir](/info/install.html#iphone-and-ipad).

Herkes, hedef kitlesinin ihtiyaç duyduğu araçlar ve ayarlarla uygulamanın kendi kopyasını da derleyip dağıtabilir. [Derleme Kılavuzu](/info/build-guide.html) nasıl yapılacağını gösterir.

## Lolly, WebGPU gerektirdiğini söylüyor. Ne yapabilirim?

Web uygulaması, güncel tarayıcıların bir grafik özelliği olan WebGPU ile çizer ve bir aracı açmadan önce WebGPU'yu kontrol eder. Sırayla şunları dene:

1. Tarayıcını güncel sürümüne yükselt.
2. Tarayıcı ayarlarında grafik veya donanım hızlandırmayı aç, sonra tarayıcıyı yeniden başlat.
3. Test edilmiş bir tarayıcı dene: [Desteklenen ortamlar](/info/supported-environments.html) bunları listeler.
4. Mac, iPhone veya iPad'de bunun yerine [uygulamayı yükle](/info/install.html).

## Lolly, Figma, Penpot, Illustrator veya InDesign dosyalarımı düzenleyip render edebilir mi?

Evet. **Design** aracını aç ve **Import a design** düğmesine tıkla: yerel Figma **.fig** (Save local copy), Penpot **.penpot** dışa aktarması, Illustrator **.ai** veya **.pdf**, InDesign **.idml** veya **.indd**, Affinity belgesi, Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** veya **herhangi bir SVG** kabul eder ([okuduğu tüm biçimler](/info/design-import.html#what-comes-in-from-each-app)). Hesaba, eklentiye veya tasarım uygulaması lisansına ihtiyacın yoktur.

![Lolly Design'ın açık tuvali - Import a design, araç çubuğundaki Lolly menüsünde yer alır](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Katmanlar düzenlenebilir kutular olarak gelir. Metin yeniden yazılabilir, şekiller şekil olarak kalır ve görseller kitaplığına eklenir. Düzen kaydedildikten sonra **Share with rules**, onu Lolly kullanan herkesin yeniden doldurabileceği bir araca dönüştürebilir. Bkz. [Tasarım içe aktar](/info/design-import.html).

## İki kişi internet olmadan aynı tasarım üzerinde çalışabilir mi?

Evet. Bir kişi davet paylaşır (bağlantı, QR kodu veya kısa kod) ve diğeri kabul eder. Ardından her iki cihaz da katılımcı göstergeleri ve odak halkalarıyla aynı oturumu canlı olarak tutar. Arada sunucu olmadığı için bu, telefonun erişim noktası dahil herhangi bir ortak ağda çalışır. Bkz. [Birlikte çalışma](/info/collaborate.html). Farklı ağlardaki meslektaşlar için kuruluşun Lolly Work örneği, kimlik doğrulamalı işbirliği oturumları sağlar.

## Özellik bayrakları nedir?

Özellik bayrakları, Lolly'nin bölümlerini açar veya kapatır. Bağımsız kullanımda kişisel ayarlarını sen seçersin. Lolly Work kullanan bir kuruluş, politikası kapsamında varsayılanları belirleyebilir veya seçili anahtarları gizleyebilir ve yönetilen denetimler etiketlenir. Bkz. [Lolly'yi kuruluşunda kullan](/info/organisation.html).

![Bağımsız uygulamada kişisel özellik bayrakları; kuruluş politikası seçili anahtarları yönetebilir](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Yardımcı araçları araçlardan ayıran nedir?

Bir yardımcı araç, zaten sahip olduğun bir dosyada PDF sıkıştırma, fotoğraf dönüştürme veya gizli verileri temizleme gibi hızlı bir iş yapar. Birçoğu hiçbir şey yüklemeden cihazında çalışır. Yardımcı araçlar, insanların genellikle rastgele bir web sitesine verdiği işleri Lolly içinde tutar. Bir sözleşmeyi sıkıştırmak, konum bilgileri hâlâ içinde olan tatil fotoğraflarını dönüştürmek veya çevrimiçi bir biçimlendiriciye token yapıştırmak; dosyayı saklama süresi, tabi olduğu hukuk ve iş modeli bilinmeyen bir siteye vermek anlamına gelmemelidir. [Lolly Utilities](/info/utilities.html) bunları listeler ve [Hiç kabul etmediğimiz takas](/info/status-quo.html) arkalarındaki hikâyeyi anlatır.

![Utilities görünümü: Lolly Strip Hidden Data, Compress PDF, Convert Image ve cihazda yapılan diğer işler, hepsi tek yerde](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kuruluşumuz SSO, paylaşılan projeler ve onaylar kullanabilir mi?

Evet, aynı açık kaynak projenin kuruluş sunucusu olan **Lolly Work** ile. Ayrı çalışır ve kimlik sağlayıcın üzerinden tek oturum açma, SCIM ile hesap sağlama, grup izinleri, paylaşılan projeler ve varlıklar, canlı işbirliği oturumları, onaylar ve denetim kayıtları ekler. Günlük uygulama kendi başına çalışmaya devam eder.

[Lolly'yi kuruluşunda kullan](/info/organisation.html), oturum açmayı ve paylaşılan işleri bulmayı anlatır. [Dağıtım](/info/deployment.html#organisation-services-with-lolly-work), Lolly Work kurulumunu anlatır. Paylaşılan içerik ve kuruluş kayıtları, o örneğin gizlilik ve saklama politikalarına tabidir.

## Lolly'yi benimserken hangi engellerle karşılaşabilirim?

Çoğunlukla teknolojiyle değil, bir ekibin iş üretme biçimindeki değişimle ilgilidir. Kurumsal kurallara tabi bir araç kümesi isteyen ekibin, tasarım sistemini ve ilk şablonlarını hazırlayacak birine ihtiyacı vardır. Yine de herkes ilk günden Lolly Design'da git gerekmeden kendi araçlarını yapabilir. Mevcut süreçler, çıktıları markaya uygun olmadığında bile çalışmaya devam eder. Görünür tek bir çıktıyı iyi dönüştürmek, önceki ve sonraki hâlini yan yana göstermek, değeri bir plandan daha hızlı ortaya koyar.

[Benimseme & yönetişim](/info/adoption-governance.html), role göre alışma sürecini, pilot uygulamanın nasıl ölçüleceğini ve bir yönetişim sürecinin nasıl olabileceğini anlatır.

## Lolly "vibe coding" ile mi yazıldı?

Lolly; yapay zekâ destekli kodlama, yapay zekâ destekli keşif ve birçok yerde yapay zekâ destekli içerikle geliştirildi. Herkese açık bulutta öncü modeller geliştiren şirketlerinkiler dahil, farklı model ve sağlayıcılar kullanıldı. Mimariyi bir insan oluşturdu, kodu bilinçli seçimlerle düzenledi ve deneyimin sanat yönetimini üstlendi.

Lolly'nin bağımlılıklarındaki yüksek veya kritik önem düzeyindeki bir güvenlik bildirimi CI'ı engeller. Henüz düzeltilemeyen bir bildirim, yalnızca yazılı gerekçesi olan onaylı bir istisna olarak ertelenir. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions), şu anda geçerli olan her istisnayı listeler ve [sürüm notları](https://github.com/lolly-tools/lolly/releases), her sürümün taşıdığı istisnaları listeler. SECURITY.md, bir güvenlik açığının nasıl bildirileceğini de söyler.

Derlemedeki kontroller, metni her okuyucu için sade tutmak amacıyla kod yorumlarında, uygulamada ve bu belgelerde makine üretimi gibi görünen ifadeleri de reddeder. Bunun bir yan etkisi, bir algılayıcının hangi metni bir modelin yazdığını anlamakta daha fazla zorlanabilmesidir. Bunu amaçlamadık.

En önemlisi, Lolly dünyanın dört bir yanındaki uzmanların onlarca yıllık açık kaynak çalışmalarının üzerine kuruludur.

**Üretken yapay zekâ açıklaması:**

- **LLM tarafından yazılan kod:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (bu liste genişleyebilir)
- **LLM ile keşif:** Gemini 3.1, Fable, Codex Astra
- **Belgeler:** Sonnet 5
- **Açık kaynak kütüphaneler:** SBOM, yorumlar ve dosya başlıklarında belirtilen ilgili yazarları

Bu liste, Lolly'ye dahil edilen üçüncü taraf modellerini içermez.

**İnsan katkıları:**
- **Fikir geliştirme, inceleme ve geri bildirim:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Topluluğu, Tim Hildred (liste eksiksiz değildir)
- **Mimari, sanat yönetimi & yapay zekâ çöplerini temizleme:** Andy Fitzsimon

## SUSE markalı araçlar nereye gitti?

Ayrı, özel bir depoda bulunurlar. Herkese açık depoyu klonlamak SUSE marka paketini getirmez; bu yüzden bu depodan alınan bir derleme, başka bir profil seçmediğin sürece tarafsız `lolly-start` profilini kullanır. Bu profil, markadan bağımsız topluluk araçlarını ve kendi markanla dolduracağın boş bir markayı içerir. [lolly.tools](https://lolly.tools), `lolly-demo` profiliyle derlenir ve Lolly'nin kendi tasarım sistemi olan [Lolly Demo](/info/lolly-demo.html) ile açılır. SUSE, ticari markalarını korumak için kendi örneğini işletir.

## Lolly logosu hangi aromada?

Kimi misket limonu der, kimi nane, bazen de elma. Lolly tatlılığı getirir, aromayı sen belirlersin.

## Lolly içerik egemenliğiyle neyi kastediyor?

İçeriğinin nasıl oluşturulduğunu, yönetildiğini, saklandığını ve seçtiğin sistemler arasında nasıl taşındığını kontrol etmek. Lolly yerel üretimi, düzenlenebilir işleri ve taşınabilir araçları destekler. Lolly Work, kuruluşun kontrol ettiği paylaşılan hizmetleri ekler. Kaynak lisansları, kullanılabilir bağımlılıklar ve iş akışının veri akışları yine de önemlidir. [İçerik egemenliği nedir?](/info/content-sovereignty.html) her kontrolü ve sınırlarını açıklar.

## Mevcut DAM sistemimizi koruyabilir miyiz?

Evet. Lolly Work seçili varlıkları Lolly araçlarına bağlarken desteklenen bir DAM, esas kayıt kaynağı olarak kalabilir. Kaynağa erişim, izin verilen düzenlemeler, kullanım hakları ve bitmiş çıktının onayı ayrı kararlardır. [Lolly'yi mevcut DAM sisteminle kullan](/info/use-with-dam.html) bu düzeni açıklar ve [SUSE'nin Brandfolder deneyimi](/info/suse-brandfolder.html) benimseme sürecindeki başarılı kullanımı kaydeder.
