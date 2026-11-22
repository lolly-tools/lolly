# Kendin doğrula

Bu sitedeki her söz, hesap olmadan denetlenebilir. Çoğu denetim yalnızca bir tarayıcı gerektirir; geri kalanı için terminal ve kaynak kodun bir kopyası gerekir. Aşağıdaki denetimlerden biri gösterilen sonucu vermezse bu bir hata veya tutulmamış bir sözdür ve bilmek isteriz: bkz. [Bir denetim başarısız olursa](#if-a-check-fails).

Bu denetimler, Lolly'nin tek başına kullanımını kapsar. Kuruluşun Lolly Work çalıştırıyorsa buna oturum açma, paylaşılan içerik, yapılandırılmış telemetri ve denetim kayıtları eklenir; bunları [Sunucu arayüzleri](/info/server-surface.html) ve [gizlilik politikasının kuruluş bölümüyle](/info/privacy.html#organisation-services-with-lolly-work) karşılaştırarak denetle.

<!--i:eti-clock-->
## On saniyede çalıştığını gör

[`/verify`](/#/verify) sayfasını aç ve sayfaya bir dosya bırak. Sunucuya yükleme yok, hesap yok ve sunucu beklemek yok. Burada Yapay zekâya yaklaşımımız sayfasındaki [üretilmiş Queensland fırtınasını](/info/ai-stance.html) denetliyor: Gemini'nin ürettiği, Lolly'nin açıp işaretlediği ve dönüştürdüğü bir görsel. Her rozet, cihazda dosyanın kendi baytlarından hesaplandı.

![Telefon genişliğindeki ekranda Lolly Verify: fırtına görseli, yeşil bir Made with Lolly sonucu ve altında sıralanmış, kimlik bilgisinin sağlam ve baytların değişmemiş olduğunu belirten rozetler](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Sonuç, her biri bağımsız bir olguyu gösteren birkaç rozetten oluşur:

- <!--i:lock--> **Made with Lolly**: kimlik bilgisi sağlamdır *ve* bir Lolly dışa aktarmasını kaydeder.
- <!--i:seal--> **The credential is intact**: imzalı C2PA bildirimi ayrıştırılır ve kendi beyan imzası doğrulanır.
- <!--i:hash--> **The bytes have not changed**: dosyanın özeti hâlâ imzalanan değerle eşleşir. Tek bir pikseli değiştir ve bu rozet değişir.
- <!--i:sparkle--> **GEN AI**: bu pikselleri bir makine üretti ve dosya bunu belirtiyor. Lolly, bu gerçeği gizlemek yerine beyanı dosyadan okur.

Tüm geçmiş dosyayla birlikte taşınır. Burada dokuz adım korunur: Google'ın görseli üretirken ve filigran eklerken kaydettiği beş adım, ardından Lolly'nin bu sayfadaki kopyayı açarken, işaretlerken ve dönüştürürken kaydettiği dört adım. Lolly Verify bunları doğrudan baytlardan okur ve zaman çizelgesi olarak çizer.

![Lolly Verify'ın fırtına görselinden okuduğu değişiklik geçmişi: Google'ın kaydettiği beş adım, ardından Lolly'nin kaydettiği dört adım ve sonunda bu sayfadaki WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Aşağıdaki denetimler, bu demonun dayandığı güvencelerdir ve her biri tekrarlanabilir. [Content Credentials](/info/content-credentials-identity.html) her sonucu açıklar.

<!--i:eti-globe-->
## Tarayıcında, araç gerekmeden

::: timeline
- <!--i:globe--> **1. Ağı izle.** [lolly.tools](https://lolly.tools) sitesini aç, tarayıcının DevTools panelini aç (F12), **Network** sekmesine geç ve bir araç kullan: [Lolly QR Code](/t/qr-code) içine bir web adresi yaz, renkleri değiştir, bir PNG dışa aktar. Her istek `lolly.tools` adresine gider: uygulama kabuğu, aracın kendi dosyaları ve katalog varlıkları. Analitik sunucusu, CDN izleme sinyali, yazı tipi hizmeti veya hata raporlama uç noktası yoktur. Bir araca yazdıkların **hiçbir istekte görünmez**, çünkü render işlemi yereldir.
- <!--i:eyeoff--> **2. Bağlantıyı kes.** Uygulamayı yükle ve bir iki araç aç, sonra çevrimdışı ol (uçak modu veya DevTools → Network → Offline) ve yeniden yükle. Galeri ve açtığın her araç, kullandığın biçimlerde render ve dışa aktarma dahil çalışmaya devam eder. Bir aracın dosyaları ve bir biçimin kodlayıcısı, ilk kullanımda önbelleğe alınır; bu yüzden çevrimdışı denemeden önce aracı bir kez çevrimiçi kullan. Bu, sayfadaki en güçlü tek denetimdir: merkeze veri gönderen yazılımın bağlantısı kesilince çalışması da durur.
- <!--i:check--> **3. Çerezleri say.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Liste boştur: uygulama çerez oluşturmaz. Konsola `document.cookie` yapıştır ve `""` alırsın. İsteğe bağlı CA kaydı, `/api/ca` kapsamındaki kısa ömürlü bir `HttpOnly` çerezi olan `lolly_ca_state` oluşturur; `document.cookie` bunu gösteremez. Bir Lolly Work kurulumu kendi oturum açma çerezlerini kullanır; bunları [Gizlilik](/info/privacy.html#organisation-services-with-lolly-work) ile karşılaştır.
- <!--i:layers--> **4. Kendi depolamanı oku.** Aynı panelde Lolly'nin sakladığı her şey önündedir: birkaç düzine düz `localStorage` anahtarı (tema, dil, kenar çubuğu genişliği, ses ve görünüm ayarları ve herkese açık araç katalog dizininin önbelleğe alınmış kopyası) ve IndexedDB'deki kendi belgelerin. Her değer okunabilir bir dize veya JSON'dur, hiçbir şey gizlenmiş değildir. Site verilerini temizlemek bu yerel kayıtları kaldırır, ancak bir Sync yedeğini veya Lolly Work kurulumunda saklanan kayıtları kaldırmaz. **Settings → Storage → Clear all my data**, uygulamanın içinden aynı işi yapar ve depolarla önbelleklerin boşalmasını izleyebilirsin.
- <!--i:lock--> **5. Güvenlik açığı bildirim iletişiminin mevcut olduğunu denetle.** [`/.well-known/security.txt`](/.well-known/security.txt), HTML sayfası yerine [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) iletişim bloğuyla yanıt verir.
:::

::: details Network sekmesinde başka neler görebilirsin
Bazı özellikler ağa yalnızca onları kullandığında erişir ve her biri aynı sekmede görünür:

- Lolly Design System Setup içinde bir **Google Font** eklemek, ilk getirme işleminden önce bir kez gösterilen ve bunu belirten bir izin iletişim kutusunun ardından Google'dan o tek yazı tipi ailesini getirir;
- bir **ICC baskı profili önayarına** tıklamak, o profili ICC'nin color.org adresindeki herkese açık kayıt sisteminden getirir;
- isteğe bağlı yerleşik **radyo** çalındığında istasyondan akış alınır;
- **Meeting Planner** içine konum girmek, koordinatlarını ve saat dilimini almak için o yeri open-meteo'nun coğrafi kodlama hizmetinde şehir başına bir kez arar (yanıtlar cihazına kaydedilir) ve alan, yazdığın yerde bunu belirtir;
- **Lolly URL Screenshot** yazdığın adresi yükler ve bunu olurken izlersin.

Ağ yeteneği bildiren bir araç, yalnızca bildirimindeki izin listesinde bulunan sunuculardan veri getirebilir ve bu denetim başarısız olduğunda erişim engellenir. Bugün sunulan hiçbir araç böyle bir yetenek bildirmez; bu yüzden tarayıcının uyguladığı Content-Security-Policy, yukarıdaki listeyi izin verilen sunucularla sınırlar. [Gizlilik politikası](/info/privacy.html), politika yenilemeleri ve etkinleştirilmiş raporlama gibi yönetilen kurulum trafiği dahil tüm bunların esas alınan tablosunu içerir.
:::

<!--i:eti-code-->
## Terminalden

**6. Render uç noktası yalnızca herkese açık verilerle yanıt verir.** Yazılan girdileri bir URL'ye koyan tek sunucu özelliği olan doğrudan bağlantılı render'lar burada etkindir. [Gizlilik politikası](/info/privacy.html), bunun bağlantıya koyduğun girdiler için ne anlama geldiğini açıklar.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Her dağıtım kendi seçimini yapar (`LOLLY_DISABLE_RENDER_GET=1`): değişkeni ayarlayan bir kurulumda aynı yoklama `404` döndürür. Bu fark, bir tutarsızlık değil, ayarın çalışmasıdır.

**7. Dağıtımının etkinleştirdiği hizmetleri denetle.** [Sunucu arayüzleri](/info/server-surface.html), isteğe bağlı hizmetleri listeler ve ayrıntılı başvurularına bağlantı verir. Lolly Work için kimlik doğrulamalı API'lerini, işbirliği bağlantısını, depolamasını ve yapılandırılmış sağlayıcılarını dahil et. Herkese açık lolly.tools sitesinin yoklanması, özel bir kuruluş kurulumunu test etmez.

Kendi kurulumunu çalıştırıyorsan [Teslimat dağıtımı](/info/deploy-delivery.html) sürüm denetimlerini içerir: model bütünlüğü, uç sunucu yoklaması ve örnek listesi, görüntüleme sürümleri, özel indirme ağ geçidi ve tarayıcıda imzalı katalog.


<!--i:eti-search-->
## Kaynak kodda

Dağıtılan kod, herkese açık koddan farklı olsaydı yukarıdakilerin hepsi yine de bir gösteriden ibaret olabilirdi. Bu yüzden kodu denetle. Dağıtım, [herkese açık depodan](https://github.com/lolly-tools/lolly) derlenir:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Hiçbir yerde izleyici veya analitik SDK'sı yok.** Dağıtılan kodda (motor, tarayıcı uzantısı dahil her kabuk, Tauri köprü geçersiz kılmaları ve service worker, sunucu işlevleri ve araç paketleri) bilinen şüphelileri ara:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Bu tarama üçüncü taraf izleme SDK'larını arar. Birinci taraf kullanım raporlamasının yokluğunu göstermez: Lolly Work, kendi politikaları ve testleri olan kuruluş telemetrisini ve ayrı bir denetim günlüğünü destekler.

**9. Üçüncü taraf DNS çözümleyicisi yok.** Lolly Verify'ın SEAL denetimi asla bir DNS-over-HTTPS sağlayıcısı üzerinden sorgu göndermez, çünkü uygulamanın çözümleyicisi yoktur:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifika hizmeti, sertifika verme günlüğü tutmaz.** Kimlik CA'sı, verdiği sertifikaların günlüğünü veya kimlik envanterini tutmaz: stdout satırı, webhook veya sertifika deposu yoktur. Bu yokluk, aramayla denetlenebilir:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA kısa ömürlü çalışma durumu tutar: hız sınırı kovaları, kendi zaman aralıkları boyunca özetlenmiş IP ve e-posta anahtarlarını saklar; yönetilen bir dağıtımın kabul deposu da en fazla on dakika boyunca anahtarlı bir tanımlayıcı ve istek özeti tutar. Ayrıntılar [Content Credentials mühendisliği](/info/content-credentials-engineering.html#protocol) sayfasındadır.

<!--i:eti-flask-->
## Testlerle güvence altında

Yukarıdaki kaynak kod denetimleri tek seferlik bir inceleme değildir: test paketine sabitlenmiştir, bu yüzden sessizce işlevsizleşemezler. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts), yukarıdaki taramadan daha uzun bir izleyici adı listesini denetler ve şu durumlarda derlemeyi başarısız kılar:

- taradığı dağıtılmış kaynak kodun herhangi bir yerinde, uygulama, motor, sunucu, uzantı ve araç paketi kodunda herhangi bir analitik veya izleme SDK'sı bulunursa;
- o kaynak kodda herhangi bir üçüncü taraf DNS-over-HTTPS çözümleyicisi bulunursa;
- CA sertifika verme günlüğü, kaynak koda **veya** üretilen sunucu paketine geri gelirse;
- gizlilik politikası, yasal olarak zorunlu beyanlarını kaybederse (adı belirtilen veri sorumlusu, hukuki dayanak, şikâyet hakkı).

Klonlanmış depoda kendin çalıştır (Node 22.18 veya üzeri; bu dosya `pnpm install` gerektirmez):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Tam paket (`pnpm install && pnpm test`), [Güvenlik & Doğrulama](/info/security.html) sayfasında açıklanan saldırı odaklı kriptografi testleri dahil birkaç bin test daha çalıştırır.

<!--i:eti-eye-off-->
## Dışarıdan doğrulayamayacakların

- **Barındırma erişim günlükleri.** Her sunucu, yanıtladığı istekleri kaydedebilir: IP adresi, yol ve zaman. Dışarıdan yapılan bir yoklama, günlüklerin ne kadar süre saklandığını belirleyemez. İşletmen; günlük tutmayı, günlük döndürmeyi ve dışa aktarmaları kontrol eder ve bu tercihleri açıklamak zorundadır. Yerel render, olağan düzenlemeleri cihazında tutar; isteğe bağlı sunucu render'ı ve paylaşılan çalışma alanı hizmetleri, gizlilik politikasında açıklanan ayrı veri akışlarına sahiptir.
- **Dağıtımın bu kodu çalıştırdığı.** Kaynak kodun temiz olduğunu ve dağıtımdaki davranışın kaynak kodla eşleştiğini denetleyebilirsin; yukarıdaki denetimler ikisini de yapar. Web platformu, bir web dağıtımı için ikili dosya düzeyinde tasdik sunmaz. Riski azaltan önlemler; herkese açık depo, zorunlu testler ve çevrimdışı denetimdir: değiştirilmiş ve merkeze veri gönderen bir dağıtım, 1. ve 2. denetimlerde aynı anda başarısız olur.
- **Araç kancaları.** Yerleşik bir aracın isteğe bağlı mantığı, korumalı alana alınmak yerine incelenir: araç bir Worker kullanmayı seçmedikçe sayfada çalışır. lolly.tools üzerindeki her araç birinci taraftır ve dağıtılmadan önce incelenir. [Tehdit Modeli](/info/threat-model.html#trust-boundaries), kancaların nerede çalıştığını ve onları neyin sınırladığını açıklar.

<!--i:eti-warning-->
## Bir denetim başarısız olursa

Bu sayfa ile gözlemlediğin şey arasındaki bir fark, güvenlik bildirimi konusudur. [Güvenlik & Doğrulama](/info/security.html#reporting-a-vulnerability) sayfasındaki özel kanallardan gönder. Koordineli açıklama uygular ve bildirimde bulunanların katkısını belirtiriz.
