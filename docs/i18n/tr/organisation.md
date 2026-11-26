# Lolly'yi kuruluşunda kullan

Kuruluşun kendi Lolly'sini çalıştırabilir: seçtiği araçlar ve tasarım sistemleriyle aynı uygulama. Nasıl ulaşacağını, nasıl oturum açacağını ve nelerin değiştiğini öğren.

Kuruluşun kurulumunu planlarken [Lolly'yi mevcut DAM sisteminle kullan](/info/use-with-dam.html), insanlar Lolly'de içerik üretirken onaylı bir kitaplığın nasıl yerinde kalabileceğini açıklar. [İçerik egemenliği](/info/content-sovereignty.html), üretim, yönetişim, depolama ve taşınabilirlik üzerindeki daha geniş denetimi anlatır.

::: note Kuruluşundan neye ihtiyacın var
Lolly'sinin web adresi veya kuruluşunun hazırladığı bir `.lolly` kurulum dosyası. lolly.tools tek başına bir kuruluşa bağlanmaz.
:::

<!--i:eti-globe-->
## Tarayıcıda

Kuruluşunun sana verdiği adresi aç. Sayfa oturum açmanı isterse **Sign in** düğmesine bas ve açılan oturum açma sayfasındaki adımları izle. Sonrasında Lolly, kuruluşunun araçları ve tasarım sistemleriyle her zamanki gibi çalışır.

lolly.tools üzerinden de başlayabilirsin: **Settings** görünümünü aç ve **Lolly instance** kartında **Open a workspace** düğmesine bas, adresi gir ve **Open this instance** düğmesine bas. Tarayıcı kuruluşunun kendi adresine gider; çünkü bir tarayıcı, lolly.tools üzerinden başka bir Lolly'nin araçlarını yükleyemez.

![Settings içindeki Lolly instance kartı; burada kuruluşunun çalışma alanını açar veya uygulamanın araçlarını nereden aldığını değiştirirsin](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Masaüstü veya mobil uygulamada

Uygulama, beraberinde gelen araçlarla başlar. Bağlanmak için **Settings** görünümünü aç ve **Lolly instance** kartındaki **Change** düğmesine bas. Açılan panelde **Where should Lolly get its tools?** sorusu yer alır.

1. **Connect to a Lolly instance** seçeneğini seç.
2. Kuruluşunun web adresini gir ve **Check & connect** düğmesine bas.
3. **Use this instance** düğmesine bas. Sonraki ekran olan **Import your data (optional)**, kayıtlı işleri bir Lolly yedeğinden taşır. Yedeğin yoksa **Skip** düğmesine bas.
4. Uygulama isterse oturum aç.

Bağlı bir örneğin araçları, uygulamanın kendi araçlarıyla aynı güven düzeyinde çalışır; bu yüzden yalnızca güvendiğin bir örneğe bağlan. Kuruluşun bunun yerine uygulamayı senin için bağlayan bir `.lolly` kurulum dosyası gönderebilir.

Daha sonra geçiş yapmak için yeniden **Change** düğmesini veya aynı karttaki **Leave** düğmesini kullan.

### Kodla oturum açma

Masaüstü ve mobil uygulamalarda, kuruluşunun Lolly'si kodla oturum açmayı destekliyorsa oturum açma ekranı kısa bir kod da sunar. **Open sign-in in browser** düğmesine bas, oturum aç ve kodu orada onayla. Ya da ekranda gösterilen adresi, zaten oturum açtığın bir telefon veya bilgisayarda aç ve kodu gir. Kod yaklaşık on dakika geçerlidir.

<!--i:eti-sliders-->
## Orada neler farklı

- **Bazı denetimler senin için ayarlanmıştır.** Kuruluşunun yönettiği bir denetim, **Managed by** ile kuruluşun adını veya **Managed by your organisation** ifadesini gösterir. Sabitlenmiş bir denetim değiştirilemez ve bir menü yalnızca bazı seçeneklerini sunabilir. Bazı denetimler gizlidir. Kuruluşunun konsolu, bir denetimi hangi kuralın neden sabitlediğini kaydeder. Kuruluşunun Lolly'sini yöneten kişiye sor.
- **Bazı tasarım sistemleri kilitlidir.** Kuruluşunun sağladığı tasarım sistemi bir kilit gösterir ve salt okunur kalır. Değişiklikleri denemek için **Settings → Preferences → Design systems** içinde düzenlenebilir bir kopya oluştur.
- **Yalnızca kuruluşunun araçları listelenir.** Kuruluşunun sunmadığı bir araç gösterilmez.
- **Paylaşılan projeler.** Kuruluşun seninle proje paylaşıyorsa **Projects**, bir **Team projects** kutucuğu gösterir. Bu oturumlar kuruluşun sunucusunda bulunur. Üzerinde çalışmak için birini aç veya kullanılabiliyorsa **Share** üzerinden bir [kurumsal işbirliği](/info/collaborate.html#collabs-through-lolly-work-optional) başlat.
- **Bazı dışa aktarmalar onay gerektirebilir.** Kuruluşunun onay istediği durumlarda **Request approval**, **Download** düğmesinin yerini alır ve araç daha az biçim sunabilir.
- **Ana ekranın şablonlarla açılabilir.** Kuruluşun, bir iş ortağı şirket için yapabileceği gibi, sana şablonlar yayımlıyorsa ana ekranın ilk ziyaret karşılaması yerine bunlarla açılır. Her şablon bir karttır; devam etmek için **Your copy**, şablon değiştiğinde ise **New version** bulunur. Bkz. [İş ortağı şablonları](/info/work-partner-templates.html).

### Ne nerede kalır

::: cols
## Bu cihazda

- [Sync](/info/sync.html) özelliğini açmadığın sürece kendi kayıtların
- Kendin oluşturduğun tasarım sistemleri
- Ürettiğin ve indirdiğin her şey

## Kuruluşunun sunucusunda

- Oturum açma kimliğin ve cihaz bilgilerin
- Ekip projeleri, paylaşılan oturumlar ve kurumsal işbirliğindeki canlı düzenlemeler
- Paylaşılan kitaplığa yüklediğin varlıklar
- Onay istekleri ve onaylı teslimatlar
- Oturum açmalarının ve orada yaptıklarının kaydı
:::

Bir çalışma alanı bağlıyken uygulamanın ilk ekranındaki gizlilik satırı da aynı şeyi söyler. Lolly'nin kendi uygulamaları çalışma alanına kullanım olayı göndermez. [Gizlilik](/info/privacy.html#organisation-services-with-lolly-work), sunucunun neleri sakladığını ve bu verileri kimin kontrol ettiğini listeler.

<!--i:eti-building-->
## Lolly Work neler ekler

Kuruluşunun sunucusu, aynı açık kaynaklı projenin kuruluş yazılımı olan **Lolly Work**'ü çalıştırır. Tek başına kullandığında uygulama ne iş hesabı ne de Lolly Work gerektirir.

::: details Lolly Work neler ekleyebilir
Kuruluşun, [Lolly Work](https://github.com/lolly-tools/lolly-work)'ü Lolly'nin yanında barındırır ve hangi özellikleri açacağını seçer:

- **Oturum açma ve erişim.** Kurumsal tek oturum açma, grup tabanlı izinler ve yönetilen profil alanları. Yöneticiler SCIM üzerinden hesap oluşturabilir ve hesapları devre dışı bırakabilir.
- **Paylaşılan işler.** Kuruluşun sunucusu üzerinden canlı düzenlemeyle ekip projeleri, paylaşılan oturumlar ve [kurumsal işbirlikleri](/info/collaborate.html#collabs-through-lolly-work-optional).
- **Paylaşılan varlık kitaplığı.** Erişim kuralları, sürümler ve incelemeyle yüklenmiş varlıklar, koleksiyonlar ve bağlı kitaplıklar.
- **İnceleme ve teslimat.** Onay adımları, süresi dolan veya iptal edilebilen yönetilen bağlantılar ve kuruluşun izin verdiği hedeflere teslimat.
- **Yönetim.** Yönetim kurallarına tabi eylemlerin denetim kaydı ve kullanım olayı gönderen istemciler için örneğin telemetri politikası kapsamında kullanım raporları. Lolly'nin kendi uygulamaları şu anda kullanım olayı göndermez.
:::

Hizmeti kurmak için [Dağıtım](/info/deployment.html#organisation-services-with-lolly-work) ile başla. [lolly.work](https://lolly.work) adresindeki herkese açık demo bir deneme ortamıdır. Saklaman gereken işler için kuruluşunun kendi adresini kullan.

<!--i:eti-palette-->
## Başka bir kuruluşun markası

Bir iş ortağı, müşteri veya sponsor sana adres yerine markasını bir tasarım sistemi dosyası (`.lolly`) olarak gönderebilir. Bu dosyayı açmak uygulamayı hiçbir yere bağlamaz. Dosya, onların tasarım sistemini bu cihazda seninkinin yanına ekler. Kendi kuruluşundan gelen bir kurulum dosyası, uygulamayı kuruluşun Lolly'sine bağlar. Bir şey değişmeden önce önizleme, dosyayı açmanın ne yapacağını gösterir. [İş ortaklarıyla çalışma](/info/partners.html), başka bir kuruluşun markasıyla çalışmanın iki tarafını da ele alır.

<!--i:eti-unlink-->
## Ayrılma

**Settings** içindeki **Lolly instance** kartında yer alan **Leave**, kuruluşunun tasarım sistemini, araçlarını ve kataloğunu kaldırır. Kendi işin kalır. Kuruluşun araçlarıyla yaptığın hiçbir şey, yeniden bağlanana kadar açılmaz. Kuruluşunun Lolly'si sunuyorsa aynı karttaki **Sign out everywhere**, bu cihaz dahil her cihazdaki oturumlarını sonlandırır.

Kuruluşa kaydettiğin her şey, kuruluşun erişim ve saklama politikaları kapsamında kuruluşta kalır. Ayrılmak veya bu cihazı temizlemek, sunucudaki kopyayı silmez. Kuruluşunun kendi adresindeki bir tarayıcıda ayrılacağın bir bağlantı yoktur: bunun yerine farklı bir adres aç.

<!--i:eti-help-->
## Kime sormalı

Kuruluşunun sunucusuna nelerin ulaştığına, paylaşılan projelerini kimlerin görebileceğine ve hangi ayarların sabit olduğuna kuruluşun karar verir. Kuruluşunun Lolly'sini yöneten kişiye sor. [Gizlilik](/info/privacy.html), Lolly'nin kendisinin verilerinle ne yaptığını anlatır.
