# SSS

`/info` açılış sayfasındaki akordeonda gösterilen sık sorulan sorular.

**Nasıl güncellenir:** aşağıdaki her `##` başlığı bir sorudur; altındaki her şey
(bir sonraki `##` başlığına kadar) cevaptır. Cevaplar sitenin geri kalanıyla aynı hafif
markdown'ı kullanır - paragrafları boş bir satırla ayır. Soruları burada ekle, çıkar ya da
yeniden sırala ve `npm run build:info` (ya da `npm run dev:web`) komutunu yeniden çalıştır.
İlk `##` başlığından önceki her şeyi (bu başlık ve bu notlar) derleme yok sayar.

## /profile sayfasında onay verdiğimde ne olur?

Lolly'yi ilk kullandığında, nereye yazarsan yaz her şey tamamen özeldir; ta ki o bilgiyi bir medya dosyasıyla ya da (çevrimiçiysen) bir paylaşım bağlantısıyla bilerek dışarı çıkarmak isteyene kadar.

Onayı verdiğinde, seçtiğin profil bilgileri ürettiğin şeyin içine mühürlenir ve seni kaynak olarak belirtir. Sen seçmeden hiçbir şey eklenmez.

Lolly büyük hacimde içerik üretir. Riski önlemek için katı bir veri minimizasyonu yaklaşımı benimsiyoruz.

## Lolly "vibe coding" ile mi kodlandı?

Lolly; yapay zeka destekli kodlama, yapay zeka destekli keşif ve birçok yerde yapay zeka destekli içerikle, kamu bulutunun öncü şirketleri dahil çeşitli model ve tedarikçilerin bir karışımı kullanılarak geliştirildi.

Bu yazının yazıldığı tarih itibarıyla Lolly, tedarik zincirinde bilinen sıfır güvenlik açığı içeriyor ve CVE'ler ortaya çıktığında hızlı güvenlik müdahale uygulamalarını taahhüt ediyor.

Mimariyi bir insan oluşturdu, kodu bilinçli biçimde derledi ve deneyimin sanat yönetmenliğini üstlendi.

En önemlisi, Lolly dünyanın dört bir yanındaki gerçek uzmanların on yıllara dayanan açık kaynak yeniliğinin omuzları üzerinde yükseliyor.

Lolly'nin kod tabanında, kodu ve belgeleri ortalama okuyucu için tutarlı tutan ve deneyimi "de-slop" eden deterministik bir build-gate bulunuyor. Bu, kökenin özel sentetik olarak tespit edilmesini zorlaştırabilir. Bu kasıtlı değildir.

**Üretken yapay zeka bildirimi:**

- **LLM tarafından yazılan kod:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (bu liste genişleyebilir)
- **LLM ile keşif:** Gemini 3.1, Fable
- **Dokümantasyon:** Sonnet 5
- **Açık kaynak kütüphaneler:** ilgili yazarları, SBOM, yorumlar ve dosya üstbilgilerinde belirtildiği gibi

Bu liste, Lolly içine gömülü modelleri içermez.

**İnsan katkısı:**

- **Mimari:** Andy Fitzsimon
- **Sanat yönetmenliği:** Andy Fitzsimon
- **İnsan tarafından yazılan kod:** Andy Fitzsimon
- **Fikir, inceleme ve geri bildirim:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Topluluğu (liste eksiksiz değildir)

## Özellik bayrakları nedir?

Özellik bayrakları Lolly'nin bazı bölümlerini açar ya da kapatır. Bunları genelde bir yönetici denetler - Lolly'de denetim sende.

![Her özellik bayrağı, bir yöneticinin konsolunda değil kendi profilinde duran, sana ait bir anahtardır](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Mobil ya da masaüstü uygulamalarını nasıl edinirim?

Herkes kendi uygulamasını dağıtabilir; bu uygulamaların araçları ve yapılandırması, hedeflenen kitleye göre büyük ölçüde değişir. Yani sen yapmadıkça ya da ilgili biri sana vermedikçe tek bir uygulama yok.

## Neden "Lolly Tools" adı?

**Lolly** çünkü özgürlük tatlıdır ve Avustralya, Yeni Zelanda ile Britanya'da lolly şeker demektir.

**Tools** çünkü bir alet, sen eline alana kadar öylece durur. Kullanmadığında çalışmaz, kullanırken de seni izlemez.

## Lolly'ye geçerken hangi engelleri beklemeliyim?

Lolly, halihazırda dosya ürettiğin her yere yerleşir - CLI, uygulamayla aynı motordur;
yani gece 2'de çalışan bir pipeline, bir kişinin tarayıcıda gördüğü önizlemeden sapamaz.
Benimsemedeki sürtünme nadiren tekniktir; kurumsaldır. Şunları bekle:

**Özenle hazırlanmış bir marka kataloğunun yazılması gerekir.** Lolly bir platformdur,
şablonlarının hazır bir paketi değil. *Yönetişimli bir yayılım* için biri ortak varlık
kataloğunu (kalıcı kimlikler olarak logolar, paletler, fontlar) tanımlar ve her çıktı türü
için manifest + şablon yazar. Yine de bireylerin bunu beklemesi gerekmez - açık uygulamada
herkes kendi dosyalarını katalogda içeri aktarabilir ve ilk günden Design içinde araç kurabilir.

**Katkı vermek için git gerekmez.** Tasarımcılar kendi araçlarını ve şablonlarını
uygulamada yapar, sonra bunları meslektaşlarıyla paylaşır ya da varsayılan olarak dahil
edilmesi için dağıtımın sahibine gönderir.

**Kapsamı bilerek dar tutuldu - öyle anlat.** Lolly, özel yapım ya da amiral gemisi
içerikler için değil. Tasarım sistemin, araçların ve kataloğunla beslenip güçlendirilmiş
kişisel DAM'in *odur* - ve evet, açık bir tuvali *var* (Design), ama orada bile renkler,
tipografi ve varlıklar etkin tasarım globallerine uyar; yani serbest yerleşim de sistemin
içinde kalır. Figma ya da Canva ile kıyaslanırsa sınırlı görünür. Gerçekte ne olduğuyla -
operasyonel hale getirilmiş, tekrar eden, çok büyük ölçekli varlık üretimi - kıyaslanırsa
rakibi yok. En sık karşılaşılan aksaklık, yanlış çerçevelemedir.

**Üretim tarafında değişim yönetimi.** Mevcut süreçler bugün çalışıyor, çıktı marka dışı
olsa bile. Onları motora yönlendirmek yeniden test etmek, yeniden öğrenmek demektir ve
"zaten dosya üretebiliyoruz" cümlesi taşınmamak için bahaneye dönüşür. İşe, çok göz önünde
olan üretim kalitesinde tek bir çıktıyı dönüştürüp öncesini ve sonrasını yan yana göstererek başla.

Lolly her şeyin seviyesini yükseltir.


## Yardımcı araçları (Utilities) araçlardan ayıran nedir?

**Kısa cevap →** Yardımcı araçların her zaman render etmesi gerekmez, bu yüzden farklı bir kullanıcı deneyimi alabilirler. 

**Asıl cevap →** Yardımcı araçların Lolly Tools içinde barındırılabilmesinin nedeni, veri sızdırmayı caydırmak için bir 'kolaylık katmanı' savunması daha eklemektir. 

Neden? Çünkü biliniyor ki insanlar her gün **ellerindeki gizli içeriği** alıp küçücük mekanik tek bir işlem yapsın diye
rastgele bir siteye teslim ediyor:

- "**Bu PDF'i sıkıştır**" → bir sözleşmeyi / maaş bordrosunu / yönetim kurulu sunumunu bilinmeyen taraflara yükler.
- "**HEIC'i JPG'ye çevir**" → kişisel fotoğrafları (GPS EXIF'iyle birlikte) reklamla finanse edilen bir sunucuya yükler
- "**Bu görseli kırp / yeniden boyutlandır**" → bir ürün ekran görüntüsünü ya da yayımlanmamış bir varlığı yükler
- "**Bu JSON'u biçimlendir**" / "şu JWT'yi çöz" → API yanıtlarını, tokenları, gizli anahtarları bir biçimlendiriciye yapıştırır
- "**Bu PDF'leri birleştir**" → **asla aynı sunucuyu paylaşmaması gereken iki belgeyi** yükler

Bu siteler ve devasa klon kuyrukları **varsayılan olarak güvenilir değildir**: saklama süresi
bilinmez, hangi ülkenin hukukuna tabi oldukları bilinmez, alt işleyenleri bilinmez ve verdiğin şeyi
saklamak için her türlü teşviki olan bir reklam/ortaklık iş modeliyle çalışırlar. İşlem önemsizdir;
**bedel içeriktir.** 

Yönetişim savaşını kusursuz kolaylık ve hizmetle kazanırız. 

![Utilities görünümü, insanların genelde rastgele bir siteye devrettiği mekanik işleri bir araya getirir; hepsi bunun yerine Lolly içinde çalışır](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Lolly, Figma, Penpot, Illustrator ya da InDesign dosyalarımı düzenleyip render edebilir mi?

Evet. **Design**'ı aç ve **Import a design**'a tıkla: yerel bir Figma **.fig** (Save local copy), bir Penpot **.penpot** dışa aktarımı, bir Illustrator **.ai** ya da **.pdf**, bir InDesign **.idml** (File → Export → InDesign Markup) veya **herhangi bir SVG** (geniş kapı - neredeyse her tasarım uygulaması bunu dışa aktarır) kabul edilir. Hesap, eklenti ve tasarım uygulaması lisansı gerekmez.

![Design'ın açık tuvali - Bir tasarımı içe aktar, araç çubuğunun Lolly menüsünde yer alır](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Katmanlar açık tuvale düzenlenebilir kutular olarak gelir: metin yeniden yazılabilir kalır, şekiller şekil kalır, görseller kendi görsel kitaplığına katılır, tipografi ve renkler ise marka globallerine uyar. Kaydettiğinde düzen, Lolly'si olan herkesin yeniden doldurabileceği, URL ile adreslenebilir ve tekrar kullanılabilir bir şablona dönüşür - üstelik yüklenirken yeniden render olan canlı araçları (bir QR kodu, bir grafik) araya karıştırabilirsin. Oradan sonrası Lolly'deki her şey gibi render edilir - SVG, PDF, PNG ve gerisi, URL'sinden yeniden üretilebilir şekilde. Bkz. [Import a design](/info/design-import.html).

## Çalışmamı bağlantı yerine dosya olarak paylaşabilir miyim?

Evet. Bir bağlantı her şeyi taşıyamadığında (kendi fotoğrafların, uzun metinler), Share penceresi neyin eksik kalacağını tam olarak söyler ve bunun yerine bir **.lolly** dosyası önerir: tasarımı, kullandığı görselleri ve istersen aracın kendisini tutan tek bir dosya. Ne kadarının yola çıkacağına sen karar verirsin - adın ve bilgilerin yalnızca profilin onay verdiyse girer, lisanslı görseller sen dahil etmedikçe geride bırakılır ve içinde araç taşıyan bir dosyayı açan kişiye, araç çalışmadan önce ona güvenip güvenmediği sorulur. Bkz. [Çalışmanı paylaşmak](/info/using.html#sharing-your-work).

## İki kişi internet olmadan aynı tasarım üzerinde çalışabilir mi?

Evet. Biri bir davet paylaşır (bir bağlantı, bir QR kodu ya da kısa bir kod), diğeri kabul eder ve iki cihaz aynı oturumu canlı tutar - kimin nerede olduğu, odak halkaları, hepsi. Ortak olan her ağda çalışır, bodrumdaki bir telefon hotspot'u dahil, çünkü arada sunucu yok. Bkz. [Birlikte çalışmak](/info/collaborate.html).

## SUSE markalı araçlar nereye gitti?

Onlar zaten ayrı, özel bir depoda duruyor. Herkese açık bir klon SUSE marka paketini hiç çekmez; dolayısıyla herkese açık bir derleme nötr `lolly-start` profilini çalıştırır - markadan bağımsız topluluk araçları ve kendi markanla doldurduğun boş bir marka. SUSE, ticari markalarını korumak için kendi örneğini işletir.

## Neden ücretsiz? Bit yeniği nerede?

**Lolly'yi kendimiz için yaptık.** SUSE'nin, her birinin içine adı mühürlenmiş, marka uyumlu binlerce dosyaya ihtiyacı vardı; hem de dışarıdaki hizmetlere hiçbir şey teslim etmeden. Biz de bunların tamamını cihazın üzerinde yapan bir araç yaptık ve ürettiğimiz her şey gibi onu da açık kaynak olarak yayımladık. Her gün kullandığımız için bakımını sürdürüyoruz. **Hiçbir zorunluluk yok:** buradaki her şey biz olsak da olmasak da çalışır.

Bu sınır bir sözle değil, lisansla çizildi: yerelde çalışan her şey sonsuza kadar ücretsizdir. Yayımlanmış bir sürüm, geri alınamayacak şekilde lisanslanır ve kimsenin çalışmasını yeniden lisanslayabilecek bir katkıda bulunan sözleşmesi yoktur. Tam metin için bkz. [konumlandırma](/info/positioning.html).

## SUSE ne kadarını özel tutuyor? (yani halı ne zaman ayağımızın altından çekilecek)

Motor, kabuklar, şemalar ve markadan bağımsız araçlar açık kaynaktır; özel kalan kısım SUSE'nin ticari markaları ile markalı araçlarıdır ve bunlar zaten ayrılmış durumdadır. [lolly.tools](https://lolly.tools) adresindeki genel örnek, boş marka üzerinde çalışır.

Bu sınır söz verilmiş değil, yapısaldır. Yayımlanan her sürüm açık kaynaktır ve yayımlanmamış hale getirilemez, kimsenin çalışmasını yeniden lisanslayabilecek bir katkıda bulunan sözleşmesi yoktur ve geride tutulan tek şey ticari markadır. 2023'te başka bir şirket kurumsal Linux kaynaklarını kapattığında SUSE, o kodu açık tutmak için [OpenELA](https://openela.org) oluşumunun kurucularından biri oldu - bu proje de aynı duruşu devralıyor.

Açık olalım: SUSE, Lolly'yi kendi BT sistemlerine entegre etmek için dahili araçlar *geliştiriyor* - ama bu, SUSE'nin kendi iç kurulumuyla ilgili; açık geliştirme mi kapalı geliştirme mi meselesi değil. Lolly ayrıca [Open Build Service](https://openbuildservice.org/) üzerinden derlenmeyi ve güvenli tedarik zinciri artefaktlarının [SUSE Application Collection](https://apps.rancher.io/applications) tarafından sunulmasını hedefliyor.

## O Lolly logosu hangi aromada?

Kimi misket limonu der, kimi nane, bazen de elma; tatlılığı Lolly getirir, aromayı sen yaratırsın!
