# Profiller

Adını, iletişim bilgilerini ve portre fotoğrafını bir kez ayarla; bunları kullanmak üzere hazırlanmış her araç, örneğin bir e-posta imzası, yaka kartı veya konuşmacı kartı, bunları otomatik doldurur. Bu kayıt senin **profilindir** ve cihazında tutulur.

Profilin ayrıca kayıtlı oturumları, yüklenen görselleri ve yerel etkinlik sayacını tutar. **Settings → Preferences** altında yönet. Araçlar yalnızca önceden doldurmak üzere tasarlandıkları alanları okur. Bağımsız kullanım hesap gerektirmez. İsteğe bağlı Sync, paylaşım ve kuruluş hizmetlerinin her birinin kendi veri akışları vardır.

<!--i:eti-user-check-->
## Bir profilde neler bulunur

| Bölüm | Ne olduğu |
|---|---|
| **Name** | Ad ve soyad. |
| **Contact** | E-posta ve telefon. |
| **Location** | Şehir ve ülke. |
| **Headshot** | E-posta imzaları, alıntı kartları ve organizasyon şemaları gibi araçlar için kare olarak kırpılan ve yerel bir görsel olarak saklanan isteğe bağlı fotoğraf. |
| **Use my details to create** | Açıldığında **Using my details** yazan, kullanıcının tercihiyle açılan bir anahtar. Bilgilerinin dışa aktarılan dosyalarda ve Lolly Batch çalıştırmalarında yazar bilgisi olarak taşınıp taşınmayacağını belirler; bkz. [Araçlar profilini nasıl kullanır](#how-tools-use-your-profile). |
| **Preferences** | Teman, her tasarım sistemindeki colourway'in, erişilebilirlik ayarların ve **Feature flags** altında açtığın uygulama bölümleri. |
| **Your work** | [Lolly Projects](/info/find-your-work.html) içinde düzenlenmiş, küçük resimleriyle birlikte kayıtlı oturumlar, yüklediğin görseller ve yerel etkinlik istatistiklerin. |

Bunların hiçbiri zorunlu değildir ve boş bir profil de çalışır.

![Preferences sekmesinde Settings: ayarlar rayı ve Use my details to create anahtarı ile ad, iletişim ve konum alanlarını içeren Your details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly ayarları](/info/dashboard.html), görünüm ve emojiden depolama ve çevrimdışı indirmelere kadar Preferences'ın geri kalanını ele alır.

<!--i:eti-users-->
## Sen, bir ekip veya bir rol

Lolly'de profil, bir şey üretirken kim olduğunu belirler: kendin, bir ekip veya bir rol. Lolly üçünü de aynı şekilde ele alır.

::: cols
## Kendin olarak

Varsayılan: adın, e-posta adresin ve portre fotoğrafın. İmzan, yaka kartın ve konferans logo düzenin bunlardan doldurulur.

## Bir ekip olarak

Ekibin ortak adı, `events@…` gibi bir grup gelen kutusu, bir departman ve ekibin amblemi. Bir kişi profili ayarlar ve bir dosya dışa aktarır. Diğer herkes aynı profili yükler, böylece ekibin dosyaları aynı bilgileri taşır. Ortak bir kiosk veya demo dizüstü bilgisayarı tek bir ekip profili kullanabilir.

## Bir rolde

Bir etkinlik yöneticisi yılda üç gün yaka kartlarında ve tabelalarda etkinliğin gelen kutusuna ve alt markasına ihtiyaç duyar, ardından her zamanki kimliğine geri döner. Rolü kayıtlı bir profil dosyası olarak tut, etkinlik için dosyayı yükle ve sonrasında bir kenara ayır.
:::

![Bir fotoğraf yükleyene kadar boş kalan portre fotoğrafı denetimi; yüklediğin fotoğraf bu cihazda kalır](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Lolly Work kullanan bir kuruluştaki profiller
Bir [kuruluşun Lolly'sinde](/info/organisation.html) oturum açtığında Lolly Work, kimlik sağlayıcısından doğrulanmış profil alanları sağlayabilir ve kuruluş politikası kapsamında alanları veya tercihleri sabitleyebilir. Yönetilen alanlar uygulamada etiketlenir.

Bu oturum açma işlemi, paylaşılan projelere ve varlıklara erişimi de kontrol eder. Ekip profili dosyası yerel bir dosyadır. Kuruluş üyeliği sağlamaz veya iş hesabının yerini almaz. **Use my details to create**, kuruluşun oturum açma veya denetim kayıtlarını değil, dışa aktarmalarındaki yazar bilgisini kontrol eder. Bkz. [Gizlilik](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Birkaçını sakla, birini kullan

Bir kurulumda aynı anda tek bir etkin profil bulunur ve uygulama içinde profil değiştirici yoktur. Her profil taşınabilir bir dosyadır; işini yeni bir cihaza taşıyan yedek dosyasının aynısıdır. Bağlam değiştirmek için:

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device** altındaki **Export my data**, geçerli profili tek bir `.zip` olarak kaydeder.
- <!--i:trash--> **Clear all my data**, bu kurulumu boşaltır.
- <!--i:upload--> **Import data…**, geçtiğin bağlamın profil dosyasını yükler.
:::

::: note Önce temizlemeden içe aktarmak verileri birleştirir
İçe aktarılan oturumlar ve görseller eklenir. Her iki kopyanın da bulunduğu durumlarda daha yakın zamanda kaydedilen tutulur. Klasörler, favoriler ve şablonlar seninkilerin yanına eklenir. Kendi bilgilerin korunur; boş alanlar ise dosyadaki değerleri alır. Birleştirme, ekibin oturumlarını kendi kurulumuna almak için uygundur ama roller arasında kesin bir ayrım sağlamaz.
:::

Aynı anda iki bağlam için ayrı bir tarayıcı profili, kullanıcı hesabı veya web uygulamasının kurulu bir kopyasını kullan. Her birinin kendi Lolly profili vardır.

![Tüm kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Her bağlam için bir dosya tut
Her dosyayı içeriğine göre adlandır, örneğin `LollyTools-events-2026.zip` ve `LollyTools-me.zip`. Dosyanın kendisi profildir.
:::

[İşini başka bir cihaza taşı](/info/find-your-work.html#move-your-work-to-another-device), dosyanın neleri içerdiğini, nelerin geride kaldığını ve Sync dahil diğer taşıma yollarını ele alır.

<!--i:eti-pen-->
## Araçlar profilini nasıl kullanır

**Önceden doldurma.** Araç yazarı, bir girdiyi profilinden veri alacak şekilde işaretler (`bindToProfile: "firstname"`, `"email"`, `"headshot"` ve benzerleri). Araç açıldığında bu girdi profilinden doldurulur. Kuruluş politikası girdiyi kilitlemediyse profili değiştirmeden değeri tek bir oturum için değiştirebilirsin. Önceden doldurma yereldir ve **Use my details** açık olsa da olmasa da gerçekleşir.

**Yazar bilgisi.** Dışa aktardığında bilgilerin, dosyanın meta verilerinde yazar bilgisi olarak taşınabilir (PNG, PDF, SVG ve diğerleri). **Use my details to create**, bu bilgiyi ve Lolly Batch çalıştırmalarındaki yazar bilgisini kontrol eder. Anahtar kapalıyken dışa aktarma yine Lolly ile oluşturulduğunu belirtir ama kişisel yazar veya iletişim satırı taşımaz.

Araç yazarları: bkz. [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) ve [`host.profile`](/info/host-api.html#host-profile).

![Kullanıcının tercihiyle açıldığı belirtilen ve sen açana kadar kapalı kalan tek Use my details to create anahtarı](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, tasarım sistemi ve yetenekler

Settings içinde birbirine yakın duran üç şeyi karıştırmak kolaydır:

- <!--i:people--> **Profile** - sen, ekibin veya üstlendiğin rol: ad, iletişim, portre fotoğrafı ve kayıtlı işler. Kişiseldir, cihazda tutulur ve dosya olarak taşınabilir.
- <!--i:palette--> **Design system** - marka: her aracın render için kullandığı renkler, yazı tipleri ve ayarlar. Ortaktır, kişisel değildir; bkz. [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - uygulamanın yapabildikleri: kullanabildiğin özellikler ve araçlar.

Bu sözcüğün Lolly'de üç anlamı daha vardır. **İçerik profili**, bir dağıtımın hangi araçları ve kataloğu içereceğini seçen derleme ayarıdır; [Sözlük](/info/glossary.html) terimi tanımlar. `profile` bağlantı parametresi, dışa aktarma için CMYK baskı koşulu gibi bir renk profili seçer; bkz. [Ayrılmış URL parametreleri](/info/url-parameters.html#print). **Doğrulanmış kimlik**, e-posta adresini imzalı dışa aktarmalarına bağlayan isteğe bağlı imzalama sertifikasıdır. Bu bilgilerden ayrıdır ama her ikisinin de gömülüp gömülmeyeceğini **Use my details to create** belirler; bkz. [Content Credentials](/info/content-credentials-identity.html).

![Telefon genişliğinde Verified identity kartı: sertifika ömrü seçicisi ve altındaki kayıt adımı - kişisel bilgilerinden ayrı olan kimlik profili](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Gizlilik

Kişisel profilin yerel olarak saklanır. Bilgilerin bir yedek veya Sync kopyasında, paylaştığın ya da dışa aktardığın içerikte ve isteğe bağlı Content Credentials kaydı sırasında taşınabilir. Bir Lolly Work örneğinde oturum açma, paylaşılan işler, telemetri politikası ve denetim kayıtları bu yerel profilden ayrıdır. **Settings → Preferences → Clear all my data**, bu cihazı temizler; depolama sağlayıcının veya kuruluşunun tuttuğu kopyaları silmez. Bkz. [Gizlilik politikası](/info/privacy.html).
