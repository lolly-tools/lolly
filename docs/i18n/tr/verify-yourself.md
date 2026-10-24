# Kendin Doğrula

Bu sitedeki her söz denetlenebilir, hesap gerekmeden. Denetimlerin çoğu yalnızca bir tarayıcı gerektirir; gerisi bir terminal ve kaynağın bir kopyasını. Aşağıdaki bir denetim gösterilen sonucu vermezse bu bir hata veya bozulmuş bir sözdür ve bunu duymak isteriz: bkz. [If a check fails](#if-a-check-fails).

En hızlısıyla başla: bir dosyayı Verify üzerine bırak. Sonra daha ileri git: bir araç kullanırken ağı izle, fişi çek ve çalışmaya devam et, çerezleri say ve kaynağı oku.

Bu denetimler Lolly'yi tek başına kapsar. Kuruluşun Lolly Work çalıştırıyorsa o giriş, paylaşılan içerik, yapılandırılmış telemetri ve denetim kayıtları ekler; onları [Server Surface](/info/server-surface.html) ve [gizlilik politikasının kuruluş bölümü](/info/privacy.html#organisation-services-with-lolly-work) ile karşılaştırarak denetle.

## On saniyede çalıştığını gör

[`/verify`](/#/verify) sayfasını aç ve sayfaya bir dosya bırak. Yükleme yok, hesap yok ve bir sunucu için bekleme yok. Burada Our AI Stance sayfasındaki [üretilmiş Queensland fırtınasını](/info/ai-stance.html) denetler: Gemini'nin ürettiği, Lolly'nin açtığı, işaretlediği ve dönüştürdüğü bir görsel. Her rozet cihazda, dosyanın kendi baytlarından hesaplandı.

![Telefon genişliğinde bir ekranda Verify - fırtına görseli, yeşil bir Made with Lolly kararı ve altında sıralanmış kimlik bilgisi-sağlam ve bayt-değişmemiş rozetleri](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Karar, her biri bağımsız bir olgu olan küçük bir rozet yığınıdır:

- <!--i:lock--> **Made with Lolly**: kimlik bilgisi sağlamdır *ve* bir Lolly dışa aktarmasını kaydeder.
- <!--i:seal--> **The credential is intact**: imzalı C2PA bildirimi ayrıştırılır ve kendi iddia imzası doğrulanır.
- <!--i:hash--> **The bytes have not changed**: dosyanın karması hâlâ imzalananla eşleşir. Tek bir pikseli değiştir ve bu rozet döner.
- <!--i:sparkle--> **GEN AI**: bu pikselleri bir makine yaptı ve dosya bunu söylüyor. Lolly bu bildirimi gizlemek yerine geri okur.

Tüm geçmiş dosyayla birlikte gider. Burada dokuz adım sağ çıkar: Google'ın görseli üretirken ve filigranlarken kaydettiği beş adım, sonra Lolly'nin bu sayfadaki kopyayı açarken, işaretlerken ve dönüştürürken kaydettiği dört adım. Verify bunları doğrudan baytlardan okur ve bir zaman çizelgesi olarak çizer.

![Verify'ın fırtına görselinden geri okuduğu değişiklik geçmişi - Google tarafından kaydedilen beş adım, ardından Lolly tarafından kaydedilen dört adım, bu sayfadaki WebP ile sona eriyor](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Demo bu. Aşağıdaki denetimler onun altındaki güvencelerdir ve her biri yeniden üretilebilir. [Content Credentials](/info/content-credentials-identity.html) her kararı açıklar.

## Tarayıcında, hiçbir araç gerekmez

::: timeline
- <!--i:globe--> **1. Ağı izle.** [lolly.tools](https://lolly.tools) aç, tarayıcının DevTools'unu (F12) aç, **Network** sekmesine geç ve bir araç kullan: [QR Code](/t/qr-code) içine bir web adresi yaz, renkleri değiştir, bir PNG dışa aktar. Her istek `lolly.tools` üzerinde kalır: uygulama kabuğu, aracın kendi dosyaları ve katalog varlıkları. Analitik sunucusu, CDN işaretçisi, yazı tipi hizmeti ve hata raporlama uç noktası yoktur. Bir araca yazdığın şey **hiçbir istekte yer almaz**, çünkü render yereldir.
- <!--i:eyeoff--> **2. Fişi çek.** Uygulamayı yükle ve bir iki araç aç, sonra çevrimdışı ol (uçak modu veya DevTools → Network → Offline) ve yenile. Galeri ve açtığın her araç, kullandığın biçimlerde render ve dışa aktarma dahil çalışmaya devam eder. Bir aracın dosyaları ve bir biçimin kodlayıcısı ilk kullandığında önbelleğe alınır; bu yüzden bir aracı çevrimdışı sınamadan önce çevrimiçiyken bir kez kullan. Bu, bu sayfadaki tek en güçlü denetimdir: eve telefon eden yazılım kablosu kesilince ayakta kalmaz.
- <!--i:check--> **3. Çerezleri say.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Liste boştur: uygulama çerez ayarlamaz. Konsola `document.cookie` yapıştır ve `""` alırsın. İsteğe bağlı CA kaydı, `/api/ca` kapsamında kısa ömürlü bir `HttpOnly` çerezi olan `lolly_ca_state` ayarlar; bunu `document.cookie` gösteremez. Bir Lolly Work örneği kendi giriş çerezlerini kullanır; onları [Privacy](/info/privacy.html#organisation-services-with-lolly-work) ile karşılaştır.
- <!--i:layers--> **4. Kendi depolamanı oku.** Aynı panelde Lolly'nin tuttuğu her şey önündedir: birkaç düzine düz `localStorage` anahtarı (tema, dil, kenar çubuğu genişliği, ses ve görünüm ayarları ve herkese açık araç kataloğu dizininin önbellekteki bir kopyası) ve IndexedDB içinde kendi belgelerin. Her değer okunabilir bir dize veya JSON'dur, gizlenmiş hiçbir şey yoktur. Site verisini temizlemek bu yerel kayıtları kaldırır, ancak bir Sync yedeğini veya bir Lolly Work örneğinin tuttuğu kayıtları değil. **Settings → Storage → Clear all my data** aynısını uygulamanın içinden yapar ve depoların ve önbelleklerin boşalışını izleyebilirsin.
- <!--i:lock--> **5. Bildirim iletişiminin var olduğunu denetle.** [`/.well-known/security.txt`](/.well-known/security.txt), bir HTML sayfasıyla değil, bir [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) iletişim bloğuyla yanıt verir.
:::

::: details Network sekmesinde başka neler görebilirsin
Bazı özellikler ağa yalnızca kullandığında ulaşır ve her biri aynı sekmede görünür:

- Design System Setup içinde bir **Google Font** eklemek, ilk getirmeden önce bir kez bunu söyleyen bir onay iletişim kutusundan sonra o tek aileyi Google'dan getirir;
- bir **ICC press-profile preset** düğmesine tıklamak o profili color.org adresindeki ICC'nin herkese açık kayıt defterinden getirir;
- isteğe bağlı yerleşik **radyoyu** çalmak istasyondan akış alır;
- **Meeting Planner** içinde bir konum girmek, o yeri koordinatları ve saat dilimi için open-meteo'nun coğrafi kodlama hizmetinde şehir başına bir kez arar (yanıtlar cihazında saklanır) ve alan yazdığın yerde bunu söyler;
- **URL Screenshot** yazdığın adresi yükler, çünkü işi budur ve bunun olduğunu izlersin.

Bir ağ yeteneği bildiren bir araç yalnızca bildiriminin izin listesine aldığı sunuculardan getirebilir ve bu denetim güvenli biçimde başarısız olur. Bugün gönderilen hiçbir araç bir tane bildirmez; bu yüzden yukarıdaki listeyi sunucularıyla sınırlı tutan, tarayıcının uyguladığı Content-Security-Policy'dir. [Privacy policy](/info/privacy.html), politika yenilemeleri ve etkin raporlama gibi yönetilen örnek trafiği dahil, bunların hepsinin kurallı tablosunu tutar.
:::

## Bir terminalden

**6. Render uç noktası yalnızca herkese açık veriyle yanıt verir.** Yazılan girdileri bir URL'ye koyan tek sunucu özelliği, hot-link render'ları, burada canlıdır. [Privacy policy](/info/privacy.html) bunun bir bağlantıya koyduğun girdiler için ne anlama geldiğini söyler.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Her dağıtım seçer (`LOLLY_DISABLE_RENDER_GET=1`): bunu ayarlayan bir örnekte aynı yoklama `404` döndürür. Bu fark ayarın çalışmasıdır, bir tutarsızlık değil.

**7. Dağıtımının etkinleştirdiği hizmetleri denetle.** [Server Surface](/info/server-surface.html) isteğe bağlı hizmetleri listeler ve ayrıntılı başvurularına bağlanır. Lolly Work için kimliği doğrulanmış API'lerini, iş birliği bağlantısını, depolamasını ve yapılandırılmış sağlayıcılarını ekle. Herkese açık lolly.tools'u yoklamak özel bir kuruluş örneğini sınamaz.

Kendi örneğini çalıştırıyorsan [Delivery deployment](/info/deploy-delivery.html) onun için yayın denetimlerini içerir: model bütünlüğü, uç yoklaması ve örnek listesi, görüntüleme sürümleri, özel indirme ağ geçidi ve bir tarayıcıda imzalı katalog.


## Kaynak kodda

Yukarıdakilerin hepsi, dağıtılan kod herkese açık koddan farklı olsaydı yine de bir gösteri olabilirdi. O yüzden kodu denetle. Dağıtım [herkese açık depodan](https://github.com/lolly-tools/lolly) derlenir:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Hiçbir yerde izleyici ve analitik SDK'sı yok.** Gönderilen kodu (motor, tarayıcı uzantısı dahil her kabuk, Tauri köprü geçersiz kılmaları ve hizmet çalışanı, sunucu işlevleri ve araç paketleri) olağan şüpheliler için ara:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Bu tarama üçüncü taraf izleme SDK'larını arar. Birinci taraf kullanım raporlamasının yokluğunu göstermez: Lolly Work, kendi politikası ve testleri olan kuruluş telemetrisini ve ayrı bir denetim günlüğünü destekler.

**9. Üçüncü taraf DNS çözümleyicisi yok.** Verify'ın SEAL denetimi, uygulamada bir çözümleyici olmadığı için bir sorguyu asla bir DNS-over-HTTPS sağlayıcısı üzerinden göndermez:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifika hizmeti bir düzenleme günlüğü tutmaz.** Kimlik CA'sı neyi verdiğine dair bir günlük ve kimlik envanteri tutmaz: stdout satırı yok, webhook yok, sertifika deposu yok. Yokluk aranabilir:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA, kısa ömürlü çalışma durumunu tutar: hız sınırı kovaları pencereleri boyunca karmalanmış IP ve e-posta anahtarlarını tutar ve yönetilen bir dağıtımın kabul deposu en fazla on dakika boyunca anahtarlı bir tanımlayıcı ve istek özeti tutar. Ayrıntı [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) sayfasındadır.

## Testlerle zorlanır

Yukarıdaki kaynak denetimleri tek seferlik bir denetim değildir: test paketinde sabitlenmişlerdir; bu yüzden sessizce çürüyemezler. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts), yukarıdaki taramadan daha uzun bir izleyici adı listesini denetler ve şu durumlarda derlemeyi bozar:

- uygulama, motor, sunucu, uzantı ve araç paketi kodu boyunca taradığı gönderilen kaynağın herhangi bir yerinde herhangi bir analitik veya izleme SDK'sı görünürse;
- o kaynakta herhangi bir üçüncü taraf DNS-over-HTTPS çözümleyicisi görünürse;
- CA düzenleme günlüğü kaynakta **veya** üretilen sunucu paketinde geri gelirse;
- gizlilik politikası yasal olarak gerekli beyanlarını (adlandırılmış sorumlu, hukuki dayanak, şikâyet hakkı) kaybederse.

Klonda kendin çalıştır (Node 22.18 veya sonrası; bu dosya `pnpm install` gerektirmez):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Tam paket (`pnpm install && pnpm test`), [Güvenlik ve Doğrulama](/info/security.html) sayfasında açıklanan çekişmeli kriptografi testleri de dahil olmak üzere birkaç bin test daha çalıştırır.

## Dışarıdan doğrulayamadıkların

- **Barındırma erişim günlükleri.** Bir isteğe yanıt veren her sunucu onu günlüğe kaydedebilir: IP adresi, yol ve zaman. Dışarıdan bir yoklama günlüklerin ne kadar süre tutulduğunu belirleyemez. İşletme günlüğü, döndürmeyi ve dışa aktarmaları denetler ve bu seçimleri açıklamalıdır. Yerel render, sıradan düzenlemeleri cihazında tutar; isteğe bağlı sunucu render'ı ve paylaşılan çalışma alanı hizmetlerinin gizlilik politikasının anlattığı ayrı veri akışları vardır.
- **Dağıtımın bu kodu çalıştırdığı.** Kaynağın temiz olduğunu ve dağıtılan davranışın onunla eşleştiğini denetleyebilirsin ve yukarıdaki denetimler ikisini de yapar. Bir web dağıtımının ikili düzeyde kanıtlanması, web platformunun sunduğu bir şey değildir. Azaltıcılar herkese açık depo, zorlanan testler ve çevrimdışı denetimdir: eve telefon eden kurcalanmış bir dağıtım 1. ve 2. denetimlerde hemen başarısız olur.
- **Araç kancaları.** Yerleşik bir aracın isteğe bağlı mantığı sanal alana alınmak yerine incelenir: araç bir Worker'ı seçmedikçe sayfada çalışır. lolly.tools üzerindeki her araç birinci taraftır ve gönderilmeden önce incelenir. [Threat Model](/info/threat-model.html#trust-boundaries) kancaların nerede çalıştığını ve neyin onları sınırladığını ortaya koyar.

## Bir kontrol başarısız olursa

Bu sayfa ile gözlemlediğin şey arasındaki bir fark bir güvenlik raporudur. Onu [Security & Verification](/info/security.html#reporting-a-vulnerability) üzerindeki özel kanallardan gönder. Koordineli ifşa uygularız ve bildirenleri anarız.
