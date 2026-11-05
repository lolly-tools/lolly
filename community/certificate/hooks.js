// === lolly:shared brand-logo - generated from community/_shared/brand-logo.js; edit there and run pnpm run sync:shared ===
// Resolve only slots declared by the active design system. Catalogue tags describe
// available artwork; they do not say which identity the person selected.
async function resolveBrandLogo(dark, mono) {
  if (!host.tokens || !host.tokens.resolve || !host.assets || !host.assets.get) return null;
  var suffix = dark ? '-reverse' : '';
  var treatments = mono ? ['mono', 'primary'] : ['primary', 'mono'];
  for (var t = 0; t < treatments.length; t++) {
    for (var o = 0; o < 2; o++) {
      var variant = (o ? 'vertical-' : 'horizontal-') + treatments[t] + suffix;
      try {
        var id = await host.tokens.resolve('{asset.logo.' + variant + '}');
        if (typeof id !== 'string' || !id.trim() || id.indexOf('{') !== -1) continue;
        var asset = await host.assets.get(id);
        if (asset && typeof asset.url === 'string' && asset.url) return asset;
      } catch { /* Try another declared slot on the same background. */ }
    }
  }
  return null;
}

var _lastBrandLogoWarning = '';
function brandLogoWarning(missing) {
  var message = missing
    ? 'A logo for this background is unavailable in the active design system. Add a matching mark in Logos, or turn off the logo.'
    : '';
  if (message && message !== _lastBrandLogoWarning && host.log) host.log('warn', message);
  _lastBrandLogoWarning = message;
  return message;
}
// === /lolly:shared brand-logo ===

// === lolly:shared certificate-i18n - generated from community/_shared/certificate-i18n.js; edit there and run pnpm run sync:shared ===
// The words the Certificate prints, by language. Keys are the English source text;
// a language or a string missing from the table prints in English, and the hook
// then formats the date in English too, so a sheet is never half translated.
// The English list, with context for translators, is CT_PRINTED below; translations
// are added here by a reviewed translation pass, never by machine at render time.
var CT_TEXT = {
  "ar": {
    "Certificate of Completion": "شهادة إتمام",
    "Certificate of Achievement": "شهادة إنجاز",
    "Certificate of Award": "شهادة جائزة",
    "Certificate of Appreciation": "شهادة شكر وتقدير",
    "This is to certify that": "نشهد بأن",
    "has successfully completed": "أتمّ بنجاح",
    "is recognised for achievement in": "تقديرًا لإنجازه في",
    "is hereby awarded": "يُمنح بموجب هذه الشهادة",
    "in appreciation of": "شكرًا وتقديرًا على",
    "Date": "التاريخ",
    "Play motion": "تشغيل الحركة",
    "This certificate could not be laid out. Check the sheet size and the colours.": "تعذّر تنسيق هذه الشهادة. تحقق من حجم الورقة والألوان."
  },
  "bg": {
    "Certificate of Completion": "Сертификат за завършване",
    "Certificate of Achievement": "Сертификат за постижение",
    "Certificate of Award": "Сертификат за награда",
    "Certificate of Appreciation": "Сертификат за признателност",
    "This is to certify that": "Удостоверява се, че",
    "has successfully completed": "успешно завърши",
    "is recognised for achievement in": "получава признание за постижения в",
    "is hereby awarded": "се удостоява с",
    "in appreciation of": "в знак на признателност за",
    "Date": "Дата",
    "Play motion": "Пускане на анимацията",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Сертификатът не може да бъде оформен. Проверете размера на листа и цветовете."
  },
  "bn": {
    "Certificate of Completion": "সমাপ্তির সনদ",
    "Certificate of Achievement": "কৃতিত্বের সনদ",
    "Certificate of Award": "পুরস্কারের সনদ",
    "Certificate of Appreciation": "কৃতজ্ঞতার সনদ",
    "This is to certify that": "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে",
    "has successfully completed": "সফলভাবে নিম্নলিখিতটি সম্পন্ন করেছেন",
    "is recognised for achievement in": "নিম্নলিখিত বিষয়ে কৃতিত্বের জন্য স্বীকৃতি পেয়েছেন",
    "is hereby awarded": "নিম্নলিখিত পুরস্কারে ভূষিত করা হলো",
    "in appreciation of": "নিম্নলিখিত অবদানের জন্য কৃতজ্ঞতাস্বরূপ",
    "Date": "তারিখ",
    "Play motion": "মোশন চালান",
    "This certificate could not be laid out. Check the sheet size and the colours.": "এই সনদটি সাজানো যায়নি। কাগজের মাপ ও রং দেখে নিন।"
  },
  "cs": {
    "Certificate of Completion": "Certifikát o absolvování",
    "Certificate of Achievement": "Certifikát za dosažené úspěchy",
    "Certificate of Award": "Certifikát o udělení ceny",
    "Certificate of Appreciation": "Certifikát uznání",
    "This is to certify that": "Tímto se potvrzuje, že",
    "has successfully completed": "úspěšně absolvoval(a)",
    "is recognised for achievement in": "získává uznání za úspěchy v",
    "is hereby awarded": "tímto získává ocenění",
    "in appreciation of": "jako poděkování za",
    "Date": "Datum",
    "Play motion": "Přehrát animaci",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Rozvržení certifikátu se nepodařilo vytvořit. Zkontrolujte velikost listu a barvy."
  },
  "de": {
    "Certificate of Completion": "Abschlusszertifikat",
    "Certificate of Achievement": "Leistungsurkunde",
    "Certificate of Award": "Auszeichnungsurkunde",
    "Certificate of Appreciation": "Dankesurkunde",
    "This is to certify that": "Hiermit wird bescheinigt, dass",
    "has successfully completed": "folgendes erfolgreich abgeschlossen hat",
    "is recognised for achievement in": "für besondere Leistungen auf folgendem Gebiet gewürdigt wird",
    "is hereby awarded": "folgende Auszeichnung erhält",
    "in appreciation of": "Dank und Anerkennung erhält für",
    "Date": "Datum",
    "Play motion": "Animation abspielen",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Dieses Zertifikat konnte nicht dargestellt werden. Prüfen Sie Blattgröße und Farben."
  },
  "es": {
    "Certificate of Completion": "Certificado de finalización",
    "Certificate of Achievement": "Certificado de logro",
    "Certificate of Award": "Certificado de premio",
    "Certificate of Appreciation": "Certificado de agradecimiento",
    "This is to certify that": "Se certifica que",
    "has successfully completed": "ha completado con éxito",
    "is recognised for achievement in": "recibe reconocimiento por su logro en",
    "is hereby awarded": "se le otorga",
    "in appreciation of": "en agradecimiento por",
    "Date": "Fecha",
    "Play motion": "Reproducir animación",
    "This certificate could not be laid out. Check the sheet size and the colours.": "No se pudo maquetar este certificado. Revise el tamaño de la hoja y los colores."
  },
  "fr": {
    "Certificate of Completion": "Certificat d’accomplissement",
    "Certificate of Achievement": "Certificat de mérite",
    "Certificate of Award": "Certificat de distinction",
    "Certificate of Appreciation": "Certificat de remerciement",
    "This is to certify that": "Il est certifié que",
    "has successfully completed": "a terminé avec succès",
    "is recognised for achievement in": "reçoit une reconnaissance pour ses réalisations en",
    "is hereby awarded": "se voit décerner",
    "in appreciation of": "en remerciement de",
    "Date": "Date",
    "Play motion": "Lire l’animation",
    "This certificate could not be laid out. Check the sheet size and the colours.": "La mise en page de ce certificat a échoué. Vérifiez le format de la feuille et les couleurs."
  },
  "hi": {
    "Certificate of Completion": "पूर्णता प्रमाणपत्र",
    "Certificate of Achievement": "उपलब्धि प्रमाणपत्र",
    "Certificate of Award": "पुरस्कार प्रमाणपत्र",
    "Certificate of Appreciation": "प्रशंसा प्रमाणपत्र",
    "This is to certify that": "प्रमाणित किया जाता है कि",
    "has successfully completed": "ने सफलतापूर्वक निम्नलिखित पूर्ण किया",
    "is recognised for achievement in": "को निम्नलिखित क्षेत्र में उपलब्धि के लिए सम्मानित किया जाता है",
    "is hereby awarded": "को निम्नलिखित पुरस्कार प्रदान किया जाता है",
    "in appreciation of": "निम्नलिखित योगदान की सराहना में",
    "Date": "तारीख",
    "Play motion": "मोशन चलाएँ",
    "This certificate could not be laid out. Check the sheet size and the colours.": "यह प्रमाणपत्र बनाया नहीं जा सका। शीट का आकार और रंग जाँचें।"
  },
  "id": {
    "Certificate of Completion": "Sertifikat Penyelesaian",
    "Certificate of Achievement": "Sertifikat Pencapaian",
    "Certificate of Award": "Sertifikat Penghargaan",
    "Certificate of Appreciation": "Sertifikat Apresiasi",
    "This is to certify that": "Dengan ini menyatakan bahwa",
    "has successfully completed": "telah berhasil menyelesaikan",
    "is recognised for achievement in": "diakui atas pencapaian dalam",
    "is hereby awarded": "dengan ini dianugerahi",
    "in appreciation of": "sebagai apresiasi atas",
    "Date": "Tanggal",
    "Play motion": "Putar animasi",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Sertifikat ini tidak dapat ditata. Periksa ukuran lembar dan warnanya."
  },
  "it": {
    "Certificate of Completion": "Attestato di completamento",
    "Certificate of Achievement": "Attestato di merito",
    "Certificate of Award": "Attestato di premiazione",
    "Certificate of Appreciation": "Attestato di apprezzamento",
    "This is to certify that": "Si certifica che",
    "has successfully completed": "ha completato con successo",
    "is recognised for achievement in": "riceve il riconoscimento per i risultati ottenuti in",
    "is hereby awarded": "riceve il premio",
    "in appreciation of": "in segno di apprezzamento per",
    "Date": "Data",
    "Play motion": "Riproduci animazione",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Non è stato possibile impaginare questo attestato. Verificare le dimensioni del foglio e i colori."
  },
  "ja": {
    "Certificate of Completion": "修了証書",
    "Certificate of Achievement": "表彰状",
    "Certificate of Award": "賞状",
    "Certificate of Appreciation": "感謝状",
    "This is to certify that": "下記の方",
    "has successfully completed": "は、以下を修了したことを証します",
    "is recognised for achievement in": "は、以下における功績を称えられます",
    "is hereby awarded": "に、以下を授与します",
    "in appreciation of": "の、以下への貢献に深く感謝いたします",
    "Date": "日付",
    "Play motion": "モーションを再生",
    "This certificate could not be laid out. Check the sheet size and the colours.": "この証書のレイアウトを作成できませんでした。用紙サイズと色を確認してください。"
  },
  "ko": {
    "Certificate of Completion": "수료증",
    "Certificate of Achievement": "성취 증서",
    "Certificate of Award": "상장",
    "Certificate of Appreciation": "감사장",
    "This is to certify that": "아래 사람은",
    "has successfully completed": "아래 과정을 성공적으로 수료하였음을 증명합니다",
    "is recognised for achievement in": "아래 분야에서의 성취를 인정합니다",
    "is hereby awarded": "아래 상을 수여합니다",
    "in appreciation of": "아래 활동에 대한 공헌에 깊이 감사드립니다",
    "Date": "날짜",
    "Play motion": "모션 재생",
    "This certificate could not be laid out. Check the sheet size and the colours.": "이 증서의 레이아웃을 구성할 수 없습니다. 용지 크기와 색상을 확인하세요."
  },
  "ms": {
    "Certificate of Completion": "Sijil Penyempurnaan",
    "Certificate of Achievement": "Sijil Pencapaian",
    "Certificate of Award": "Sijil Anugerah",
    "Certificate of Appreciation": "Sijil Penghargaan",
    "This is to certify that": "Dengan ini disahkan bahawa",
    "has successfully completed": "telah berjaya menamatkan",
    "is recognised for achievement in": "diiktiraf atas pencapaian dalam",
    "is hereby awarded": "dengan ini dianugerahkan",
    "in appreciation of": "sebagai penghargaan atas",
    "Date": "Tarikh",
    "Play motion": "Mainkan gerakan",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Sijil ini tidak dapat disusun atur. Semak saiz helaian dan warna."
  },
  "nl": {
    "Certificate of Completion": "Certificaat van voltooiing",
    "Certificate of Achievement": "Certificaat van prestatie",
    "Certificate of Award": "Certificaat van onderscheiding",
    "Certificate of Appreciation": "Certificaat van waardering",
    "This is to certify that": "Hierbij wordt verklaard dat",
    "has successfully completed": "met succes heeft voltooid",
    "is recognised for achievement in": "erkenning krijgt voor behaalde prestaties op het gebied van",
    "is hereby awarded": "de volgende onderscheiding ontvangt",
    "in appreciation of": "dank en waardering ontvangt voor",
    "Date": "Datum",
    "Play motion": "Animatie afspelen",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Dit certificaat kon niet worden opgemaakt. Controleer het papierformaat en de kleuren."
  },
  "no": {
    "Certificate of Completion": "Kursbevis",
    "Certificate of Achievement": "Prestasjonsbevis",
    "Certificate of Award": "Prisbevis",
    "Certificate of Appreciation": "Anerkjennelsesbevis",
    "This is to certify that": "Det bekreftes herved at",
    "has successfully completed": "har gjennomført med suksess",
    "is recognised for achievement in": "anerkjennes for sin innsats innen",
    "is hereby awarded": "tildeles",
    "in appreciation of": "som takk for",
    "Date": "Dato",
    "Play motion": "Spill av animasjon",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Beviset kunne ikke legges ut. Kontroller arkets størrelse og fargene."
  },
  "pl": {
    "Certificate of Completion": "Certyfikat ukończenia",
    "Certificate of Achievement": "Certyfikat za osiągnięcia",
    "Certificate of Award": "Certyfikat nagrody",
    "Certificate of Appreciation": "Certyfikat uznania",
    "This is to certify that": "Niniejszym zaświadcza się, że",
    "has successfully completed": "pomyślnie ukończył(a)",
    "is recognised for achievement in": "otrzymuje wyróżnienie za osiągnięcia w",
    "is hereby awarded": "otrzymuje nagrodę",
    "in appreciation of": "w podziękowaniu za",
    "Date": "Data",
    "Play motion": "Odtwórz animację",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Nie udało się ułożyć tego certyfikatu. Sprawdź rozmiar arkusza i kolory."
  },
  "pt": {
    "Certificate of Completion": "Certificado de Conclusão",
    "Certificate of Achievement": "Certificado de Mérito",
    "Certificate of Award": "Certificado de Premiação",
    "Certificate of Appreciation": "Certificado de Agradecimento",
    "This is to certify that": "Certificamos que",
    "has successfully completed": "concluiu com sucesso",
    "is recognised for achievement in": "recebe reconhecimento por suas conquistas em",
    "is hereby awarded": "recebe o prêmio",
    "in appreciation of": "em agradecimento por",
    "Date": "Data",
    "Play motion": "Reproduzir animação",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Não foi possível diagramar este certificado. Verifique o tamanho da folha e as cores."
  },
  "ro": {
    "Certificate of Completion": "Certificat de absolvire",
    "Certificate of Achievement": "Certificat de realizare",
    "Certificate of Award": "Certificat de premiere",
    "Certificate of Appreciation": "Certificat de apreciere",
    "This is to certify that": "Se certifică prin prezenta că",
    "has successfully completed": "a absolvit cu succes",
    "is recognised for achievement in": "primește recunoaștere pentru realizările în",
    "is hereby awarded": "i se acordă",
    "in appreciation of": "în semn de apreciere pentru",
    "Date": "Data",
    "Play motion": "Redă animația",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Acest certificat nu a putut fi aranjat în pagină. Verificați dimensiunea foii și culorile."
  },
  "sv": {
    "Certificate of Completion": "Kursintyg",
    "Certificate of Achievement": "Intyg om prestation",
    "Certificate of Award": "Diplom för utmärkelse",
    "Certificate of Appreciation": "Intyg om uppskattning",
    "This is to certify that": "Härmed intygas att",
    "has successfully completed": "framgångsrikt har slutfört",
    "is recognised for achievement in": "erkänns för prestationer inom",
    "is hereby awarded": "tilldelas",
    "in appreciation of": "som tack för",
    "Date": "Datum",
    "Play motion": "Spela upp animation",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Certifikatet kunde inte läggas ut. Kontrollera arkets storlek och färgerna."
  },
  "tl": {
    "Certificate of Completion": "Sertipiko ng Pagkumpleto",
    "Certificate of Achievement": "Sertipiko ng Tagumpay",
    "Certificate of Award": "Sertipiko ng Parangal",
    "Certificate of Appreciation": "Sertipiko ng Pagpapahalaga",
    "This is to certify that": "Pinatutunayan na",
    "has successfully completed": "ay matagumpay na nakatapos ng",
    "is recognised for achievement in": "ay kinikilala para sa tagumpay sa",
    "is hereby awarded": "ay ginagawaran ng",
    "in appreciation of": "bilang pagpapahalaga sa",
    "Date": "Petsa",
    "Play motion": "I-play ang galaw",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Hindi maisaayos ang sertipikong ito. Suriin ang laki ng pahina at ang mga kulay."
  },
  "tr": {
    "Certificate of Completion": "Tamamlama Sertifikası",
    "Certificate of Achievement": "Başarı Sertifikası",
    "Certificate of Award": "Ödül Sertifikası",
    "Certificate of Appreciation": "Takdir Belgesi",
    "This is to certify that": "Bu belge ile onaylanır ki",
    "has successfully completed": "aşağıdakini başarıyla tamamlamıştır",
    "is recognised for achievement in": "aşağıdaki alandaki başarısından dolayı takdir edilmiştir",
    "is hereby awarded": "aşağıdaki ödüle layık görülmüştür",
    "in appreciation of": "aşağıdaki katkısı için teşekkür edilir",
    "Date": "Tarih",
    "Play motion": "Hareketi oynat",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Bu sertifika yerleştirilemedi. Sayfa boyutunu ve renkleri kontrol edin."
  },
  "uk": {
    "Certificate of Completion": "Сертифікат про завершення",
    "Certificate of Achievement": "Сертифікат про досягнення",
    "Certificate of Award": "Сертифікат про нагороду",
    "Certificate of Appreciation": "Сертифікат подяки",
    "This is to certify that": "Цим засвідчується, що",
    "has successfully completed": "успішно завершив(ла)",
    "is recognised for achievement in": "відзначається за досягнення в",
    "is hereby awarded": "отримує нагороду",
    "in appreciation of": "у подяку за",
    "Date": "Дата",
    "Play motion": "Відтворити анімацію",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Не вдалося скласти макет сертифіката. Перевірте розмір аркуша та кольори."
  },
  "ur": {
    "Certificate of Completion": "تکمیل کا سرٹیفکیٹ",
    "Certificate of Achievement": "کامیابی کا سرٹیفکیٹ",
    "Certificate of Award": "انعام کا سرٹیفکیٹ",
    "Certificate of Appreciation": "تعریفی سرٹیفکیٹ",
    "This is to certify that": "تصدیق کی جاتی ہے کہ",
    "has successfully completed": "نے کامیابی سے یہ مکمل کیا",
    "is recognised for achievement in": "کی نمایاں کامیابی کے اعتراف میں",
    "is hereby awarded": "کو یہ اعزاز عطا کیا جاتا ہے",
    "in appreciation of": "کی خدمات کی قدردانی میں",
    "Date": "تاریخ",
    "Play motion": "حرکت چلائیں",
    "This certificate could not be laid out. Check the sheet size and the colours.": "اس سرٹیفکیٹ کی ترتیب ممکن نہیں ہوئی۔ ورق کا سائز اور رنگ جانچیں۔"
  },
  "vi": {
    "Certificate of Completion": "Chứng nhận Hoàn thành",
    "Certificate of Achievement": "Chứng nhận Thành tích",
    "Certificate of Award": "Chứng nhận Giải thưởng",
    "Certificate of Appreciation": "Chứng nhận Tri ân",
    "This is to certify that": "Chứng nhận rằng",
    "has successfully completed": "đã hoàn tất thành công",
    "is recognised for achievement in": "được ghi nhận thành tích trong",
    "is hereby awarded": "được trao tặng",
    "in appreciation of": "nhằm tri ân",
    "Date": "Ngày",
    "Play motion": "Phát hoạt ảnh",
    "This certificate could not be laid out. Check the sheet size and the colours.": "Không thể dàn trang chứng nhận này. Hãy kiểm tra kích thước trang và màu sắc."
  },
  "zh": {
    "Certificate of Completion": "结业证书",
    "Certificate of Achievement": "成就证书",
    "Certificate of Award": "获奖证书",
    "Certificate of Appreciation": "感谢证书",
    "This is to certify that": "兹证明",
    "has successfully completed": "已成功完成",
    "is recognised for achievement in": "因在以下方面的成就而获得表彰",
    "is hereby awarded": "特此授予",
    "in appreciation of": "谨此感谢其在以下方面的付出",
    "Date": "日期",
    "Play motion": "播放动效",
    "This certificate could not be laid out. Check the sheet size and the colours.": "无法排版此证书。请检查纸张尺寸和颜色。"
  },
  "zh-hant": {
    "Certificate of Completion": "結業證書",
    "Certificate of Achievement": "成就證書",
    "Certificate of Award": "獲獎證書",
    "Certificate of Appreciation": "感謝狀",
    "This is to certify that": "茲證明",
    "has successfully completed": "已成功完成",
    "is recognised for achievement in": "因在以下方面的成就而獲得表彰",
    "is hereby awarded": "特此授予",
    "in appreciation of": "謹此感謝其在以下方面的付出",
    "Date": "日期",
    "Play motion": "播放動態",
    "This certificate could not be laid out. Check the sheet size and the colours.": "無法排版此證書。請檢查紙張尺寸與顏色。"
  }
};
var CT_PRINTED = [
  'Certificate of Completion',
  'Certificate of Achievement',
  'Certificate of Award',
  'Certificate of Appreciation',
  'This is to certify that',
  'has successfully completed',
  'is recognised for achievement in',
  'is hereby awarded',
  'in appreciation of',
  'Date',
  'Play motion',
  'This certificate could not be laid out. Check the sheet size and the colours.'
];
// Right-to-left languages among the ones Lolly ships (engine/src/lang.ts).
var CT_RTL = { ar: 1, ur: 1 };
// The value for Intl and the `lang` attribute, where it differs from the code.
var CT_LOCALE = { en: 'en-GB', zh: 'zh-Hans', 'zh-hant': 'zh-Hant', pt: 'pt-BR' };
function ctLangOf(code) {
  var c = String(code || '').trim().toLowerCase().replace(/_/g, '-');
  if (c === 'zh-hans' || c === 'zh-cn' || c === 'cn') return 'zh';
  if (c === 'zh-tw' || c === 'zh-hk' || c === 'tw' || c === 'hk') return 'zh-hant';
  if (c === 'pt-br' || c === 'br') return 'pt';
  if (c === 'jp') return 'ja';
  return c;
}
// The language the sheet is printed in: the requested one when the table has it,
// English otherwise.
function ctPrintLang(code) {
  var c = ctLangOf(code);
  return c && c !== 'en' && Object.prototype.hasOwnProperty.call(CT_TEXT, c) ? c : 'en';
}
function ctText(text, lang) {
  var table = Object.prototype.hasOwnProperty.call(CT_TEXT, lang) ? CT_TEXT[lang] : null;
  return table && Object.prototype.hasOwnProperty.call(table, text) && table[text] ? table[text] : text;
}
// === /lolly:shared certificate-i18n ===

/* global host */
/**
 * Certificate hooks.
 *
 * Turns the manifest inputs into the finished wording, the colours of the chosen
 * style and the sizes the logic-less template prints. Nothing here throws: a
 * failure comes back as the `error` extra, which the template shows in place of
 * the sheet's copy.
 *
 * Five things to know before editing:
 *
 * 1. COLOUR starts from the design system's colourway. The lead, the colour on
 *    the lead and the partner are read once per mount (and again after a theme
 *    or colourway switch, which reaches onInput as id '__tokens'), and each style
 *    gives them its own jobs: Classic inks the name and the frame in the lead,
 *    Modern lays the lead down as a panel, Minimal keeps it to a kicker and a
 *    ring, Celebration prints on the lead itself. Ink, Paper and Accent start
 *    empty and only override. Every colour the hook chooses is checked against
 *    what it sits on, so a pale lead hands the job to its partner or the ink.
 *
 * 2. WORDING follows `certKind` and the print language. A typed Title wins over
 *    the kind's title and nothing else, because the citation line is grammar,
 *    not branding. The language is the Language input, else the language the
 *    app or the link renders in; a language the CT_TEXT table does not hold yet
 *    prints in English, date included, so a sheet is never half translated.
 *
 * 3. SHAPE: the sheet re-lays itself out for its proportion through container
 *    queries in styles.css (banner, landscape, square, portrait, story). The hook
 *    works out the same shape to size the name and the course: one layout unit
 *    is a thousandth of the sheet's width, or of a design box H units tall when
 *    the sheet is wider than that box. The sheet is the `pageSize` preset, unless
 *    the canvas size the engine reports (ctx.canvasSize, engine 1.293) is a
 *    proportion of its own: someone typed a size, and the container queries lay
 *    the sheet out for the canvas, so the name and the course are sized for it
 *    too (see sheetFor). The manifest declares render.followsCanvasSize, so a
 *    change of size reaches onInput as id '__canvasSize'.
 *
 * 4. FIT is an estimate by character class (CJK is full width, capitals are
 *    wide), because a hook has no font metrics. The template's script measures
 *    the laid-out name and course afterwards and only ever shrinks them further.
 *
 * 5. MOTION is data here and maths in the template's script: the hook picks the
 *    preset, and seeds the confetti so every shell draws the same pieces.
 */

// Fallbacks for every colour: a design system with no tokens (the plain CLI host)
// still paints a finished sheet.
var INK_FALLBACK = '#1f2933';
var PAPER_FALLBACK = '#faf8f4';
var ACCENT_FALLBACK = '#8a6a2b';

// Page sizes, in the unit the manifest's select declares for each one, so the
// export bar and the sheet agree on what "A4 landscape" means.
var PAGES = {
  'a4-landscape': { w: 297, h: 210, unit: 'mm' },
  'a4-portrait': { w: 210, h: 297, unit: 'mm' },
  'letter-landscape': { w: 11, h: 8.5, unit: 'in' },
  'letter-portrait': { w: 8.5, h: 11, unit: 'in' },
  screen: { w: 1600, h: 1131, unit: 'px' },
  slide: { w: 1920, h: 1080, unit: 'px' },
  'social-landscape': { w: 1200, h: 628, unit: 'px' },
  'social-square': { w: 1080, h: 1080, unit: 'px' },
  'social-portrait': { w: 1080, h: 1350, unit: 'px' },
  story: { w: 1080, h: 1920, unit: 'px' },
  banner: { w: 1200, h: 400, unit: 'px' },
};
var PAGE_DEFAULT = 'a4-landscape';

// The proportion bands styles.css switches layout on, with the height of each
// band's design box in layout units. Keep in step with the @container rules.
var SHAPES = [
  { id: 'wide', min: 2.3, h: 333 },
  { id: 'land', min: 1.2, h: 707 },
  { id: 'square', min: 0.9, h: 1000 },
  { id: 'tall', min: 0.66, h: 1250 },
  { id: 'story', min: 0, h: 1778 },
];

var STYLES = ['classic', 'modern', 'minimal', 'celebration'];
var MOTIONS = ['none', 'fade', 'reveal', 'shimmer', 'confetti'];

// title / citation per kind. The lead line ("This is to certify that") is the
// same for all four: it introduces the name, not the reason.
var KINDS = {
  completion: { title: 'Certificate of Completion', cite: 'has successfully completed', glyph: 'check' },
  achievement: { title: 'Certificate of Achievement', cite: 'is recognised for achievement in', glyph: 'star' },
  award: { title: 'Certificate of Award', cite: 'is hereby awarded', glyph: 'star' },
  appreciation: { title: 'Certificate of Appreciation', cite: 'in appreciation of', glyph: 'heart' },
};
var KIND_DEFAULT = 'completion';
var LEAD = 'This is to certify that';

var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Own-property lookup only: a value of "constructor" or "__proto__" arriving
// from a URL would otherwise pick an inherited member and lay out a NaN sheet.
function own(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function str(v) {
  return String(v == null ? '' : v).trim();
}

function pick(list, value, fallback) {
  return list.indexOf(value) >= 0 ? value : fallback;
}

function round(v, places) {
  var k = Math.pow(10, places || 0);
  return Math.round(v * k) / k;
}

// ── colour ──────────────────────────────────────────────────────────────────

// Accept #rgb / #rgba / #rrggbb / #rrggbbaa (with or without the hash); anything
// else takes the fallback, so a blank token alias can never paint a transparent
// sheet. A sheet of paper has no opacity to express, so an alpha is dropped
// rather than the whole colour.
function hex(v, fallback) {
  var m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(str(v));
  if (!m) return fallback;
  var h = m[1].toLowerCase();
  if (h.length <= 4) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h.slice(0, 6);
}

function rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Straight 8-bit blend: hairlines, tints and muted labels from the sheet's own
// colours.
function mix(a, b, t) {
  var A = rgb(a);
  var B = rgb(b);
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Rec.709 luma of a ground, the same test deck-studio uses to pick a logo side.
function isDark(h) {
  var c = rgb(h);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) < 140;
}

// WCAG relative luminance and contrast ratio.
function lum(h) {
  var c = rgb(h);
  var out = 0;
  var w = [0.2126, 0.7152, 0.0722];
  for (var i = 0; i < 3; i++) {
    var v = c[i] / 255;
    out += w[i] * (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  }
  return out;
}

function contrast(a, b) {
  var x = lum(a);
  var y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// The first candidate that reaches `min` against `bg`, else the one that comes
// closest. Empty candidates are skipped, so a missing token never wins.
function readable(candidates, bg, min) {
  var best = '';
  var score = 0;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    var k = contrast(c, bg);
    if (k >= min) return c;
    if (k > score) { score = k; best = c; }
  }
  return best || INK_FALLBACK;
}

function withAlpha(h, a) {
  var v = Math.max(0, Math.min(255, Math.round(a * 255)));
  return h + (v < 16 ? '0' : '') + v.toString(16);
}

// ── the design system ───────────────────────────────────────────────────────
// Read once and kept, because onInput runs on every keystroke. A theme or
// colourway switch reaches onInput as '__tokens', which drops the kept answers.

var _theme = null;

async function readTheme() {
  if (_theme) return _theme;
  var t = { lead: '', onLead: '', partner: '', surface: '', text: '', muted: '', edge: '', family: [] };
  if (typeof host !== 'undefined' && host && host.tokens && host.tokens.resolve) {
    var read = async function (ref) {
      try {
        var v = await host.tokens.resolve(ref);
        return typeof v === 'string' ? v : '';
      } catch (e) { return ''; }
    };
    // The colourway: its lead, the colour that sits on the lead, and its partner.
    t.lead = hex(await read('{color.semantic.primary}'), '');
    t.onLead = hex(await read('{color.semantic.on-primary}'), '');
    t.partner = hex(await read('{color.semantic.secondary}'), '');
    t.surface = hex(await read('{color.semantic.surface}'), '');
    t.text = hex(await read('{color.semantic.text}'), '');
    t.muted = hex(await read('{color.semantic.muted}'), '');
    t.edge = hex(await read('{color.semantic.edge}'), '');
    // Every colourway's lead, for confetti that looks like the whole brand.
    if (host.tokens.family) {
      try {
        var members = (await host.tokens.family('primary')) || [];
        for (var i = 0; i < members.length && t.family.length < 6; i++) {
          var v = hex(members[i] && members[i].value, '');
          if (v && t.family.indexOf(v) < 0) t.family.push(v);
        }
      } catch (e) { /* a design system with one colourway has no family */ }
    }
  }
  _theme = t;
  return t;
}

// The colours of one style. Overrides are the person's own choices and are used
// as given; everything chosen here is contrast-checked against its ground.
function paletteFor(style, t, args, shape) {
  var oInk = hex(args.color, '');
  var oPaper = hex(args.background, '');
  var oAccent = hex(args.accent, '');
  var lead = t.lead || ACCENT_FALLBACK;
  var surface = t.surface || PAPER_FALLBACK;
  var text = t.text || INK_FALLBACK;
  var p = {};

  if (style === 'celebration') {
    // The whole sheet in the lead, printed in the colour made to sit on the lead.
    p.paper = oPaper || lead;
    p.ink = oInk || readable([t.onLead, surface, text, '#ffffff', '#111111'], p.paper, 4.5);
    p.accent = oAccent || readable([t.partner, t.onLead, p.ink], p.paper, 1.8);
    p.second = mix(p.ink, p.paper, 0.3);
    p.muted = mix(p.ink, p.paper, 0.22);
    p.rule = mix(p.ink, p.paper, 0.55);
    p.panel = p.paper;
    p.panelInk = p.ink;
  } else {
    p.paper = oPaper || surface;
    p.ink = oInk || readable([text, '#111111', '#ffffff'], p.paper, 4.5);
    if (style === 'modern') {
      // The lead becomes a panel; the accent is a short bar beside the name.
      p.panel = oAccent || lead;
      p.panelInk = readable([t.onLead, surface, text, '#ffffff', '#111111'], p.panel, 4.5);
      p.accent = readable([t.partner, p.panel, p.ink], p.paper, 2);
    } else {
      p.accent = oAccent || readable([lead, t.partner, p.ink], p.paper, 3);
      p.panel = p.accent;
      p.panelInk = readable([t.onLead, p.paper, '#ffffff', '#111111'], p.panel, 3);
    }
    p.second = t.partner && t.partner !== p.accent && contrast(t.partner, p.paper) >= 1.4
      ? t.partner : mix(p.accent, p.paper, 0.4);
    p.muted = t.muted && contrast(t.muted, p.paper) >= 3.5 ? t.muted : mix(p.ink, p.paper, 0.4);
    p.rule = mix(p.paper, p.accent, 0.45);
  }
  p.edge = t.edge && contrast(t.edge, p.paper) >= 1.2 ? t.edge : mix(p.paper, p.ink, 0.22);

  // The seal: a rosette in the accent (Classic, Celebration), a badge in the
  // panel's ink (Modern), a ring in the accent (Minimal).
  if (style === 'modern' && shape === 'wide') {
    p.seal = p.panel;
    p.sealInk = p.panelInk;
  } else if (style === 'modern') {
    p.seal = p.panelInk;
    p.sealInk = p.panel;
  } else {
    p.seal = p.accent;
    p.sealInk = readable([p.accent === lead ? t.onLead : '', p.paper, '#ffffff', '#111111'], p.seal, 3);
  }
  p.sealInner = mix(p.seal, p.sealInk, 0.12);
  p.ribbon = style === 'celebration' ? mix(p.ink, p.paper, 0.15) : p.second;

  // A light that passes over the sheet once, for the shimmer: white on a dark
  // ground, a glint of the accent on a light one.
  p.sheen = isDark(p.paper) ? '#ffffff47' : withAlpha(mix(p.accent, '#ffffff', 0.7), 0.34);

  // Confetti and ornaments: the brand's own colours, each one visible on the
  // paper it falls across.
  var pool = [p.accent, p.second, t.partner, t.onLead].concat(t.family);
  var confetti = [];
  for (var i = 0; i < pool.length && confetti.length < 6; i++) {
    var c = pool[i];
    if (c && confetti.indexOf(c) < 0 && contrast(c, p.paper) >= 1.3) confetti.push(c);
  }
  if (confetti.length < 3) confetti.push(p.ink, mix(p.accent, p.paper, 0.5));
  p.confetti = confetti;
  return p;
}

// ── wording ─────────────────────────────────────────────────────────────────

// 'YYYY-MM-DD' -> '18 June 2026' (or the print language's own long date).
// Anything else (a typed word, an empty value) passes straight through, so a
// hand-written "Spring 2026" still prints.
function fmtDate(v, lang) {
  var s = str(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  var day = Number(m[3]);
  if (!(mo >= 1 && mo <= 12) || !(day >= 1 && day <= 31)) return s;
  if (lang !== 'en' && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      var locale = own(CT_LOCALE, lang) ? CT_LOCALE[lang] : lang;
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, mo - 1, day)));
    } catch (e) { /* an engine without that locale prints the English date */ }
  }
  return day + ' ' + MONTHS[mo - 1] + ' ' + m[1];
}

// ── fit ─────────────────────────────────────────────────────────────────────

// Advance widths in em, by character class: an approximation of a display sans,
// erring wide so a name rarely needs the template's measured correction.
function emWidth(text) {
  var w = 0;
  var chars = Array.from(text);
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    var c = ch.codePointAt(0);
    if (c === 32) w += 0.27;
    else if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7af) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || c >= 0x20000) w += 1;
    else if (c >= 0x0590 && c <= 0x08ff) w += 0.52;
    else if (c >= 0x0900 && c <= 0x0dff) w += 0.62;
    else if (/[0-9]/.test(ch)) w += 0.58;
    else if (/[iljtfr.,'’\-]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.86;
    else if (ch.toUpperCase() === ch && ch.toLowerCase() !== ch) w += 0.68;
    else if (ch.toLowerCase() === ch && ch.toUpperCase() !== ch) w += 0.55;
    else w += 0.6;
  }
  return w;
}

function shapeOf(aspect) {
  for (var i = 0; i < SHAPES.length; i++) if (aspect >= SHAPES[i].min) return SHAPES[i];
  return SHAPES[SHAPES.length - 1];
}

// The widths and largest sizes, in layout units, that styles.css gives the name
// and the course line in each style and shape. `sheetW` is the sheet's width in
// layout units: 1000, or more when the sheet is wider than its design box.
function boxes(style, shape, sheetW) {
  var portrait = shape === 'square' || shape === 'tall' || shape === 'story';
  var nameMax = { wide: 54, land: 68, square: 92, tall: 112, story: 132 }[shape];
  var courseMax = { wide: 24, land: 30, square: 38, tall: 46, story: 56 }[shape];
  var w;
  if (shape === 'wide') w = sheetW - 480;
  else if (style === 'modern') w = portrait ? sheetW - 190 : sheetW - 340 - 150;
  else if (style === 'minimal') w = sheetW - 200;
  else w = Math.min(900, sheetW - (portrait ? 190 : 230));
  if (style === 'minimal') nameMax = Math.round(nameMax * 1.15);
  if (style === 'modern' && !portrait) nameMax = Math.round(nameMax * 0.94);
  return { width: Math.max(260, w), nameMax: nameMax, courseMax: courseMax, courseLines: portrait ? 3 : 2 };
}

// The name is the hero: the largest size that keeps it on one line, down to a
// floor; below the floor it takes two balanced lines rather than shrinking to
// a whisper.
function fitName(name, box) {
  var em = Math.max(1, emWidth(name));
  var one = Math.floor(box.width / em);
  var floor = Math.round(box.nameMax * 0.56);
  if (one >= floor) return { size: Math.min(box.nameMax, one), lines: 1 };
  var two = Math.floor(box.width * 2 / (em * 1.12));
  return { size: Math.max(Math.round(box.nameMax * 0.32), Math.min(Math.round(box.nameMax * 0.8), two)), lines: 2 };
}

// The course is a sentence and is meant to wrap, balanced, up to the shape's
// line budget.
function fitCourse(course, box) {
  var em = Math.max(1, emWidth(course));
  var size = Math.floor(box.width * box.courseLines / (em * 1.15));
  return Math.max(Math.round(box.courseMax * 0.55), Math.min(box.courseMax, size));
}

// ── shapes the template draws ───────────────────────────────────────────────

// The rosette's scalloped edge in its 120-unit box.
function scallopPath(bumps) {
  var cx = 60;
  var cy = 60;
  var r = 52;
  var R = 59;
  var d = '';
  for (var i = 0; i < bumps; i++) {
    var a0 = (i / bumps) * Math.PI * 2;
    var a1 = ((i + 1) / bumps) * Math.PI * 2;
    var am = (a0 + a1) / 2;
    if (i === 0) d += 'M' + round(cx + r * Math.cos(a0), 2) + ' ' + round(cy + r * Math.sin(a0), 2);
    d += 'Q' + round(cx + R * Math.cos(am), 2) + ' ' + round(cy + R * Math.sin(am), 2) + ' ' +
      round(cx + r * Math.cos(a1), 2) + ' ' + round(cy + r * Math.sin(a1), 2);
  }
  return d + 'Z';
}

function starPath() {
  var d = '';
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + (i * Math.PI) / 5;
    var r = i % 2 ? 9.5 : 22;
    d += (i ? 'L' : 'M') + round(60 + r * Math.cos(a), 2) + ' ' + round(61 + r * Math.sin(a), 2);
  }
  return d + 'Z';
}

var GLYPHS = {
  check: { d: 'M43 61 L55 73 L78 48', stroke: true },
  star: { d: starPath(), stroke: false },
  heart: { d: 'M60 80 C42 67 38 58 38 51 C38 44 43 39 49.5 39 C54 39 57.5 41.5 60 45.5 C62.5 41.5 66 39 70.5 39 C77 39 82 44 82 51 C82 58 78 67 60 80 Z', stroke: false },
};

// A small seeded generator: the same seed gives the same pieces in every shell.
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Celebration's printed confetti: thrown into two opposite corners and thinning
// out along the margins, so it frames the sheet and never crosses the wording.
// Each corner has a streak down the side margin and one along the top or foot
// margin; the bands are the body's own padding, as a share of the sheet.
// Positions are percentages of the sheet; sizes are layout units. Pieces keep a
// little air between them, so a cluster reads as thrown, not piled.
var ORNAMENT_BANDS = {
  wide: { side: 4.5, end: 9, along: 30, down: 42, grow: 0.9, aspect: 3 },
  land: { side: 9, end: 7.5, along: 24, down: 40, grow: 1, aspect: 1.41 },
  square: { side: 8, end: 8, along: 26, down: 30, grow: 1.35, aspect: 1 },
  tall: { side: 8, end: 7, along: 28, down: 22, grow: 1.7, aspect: 0.75 },
  story: { side: 7.5, end: 8, along: 30, down: 18, grow: 1.9, aspect: 0.56 },
};

function ornaments(colours, shape) {
  var rnd = rng(337);
  var band = ORNAMENT_BANDS[shape] || ORNAMENT_BANDS.land;
  var out = [];
  var kinds = ['dot', 'pill', 'ring', 'pill', 'dot', 'spark'];
  // [corner x, corner y, pieces down the side, pieces along the end]
  var corners = [[0, 0, 8, 7], [1, 1, 8, 7], [1, 0, 3, 2], [0, 1, 3, 2]];
  for (var k = 0; k < corners.length; k++) {
    var scale = k >= 2 ? 0.55 : 1;
    for (var streak = 0; streak < 2; streak++) {
      var want = corners[k][2 + streak];
      var placed = 0;
      for (var tries = 0; placed < want && tries < 300; tries++) {
        var d = Math.pow(rnd(), 0.8);
        var across = 0.6 + rnd() * 0.4;
        var dx = streak === 0 ? across * band.side : d * band.along * scale;
        var dy = streak === 0 ? d * band.down * scale : across * band.end;
        var x = Math.max(2.5, Math.min(97.5, corners[k][0] ? 100 - dx : dx));
        var y = Math.max(3, Math.min(97, corners[k][1] ? 100 - dy : dy));
        var clash = false;
        for (var j = 0; j < out.length && !clash; j++) {
          var ddx = (out[j].x - x) * band.aspect;
          var ddy = out[j].y - y;
          if (ddx * ddx + ddy * ddy < 9) clash = true;
        }
        if (clash) continue;
        var kind = kinds[Math.floor(rnd() * kinds.length)];
        out.push({
          i: out.length,
          kind: kind,
          x: round(x, 2),
          y: round(y, 2),
          size: round((kind === 'pill' ? 5 + rnd() * 2.5 : 7 + rnd() * 8) * (1 - d * 0.4) * band.grow, 1),
          rot: Math.round(rnd() * 180),
          color: colours[out.length % colours.length],
        });
        placed++;
      }
    }
  }
  return out;
}

// The confetti that falls in the Confetti motion: start across the width above
// the sheet, each with its own delay, fall time, sway and spin. Motion maths
// lives in the template; these are only the seeds.
function confettiPieces(colours) {
  var rnd = rng(2026);
  var out = [];
  for (var i = 0; i < 56; i++) {
    out.push({
      i: i,
      kind: rnd() < 0.68 ? 'strip' : 'dot',
      color: colours[i % colours.length],
      size: round(8 + rnd() * 8, 1),
      x: round(rnd() * 100, 2),
      delay: round(rnd() * 0.55, 3),
      fall: round(1.9 + rnd() * 0.7, 3),
      sway: round(1.5 + rnd() * 4, 2),
      phase: round(rnd() * 6.28, 3),
      spin: Math.round(200 + rnd() * 520) * (rnd() < 0.5 ? -1 : 1),
      rot: Math.round(rnd() * 180),
    });
  }
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────

// px at 96 dpi for a value in the unit the page table declares.
function toPx(value, unit) {
  if (unit === 'mm') return Math.round(value * 96 / 25.4);
  if (unit === 'in') return Math.round(value * 96);
  return Math.round(value);
}

// The sheet's size in px: the preset's, or the canvas's when the canvas is a
// proportion of its own. A canvas at the manifest's own size is the one nobody
// chose (a render with no size asked for), and a canvas of the preset's
// proportion is the preset at another scale, so both keep the preset's px and a
// sheet drawn at its preset is exactly what it was before the canvas size existed.
var CANVAS_W = 1123;
var CANVAS_H = 794;
function sheetFor(pageW, pageH, canvas) {
  var w = canvas ? Number(canvas.width) : 0, h = canvas ? Number(canvas.height) : 0;
  if (!(w > 0) || !(h > 0) || (w === CANVAS_W && h === CANVAS_H)) return { w: pageW, h: pageH };
  if (Math.abs((w / h) / (pageW / pageH) - 1) < 0.002) return { w: pageW, h: pageH };
  return { w: Math.round(w), h: Math.round(h) };
}

function build(args, theme, logoUrl, lang, canvas) {
  var style = pick(STYLES, str(args.style), 'classic');
  var motion = pick(MOTIONS, str(args.motion), 'none');
  var kind = own(KINDS, str(args.certKind)) ? str(args.certKind) : KIND_DEFAULT;
  var pageKey = own(PAGES, str(args.pageSize)) ? str(args.pageSize) : PAGE_DEFAULT;
  var page = PAGES[pageKey];
  var sheet = sheetFor(toPx(page.w, page.unit), toPx(page.h, page.unit), canvas);
  var pageW = sheet.w;
  var pageH = sheet.h;
  var shape = shapeOf(pageW / pageH);
  var unitPx = Math.min(pageW / 1000, pageH / shape.h);
  var sheetW = Math.round(pageW / unitPx);

  var p = paletteFor(style, theme, args, shape.id);

  var typedTitle = str(args.heading);
  var name = (str(args.firstname) + ' ' + str(args.lastname)).trim();
  var course = str(args.awardtopic);
  var presenter = str(args.presenter);
  var dateText = fmtDate(args.awarddate, lang);
  var box = boxes(style, shape.id, sheetW);
  var nameFit = fitName(name || ' ', box);
  var glyph = GLYPHS[KINDS[kind].glyph];
  var showSeal = args.seal !== false;
  var celebrate = style === 'celebration';
  var ornamentList = celebrate ? ornaments(p.confetti, shape.id) : [];
  var pieces = motion === 'confetti' ? confettiPieces(p.confetti) : [];
  // The sheet reads in its print language: ar and ur lay it out right to left
  // whatever the typed title says. Every typed line carries dir="auto" in the
  // template, so a title in the other direction still shapes and reads in its
  // own order while keeping the sheet's alignment.
  var dir = own(CT_RTL, lang) ? 'rtl' : 'ltr';

  return {
    error: '',

    // Wording, in the print language.
    printLang: own(CT_LOCALE, lang) ? CT_LOCALE[lang] : lang,
    dir: dir,
    titleText: typedTitle || ctText(KINDS[kind].title, lang),
    leadText: ctText(LEAD, lang),
    citeText: ctText(KINDS[kind].cite, lang),
    dateLabel: ctText('Date', lang),
    playLabel: ctText('Play motion', lang),
    recipientName: name,
    courseText: course,
    dateText: dateText,
    presenterText: presenter,
    presenterTitleText: str(args.presenterTitle),
    companyText: str(args.company),
    serialText: str(args.serial),
    hasPresenter: !!presenter,
    hasDate: !!dateText,
    hasSign: !!presenter || !!dateText,

    // Issuer lockup: the logo when there is one, the company line otherwise,
    // and the company line stays under a logo when both are set.
    logoUrl: logoUrl || '',
    hasLogo: !!logoUrl,

    // Look and size.
    style: style,
    shape: shape.id,
    motion: motion,
    hasMotion: motion !== 'none',
    pageW: pageW,
    pageH: pageH,
    designH: shape.h,
    nameSizeU: nameFit.size,
    nameLines: nameFit.lines,
    courseSizeU: fitCourse(course || ' ', box),
    courseLines: box.courseLines,
    hasFrame: style === 'classic' || celebrate,
    hasInnerRule: style === 'classic',
    hasPanel: style === 'modern',

    // The seal.
    hasSeal: showSeal,
    sealRibbons: style === 'classic' || celebrate,
    sealScallop: style === 'classic' || celebrate,
    sealRing: style === 'minimal',
    sealEdge: scallopPath(22),
    sealGlyph: glyph.d,
    sealStroke: glyph.stroke,
    sealViewH: style === 'classic' || celebrate ? 150 : 120,

    // Celebration's printed confetti and the falling confetti of the motion.
    ornaments: ornamentList,
    confetti: pieces,
    // Numbers only, and `<` cannot occur: safe inside a <script> data island.
    motionJson: JSON.stringify({
      motion: motion,
      key: motion + '|' + style + '|' + pageKey,
      confetti: pieces.map(function (c) { return [c.x, c.delay, c.fall, c.sway, c.phase, c.spin, c.rot]; }),
    }),

    // Colours. paperColor drives --ct-paper, the only thing that paints the
    // sheet, so 'transparent' there is the whole transparent-background toggle.
    paperColor: args.transparentBg === true ? 'transparent' : p.paper,
    groundColor: p.paper,
    inkColor: p.ink,
    accentColor: p.accent,
    secondColor: p.second,
    mutedColor: p.muted,
    ruleColor: p.rule,
    edgeColor: p.edge,
    panelColor: p.panel,
    panelInk: p.panelInk,
    sealColor: p.seal,
    sealInk: p.sealInk,
    sealInner: p.sealInner,
    ribbonColor: p.ribbon,
    sheenColor: p.sheen,

    // What Ink, Paper and Accent draw while they are left empty, for the web shell
    // to show on those inputs' chips. Accent paints the panel in Modern.
    autoColors: autoColorsFor(style, theme, args, shape.id),
  };
}

// Each one as the sheet would draw it with that input emptied and the others kept,
// so the chip on a set input's "Follow the design system" choice shows what it returns to.
function autoColorsFor(style, theme, args, shape) {
  var source = theme && (theme.lead || theme.text || theme.surface) ? 'design-system' : 'tool';
  var without = function (id) {
    var rest = {};
    for (var k in args) if (Object.prototype.hasOwnProperty.call(args, k)) rest[k] = args[k];
    rest[id] = '';
    return paletteFor(style, theme, rest, shape);
  };
  var accent = without('accent');
  return {
    color: { value: without('color').ink, source: source },
    background: { value: without('background').paper, source: source },
    accent: { value: style === 'modern' ? accent.panel : accent.accent, source: source },
  };
}

function blank(note, lang) {
  var out = build({}, {}, '', lang);
  out.error = ctText(note, lang);
  return out;
}

// The ground the logo sits on: Modern's panel, else the paper.
function logoGround(args, theme) {
  var style = pick(STYLES, str(args.style), 'classic');
  var p = paletteFor(style, theme, args);
  return { dark: isDark(style === 'modern' ? p.panel : p.paper), colourGround: style === 'modern' || style === 'celebration' };
}

async function compute(model, lang, canvas) {
  var args = {};
  for (var i = 0; i < model.length; i++) args[model[i].id] = model[i].value;

  var requested = str(args.language) || lang || '';
  if (!requested && typeof host !== 'undefined' && host && host.profile && host.profile.get) {
    try { requested = (await host.profile.get()).lang || ''; } catch (e) { requested = ''; }
  }
  var printLang = ctPrintLang(requested || 'en');

  var result;
  try {
    var theme = await readTheme();
    var wantLogo = args.brandLogo !== false;
    var logoUrl = '';
    if (wantLogo) {
      var ground = logoGround(args, theme);
      var version = pick(['auto', 'colour', 'mono'], str(args.logoStyle), 'auto');
      var mono = version === 'mono' || (version === 'auto' && ground.colourGround);
      var asset = await resolveBrandLogo(ground.dark, mono);
      logoUrl = asset ? asset.url : '';
    }
    result = build(args, theme, logoUrl, printLang, canvas);
    result._logoWarning = brandLogoWarning(wantLogo && !logoUrl);
  } catch (err) {
    result = blank('This certificate could not be laid out. Check the sheet size and the colours.', printLang);
  }
  return result;
}

function onInit({ model, lang, canvasSize }) {
  return compute(model, lang, canvasSize);
}

function onInput({ id, model, lang, canvasSize }) {
  // A theme or colourway switch: read the design system again. A change of canvas
  // size ('__canvasSize') needs nothing dropped: the sheet is worked out again below.
  if (id === '__tokens') _theme = null;
  return compute(model, lang, canvasSize);
}
