# Lolly Batch ve Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch**, bir kartın bir düzine dildeki hâli veya bir bannerın her boyutu gibi, tek bir tasarımın birçok sürümünü oluşturur. **Lolly Multi-edit**, yeni bir tarih veya başlık gibi tek bir değişikliği farklı kayıtlı tasarımlara uygular.

İkisi de cihazında çalışır ve araçlarla aynı render yolundan dışa aktarır.

::: cols
## Batch

- Tek şablon, birçok satır. Her satır bir girdi kümesidir ve bir dosya oluşturur.
- Satırları yazarak, bir elektronik tablodan yapıştırarak veya CSV içe aktararak doldur.
- Satır sınırı yoktur; sayfa başına 50 satır gösterilir.
- Projects başlığındaki **Lolly Batch** üzerinden açılır (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- İki ile sekiz farklı kayıtlı tasarım, yan yana canlı kartlar olarak görünür.
- Tek bir kenar çubuğu, önce paylaştıkları girdileri, sonra her kartın kendi girdilerini düzenler.
- Her tasarım geldiği yere geri kaydedilir.
- Projects seçim çubuğundaki **Edit together** üzerinden açılır.
:::

<!--i:eti-table-->
## Tek bir tasarımın birçok sürümünü oluştur

Önce **Projects** görünümünü aç ve başlığındaki **Batch** düğmesine bas. Izgara tek satırla başlar. O satırda bir şablon seç, sonra satırı çoğalt veya bir elektronik tablodan veri yapıştır. Bir klasörün içinden açıldığında Batch seni o klasöre geri götürür.

![Yeni bir ızgarada Batch: üstte dosya adı ve satır araçları, ilk satırın şablon listesinde seçebileceğin araçlar açık](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Satırları doldur.** Bir hücreye yaz veya Excel, Google Sheets ya da başka bir elektronik tablodan bir blok yapıştır. **Import CSV** satır ekler veya toplu işin yerini alır. Dışa aktarma ayarları içeren bir hücreye yapıştırdığında Lolly, yapıştırılan her sütunun hangi girdiyi dolduracağını sorar. **Export CSV** ızgarayı dışarı yazar. Daha fazla girdi veya satır başına genişlik, yükseklik, birim ve DPI göstermek için ızgaranın altındaki **Columns** bölümünü aç. Bir sayı, metin veya seçim sütununun **Fill** açılır penceresinde, tek bir token'ı sütunun satırlarına bağlayan bir **Design token** bölümü de vardır ([Birçok belgeyi aynı anda bağla](/info/token-workflows.html#link-many-documents-at-once)).

**Çıktıyı ayarla.** Araç çubuğu, zip'in dosya adını ve her satır için **Default format**, birim ve DPI değerlerini ayarlar. Biçim menüsü, kataloğun sunduğu ve tarayıcının desteklediği biçimleri içeren dışa aktarma panelindeki gruplu listedir. Kendi biçimi, boyutu veya dosya adı olan bir satır kendi ayarını korur.

**Render et.** **Render all**, her satırı tek bir `.zip` içine dışa aktarır. Satırlar seçiliyken **Render selected**, **Export selected CSV** ve **Print selected rows** yalnızca bu satırlarda işlem yapar. Yeniden toplu işin tamamında çalışmak için seçimi temizle. **Print sheet**, satırları yazdırılabilir bir sayfaya yerleştirir. **Batch activity** her içe aktarmayı ve render işlemini bildirir ve katlanabilir.

**Toplu işi sakla.** **Sessions**, ne seçili olursa olsun ızgaranın tüm satırlarını adlandırılmış tek bir toplu iş oturumunda kaydeder. Oturum Projects içinden yeniden açılır. Aynı menüdeki **Folders…**, bir Projects klasörünü kayıtlı oturum başına bir satır olacak şekilde açar; her dosya adı klasör yolunu taşır.

::: details Satır ve hücre seçme
Satırları onay kutularıyla seç veya bir aralık seçmek için Shift tuşunu basılı tutarak bir onay kutusuna tıkla. Başlıktaki onay kutusu geçerli sayfayı seçer ve **Select all *N* rows** diğer sayfalardaki satırları da alır. Sayfalar arasında geçiş yaptığında seçimler korunur. **Edit input**, **Duplicate** ve **Remove** seçili satırlarda işlem yapar ve **Undo remove** son kaldırılan satırları geri yükler. Bir hücre odaktayken Shift+Space o satırı seçer ve Escape seçimi temizler.

Bir dikdörtgen seçmek için hücreler boyunca sürükle, Shift tuşunu basılı tutarak bir hücreye tıkla veya Shift+Arrow tuşlarını kullan. **Copy cells** veya Ctrl+C / Command+C, değerleri elektronik tabloya uygun olarak kopyalar. Bir hücre odaktayken Ctrl+A / Command+A, her sayfadaki tüm görünür sütunları seçer; bir satırın onay kutusunda aynı kısayol her satırı seçer. Hücre seçmek, işaretlenmiş satırların işaretini kaldırmaz. Bir hücrenin metnini düzenlemek için hücreye çift tıkla veya Enter tuşuna bas. Panodan bir dikdörtgen yapıştır veya seçili her hücreyi doldurmak için tek bir değer yapıştır; boş hücreler ve çok satırlı metin konumlarını korur.
:::

### Satır başına colourway'ler ve temalar

Her satır kendi tema seçimlerini korur: açık veya koyu ve tasarım sisteminde varsa bir colourway. Projects, bir klasör veya kayıtlı toplu işten açılan satır, oturumunun kaydedildiği seçimlerle render edilir ve önizlenir. Baskı sayfası, çoğaltılmış bir satır ve doldurulmuş bir satır bunları korur.

Bir CSV, seçimleri boyut sütunlarından sonraki bir `_themes` sütununda taşır. Sütun, `_themes` bağlantı parametresiyle aynı JSON'u içerir; örneğin `{"":"dark","colourway":"beach"}`. Boş bir hücre veya `{}`, tasarım sisteminin varsayılanları anlamına gelir. Sütun yalnızca en az bir satırda seçim varsa yazılır. İçe aktarmada, geçerli tema seçimleri içermeyen bir hücre sorun olarak listelenir ve satırı varsayılanlarla render edilir.

::: note Bir satırın seçimlerini CSV'de ayarla
Izgarada bir satırın seçimlerini değiştirecek bir denetim henüz yoktur; bu yüzden bunları CSV'de veya kayıtlı oturumda ayarla.
:::

### Her satır için bir dil

Certificate gibi kendi metnini basan bir araç, `language` sütununda `de`, `ja` veya `ar` gibi kısa bir dil kodu alabilir. Böylece her satır metnini ve tarihini o dilde basar. Arapça ve Urduca satırlar sağdan sola düzenlenir. Boş bir hücre uygulamanın dilini izler. Lolly'nin henüz çevirisinin bulunmadığı bir dilde, tarih dahil İngilizce basılır; böylece bir sertifika hiçbir zaman yarı çevrilmiş olmaz.

### Batch veya Render folder

Daha önce kaydettiğin oturumları yeniden render etmek için Projects içinde seç ve **Render selection** seçeneğini veya tüm bir klasör için **Render folder** seçeneğini kullan. [İşini bul ve kurtar](/info/find-your-work.html#find-something-you-saved) ikisini de anlatır.

<!--i:eti-layers-->
## Birkaç kayıtlı tasarımı birlikte düzenle

İki ile sekiz kayıtlı oturumu **Projects** içinde işaretle ve seçim çubuğundan **Edit together** seç. `#/multi?s=<slot>,<slot>…` adresinde yan yana canlı kartlar olarak açılırlar. Her kart, oturumunun gerçek bir render'ıdır ve neyin dışa aktarılacağını gösterir.

Tek bir kenar çubuğu hepsini yönetir:

- <!--i:sliders--> Önce **Shared** gelir: iki veya daha fazla oturumun aynı şekilde tanımladığı her girdi (aynı kimlik, tür ve kısıtlar; toplu iş ızgarasının sütunları için kullandığı kural). Paylaşılan bir denetimdeki değişiklik, girdiyi tanımlayan her oturuma ulaşır ve her kartta canlı görünür. Aynı aracın iki oturumu her şeyi paylaşır; iki farklı araç yalnızca ortak girdilerini paylaşır. Shared kartının **Input actions** menüsü, girdiyi tanımlayan her oturumda bir tasarım token'ını bağlar.
- <!--i:document--> Shared kartının altında **oturum başına bir katlanmış kart**, aracın kendi kenar çubuğundaki gibi o oturumun tüm girdilerini ve kompakt bir dışa aktarma bloğunu tutar: **Format**, **W** / **H**, **Unit**, **DPI** ve **Download**. Bu Download önce oturumu kaydeder, sonra dosyayı araçtan alacağı dosya adı, biçim ve Content Credentials ile render eder.
- <!--i:search--> Üstteki **Filter inputs…**, tüm kartlardaki denetimleri aynı anda daraltır.

Bir oturumun kenar çubuğu kartını açmak için kartına tıkla (veya kartın üzerindeyken Enter tuşuna bas). **Save all**, her oturumu kendi yuvasına geri yazar. **Download all** önce kaydeder, sonra Projects içindeki **Render selection** gibi kümeyi tek bir zip'e render eder ve isteğe bağlı parola kilidi sunar.

Her kart, tasarımın içine yerleştirilmiş bir araç da dahil olmak üzere kendi oturumunun tema seçimleriyle çizilir. Kartları çevreleyen uygulama kendi renklerini korur. **Save all**, indirmeler, **Batch grid** ve **Send to Print Sheet** her oturumun seçimlerini korur.

### Sınırlar

- **En fazla sekiz.** Her kart kendi canlı çalışma ortamını başlatır ve sekiz kartla arayüz akıcı kalır. Daha fazlasını veya artık var olmayan bir oturumu isteyen bağlantı bunu söyler ve yarım yükleme yapmaz.
- **Bağlantı yereldir.** Kendi kayıtlı yuvalarını belirtir ve o kümeyi bu cihazda yeniden açar. Paylaşım bağlantısı değildir.
- **Daha büyük işler için** aynı seçim çubuğunda **Edit as sheet** seç. Seçimi, boyut sınırı veya aynı araç koşulu olmadan toplu iş ızgarasında satırlar olarak açar (`#/batch?s=…`). Klasörler ikisinin de dışında kalır: bir klasörü ızgarada **Sessions → Folders…** ile aç veya Projects içinde **Render folder** ile render et.
- **Arama Lolly Multi-edit'e ulaşmaz.** Arama çubuğunun kapsamadığı tek görünümdür.

<!--i:eti-map-pin-->
## Sırada nereye gitmeli

- **[Dosya dışa aktar](/info/exporting.html)**: her satırın kullanabileceği biçimler, boyutlar ve baskı ayarları.
- **[Şablonlar](/info/templates.html)**: iyi bir ilk satır oluşturan başlangıç noktaları.
- **[İşini bul ve kurtar](/info/find-your-work.html)**: Projects, klasörler ve kaydettiklerini render etme.
