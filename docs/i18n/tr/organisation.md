# Lolly'yi kuruluşunda kullan

Kuruluşun kendi Lolly'sini işletebilir: seçtiği araçlar ve tasarım sistemleriyle aynı uygulama. Bu sayfa ona nasıl ulaşacağını, nasıl giriş yapacağını ve bunu yaptığında nelerin değiştiğini gösterir.

::: note Kuruluşundan neye ihtiyacın var
Kuruluşunun Lolly'sinin web adresi, ya da kuruluşunun hazırladığı bir `.lolly` kurulum dosyası. lolly.tools tek başına bir kuruluşa bağlanmaz.
:::

## Bir tarayıcıda

Kuruluşunun verdiği adresi aç. Sayfa girişi isterse **Sign in** düğmesine bas ve açtığı giriş sayfasını izle. Ondan sonra, kuruluşunun araçları ve tasarım sistemleriyle her Lolly gibi çalışır.

Ayrıca lolly.tools'tan da başlayabilirsin: **Settings** bölümünü aç, **Lolly instance** kartında **Open a workspace** düğmesine bas, adresi gir ve **Open this instance** düğmesine bas. Tarayıcı kuruluşunun kendi adresine gider; çünkü bir tarayıcı başka bir Lolly'nin araçlarını lolly.tools'tan yükleyemez.

![Settings içindeki Lolly instance kartı: kuruluşunun çalışma alanını açtığın veya uygulamanın araçlarını nereden aldığını değiştirdiğin yer](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Masaüstü veya mobil uygulamada

Uygulama paketlenmiş araçlarıyla başlar. Bağlanmak için **Settings** bölümünü aç ve **Lolly instance** kartında **Change** düğmesine bas. Sayfa **Where should Lolly get its tools?** diye sorar.

1. **Bir Lolly örneğine bağlan**'ı seç.
2. Kuruluşunun web adresini gir ve **Kontrol et ve bağlan**'a bas.
3. **Bu örneği kullan**'a bas. Sonraki ekran, **Verilerini içe aktar (isteğe bağlı)**, kaydedilmiş çalışmayı bir Lolly yedeğinden aktarır; hiçbiri yoksa **Atla**'ya bas.
4. Uygulama isterse oturum aç.

Bağlı bir örnekten gelen araçlar, uygulamanın kendi araçlarıyla aynı güvenle çalışır, bu yüzden yalnızca güvendiğin bir örneğe bağlan. Kuruluşun bunun yerine sana, uygulamayı senin için bağlayan bir `.lolly` kurulum dosyası gönderebilir.

Sonra geçiş yapmak için yine **Change** düğmesini ya da aynı karttaki **Leave** düğmesini kullan.

### Kodla giriş yapma

Masaüstü ve mobil uygulamalarda, kuruluşunun Lolly'si kodla girişi destekliyorsa giriş ekranı kısa bir kod da sunar. **Open sign-in in browser** düğmesine bas, giriş yap ve kodu orada onayla. Ya da gösterdiği adresi zaten oturum açtığın bir telefonda veya bilgisayarda aç ve kodu gir. Kod yaklaşık on dakika geçerlidir.

## Orada neyin farklı olduğu

- **Bazı denetimler senin için ayarlanır.** Kuruluşunun yönettiği bir denetim **Managed by** ve kuruluşun adını ya da **Managed by your organisation** gösterir. Sabit bir denetim değiştirilemez, bir menü seçeneklerinin yalnızca bir kısmını sunabilir ve **Set by** ile başlayan bir satır hangi kuralın neden geçerli olduğunu söyleyebilir. Bazı denetimler hiç gösterilmez.
- **Bazı tasarım sistemleri kilitlidir.** Kuruluşunun sağladığı bir tasarım sistemi kilit gösterir ve salt okunur kalır. Değişiklik denemek için **Settings → Preferences → Design systems** içinde düzenlenebilir bir kopya yap.
- **Yalnızca onun araçları listelenir.** Kuruluşunun sunmadığı bir araç hiç gösterilmez.
- **Paylaşılan projeler.** Kuruluşun seninle proje paylaşıyorsa **Projects** bir **Team projects** karosu gösterir. Bu oturumlar kuruluşun sunucusunda yaşar. Üzerinde çalışmak için birini aç ya da mümkünse **Share** üzerinden bir [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) başlat.
- **Bazı dışa aktarmalar onay gerektirebilir.** Kuruluşun onay istediğinde **Request approval**, **Download** düğmesinin yerini alır ve bir araç daha az biçim sunabilir.

### Ne nerede kalır

::: cols
## Bu cihazda

- Kendi kayıtların, [Sync](/info/sync.html) açmadıkça
- Kendi yaptığın tasarım sistemleri
- Yaptığın ve indirdiğin her şey

## Kuruluşunun sunucusunda

- Giriş kimliğin ve cihaz bilgin
- Team projects, paylaşılan oturumlar ve bir work collab içindeki canlı düzenlemeler
- Paylaşılan kitaplığa yüklediğin varlıklar
- Onay istekleri ve onaylanmış teslimatlar
- Kuruluşunun açtığı yerde kullanım olayları
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) sunucunun neleri sakladığını ve bu veriyi kimin denetlediğini listeler.

## Lolly Work neler ekler

Kuruluşunun sunucusu, aynı açık kaynak projesinin kuruluş yazılımı olan **Lolly Work**'ü çalıştırır. Uygulamayı tek başına kullandığında ne bir iş hesabına ne de Lolly Work'e ihtiyaç duyar.

::: details Lolly Work neler ekleyebilir
Kuruluşun [Lolly Work](https://github.com/lolly-tools/lolly-work)'ü Lolly'nin yanında barındırır ve hangi özelliklerin açılacağını seçer:

- **Giriş ve erişim.** Kuruluş çapında çoklu oturum açma (SSO), grup tabanlı izinler ve yönetilen profil alanları. Yöneticiler SCIM ile hesap sağlayıp devre dışı bırakabilir.
- **Paylaşılan iş.** Team projects, paylaşılan oturumlar ve kuruluşun sunucusu üzerinden canlı düzenlemeli [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional)'lar.
- **Paylaşılan bir varlık kitaplığı.** Erişim kuralları, sürümler ve incelemeyle yüklenen varlıklar, koleksiyonlar ve bağlı kitaplıklar.
- **İnceleme ve teslimat.** Onay adımları, süresi dolan veya iptal edilebilen yönetilen bağlantılar ve kuruluşun izin verdiği hedeflere teslimat.
- **Yönetim.** Örneğin telemetri politikası altında kullanım raporlama ve yönetilen eylemlerin denetim kaydı.

Hizmeti kuruyorsan [Deployment](/info/deployment.html#organisation-services-with-lolly-work) ile başla. [lolly.work](https://lolly.work) adresindeki herkese açık demo bir kum havuzudur; saklaman gereken iş için kuruluşunun kendi adresini kullan.
:::

## Ayrılma

**Settings** içindeki **Lolly instance** kartında **Leave**, kuruluşunun tasarım sistemini, araçlarını ve kataloğunu kaldırır. Kendi işin kalır. Onun araçlarıyla yaptığın her şey, yeniden bağlanana kadar bir daha açılmaz.

Kuruluşa kaydettiğin her şey, erişim ve saklama politikaları altında kuruluşta kalır. Ayrılmak veya bu cihazı temizlemek o sunucu kopyasını silmez. Kuruluşunun kendi adresindeki bir tarayıcıda ayrılacak bir şey yoktur: bunun yerine farklı bir adres aç.

## Kime sorulur

Kuruluşunun sunucusuna neyin ulaştığı, paylaşılan projelerini kimin görebildiği ve hangi ayarların sabit olduğu, kuruluşunun kararlarıdır. Kuruluşunun Lolly'sini kim yönetiyorsa ona sor. [Gizlilik](/info/privacy.html), Lolly'nin kendisinin verilerinle ne yaptığını kapsar.
