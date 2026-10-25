# Batch ve Multi-edit

Aynı tür dosyayı sık yaptığında iki iş ortaya çıkar. Bazen bir tasarımın birçok sürümüne ihtiyacın olur: düzinelerce dilde bir kart ya da bir afişin her boyutu. Bazen birkaç farklı kayıtlı tasarımın olur ve tek bir değişikliğin hepsine ulaşmasını istersin; yeni bir tarih veya yeni bir başlık gibi.

**Batch** ilk işi, **Multi-edit** ikinci işi yapar. İkisi de cihazında çalışır ve araçların kendisiyle aynı render yolundan dışa aktarır.

::: cols
## Batch

- Bir şablon, çok satır. Her satır bir girdi kümesidir ve bir dosya yapar.
- Satırları yazarak, bir elektronik tablodan yapıştırarak veya bir CSV içe aktararak doldur.
- Satır sınırı yok; sayfa başına 50 gösterilir.
- Projects başlığındaki **Batch** üzerinden açılır (`#/batch`).

## Multi-edit

- İki ila sekiz farklı kayıtlı tasarım, canlı kartlar olarak yan yana.
- Tek bir kenar çubuğu paylaştıkları girdileri, sonra her kartın kendi girdilerini düzenler.
- Her tasarım geldiği yere geri kaydedilir.
- Projects seçim çubuğundaki **Edit together** üzerinden açılır.
:::

## Bir tasarımın birçok sürümünü yap

**Projects** sayfasını aç ve başlığındaki **Batch** düğmesine bas. Izgara tek bir satırla başlar: onda bir şablon seç, sonra satırı çoğalt veya elektronik tablondan veri yapıştır. Bir klasörün içinden açıldığında Batch seni o klasöre geri döndürür.

![Yeni bir ızgarada Batch: üstte dosya adı ve satır araçları, seçebileceğin araçlar üzerinde açık duran ilk satırın şablon listesi](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Satırları doldur.** Bir hücreye yaz ya da Excel'den, Google Sheets'ten veya başka bir elektronik tablodan bir bloğu doğrudan yapıştır. **Import CSV** satır ekler veya toplu işi değiştirir. Dışa aktarma ayarlarını tutan bir hücreye yapıştırdığında Lolly, yapıştırılan her sütunun hangi girdiyi doldurduğunu sorar. **Export CSV** ızgarayı geri yazar. Daha fazla girdiyi ya da satır başına genişlik, yükseklik, birim ve DPI değerlerini göstermek için ızgaranın altındaki **Columns** bölümünü aç.

**Çıktıyı ayarla.** Araç çubuğu zip dosyasının adını, her satır için **Default format**, birimleri ve DPI değerini belirler. Biçim menüsü, dışa aktarma panelinin gruplanmış listesidir ve katalogun sunduğu ve tarayıcının desteklediği biçimleri gösterir. Kendi biçimi, boyutu veya dosya adı olan bir satır kendi ayarını korur.

**Render.** **Render all** her satırı tek bir `.zip` içine dışa aktarır. Önce satırları seç; **Render selected**, **Export selected CSV** ve **Print selected rows** yalnızca onlar üzerinde işlem yapar; tüm toplu iş üzerinde yeniden çalışmak için seçimi temizle. **Print sheet** satırları yazdırılabilir bir sayfaya yerleştirir. **Batch activity** her içe aktarmayı ve render'ı raporlar ve tabloya daha fazla yer vermek için katlanır.

**Toplu işi sakla.** **Sessions** tüm ızgarayı adlandırılmış bir toplu iş oturumu olarak kaydeder; bu oturum sonra Projects içinden yeniden açılır. Sessions, ne seçili olursa olsun her zaman her satırı kaydeder. Aynı menüdeki **Folders…** bütün bir Projects klasörünü, kayıtlı oturum başına bir satır olacak şekilde ve her dosya adı klasör yolunu taşıyarak satırlar olarak açar.

::: details Satırları ve hücreleri seçme
Satırları onay kutularıyla seç ya da bir aralık için bir onay kutusuna Shift ile tıkla. Başlıktaki onay kutusu geçerli sayfayı seçer ve **Select all *N* rows** diğer sayfalardaki satırları da alır. Seçimler sayfalar arasında gezinirken kalır. **Edit input**, **Duplicate** ve **Remove** seçili satırlar üzerinde işlem yapar ve **Undo remove** en son kaldırılan satırları geri yükler. Odaktaki bir hücreden Shift+Space o satırı seçer ve Escape seçimi temizler.

Bir dikdörtgen seçmek için hücrelerin üzerinde sürükle, bir hücreye Shift ile tıkla veya Shift+Ok tuşlarını kullan. **Copy cells** veya Ctrl+C / Command+C değerleri bir elektronik tablo için kopyalar. Odaktaki bir hücreden Ctrl+A / Command+A her sayfadaki her görünür sütunu seçer; bir satır onay kutusundan aynı kısayol her satırı seçer. Hücre seçmek işaretli satırları işaretli bırakır. Metnini düzenlemek için bir hücreye çift tıkla ya da Enter'a bas. Panodan bir dikdörtgen yapıştır ya da seçili her hücreyi doldurmak için tek bir değer yapıştır; boş hücreler ve çok satırlı metin konumlarını korur.
:::

### Satır başına colourway'ler ve temalar

Her satır kendi tema seçimlerini korur: açık veya koyu ve tasarım sisteminde varsa bir colourway. Projects'ten, bir klasörden veya kayıtlı bir toplu işten açılan bir satır, oturumunun kaydedildiği seçimlerle render edilir ve önizlemesi onlarla açılır. Baskı sayfası, çoğaltılmış bir satır ve doldurulmuş bir satır bunları korur.

Bir CSV seçimleri boyut sütunlarından sonra bir `_themes` sütununda taşır; bu, `_themes` bağlantı parametresiyle aynı JSON'u tutar, örneğin `{"":"dark","colourway":"beach"}`. Boş bir hücre veya `{}` tasarım sisteminin varsayılanları anlamına gelir. Sütun yalnızca bir satırın seçimleri olduğunda yazılır; bu yüzden hiçbiri olmayan bir toplu iş öncekiyle aynı CSV'yi dışa aktarır. İçe aktarırken geçerli tema seçimi olmayan bir hücre sorun olarak listelenir ve satırı varsayılanlarla render edilir. Izgarada bir satırın seçimlerini değiştirecek bir denetim henüz yok; bu yüzden onları CSV'de veya kayıtlı oturumda ayarla.

### Batch veya Render folder

Batch, bir şablonun birçok varyantını yapar. Zaten kaydettiğin oturumları yeniden render etmek için onları Projects içinde seç ve **Render selection** ya da bütün bir klasör için **Render folder** kullan; ikisini de [Find and recover your work](/info/find-your-work.html#find-something-you-saved) kapsar.

## Birkaç kayıtlı tasarımı birlikte düzenle

**Projects** içinde iki ila sekiz kayıtlı oturumu işaretle ve seçim çubuğundan **Edit together** seç. `#/multi?s=<slot>,<slot>…` adresinde canlı kartlar olarak yan yana açılırlar. Her kart oturumunun gerçek bir render'ıdır; yani gördüğün, dışa aktarılacak olandır.

Tek bir kenar çubuğu hepsini sürer:

- <!--i:sliders--> **Shared** önce gelir: oturumlardan ikisinin veya daha fazlasının aynı şekilde bildirdiği her girdi (aynı kimlik, aynı tür, aynı kısıtlar; toplu iş ızgarasının sütunları için kullandığı kural). Paylaşılan bir denetimi bir kez düzenle; değer, girdiyi bildiren her oturuma, her kartta canlı olarak ulaşır. Aynı aracın iki oturumu her şeyi paylaşır; iki farklı araç yalnızca ortak girdilerini paylaşır.
- <!--i:document--> Altında, **oturum başına bir katlanmış kart**, o oturumun kendi girdilerinin tamamını, aracın kendi kenar çubuğu kadar eksiksiz biçimde, kompakt bir dışa aktarma bloğuyla tutar: **Format**, **W** / **H**, **Unit**, **DPI** ve **Download**. Bu Download önce oturumu kaydeder, sonra dosyayı araçtan alacağı aynı dosya adı, biçim ve Content Credentials ile render eder.
- <!--i:search--> En üstteki **Filter inputs…** her kartta denetimleri aynı anda daraltır; böylece sekiz oturumda kaydırmadan "başlığa" ulaşabilirsin.

O oturumun kenar çubuğu kartını açmak için herhangi bir karta tıkla (veya üzerindeyken Enter'a bas). **Save all** her oturumu kendi yuvasına geri yazar. **Download all** önce kaydeder, sonra tüm kümeyi Projects'teki **Render selection** gibi tek bir zip içine render eder; yolda isteğe bağlı parola kilidi sunulur.

Her kart, tasarımın içine yerleştirilmiş bir araç dahil kendi oturumunun tema seçimlerinde çizilir. Farklı görünümlerdeki kartlar, etraflarındaki uygulama kendi renklerini korurken yan yana durur; **Save all**, indirmeler, **Batch grid** ve **Send to Print Sheet** her oturumun seçimlerini korur.

### Sınırlar

- **En fazla sekiz.** Her kart kendi canlı çalışma zamanını bağlar ve sekiz, yanıt verir kalan sayıdır. Daha fazlasını veya artık var olmayan bir oturumu isteyen bir bağlantı, yarım yüklenmek yerine bunu söyler.
- **Bağlantı yereldir.** Kendi kayıtlı yuvalarının adını verir; bu yüzden o kümeyi bu cihazda yeniden açar. Bir paylaşım bağlantısı değildir.
- **Daha büyük her şey için** aynı seçim çubuğunda **Edit as sheet** seç. Tüm seçimi, boyut sınırı ve aynı araç kuralı olmadan toplu iş ızgarasında satırlar olarak açar (`#/batch?s=…`). Klasörler ikisinin de dışında kalır: bir klasörü ızgarada **Sessions → Folders…** ile aç ya da Projects içinde **Render folder** ile render et.
- **Arama Multi-edit'e ulaşmaz.** Arama çubuğunun bilmediği tek görünümdür.

## Bundan sonra nereye

- **[Export a file](/info/exporting.html)**: her satırın kullanabileceği biçimler, boyutlar ve baskı ayarları.
- **[Templates](/info/templates.html)**: iyi bir ilk satır yapan başlangıç noktaları.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, klasörler ve kaydettiklerini render etme.
