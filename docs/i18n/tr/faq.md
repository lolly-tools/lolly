# Sorular ve yanıtlar

`/info/start/faq.html` adresinde akordeon olarak render edilen sık sorulan sorular.

**Nasıl güncellenir:** aşağıdaki her `##` başlığı bir sorudur; altındaki her şey
(bir sonraki `##` başlığına kadar) cevaptır. Cevaplar sitenin geri kalanıyla aynı hafif
markdown'ı kullanır - paragrafları boş bir satırla ayır. Soruları burada ekle, çıkar ya da
yeniden sırala ve `pnpm run build:info` (ya da `pnpm run dev:web`) komutunu yeniden çalıştır.
İlk `##` başlığından önceki her şeyi (bu başlık ve bu notlar) derleme yok sayar.

Sıra, ilk kez gelenin sırasıdır: önce tuzak, sonra dosyaların, sonra Lolly'yi edinme
ve çalıştırma, sonra kuruluşlar, sonra nasıl yapıldığı. Her sorunun çapası
aynı konumdaki İngilizce sorudan üretilir; bu yüzden bir çeviri
İngilizce sırayı korur.

## Neden ücretsiz? Bit yeniği nerede?

**Lolly'yi kendimiz için yaptık.** SUSE'nin, dışarıdaki hizmetlere hiçbir şey vermeden yapılmış binlerce markaya uygun dosyaya ihtiyacı vardı. Bu yüzden hepsini cihazda yapan bir araç kurduk ve yaptığımız diğer her şey gibi açık kaynak olarak yayımladık. Onu her gün kullandığımız için bakımını sürdürüyoruz. **Hiçbir yükümlülük yok:** burada her şey bizimle de bizsiz de çalışır.

Bu çizgi bir sözle değil lisansla çizilir: yerel çalışan her şey sonsuza dek ücretsizdir. Yayımlanmış bir sürüm geri alınamayacak şekilde lisanslanır ve kimsenin çalışmasını yeniden lisanslayabilecek bir katkıda bulunan sözleşmesi yoktur.

## SUSE ne kadarını özel tutuyor? (yani halı ne zaman ayağımızın altından çekilecek)

Motor, kabuklar, şemalar ve markadan bağımsız araçlar açık kaynaktır. SUSE'nin ticari markaları ve markalı araçları özel kalan kısımdır ve zaten ayrılmıştır. [lolly.tools](https://lolly.tools) adresindeki herkese açık örnek, Lolly'nin kendi tasarım sistemi olan [Lolly Demo](/info/lolly-demo.html)'yu çalıştırır.

Burada hiçbir şey bir söze dayanmaz: yayımlanan her sürüm açık kaynak kalır ve geri tutulan tek şey ticari markadır. Başka bir şirket 2023'te kurumsal Linux kaynaklarını kapattığında, SUSE o kodu açık tutmak için [OpenELA](https://openela.org)'yı birlikte kurdu; bu proje aynı duruşu devralır.

Tam açıklama: SUSE, Lolly'yi kendi BT sistemlerine bağlamak için dahili araçlar *geliştiriyor*. Bu, SUSE'nin dahili düzenidir; herkese açık ve özel geliştirme arasında bir bölünme değildir. Lolly ayrıca [Open Build Service](https://openbuildservice.org/) ile derlenmeyi ve [SUSE Application Collection](https://apps.rancher.io/applications) tarafından sunulan güvenli tedarik zinciri yapıtlarıyla gelmeyi hedefler.

## Neden "Lolly Tools" adı?

**Lolly** çünkü özgürlük tatlıdır ve Avustralya, Yeni Zelanda ile Britanya'da lolly şeker demektir.

**Tools** çünkü bir alet, sen eline alana kadar öylece durur. Kullanmadığında çalışmaz, kullanırken de seni izlemez.

## Neden her şey yeşil?

lolly.tools, Lolly'nin kendi örnek tasarım sistemi olan [Lolly Demo](/info/lolly-demo.html) ile açılır ve ana rengi yeşildir. Bu bir örnektir, kural değil. Boş bir tasarım sistemi olan **Lolly Starter**'a ya da [Settings → Design systems](/#/settings?focus=design-systems-section) içindeki kendi tasarım sistemine geç.

## Kendi markamı kullanabilir miyim?

Evet. **Design System Setup** (`#/start`) bir renkten, bir tasarım token dosyasından veya bitmiş bir tasarımdan tasarım sistemi kurar ve her araç sonra senin tasarım sistemin ile çizer. [Start](/info/quickstart.html#put-your-brand-in) üç yolu anlatır.

Kuruluşunun veya sürümünün sağladığı bir tasarım sistemi yönetilir: kilit gösterir ve salt okunur kalır; değiştirmek için düzenlenebilir bir kopya yapabilirsin.

## Dün yaptığım şeyi nerede bulabilirim?

**Save as** veya **Save** düğmesine bastıysan, ana ekrandaki **Projects** içinde, kaydettiğin tarayıcıda veya uygulamada durur. Yalnızca **Download** düğmesine bastıysan dosya, tarayıcının veya sistemin indirmeleri kaydettiği yerdedir ve genellikle bir kopyası **Assets** içindedir. [Çalışırken kaydeden](/info/find-your-work.html#which-tools-save-as-you-work) araçlar, kaydedilmemiş işi de **Projects** içinde tutar. [Find and recover your work](/info/find-your-work.html) her durumu kapsar.

## Sekmeyi kapattım. Çalışmam gitti mi?

Kaydedilmiş çalışma hâlâ **Projeler**'dedir. Kaydedilmemiş çalışma gider, çalışırken kaydeden araçlar dışında; onlar da bunu **Projeler**'de tutar. Bir dahaki sefere, ayrılmadan önce **Farklı kaydet**'e bas. Bkz. [Sekmeyi kapattıysan ya da araçtan ayrıldıysan](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Çalışmamı bağlantı yerine dosya olarak paylaşabilir miyim?

Evet. Bir bağlantı her şeyi taşıyamadığında, örneğin kendi fotoğrafların veya uzun metin, Share iletişim kutusu nelerin eksik kalacağını söyler ve bunun yerine bir **.lolly** dosyası sunar: tasarımı, kullandığı görselleri ve istersen aracın kendisini tutan tek bir dosya.

Ne kadarının gideceğine sen karar verirsin. Adın ve ayrıntıların yalnızca profilin izin verirse girer ve lisanslı çalışmalar, onları dahil etmeyi seçmedikçe geri tutulur. Bir araç taşıyan dosyayı açan kişiye, araç çalışmadan önce ona güvenip güvenmediği sorulur. Bkz. [Sharing your work](/info/using.html#sharing-your-work).

## Profil ayrıntılarım ne işe yarar?

**Settings** içindeki ayrıntıların, bir rozetteki ad gibi onları isteyen araçları önceden doldurur. Bu cihazda kalırlar. İzni de açarsan seçtiğin ayrıntılar yaptığın şeylere mühürlenir ve seni kaynak olarak adlandırır. Ayrıntılarını dahil etmeyi seçmedikçe hiçbir şey dahil edilmez.

Paylaşım ve Sync yalnızca seçtiğin içeriği gönderir. Bir kuruluşun Lolly Work örneğinde paylaşılan oturumlar ve yönetilen iş de o sunucuya gider. Bkz. [Privacy](/info/privacy.html).

## Mobil ya da masaüstü uygulamalarını nasıl edinirim?

Bunları [Install Lolly](/info/install.html) sayfasından indir. Sayfa macOS, Windows, Linux ve Android için her sürümü listeler ve indirdiğin dosyayı nasıl denetleyeceğini gösterir. iPhone ve iPad **Lolly Tools**'u App Store'dan alır; bağlantı [iPhone ve iPad bölümünde](/info/install.html#iphone-and-ipad) var.

Herkes ayrıca kitlesinin ihtiyaç duyduğu araçlar ve ayarlarla uygulamanın kendi kopyasını derleyip dağıtabilir. [Build Guide](/info/build-guide.html) nasıl yapılacağını gösterir.

## Lolly WebGPU gerektirdiğini söylüyor. Ne yapabilirim?

Web uygulaması, güncel tarayıcıların bir grafik özelliği olan WebGPU ile çizer ve bir aracı açmadan önce onu denetler. Bunları sırayla dene:

1. Tarayıcını güncel sürüme güncelle.
2. Tarayıcının ayarlarında grafik veya donanım hızlandırmayı aç, sonra tarayıcıyı yeniden başlat.
3. Test edilmiş bir tarayıcı dene: [Supported environments](/info/supported-environments.html) onları listeler.
4. Bir Mac, iPhone veya iPad'de bunun yerine [uygulamayı kur](/info/install.html).

## Lolly, Figma, Penpot, Illustrator ya da InDesign dosyalarımı düzenleyip render edebilir mi?

Evet. **Design** uygulamasını aç ve **Import a design** düğmesine tıkla: yerel bir Figma **.fig** (Save local copy), bir Penpot **.penpot** dışa aktarması, bir Illustrator **.ai** veya **.pdf**, bir InDesign **.idml** (File → Export → InDesign Markup) ya da **herhangi bir SVG** kabul eder. Hesap, eklenti veya tasarım uygulaması lisansı gerekmez.

![Design'ın serbest kanvası - Bir tasarım içe aktar, araç çubuğunun Lolly menüsünde durur](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Katmanlar düzenlenebilir kutular olarak gelir: metin yeniden yazılabilir kalır, şekiller şekil kalır ve görseller kendi kitaplığına katılır. Kaydet ve **Share with rules** düzeni, Lolly'si olan herkesin yeniden doldurabileceği bir araca dönüştürebilir. Bkz. [Import a design](/info/design-import.html).

## İki kişi internet olmadan aynı tasarım üzerinde çalışabilir mi?

Evet. Biri bir davet paylaşır; bir bağlantı, bir QR kodu veya kısa bir kod olarak, diğeri kabul eder. Her iki cihaz da sonra aynı oturumu, varlık ve odak halkaları dahil canlı tutar. Bir bodrumdaki telefon erişim noktası dahil, paylaşılan herhangi bir ağda çalışır, çünkü arada sunucu yoktur. Bkz. [Working together](/info/collaborate.html). Farklı ağlardaki meslektaşlar için bir kuruluşun Lolly Work örneği kimliği doğrulanmış work collab'lar sağlar.

## Özellik bayrakları nedir?

Özellik bayrakları Lolly'nin bölümlerini açar veya kapatır. Bağımsız kullanımda kişisel ayarlarını sen seçersin. Lolly Work kullanan bir kuruluş, politikası altında varsayılanlar belirleyebilir veya seçili anahtarları gizleyebilir ve yönetilen denetimler etiketlenir. Bkz. [Use Lolly at your organisation](/info/organisation.html).

![Bağımsız uygulamada kişisel özellik bayrakları; kuruluş politikası seçili anahtarları yönetebilir](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Yardımcı araçları (Utilities) araçlardan ayıran nedir?

Bir yardımcı araç, zaten elinde olan bir dosya üzerinde hızlı bir iş yapar; örneğin bir PDF'i sıkıştırmak, bir fotoğrafı dönüştürmek veya gizli verileri temizlemek; birçoğu hiçbir şey yüklenmeden cihazında çalışır. İnsanların genellikle rastgele bir web sitesine verdiği işler Lolly içinde kalsın diye vardırlar. Bir sözleşmeyi sıkıştırmak, konumu hâlâ içinde olan tatil fotoğraflarını dönüştürmek veya bir belirteci çevrimiçi bir biçimlendiriciye yapıştırmak, dosyayı saklama süresi, yargı alanı ve iş modeli bilinmeyen bir siteye vermek anlamına gelmemelidir. [Utilities](/info/utilities.html) onları listeler ve [The trade we never agreed to](/info/status-quo.html) arkalarındaki hikâyeyi anlatır.

![Utilities görünümü: Strip Hidden Data, Compress PDF, Convert Image ve diğer cihaz üzerindeki işler, hepsi tek yerde](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kuruluşumuz SSO, paylaşılan projeler ve onayları kullanabilir mi?

Evet, aynı açık kaynak projesinin kuruluş sunucusu olan **Lolly Work** ile. Ayrı çalışır ve kimlik sağlayıcın üzerinden çoklu oturum açma (SSO), SCIM hesap sağlama, grup izinleri, paylaşılan projeler ve varlıklar, canlı work collab'lar, onaylar ve denetim kayıtları ekler. Günlük uygulama yine tek başına çalışır.

[Use Lolly at your organisation](/info/organisation.html) girişi ve paylaşılan işi bulmayı, [Deployment](/info/deployment.html#organisation-services-with-lolly-work) kurulumunu kapsar. Paylaşılan içerik ve kuruluş kayıtları o örneğin gizlilik ve saklama politikalarını izler.

## Lolly'ye geçerken hangi engelleri beklemeliyim?

Çoğunlukla teknolojiden çok üretim tarafında değişir. Yönetilen bir araç kümesi isteyen bir ekibin, tasarım sistemini ve ilk şablonları yazacak birine ihtiyacı vardır; yine de herkes Design içinde ilk günden kendi araçlarını yapmaya başlayabilir, git gerekmez. Ve mevcut süreçler çıktıları markaya aykırı olsa bile çalışmaya devam eder; bu yüzden görünür bir çıktıyı, önce ve sonra yan yana iyi dönüştürmek, durumu bir plandan daha hızlı anlatır.

[Adoption & Governance](/info/adoption-governance.html) role göre karşılamayı, bir pilotun nasıl ölçüleceğini ve bir yönetişim sürecinin nasıl görünebileceğini kapsar.

## Lolly "vibe coding" ile mi kodlandı?

Lolly, kamu bulutu öncü şirketlerinin modelleri dahil bir model ve sağlayıcı karışımıyla yapay zekâ destekli kodlama, yapay zekâ destekli keşif ve çoğu yerde yapay zekâ destekli içerikle geliştirildi. Mimariyi bir insan yarattı, kodu bilinçli olarak ayıkladı ve deneyimin sanat yönetimini yaptı.

Lolly'nin bağımlılıklarındaki yüksek veya kritik bir güvenlik uyarısı CI'ı engeller. Henüz düzeltilemeyen bir uyarı yalnızca yazılı gerekçeli onaylı bir istisna olarak geri tutulur. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) bugün tutulan her istisnayı listeler ve [yayın notları](https://github.com/lolly-tools/lolly/releases) her sürümün taşıdıklarını listeler. SECURITY.md ayrıca bir güvenlik açığının nasıl bildirileceğini söyler.

Derlemedeki denetimler ayrıca kod yorumlarında, uygulamada ve bu belgelerde makine yapımı gibi okunan ifadeleri reddeder; böylece metin her okuyucu için sade kalır. Bir yan etki, bir dedektörün hangi metni bir modelin yazdığını ayırt etmesinin zorlaşabilmesidir. Buna yol açmak amacıyla yola çıkmadık.

En önemlisi, Lolly dünyanın dört bir yanındaki uzmanların on yıllardır süren açık kaynak çalışmasının omuzlarında durur.

**Üretken yapay zeka bildirimi:**

- **LLM tarafından yazılan kod:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (bu liste genişleyebilir)
- **LLM keşfi:** Gemini 3.1, Fable, Codex Astra
- **Belgeleme:** Sonnet 5
- **Açık kaynak kitaplıkları:** SBOM, yorumlar ve dosya başlıklarında belirtilen ilgili yazarları

Bu liste, Lolly içine gömülü modelleri içermez.

**İnsan beyanları:**
- **Fikir, inceleme ve geri bildirim:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (liste kapsamlı değildir)
- **Mimari, sanat yönetimi ve slop janitor:** Andy Fitzsimon

## SUSE markalı araçlar nereye gitti?

Ayrı, özel bir depoda yaşarlar. Herkese açık bir klon SUSE marka paketini hiç getirmez; bu yüzden ondan yapılan bir derleme, başka bir tane seçmedikçe tarafsız `lolly-start` profilini kullanır: markadan bağımsız topluluk araçları ve kendi markanla doldurduğun boş bir marka. [lolly.tools](https://lolly.tools), `lolly-demo` profiliyle derlenir ve Lolly'nin kendi tasarım sistemi olan [Lolly Demo](/info/lolly-demo.html) ile açılır. SUSE, ticari markalarını korumak için kendi örneğini işletir.

## O Lolly logosu hangi aromada?

Kimi misket limonu der, kimi nane, bazen de elma; tatlılığı Lolly getirir, aromayı sen yaratırsın!
