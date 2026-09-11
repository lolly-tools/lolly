# Kendin Doğrula

Lolly'nin gizlilik ve güvenlik sayfaları iddialarda bulunur: analitik yok, izleme yok, dosyalar cihazdan asla çıkmaz, sistemin tamamında tek bir çerez. Bu sayfa farklıdır: bunların hiçbirine inanmanı istemez. Her biri kesin komutu veya tıklama yolunu ve göreceğin çıktıyı içeren bir prosedür listesidir. Buradaki her iddia, çoğu için hiçbir şey kurmadan, dakikalar içinde çürütülebilir.

Bu sayfadaki herhangi bir kontrol gösterilen sonucu üretmiyorsa, bu ya bir hatadır ya da tutulmamış bir sözdür. [Bildir](#if-a-check-fails) - her iki durumda da, bunu tutulmamış bir sözün hak ettiği ciddiyetle ele alacağız.

## On saniyede çalıştığını gör

Prosedürlerden önce, karşılığı gör. [`/verify`](/#/verify) sayfasını aç ve üzerine bir dosya bırak - yükleme yok, hesap yok, sunucu beklemesi yok. İşte AI duruşu sayfamızdan [oluşturulmuş Queensland fırtınasını](/info/ai-stance.html) kontrol ediyor: Lolly'nin açtığı, yeniden boyutlandırdığı ve dışa aktardığı bir Gemini görseli. Aşağıdaki her rozet, cihazda, dosyanın kendi baytlarından hesaplandı.

![Telefon genişliğinde bir ekranda Verify - fırtına görseli, yeşil bir Made with Lolly kararı ve altında sıralanmış kimlik bilgisi-sağlam ve bayt-değişmemiş rozetleri](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Karar, tek bir rozet değil, her biri bağımsız bir gerçek olan küçük bir rozet yığınıdır:

- <!--i:lock--> **Made with Lolly** - kimlik bilgisi sağlam *ve* bir Lolly dışa aktarımı kaydediyor.
- <!--i:seal--> **Kimlik bilgisi sağlam** - imzalı C2PA manifestosu ayrıştırılıyor ve kendi iddia imzası doğrulanıyor.
- <!--i:hash--> **Baytlar değişmedi** - dosyanın özeti (hash) hâlâ imzalanan değerle eşleşiyor. Tek bir pikseli değiştir ve bu rozet döner.
- <!--i:sparkle--> **GEN AI** - bu pikselleri bir makine üretti ve dosya bunu söylüyor. Lolly bu iddiayı gizlemek yerine olduğu gibi geri okuyor.

Ve tüm geçmiş dosyayla birlikte yolculuk ediyor. Burada dokuz adım hayatta kalıyor - görseli oluştururken ve filigranlarken Google'ın kaydettiği beş adım, ardından bu sayfadaki kopyayı açarken, işaretlerken ve dönüştürürken Lolly'nin kaydettiği dört adım - doğrudan baytlardan, cihazında geri okunuyor ve bir zaman çizelgesi olarak gösteriliyor. Bu, [AI duruşu sayfasındaki](/info/ai-stance.html) C2PA zaman çizelgesiyle aynı görsel, aynı şekilde doğrulanmış.

![Verify'ın fırtına görselinden geri okuduğu değişiklik geçmişi - Google tarafından kaydedilen beş adım, ardından Lolly tarafından kaydedilen dört adım, bu sayfadaki WebP ile sona eriyor](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Ancak bunların hiçbiri güven iddiası değil - bu bir gösterim. Bu sayfanın geri kalanı asıl güven iddiasıdır: yukarıdaki her rozet yeniden üretilebilir ve altlarındaki garantileri nasıl yeniden üreteceğin burada.

## Tarayıcında, hiçbir araç gerekmez

**1. Ağı izle.** [lolly.tools](https://lolly.tools) adresini aç, tarayıcının DevTools'unu (F12) aç, **Network** sekmesine geç ve bir araç kullan - [QR Code](/t/qr-code) aracına bir URL yaz, renkleri değiştir, bir PNG dışa aktar. Her istek `lolly.tools` üzerinde kalır: uygulama kabuğu, aracın kendi dosyaları, katalog varlıkları. Analitik sunucusu yok, CDN işareti yok, yazı tipi servisi yok, "hata bildirimi" uç noktası yok. Bir araca yazdıkların **hiçbir istekte** görünmez - render işlemi yerel olarak yapılır.

Dürüst istisnalar - her biri isteğe bağlı, kullanıcı tarafından başlatılır ve gerçekleştiği anda aynı Network sekmesinde görünür: marka düzenleyicisinde bir **Google Font** eklemek, ilk getirmeden önce bir kez tam olarak bunu söyleyen bir onay iletişim kutusundan sonra o tek aile yazı tipini Google'dan getirir; bir **ICC baskı profili ön ayarına** tıklamak o profili ICC'nin color.org'daki genel kayıt defterinden getirir; isteğe bağlı yerleşik **radyoyu** çalmak istasyondan akış yapar; **Meeting Planner**'a bir konum girmek, koordinatları ve saat dilimi için o yeri open-meteo'nun coğrafi kodlama servisinde şehir başına bir kez arar (yanıtlar cihazında saklanır) ve giriş alanı bu bilgiyi tam yazdığın yerde taşır; ve **URL Screenshot** yazdığın URL'yi zorunlu olarak yükler - bu onun işidir ve bunun gerçekleştiğini izlersin. Ağ yeteneği bildiren bir araç yalnızca manifestosunun izin verdiği ana bilgisayarlardan getirme yapabilir ve bu mekanizma başarısızlıkta kapanır (fail-closed); şu anda dağıtılan hiçbir araç böyle bir yetenek bildirmiyor, dolayısıyla yukarıdaki listeyi gerçekten kendi ana bilgisayarlarıyla sınırlayan sınır, tarayıcı tarafından uygulanan İçerik Güvenliği Politikası'dır. [Gizlilik politikası](/info/privacy.html) bunların tümünün kurallı tablosunu tutar; yerleşik kuralı, o tabloda olmayan bir ağ temasının gerçekleşmediğidir.

**2. Fişi çek.** Uygulamayı yükle ve bir iki araç aç, sonra çevrimdışına geç - uçak modu veya DevTools → Network → Offline. Yeniden yükle. Galeri ve açtığın her araç çalışmaya devam eder, kullandığın biçimlerde render ve dışa aktarma dahil - bir aracın dosyaları ve bir biçimin kodlayıcısı ilk kullanımında önbelleğe alınır, bu yüzden bir aracı çevrimdışı test etmeden önce bir kez çevrimiçiyken çalıştır. Bu, bu sayfadaki en güçlü tek kontroldür: eve telefon eden yazılım, bağlantısı kesildiğinde ayakta kalamaz.

**3. Çerezleri say.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Liste boştur - uygulama hiçbir çerez ayarlamaz. Ya da konsola `document.cookie` yapıştır: `""` alırsın. (Tüm sistemdeki tek çerez olan `lolly_ca_state`, isteğe bağlı bir kimlik girişi sırasında en fazla on dakika yaşar - giriş tamamlanır tamamlanmaz silinir - `/api/ca` ile sınırlıdır ve `HttpOnly`'dir: [gizlilik politikası](/info/privacy.html) bunu tam olarak açıklar.)

**4. Kendi depolamanı oku.** Aynı Application paneli: Lolly'nin sakladığı her şey önünde incelenebilir - birkaç düzine sade `localStorage` anahtarı (tema, dil, kenar çubuğu genişliği, ses ve görünüm ayarları, ayrıca genel araç kataloğu indeksinin önbelleğe alınmış bir kopyası) ve IndexedDB'de kendi belgelerin. Her değer okunabilir bir dize veya JSON'dur - hiçbir şey gizlenmemiş, okunmasını caydırmak için hiçbir şey kodlanmamıştır. **Profile → Clear all my data** bunu siler; tarayıcıda site verilerini temizlemek de aynı işi görür, çünkü hayatta kalacak sunucu tarafı kopyası yoktur.

**5. Bildirim iletişim bilgisinin var olduğunu kontrol et.** [`/.well-known/security.txt`](/.well-known/security.txt), bir HTML sayfası değil, bir [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) iletişim bloğuyla yanıt verir.

## Bir terminalden

**6. Render uç noktası yalnızca genel verilerle yanıt verir.** Kullanıcının yazdığı girdileri bir URL'ye koyan tek sunucu özelliği - doğrudan bağlantı render'ları - burada aktiftir, ve [gizlilik politikası](/info/privacy.html) bir bağlantıya koyduğun girdiler için bunun ne anlama geldiğini açıklar:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Bu anahtar dağıtım başınadır (`LOLLY_DISABLE_RENDER_GET=1`): bu değişkeni ayarlayan bir örnekte aynı sınama `404` döndürür - bu fark bayrağın çalıştığını gösterir, bir tutarsızlık değildir.

**7. Sunucu yüzeyi listelenebilirdir.** [Server Surface](/info/server-surface.html) var olan her sunucu tarafı rotasını listeler; yerleşik kural, o sayfada olmayan bir uç noktanın Lolly'nin parçası olmadığıdır. Onları `curl` ile dene; bulunacak başka bir şey yok.

## Kaynak kodda

Dağıtılan kod genel koddan farklı olsaydı, yukarıdakilerin tümü yine de bir gösteri olabilirdi. O yüzden kodu kontrol et - dağıtım [genel depodan](https://github.com/lolly-tools/lolly) derlenir:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Hiçbir yerde takipçi, hiçbir analitik SDK'sı yok.** Dağıtılan kodda - motor, her kabuk (tarayıcı uzantısı, Tauri köprü geçersiz kılmaları ve servis çalışanı dahil), sunucu fonksiyonları ve araç paketleri - her zamanki şüphelileri ara:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Üçüncü taraf DNS çözümleyici yok.** Verify'ın SEAL kontrolü aramaları hiçbir zaman bir DNS-over-HTTPS sağlayıcısı üzerinden yönlendirmez - web uygulamasının basitçe bir çözümleyicisi yoktur:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifika servisi hiçbir şey saklamaz.** Kimlik CA'sının bir düzenleme günlüğü yoktur - ne e-postan, ne bir zaman damgası, ne de bir webhook. Bu yokluk grep ile doğrulanabilir:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Vaatlerle değil, testlerle uygulanır

Yukarıdaki üç kaynak kontrolü tek seferlik bir denetim değildir - test paketine sabitlenmişlerdir, böylece sessizce çürüyemezler. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) şu durumlarda derlemeyi başarısız kılar:

- taradığı dağıtılan kaynağın herhangi bir yerinde bir analitik veya takip SDK'sı görünürse - uygulama, motor, sunucu, uzantı ve araç paketi kodu dahil,
- o kaynakta herhangi bir üçüncü taraf DNS-over-HTTPS çözümleyicisi görünürse,
- CA düzenleme günlüğü geri gelirse - kaynakta **veya** üretilen sunucu paketinde,
- gizlilik politikası yasal olarak gerekli ifadelerini kaybederse (adlandırılmış veri sorumlusu, hukuki dayanak, şikayet hakkı).

Klonda kendin çalıştır (Node 22.18+; bu dosya için `npm install` gerekmez):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Tam paket (`npm install && npm test`), [Security & Verification](/info/security.html) sayfasında anlatılan çekişmeli kriptografi testleri dahil, birkaç bin test daha çalıştırır.

## Dışarıdan doğrulayamayacakların - açıkça söylenmiş

Böyle bir sayfa, kendi sınırlarını adlandırarak güven kazanır:

- **Barındırma erişim günlükleri.** Bir isteğe yanıt veren herhangi bir sunucu o isteği günlükleyebilir - IP, yol, zaman damgası. Bir barındırıcının neyi saklayıp neyi saklamadığını doğrulayamazsın, biz de sağlayıcımızın belgelenmiş davranışının ötesinde doğrulayamayız. Mimarinin içeriğini tamamen hattın dışında tutmasının tam nedeni budur: cihazından hiç çıkmayan bir şey kimse tarafından günlüklenemez.
- **Dağıtımın bu kodu çalıştırdığı.** Kaynağın temiz olduğunu ve dağıtılan davranışın onunla eşleştiğini doğrulayabilirsin (yukarıdaki kontroller her iki ucu da yapar), ancak bir web dağıtımının ikili düzeyde tasdiki web platformunun sunduğu bir şey değildir. Önlemler genel depo, uygulanan testler ve çevrimdışı kontroldür - eve telefon eden kurcalanmış bir dağıtım 1. ve 2. kontrolde hemen başarısız olur.
- **Araç kancaları varsayılan olarak izole edilmemiştir.** Bir aracın isteğe bağlı mantığı incelenmiş olarak, sayfanın kendi alanında çalışır; lolly.tools'taki her araç birinci taraftır ve dağıtılmadan önce incelenir. Worker izolasyonu artık araç başına isteğe bağlı olarak sunuluyor - manifestosu `isolate: true` ayarlayan bir araç kancalarını bunun yerine iş parçacığı dışında çalıştırır - yani dışarıdan doğrulayamadıkların daralıyor, ama varsayılan yol hâlâ aynı alanda ve denetim hâlâ kontrol mekanizması. Bu gizlenmiş değil, açıkça belirtilmiştir - her zaman böyle söyleyen [tasarım sınırları](/info/security.html) bölümüne bak.

## Bir kontrol başarısız olursa

Bu sayfa ile gözlemlenen davranış arasındaki bir uyumsuzluk bir güvenlik raporudur ve bunu duymayı duymamaktan gerçekten daha çok isteriz: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), herhangi bir [lolly-tools deposundaki](https://github.com/lolly-tools) **Report a vulnerability** düğmesi veya [`/.well-known/security.txt`](/.well-known/security.txt) içindeki iletişim bilgisi. Koordineli ifşa ve bildirene teşekkür, yerleşik politikadır - ayrıntılar [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) içindedir.
