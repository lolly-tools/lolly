// SPDX-License-Identifier: MPL-2.0
(function () {
  'use strict';
  var script = document.currentScript;
  var root = script && script.previousElementSibling;
  while (root && !root.matches('[data-portable-root]')) root = root.previousElementSibling;
  if (!root || root.__lollyPresentation) return;
  var data = JSON.parse(root.querySelector('[data-ag-document]').textContent);
  root.querySelectorAll('[data-ag-session-image]').forEach(function (image) {
    var session = data.sessions.find(function (s) { return s.id === image.dataset.agSessionImage; });
    if (session) session.image = image.src;
  });
  var live = root.querySelector('.ag-live'),
    canvas = root.querySelector('canvas');
  var abort = new AbortController(),
    signal = abort.signal;
  var staticExport = false;
  var disposed = false,
    exporting = false,
    paused = false,
    start = performance.now(),
    pausedAt = 0;
  var pausedInstant = null, wakeLock = null;
  var elapsed = 0,
    scenes = [],
    current = -1,
    frame = 0,
    exportInstant = 0,
    pans = [],
    lastEventMinute = -1;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var page = data.layout === 'page',
    selected = new Set(),
    filter = { q: '', day: '', track: '', room: '' };
  var legacy = data.layout === 'list' || data.layout === 'grid';
  var width = 1920,
    height = 1080,
    scale = 1,
    glState = null;
// === lolly:shared agenda-i18n - generated from community/_shared/agenda-i18n.js; edit there and run pnpm run sync:shared ===
var AG_TEXT = {"es":{"Programme":"Programa","Untitled session":"Sesión sin título","Add to my calendar":"Añadir a mi calendario","Local event time":"hora del evento local","Event local time":"Hora local del evento","Rehearsal":"Ensayo","Snapshot":"Instantánea","Check event time zone":"Consultar zona horaria del evento","No sessions remain. Thank you for joining us.":"No quedan sesiones. Gracias por acompañarnos.","Session website":"Sitio web de la sesión","Add session to calendar":"Agregar sesión al calendario","Close":"Cerrar","Filter programme":"Filtrar programa","Find a session or speaker":"Encuentre una sesión o un orador","Search sessions":"Sesiones de búsqueda","All days":"todos los dias","All tracks":"Todos los temas","All rooms":"Todas las salas","Reset filters":"Restablecer filtros","Happening now":"En curso","Calendar: results":"Calendario: resultados","Calendar: all":"Calendario: todos","Calendar: selected":"Calendario: seleccionado","Print":"Imprimir","Play overview":"Reproducir resumen","Scenes and coverage":"Escenas y contenido incluido","Preview scene":"Vista previa de la escena","Programme playback":"Reproducción del programa","Pause":"Pausa","Play":"Reproducir","Previous":"Anterior","Next":"Siguiente","Full screen":"Pantalla completa","Restart":"Reiniciar","Event programme":"Programa del evento","Programme. Space pauses; arrow keys change scene.":"Programa. El espacio se detiene; Las teclas de flecha cambian de escena.","Programme paused. Press Space to resume.":"Programa en pausa. Presione la barra espaciadora para continuar.","Programme playing. Press Space to pause.":"Programa en reproducción. Presione Espacio para pausar.","scheduled":"programado","rescheduled":"reprogramado","cancelled":"cancelado","Invalid date":"Fecha no válida","Invalid end date":"Fecha de finalización no válida","Invalid start time":"Hora de inicio no válida","End must follow start; use End date for an overnight session":"El fin debe seguir al comienzo; utilizar la fecha de finalización para una sesión nocturna","End defaults to one hour after Start":"El final predeterminado es una hora después del inicio.","Missing session title":"Título de sesión faltante","Duplicate Session ID":"Duplicado Session ID","Unknown time zone":"Zona horaria desconocida","Ambiguous time at daylight saving change":"Hora ambigua en el cambio de horario de verano","Time does not exist at daylight saving change":"La hora no existe en el cambio de horario de verano","Room overlaps with":"El horario de la sala coincide con","Track overlaps with":"El horario del tema coincide con","Speaker overlaps with":"El horario del ponente coincide con","Fix the date, time and session identity issues before exporting the programme.":"Solucione los problemas de fecha, hora e identidad de la sesión antes de exportar el programa.","This programme could not be laid out. Check the dates and times in the table.":"Este programa no se pudo diseñar. Consulta las fechas y horarios en la tabla.","Unknown time zone - the calendar file keeps floating times.":"Zona horaria desconocida: el archivo de calendario mantiene los tiempos flotantes.","Set a reference time before exporting a rehearsal.":"Establece un tiempo de referencia antes de exportar un ensayo.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Una sesión es demasiado larga para esta página. Aumente el tamaño de la página o elija una página interactiva HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Un kit de eventos admite como máximo 32 salas. Filtrar el programa antes de exportar.","Row":"Fila","Select":"Seleccionar","sessions":"sesiones","scenes":"escenas","seconds":"segundos","data issues":"problemas de datos","programme issues":"problemas del programa","Scene":"escena","px title type":"tipo de título px","Every selected title completes its reveal. Longest wait:":"Cada título seleccionado completa su revelación. Espera más larga:","Revision:":"Revisión:","Paused":"En pausa","day":"dia","track":"tema","room":"sala","Reference time:":"Tiempo de referencia:","Floating time":"tiempo flotante","Programme revision:":"Revisión del programa:","Event time zone:":"Zona horaria del evento:","Generated:":"Generado:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"El HTML contiene el programa integrado. Vuelve a publicarlo tras los cambios. El vídeo es una grabación.","A session needs more space. Use a taller screen or a closer reading distance.":"Una sesión necesita más espacio. Utilice una pantalla más alta o una distancia de lectura más cercana.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Esta sesión termina antes de que se muestre su escena. Elija menos habitaciones por pantalla.","px room and time type":"px habitación y tipo de hora","Longest wait:":"Espera más larga:","Select at least one session.":"Seleccione al menos una sesión.","Fix the date and time issues before exporting these sessions.":"Solucione los problemas de fecha y hora antes de exportar estas sesiones.","No sessions match these filters.":"Ninguna sesión coincide con estos filtros.","Starts in":"Comienza en","minutes":"minutos","Invalid end time":"Hora de finalización no válida","Invalid date or time":"Fecha u hora no válida","A session may span at most 31 days":"Una sesión puede durar como máximo 31 días.","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Este programa necesita {seconds} segundos para mostrar cada título. Aumentar la duración de la exportación.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"El programa completo necesita {pages} páginas. Utilice PDF, PowerPoint o HTML para incluir cada sesión."},"de":{"Programme":"Programm","Untitled session":"Sitzung ohne Titel","Add to my calendar":"Zu meinem Kalender hinzufügen","Local event time":"Lokale Veranstaltungszeit","Event local time":"Ortszeit der Veranstaltung","Rehearsal":"Probe","Snapshot":"Schnappschuss","Check event time zone":"Überprüfen Sie die Zeitzone des Ereignisses","No sessions remain. Thank you for joining us.":"Es bleiben keine Sitzungen übrig. Vielen Dank, dass Sie sich uns angeschlossen haben.","Session website":"Sitzungswebsite","Add session to calendar":"Sitzung zum Kalender hinzufügen","Close":"Schließen","Filter programme":"Programm filtern","Find a session or speaker":"Finden Sie eine Sitzung oder einen Redner","Search sessions":"Suchsitzungen","All days":"Alle Tage","All tracks":"Alle Themenbereiche","All rooms":"Alle Räume","Reset filters":"Filter zurücksetzen","Happening now":"Findet gerade statt","Calendar: results":"Kalender: Ergebnisse","Calendar: all":"Kalender: alle","Calendar: selected":"Kalender: ausgewählt","Print":"Drucken","Play overview":"Übersicht abspielen","Scenes and coverage":"Szenen und enthaltene Inhalte","Preview scene":"Vorschauszene","Programme playback":"Programmwiedergabe","Pause":"Pause","Play":"Wiedergabe","Previous":"Zurück","Next":"Als nächstes","Full screen":"Vollbild","Restart":"Neustart","Event programme":"Veranstaltungsprogramm","Programme. Space pauses; arrow keys change scene.":"Programm. Der Raum hält inne; Pfeiltasten wechseln die Szene.","Programme paused. Press Space to resume.":"Programm pausiert. Drücken Sie die Leertaste, um fortzufahren.","Programme playing. Press Space to pause.":"Programm abgespielt. Drücken Sie die Leertaste, um zu pausieren.","scheduled":"geplant","rescheduled":"verschoben","cancelled":"abgesagt","Invalid date":"Ungültiges Datum","Invalid end date":"Ungültiges Enddatum","Invalid start time":"Ungültige Startzeit","End must follow start; use End date for an overnight session":"Das Ende muss auf den Start folgen. Verwenden Sie das Enddatum für eine Nachtsitzung","End defaults to one hour after Start":"Das Ende ist standardmäßig eine Stunde nach dem Start","Missing session title":"Fehlender Sitzungstitel","Duplicate Session ID":"Duplikat Session ID","Unknown time zone":"Unbekannte Zeitzone","Ambiguous time at daylight saving change":"Unklare Zeit bei Sommerzeitumstellung","Time does not exist at daylight saving change":"Bei der Sommerzeitumstellung existiert keine Zeit","Room overlaps with":"Die Raumbelegung überschneidet sich mit","Track overlaps with":"Der Themenbereich überschneidet sich zeitlich mit","Speaker overlaps with":"Der Referent ist gleichzeitig eingeplant für","Fix the date, time and session identity issues before exporting the programme.":"Beheben Sie die Probleme mit Datum, Uhrzeit und Sitzungsidentität, bevor Sie das Programm exportieren.","This programme could not be laid out. Check the dates and times in the table.":"Dieses Programm konnte nicht angelegt werden. Überprüfen Sie die Daten und Zeiten in der Tabelle.","Unknown time zone - the calendar file keeps floating times.":"Unbekannte Zeitzone – in der Kalenderdatei bleiben die Zeiten schwankend.","Set a reference time before exporting a rehearsal.":"Legen Sie eine Referenzzeit fest, bevor Sie eine Probe exportieren.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Eine Sitzung ist zu lang für diese Seite. Erhöhen Sie die Seitengröße oder wählen Sie eine interaktive HTML Seite.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Ein Event-Kit unterstützt höchstens 32 Räume. Filtern Sie das Programm vor dem Export.","Row":"Reihe","Select":"Auswählen","sessions":"Sitzungen","scenes":"Szenen","seconds":"Sekunden","data issues":"Datenprobleme","programme issues":"Programmprobleme","Scene":"Szene","px title type":"px-Titeltyp","Every selected title completes its reveal. Longest wait:":"Jeder ausgewählte Titel vervollständigt seine Enthüllung. Längste Wartezeit:","Revision:":"Überarbeitung:","Paused":"Angehalten","day":"Tag","track":"themenbereich","room":"raum","Reference time:":"Referenzzeit:","Floating time":"Schwebende Zeit","Programme revision:":"Programmrevision:","Event time zone:":"Zeitzone der Veranstaltung:","Generated:":"Erstellt:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Die HTML-Datei enthält einen eingebetteten Zeitplan. Nach Änderungen erneut veröffentlichen. Das Video ist eine Aufzeichnung.","A session needs more space. Use a taller screen or a closer reading distance.":"Eine Sitzung benötigt mehr Platz. Verwenden Sie einen höheren Bildschirm oder einen geringeren Leseabstand.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Diese Sitzung endet, bevor ihre Szene gezeigt wird. Wählen Sie weniger Räume pro Bildschirm.","px room and time type":"px Raum- und Zeittyp","Longest wait:":"Längste Wartezeit:","Select at least one session.":"Wählen Sie mindestens eine Sitzung aus.","Fix the date and time issues before exporting these sessions.":"Beheben Sie die Datums- und Uhrzeitprobleme, bevor Sie diese Sitzungen exportieren.","No sessions match these filters.":"Keine Sitzungen entsprechen diesen Filtern.","Starts in":"Beginnt in","minutes":"Minuten","Invalid end time":"Ungültige Endzeit","Invalid date or time":"Ungültiges Datum oder ungültige Uhrzeit","A session may span at most 31 days":"Eine Sitzung kann höchstens 31 Tage dauern","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Dieses Programm benötigt {seconds} Sekunden, um jeden Titel anzuzeigen. Erhöhen Sie die Exportdauer.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Das vollständige Programm benötigt {pages} Seiten. Verwenden Sie PDF, PowerPoint oder HTML, um jede Sitzung einzuschließen."},"fr":{"Programme":"Programme","Untitled session":"Séance sans titre","Add to my calendar":"Ajouter à mon calendrier","Local event time":"Heure de l'événement local","Event local time":"Heure locale de l'événement","Rehearsal":"Répétition","Snapshot":"Instantané","Check event time zone":"Vérifier le fuseau horaire de l'événement","No sessions remain. Thank you for joining us.":"Il ne reste aucune séance. Merci de vous joindre à nous.","Session website":"Site Web de la séance","Add session to calendar":"Ajouter une session au calendrier","Close":"Fermer","Filter programme":"Filtrer le programme","Find a session or speaker":"Trouver une session ou un conférencier","Search sessions":"Sessions de recherche","All days":"Tous les jours","All tracks":"Tous les thèmes","All rooms":"Toutes les salles","Reset filters":"Réinitialiser les filtres","Happening now":"En cours","Calendar: results":"Calendrier : résultats","Calendar: all":"Calendrier : tout","Calendar: selected":"Calendrier : sélectionné","Print":"Imprimer","Play overview":"Lire la vue d’ensemble","Scenes and coverage":"Scènes et contenu inclus","Preview scene":"Aperçu de la scène","Programme playback":"Lecture du programme","Pause":"Pause","Play":"Lire","Previous":"Précédent","Next":"Suivant","Full screen":"Plein écran","Restart":"Redémarrer","Event programme":"Programme de l'événement","Programme. Space pauses; arrow keys change scene.":"Programme. Espacez les pauses ; les touches fléchées changent de scène.","Programme paused. Press Space to resume.":"Programme en pause. Appuyez sur Espace pour reprendre.","Programme playing. Press Space to pause.":"Lecture du programme. Appuyez sur Espace pour faire une pause.","scheduled":"programmé","rescheduled":"reporté","cancelled":"annulé","Invalid date":"Date invalide","Invalid end date":"Date de fin invalide","Invalid start time":"Heure de début invalide","End must follow start; use End date for an overnight session":"La fin doit suivre le début ; utilisez la date de fin pour une session de nuit","End defaults to one hour after Start":"La fin est par défaut une heure après le début","Missing session title":"Titre de session manquant","Duplicate Session ID":"Dupliquer Session ID","Unknown time zone":"Fuseau horaire inconnu","Ambiguous time at daylight saving change":"Heure ambiguë lors du changement d’heure d’été","Time does not exist at daylight saving change":"L'heure n'existe pas au changement d'heure d'été","Room overlaps with":"La réservation de salle chevauche celle de","Track overlaps with":"Le créneau du thème chevauche celui de","Speaker overlaps with":"L’intervenant est déjà programmé pour","Fix the date, time and session identity issues before exporting the programme.":"Résolvez les problèmes de date, d’heure et d’identité de session avant d’exporter le programme.","This programme could not be laid out. Check the dates and times in the table.":"Ce programme n'a pas pu être élaboré. Vérifiez les dates et heures dans le tableau.","Unknown time zone - the calendar file keeps floating times.":"Fuseau horaire inconnu : le fichier de calendrier conserve des heures flottantes.","Set a reference time before exporting a rehearsal.":"Définissez une heure de référence avant d’exporter une répétition.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Une session est trop longue pour cette page. Augmentez la taille de la page ou choisissez une page interactive HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Un kit événementiel prend en charge au maximum 32 salles. Filtrez le programme avant de l'exporter.","Row":"Rangée","Select":"Sélectionnez","sessions":"séances","scenes":"scènes","seconds":"secondes","data issues":"problèmes de données","programme issues":"problèmes de programme","Scene":"Scène","px title type":"type de titre px","Every selected title completes its reveal. Longest wait:":"Chaque titre sélectionné termine sa révélation. Attente la plus longue :","Revision:":"Révision :","Paused":"En pause","day":"jour","track":"thème","room":"salle","Reference time:":"Temps de référence :","Floating time":"Temps flottant","Programme revision:":"Révision du programme :","Event time zone:":"Fuseau horaire de l'événement :","Generated:":"Généré :","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Le fichier HTML contient le programme intégré. Publiez-le à nouveau après modification. La vidéo est un enregistrement.","A session needs more space. Use a taller screen or a closer reading distance.":"Une session a besoin de plus d'espace. Utilisez un écran plus grand ou une distance de lecture plus proche.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Cette session se termine avant que sa scène ne soit affichée. Choisissez moins de pièces par écran.","px room and time type":"Type de pièce et d'heure en px","Longest wait:":"Attente la plus longue :","Select at least one session.":"Sélectionnez au moins une session.","Fix the date and time issues before exporting these sessions.":"Corrigez les problèmes de date et d’heure avant d’exporter ces sessions.","No sessions match these filters.":"Aucune session ne correspond à ces filtres.","Starts in":"Commence dans","minutes":"minutes","Invalid end time":"Heure de fin invalide","Invalid date or time":"Date ou heure invalide","A session may span at most 31 days":"Une session peut durer au maximum 31 jours","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Ce programme a besoin de {seconds} secondes pour afficher chaque titre. Augmentez la durée de l'exportation.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Le programme complet nécessite {pages} pages. Utilisez PDF, PowerPoint ou HTML pour inclure chaque session."},"zh":{"Programme":"节目","Untitled session":"无标题会议","Add to my calendar":"添加到我的日历","Local event time":"当地活动时间","Event local time":"活动当地时间","Rehearsal":"排练","Snapshot":"快照","Check event time zone":"检查活动时区","No sessions remain. Thank you for joining us.":"没有剩余会话。感谢您加入我们。","Session website":"会议网站","Add session to calendar":"将会话添加到日历","Close":"关闭","Filter programme":"筛选日程","Find a session or speaker":"查找会议或演讲者","Search sessions":"搜索会话","All days":"全天","All tracks":"所有主题","All rooms":"所有会场","Reset filters":"重置过滤器","Happening now":"正在进行","Calendar: results":"日历：结果","Calendar: all":"日历：全部","Calendar: selected":"日历：已选择","Print":"打印","Play overview":"播放概览","Scenes and coverage":"场景与内容覆盖","Preview scene":"预览场景","Programme playback":"日程播放","Pause":"暂停","Play":"播放","Previous":"上一页","Next":"下一步","Full screen":"全屏","Restart":"重新启动","Event programme":"活动节目","Programme. Space pauses; arrow keys change scene.":"计划。空间暂停；方向键改变场景。","Programme paused. Press Space to resume.":"程序暂停了。按空格键继续。","Programme playing. Press Space to pause.":"节目播放。按空格键暂停。","scheduled":"预定的","rescheduled":"重新安排","cancelled":"取消","Invalid date":"无效日期","Invalid end date":"结束日期无效","Invalid start time":"开始时间无效","End must follow start; use End date for an overnight session":"结束必须跟随开始；使用过夜会话的结束日期","End defaults to one hour after Start":"结束默认为开始后一小时","Missing session title":"缺少会话标题","Duplicate Session ID":"重复Session ID","Unknown time zone":"未知时区","Ambiguous time at daylight saving change":"夏令时变化的时间不明确","Time does not exist at daylight saving change":"夏令时变更时时间不存在","Room overlaps with":"会场时间冲突：","Track overlaps with":"主题时间冲突：","Speaker overlaps with":"演讲者时间冲突：","Fix the date, time and session identity issues before exporting the programme.":"在导出节目之前修复日期、时间和会话身份问题。","This programme could not be laid out. Check the dates and times in the table.":"该计划无法制定。检查表中的日期和时间。","Unknown time zone - the calendar file keeps floating times.":"未知时区 - 日历文件保持浮动时间。","Set a reference time before exporting a rehearsal.":"在导出排练之前设置参考时间。","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"此页面的会话时间太长。增加页面大小或选择交互式 HTML 页面。","An event kit supports at most 32 rooms. Filter the programme before exporting.":"一个活动套件最多支持 32 个房间。导出前过滤程序。","Row":"排","Select":"选择","sessions":"会议","scenes":"场景","seconds":"秒","data issues":"数据问题","programme issues":"程序问题","Scene":"场景","px title type":"px 标题类型","Every selected title completes its reveal. Longest wait:":"每个选定的标题都完成了它的揭示。最长等待时间：","Revision:":"修订：","Paused":"已暂停","day":"日","track":"主题","room":"会场","Reference time:":"参考时间：","Floating time":"漂浮时间","Programme revision:":"方案修订：","Event time zone:":"活动时区：","Generated:":"生成：","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML 内嵌活动日程。更改后请重新发布。视频为录制内容。","A session needs more space. Use a taller screen or a closer reading distance.":"会话需要更多空间。使用更高的屏幕或更近的阅读距离。","This session ends before its scene is shown. Choose fewer rooms per screen.":"该会话在其场景显示之前结束。每个屏幕选择更少的房间。","px room and time type":"px 房间和时间类型","Longest wait:":"最长等待时间：","Select at least one session.":"至少选择一个会话。","Fix the date and time issues before exporting these sessions.":"在导出这些会话之前修复日期和时间问题。","No sessions match these filters.":"没有会话与这些过滤器匹配。","Starts in":"开始于","minutes":"分钟","Invalid end time":"结束时间无效","Invalid date or time":"日期或时间无效","A session may span at most 31 days":"会话最多可以持续 31 天","This programme needs {seconds} seconds to show every title. Increase the export duration.":"该程序需要{seconds}秒来显示每个标题。增加导出持续时间。","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"完整的程序需要{pages}页。使用 PDF、PowerPoint 或 HTML 包含每个会话。"},"ja":{"Programme":"プログラム","Untitled session":"無題のセッション","Add to my calendar":"私のカレンダーに追加","Local event time":"現地イベントの時間","Event local time":"イベント現地時間","Rehearsal":"リハーサル","Snapshot":"スナップショット","Check event time zone":"イベントのタイムゾーンを確認する","No sessions remain. Thank you for joining us.":"セッションは残りません。ご参加いただきありがとうございます。","Session website":"セッションウェブサイト","Add session to calendar":"カレンダーにセッションを追加","Close":"閉じる","Filter programme":"プログラムを絞り込む","Find a session or speaker":"セッションまたは講演者を探す","Search sessions":"セッションの検索","All days":"全日","All tracks":"すべてのテーマ","All rooms":"すべての会場","Reset filters":"フィルターをリセットする","Happening now":"開催中","Calendar: results":"カレンダー: 結果","Calendar: all":"カレンダー: すべて","Calendar: selected":"カレンダー: 選択済み","Print":"印刷する","Play overview":"概要を再生","Scenes and coverage":"シーンと収録内容","Preview scene":"プレビューシーン","Programme playback":"プログラムの再生","Pause":"一時停止","Play":"再生","Previous":"前へ","Next":"次へ","Full screen":"全画面表示","Restart":"再起動","Event programme":"イベントプログラム","Programme. Space pauses; arrow keys change scene.":"プログラム。宇宙は一時停止します。矢印キーでシーンが変わります。","Programme paused. Press Space to resume.":"プログラムは一時停止されました。再開するにはスペースを押してください。","Programme playing. Press Space to pause.":"プログラム再生中。スペースを押すと一時停止します。","scheduled":"予定されている","rescheduled":"再スケジュールされた","cancelled":"キャンセルされました","Invalid date":"無効な日付","Invalid end date":"無効な終了日です","Invalid start time":"開始時間が無効です","End must follow start; use End date for an overnight session":"終了は開始の後に続く必要があります。夜間セッションの終了日を使用する","End defaults to one hour after Start":"終了のデフォルトは開始から 1 時間後です","Missing session title":"セッションタイトルがありません","Duplicate Session ID":"重複 Session ID","Unknown time zone":"不明なタイムゾーン","Ambiguous time at daylight saving change":"夏時間変更時のあいまいな時間","Time does not exist at daylight saving change":"夏時間変更時に時刻は存在しません","Room overlaps with":"会場の使用時間が重複：","Track overlaps with":"テーマの時間が重複：","Speaker overlaps with":"登壇者の予定が重複：","Fix the date, time and session identity issues before exporting the programme.":"プログラムをエクスポートする前に、日付、時刻、およびセッション ID の問題を修正してください。","This programme could not be laid out. Check the dates and times in the table.":"このプログラムはレイアウトできませんでした。表内の日付と時刻を確認してください。","Unknown time zone - the calendar file keeps floating times.":"不明なタイムゾーン - カレンダーファイルは変動した時間を保持します。","Set a reference time before exporting a rehearsal.":"リハーサルをエクスポートする前に基準時間を設定します。","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"このページにはセッションが長すぎます。ページ サイズを大きくするか、インタラクティブな HTML ページを選択してください。","An event kit supports at most 32 rooms. Filter the programme before exporting.":"イベント キットは最大 32 の部屋をサポートします。エクスポートする前にプログラムをフィルタリングします。","Row":"行","Select":"選択","sessions":"セッション","scenes":"シーン","seconds":"秒","data issues":"データの問題","programme issues":"プログラムの問題","Scene":"シーン","px title type":"pxタイトルタイプ","Every selected title completes its reveal. Longest wait:":"選択したすべてのタイトルが公開を完了します。最長待ち時間:","Revision:":"リビジョン:","Paused":"一時停止中","day":"日","track":"テーマ","room":"会場","Reference time:":"参考時間：","Floating time":"浮上時間","Programme revision:":"プログラム改訂:","Event time zone:":"イベントのタイムゾーン:","Generated:":"生成されるもの:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTMLには日程が埋め込まれています。変更後は再公開してください。動画は録画です。","A session needs more space. Use a taller screen or a closer reading distance.":"セッションにはさらに多くのスペースが必要です。より高い画面を使用するか、読み取り距離を近づけてください。","This session ends before its scene is shown. Choose fewer rooms per screen.":"このセッションは、シーンが表示される前に終了します。 1 画面あたり選択する部屋の数を減らします。","px room and time type":"pxの部屋と時間のタイプ","Longest wait:":"最長待ち時間:","Select at least one session.":"少なくとも 1 つのセッションを選択します。","Fix the date and time issues before exporting these sessions.":"これらのセッションをエクスポートする前に、日付と時刻の問題を修正してください。","No sessions match these filters.":"これらのフィルターに一致するセッションはありません。","Starts in":"に始まります","minutes":"分","Invalid end time":"無効な終了時刻です","Invalid date or time":"無効な日付または時刻です","A session may span at most 31 days":"セッションは最大 31 日間続く場合があります","This programme needs {seconds} seconds to show every title. Increase the export duration.":"このプログラムはすべてのタイトルを表示するのに {seconds} 秒かかります。エクスポート期間を長くします。","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"完全なプログラムには {pages} ページが必要です。すべてのセッションを含めるには、PDF、PowerPoint、または HTML を使用します。"},"vi":{"Programme":"chương trình","Untitled session":"Phiên không có tiêu đề","Add to my calendar":"Thêm vào lịch của tôi","Local event time":"Thời gian sự kiện địa phương","Event local time":"Giờ địa phương sự kiện","Rehearsal":"Diễn tập","Snapshot":"Ảnh chụp nhanh","Check event time zone":"Kiểm tra múi giờ sự kiện","No sessions remain. Thank you for joining us.":"Không còn phiên nào nữa. Cảm ơn bạn đã tham gia cùng chúng tôi.","Session website":"Trang web phiên","Add session to calendar":"Thêm phiên vào lịch","Close":"Đóng","Filter programme":"Lọc chương trình","Find a session or speaker":"Tìm một phiên hoặc diễn giả","Search sessions":"Phiên tìm kiếm","All days":"Tất cả các ngày","All tracks":"Tất cả chủ đề","All rooms":"Tất cả hội trường","Reset filters":"Đặt lại bộ lọc","Happening now":"Đang diễn ra","Calendar: results":"Lịch: kết quả","Calendar: all":"Lịch: tất cả","Calendar: selected":"Lịch: đã chọn","Print":"In","Play overview":"Phát tổng quan","Scenes and coverage":"Cảnh và nội dung được hiển thị","Preview scene":"Xem trước cảnh","Programme playback":"Phát chương trình","Pause":"Tạm dừng","Play":"Phát","Previous":"trước đó","Next":"Tiếp theo","Full screen":"Toàn màn hình","Restart":"Khởi động lại","Event programme":"Chương trình sự kiện","Programme. Space pauses; arrow keys change scene.":"Chương trình. Không gian tạm dừng; phím mũi tên chuyển cảnh.","Programme paused. Press Space to resume.":"Chương trình bị tạm dừng. Nhấn Space để tiếp tục.","Programme playing. Press Space to pause.":"Chương trình đang chơi. Nhấn Space để tạm dừng.","scheduled":"theo lịch trình","rescheduled":"đã lên lịch lại","cancelled":"đã hủy bỏ","Invalid date":"Ngày không hợp lệ","Invalid end date":"Ngày kết thúc không hợp lệ","Invalid start time":"Thời gian bắt đầu không hợp lệ","End must follow start; use End date for an overnight session":"Kết thúc phải theo sau bắt đầu; sử dụng Ngày kết thúc cho phiên qua đêm","End defaults to one hour after Start":"Kết thúc mặc định là một giờ sau khi bắt đầu","Missing session title":"Thiếu tiêu đề phiên","Duplicate Session ID":"Trùng lặp Session ID","Unknown time zone":"Múi giờ không xác định","Ambiguous time at daylight saving change":"Thời gian mơ hồ khi thay đổi tiết kiệm ánh sáng ban ngày","Time does not exist at daylight saving change":"Thời gian không tồn tại khi thay đổi tiết kiệm ánh sáng ban ngày","Room overlaps with":"Lịch hội trường trùng với","Track overlaps with":"Lịch chủ đề trùng với","Speaker overlaps with":"Lịch diễn giả trùng với","Fix the date, time and session identity issues before exporting the programme.":"Khắc phục các vấn đề về nhận dạng ngày, giờ và phiên trước khi xuất chương trình.","This programme could not be laid out. Check the dates and times in the table.":"Chương trình này không thể được trình bày. Kiểm tra ngày và giờ trong bảng.","Unknown time zone - the calendar file keeps floating times.":"Múi giờ không xác định - tệp lịch giữ thời gian trôi nổi.","Set a reference time before exporting a rehearsal.":"Đặt thời gian tham chiếu trước khi xuất bản diễn tập.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Một phiên quá dài cho trang này. Tăng kích thước trang hoặc chọn trang HTML tương tác.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Một bộ sự kiện hỗ trợ tối đa 32 phòng. Lọc chương trình trước khi xuất.","Row":"Hàng ngang","Select":"chọn","sessions":"phiên","scenes":"cảnh","seconds":"giây","data issues":"vấn đề dữ liệu","programme issues":"vấn đề chương trình","Scene":"Cảnh","px title type":"loại tiêu đề px","Every selected title completes its reveal. Longest wait:":"Mỗi tiêu đề được chọn sẽ hoàn thành tiết lộ của nó. Chờ đợi lâu nhất:","Revision:":"Sửa đổi:","Paused":"Đã tạm dừng","day":"ngày","track":"chủ đề","room":"hội trường","Reference time:":"Thời gian tham khảo:","Floating time":"Thời gian trôi nổi","Programme revision:":"Sửa đổi chương trình:","Event time zone:":"Múi giờ sự kiện:","Generated:":"Đã tạo:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML chứa lịch trình được nhúng sẵn. Hãy xuất bản lại sau khi thay đổi. Video là bản ghi.","A session needs more space. Use a taller screen or a closer reading distance.":"Một phiên cần nhiều không gian hơn. Sử dụng màn hình cao hơn hoặc khoảng cách đọc gần hơn.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Phiên này kết thúc trước khi cảnh của nó được hiển thị. Chọn ít phòng hơn trên mỗi màn hình.","px room and time type":"phòng px và loại thời gian","Longest wait:":"Chờ đợi lâu nhất:","Select at least one session.":"Chọn ít nhất một phiên.","Fix the date and time issues before exporting these sessions.":"Fix the date and time issues before exporting these sessions.","No sessions match these filters.":"Không có phiên nào khớp với các bộ lọc này.","Starts in":"Bắt đầu vào","minutes":"phút","Invalid end time":"Thời gian kết thúc không hợp lệ","Invalid date or time":"Ngày hoặc giờ không hợp lệ","A session may span at most 31 days":"Một phiên có thể kéo dài tối đa 31 ngày","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Chương trình này cần {seconds} giây để hiển thị mọi tiêu đề. Tăng thời gian xuất khẩu.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Toàn bộ chương trình cần {pages} trang. Sử dụng PDF, PowerPoint hoặc HTML để bao gồm mọi phiên."},"pt":{"Programme":"Programa","Untitled session":"Sessão sem título","Add to my calendar":"Adicionar ao meu calendário","Local event time":"Horário do evento local","Event local time":"Hora local do evento","Rehearsal":"Ensaio","Snapshot":"Instantâneo","Check event time zone":"Verifique o fuso horário do evento","No sessions remain. Thank you for joining us.":"Nenhuma sessão permanece. Obrigado por se juntar a nós.","Session website":"Site da sessão","Add session to calendar":"Adicionar sessão ao calendário","Close":"Fechar","Filter programme":"Filtrar programa","Find a session or speaker":"Encontre uma sessão ou palestrante","Search sessions":"Sessões de pesquisa","All days":"Todos os dias","All tracks":"Todos os temas","All rooms":"Todas as salas","Reset filters":"Redefinir filtros","Happening now":"Em andamento","Calendar: results":"Calendário: resultados","Calendar: all":"Calendário: todos","Calendar: selected":"Calendário: selecionado","Print":"Imprimir","Play overview":"Reproduzir visão geral","Scenes and coverage":"Cenas e conteúdo incluído","Preview scene":"Cena de visualização","Programme playback":"Reprodução do programa","Pause":"Pausa","Play":"Reproduzir","Previous":"Anterior","Next":"Próximo","Full screen":"Tela cheia","Restart":"Reiniciar","Event programme":"Programa do evento","Programme. Space pauses; arrow keys change scene.":"Programa. Pausas espaciais; teclas de seta mudam de cena.","Programme paused. Press Space to resume.":"Programa pausado. Pressione Espaço para continuar.","Programme playing. Press Space to pause.":"Reprodução do programa. Pressione Espaço para pausar.","scheduled":"programado","rescheduled":"remarcado","cancelled":"cancelado","Invalid date":"Data inválida","Invalid end date":"Data de término inválida","Invalid start time":"Hora de início inválida","End must follow start; use End date for an overnight session":"O fim deve seguir o início; use a data de término para uma sessão noturna","End defaults to one hour after Start":"O término é padronizado para uma hora após o início","Missing session title":"Título da sessão ausente","Duplicate Session ID":"Duplicar Session ID","Unknown time zone":"Fuso horário desconhecido","Ambiguous time at daylight saving change":"Horário ambíguo na mudança de horário de verão","Time does not exist at daylight saving change":"O horário não existe na mudança de horário de verão","Room overlaps with":"O horário da sala coincide com","Track overlaps with":"O horário do tema coincide com","Speaker overlaps with":"O horário do palestrante coincide com","Fix the date, time and session identity issues before exporting the programme.":"Corrija os problemas de data, hora e identidade da sessão antes de exportar o programa.","This programme could not be laid out. Check the dates and times in the table.":"Este programa não pôde ser definido. Confira as datas e horários na tabela.","Unknown time zone - the calendar file keeps floating times.":"Fuso horário desconhecido - o arquivo de calendário mantém horários flutuantes.","Set a reference time before exporting a rehearsal.":"Defina um horário de referência antes de exportar um ensaio.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Uma sessão é muito longa para esta página. Aumente o tamanho da página ou escolha uma página HTML interativa.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Um kit de evento suporta no máximo 32 salas. Filtre o programa antes de exportar.","Row":"Linha","Select":"Selecione","sessions":"sessões","scenes":"cenas","seconds":"segundos","data issues":"problemas de dados","programme issues":"problemas do programa","Scene":"Cena","px title type":"tipo de título px","Every selected title completes its reveal. Longest wait:":"Cada título selecionado completa sua revelação. Espera mais longa:","Revision:":"Revisão:","Paused":"Pausado","day":"dia","track":"tema","room":"sala","Reference time:":"Tempo de referência:","Floating time":"Tempo flutuante","Programme revision:":"Revisão do programa:","Event time zone:":"Fuso horário do evento:","Generated:":"Gerado:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"O HTML contém o programa integrado. Publique novamente após alterações. O vídeo é uma gravação.","A session needs more space. Use a taller screen or a closer reading distance.":"Uma sessão precisa de mais espaço. Use uma tela mais alta ou uma distância de leitura mais próxima.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Esta sessão termina antes que sua cena seja mostrada. Escolha menos salas por tela.","px room and time type":"px sala e tipo de hora","Longest wait:":"Espera mais longa:","Select at least one session.":"Selecione pelo menos uma sessão.","Fix the date and time issues before exporting these sessions.":"Corrija os problemas de data e hora antes de exportar essas sessões.","No sessions match these filters.":"Nenhuma sessão corresponde a esses filtros.","Starts in":"Começa em","minutes":"minutos","Invalid end time":"Horário de término inválido","Invalid date or time":"Data ou hora inválida","A session may span at most 31 days":"Uma sessão pode durar no máximo 31 dias","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Este programa precisa de {seconds} segundos para mostrar todos os títulos. Aumente a duração da exportação.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"O programa completo precisa de {pages} páginas. Use PDF, PowerPoint ou HTML para incluir todas as sessões."},"zh-hant":{"Programme":"節目","Untitled session":"無標題會議","Add to my calendar":"新增到我的日曆","Local event time":"當地活動時間","Event local time":"活動當地時間","Rehearsal":"排練","Snapshot":"快照","Check event time zone":"檢查活動時區","No sessions remain. Thank you for joining us.":"沒有剩餘會話。感謝您加入我們。","Session website":"會議網站","Add session to calendar":"將會話新增至日曆","Close":"關閉","Filter programme":"篩選議程","Find a session or speaker":"尋找會議或演講者","Search sessions":"搜尋會話","All days":"全天","All tracks":"所有主題","All rooms":"所有會場","Reset filters":"重置過濾器","Happening now":"正在進行","Calendar: results":"日曆：結果","Calendar: all":"日曆：全部","Calendar: selected":"日曆：已選擇","Print":"列印","Play overview":"播放概覽","Scenes and coverage":"場景與內容涵蓋範圍","Preview scene":"預覽場景","Programme playback":"議程播放","Pause":"暫停","Play":"播放","Previous":"上一頁","Next":"下一步","Full screen":"全螢幕","Restart":"重新啟動","Event programme":"活動節目","Programme. Space pauses; arrow keys change scene.":"計劃。空間暫停；方向鍵改變場景。","Programme paused. Press Space to resume.":"程序暫停了。按空白鍵繼續。","Programme playing. Press Space to pause.":"節目播放。按空白鍵暫停。","scheduled":"預定的","rescheduled":"重新安排","cancelled":"取消","Invalid date":"無效日期","Invalid end date":"結束日期無效","Invalid start time":"開始時間無效","End must follow start; use End date for an overnight session":"結束必須跟隨開始；使用過夜會話的結束日期","End defaults to one hour after Start":"結束預設為開始後一小時","Missing session title":"缺少會話標題","Duplicate Session ID":"重複Session ID","Unknown time zone":"未知時區","Ambiguous time at daylight saving change":"夏令時變化的時間不明確","Time does not exist at daylight saving change":"夏令時間變更時時間不存在","Room overlaps with":"會場時間衝突：","Track overlaps with":"主題時間衝突：","Speaker overlaps with":"講者時間衝突：","Fix the date, time and session identity issues before exporting the programme.":"在匯出節目之前修復日期、時間和會話身分問題。","This programme could not be laid out. Check the dates and times in the table.":"該計劃無法制定。檢查表中的日期和時間。","Unknown time zone - the calendar file keeps floating times.":"未知時區 - 日曆檔案保持浮動時間。","Set a reference time before exporting a rehearsal.":"在匯出排練之前設定參考時間。","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"此頁面的會話時間太長。增加頁面大小或選擇互動式 HTML 頁面。","An event kit supports at most 32 rooms. Filter the programme before exporting.":"一個活動套件最多支援 32 個房間。匯出前過濾程序。","Row":"排","Select":"選擇","sessions":"會議","scenes":"場景","seconds":"秒","data issues":"數據問題","programme issues":"程式問題","Scene":"場景","px title type":"px 標題類型","Every selected title completes its reveal. Longest wait:":"每個選定的標題都完成了它的揭示。最長等待時間：","Revision:":"修訂：","Paused":"已暫停","day":"日","track":"主題","room":"會場","Reference time:":"參考時間：","Floating time":"漂浮時間","Programme revision:":"方案修訂：","Event time zone:":"活動時區：","Generated:":"生成：","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML 內嵌活動日程。變更後請重新發布。影片為錄製內容。","A session needs more space. Use a taller screen or a closer reading distance.":"會話需要更多空間。使用更高的螢幕或更近的閱讀距離。","This session ends before its scene is shown. Choose fewer rooms per screen.":"該會話在其場景顯示之前結束。每個螢幕選擇更少的房間。","px room and time type":"px 房間和時間類型","Longest wait:":"最長等待時間：","Select at least one session.":"至少選擇一個會話。","Fix the date and time issues before exporting these sessions.":"在匯出這些會話之前修復日期和時間問題。","No sessions match these filters.":"沒有會話與這些過濾器匹配。","Starts in":"開始於","minutes":"分分鐘","Invalid end time":"結束時間無效","Invalid date or time":"日期或時間無效","A session may span at most 31 days":"會話最多可持續 31 天","This programme needs {seconds} seconds to show every title. Increase the export duration.":"程式需要{seconds}秒來顯示每個標題。增加導出持續時間。","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"完整的程序需要{pages}頁。使用 PDF、PowerPoint 或 HTML 包含每個會話。"},"cs":{"Programme":"Program","Untitled session":"Relace bez názvu","Add to my calendar":"Přidat do mého kalendáře","Local event time":"Čas místní události","Event local time":"Událost místního času","Rehearsal":"Zkouška","Snapshot":"Snímek","Check event time zone":"Zkontrolujte časové pásmo události","No sessions remain. Thank you for joining us.":"Nezbývají žádné relace. Děkujeme, že jste se k nám přidali.","Session website":"Web relace","Add session to calendar":"Přidat relaci do kalendáře","Close":"Zavřít","Filter programme":"Filtrovat program","Find a session or speaker":"Najděte relaci nebo řečníka","Search sessions":"Vyhledávání relací","All days":"Všechny dny","All tracks":"Všechna témata","All rooms":"Všechny sály","Reset filters":"Resetovat filtry","Happening now":"Právě probíhá","Calendar: results":"Kalendář: výsledky","Calendar: all":"Kalendář: vše","Calendar: selected":"Kalendář: vybráno","Print":"Tisk","Play overview":"Přehrát přehled","Scenes and coverage":"Scény a zahrnutý obsah","Preview scene":"Náhled scény","Programme playback":"Přehrávání programu","Pause":"Pauza","Play":"Přehrát","Previous":"Předchozí","Next":"Další","Full screen":"Celá obrazovka","Restart":"Restartujte","Event programme":"Program akce","Programme. Space pauses; arrow keys change scene.":"Program. Prostorové pauzy; šipky mění scénu.","Programme paused. Press Space to resume.":"Program pozastaven. Pokračujte stisknutím mezerníku.","Programme playing. Press Space to pause.":"Přehrávání programu. Stisknutím mezerníku pozastavíte.","scheduled":"naplánováno","rescheduled":"přeplánováno","cancelled":"zrušeno","Invalid date":"Neplatné datum","Invalid end date":"Neplatné datum ukončení","Invalid start time":"Neplatný čas zahájení","End must follow start; use End date for an overnight session":"Konec musí následovat po startu; použijte Koncové datum pro noční relaci","End defaults to one hour after Start":"Konec je ve výchozím nastavení jednu hodinu po Startu","Missing session title":"Chybí název relace","Duplicate Session ID":"Duplikát Session ID","Unknown time zone":"Neznámé časové pásmo","Ambiguous time at daylight saving change":"Nejednoznačný čas při změně letního času","Time does not exist at daylight saving change":"Při změně letního času neexistuje čas","Room overlaps with":"Obsazení sálu se překrývá s","Track overlaps with":"Čas tématu se překrývá s","Speaker overlaps with":"Čas přednášejícího se překrývá s","Fix the date, time and session identity issues before exporting the programme.":"Před exportem programu opravte problémy s datem, časem a identitou relace.","This programme could not be laid out. Check the dates and times in the table.":"Tento program se nepodařilo naplánovat. Zkontrolujte data a časy v tabulce.","Unknown time zone - the calendar file keeps floating times.":"Neznámé časové pásmo – kalendářní soubor má plovoucí časy.","Set a reference time before exporting a rehearsal.":"Před exportem zkoušky nastavte referenční čas.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Relace je pro tuto stránku příliš dlouhá. Zvětšete velikost stránky nebo zvolte interaktivní stránku HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Sada událostí podporuje maximálně 32 místností. Před exportem program filtrujte.","Row":"Řádek","Select":"Vyberte","sessions":"sezení","scenes":"scény","seconds":"sekund","data issues":"problémy s daty","programme issues":"problémy programu","Scene":"Scéna","px title type":"typ nadpisu px","Every selected title completes its reveal. Longest wait:":"Každý vybraný titul dokončí své odhalení. Nejdelší čekání:","Revision:":"Revize:","Paused":"Pozastaveno","day":"den","track":"téma","room":"sál","Reference time:":"Referenční čas:","Floating time":"Plovoucí čas","Programme revision:":"Revize programu:","Event time zone:":"Časové pásmo události:","Generated:":"Vygenerováno:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML obsahuje vložený program. Po změnách jej znovu zveřejněte. Video je záznam.","A session needs more space. Use a taller screen or a closer reading distance.":"Relace potřebuje více prostoru. Použijte vyšší obrazovku nebo kratší čtecí vzdálenost.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Tato relace končí před zobrazením scény. Vyberte méně místností na obrazovku.","px room and time type":"px typ místnosti a času","Longest wait:":"Nejdelší čekání:","Select at least one session.":"Vyberte alespoň jednu relaci.","Fix the date and time issues before exporting these sessions.":"Před exportem těchto relací opravte problémy s datem a časem.","No sessions match these filters.":"Těmto filtrům neodpovídají žádné návštěvy.","Starts in":"Začíná v","minutes":"minut","Invalid end time":"Neplatný čas ukončení","Invalid date or time":"Neplatné datum nebo čas","A session may span at most 31 days":"Relace může trvat maximálně 31 dní","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Tento program potřebuje {seconds} sekund k zobrazení každého titulu. Prodlužte dobu exportu.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Úplný program potřebuje {pages} stránek. Pomocí PDF, PowerPoint nebo HTML zahrňte každou relaci."},"nl":{"Programme":"Programma","Untitled session":"Naamloze sessie","Add to my calendar":"Voeg toe aan mijn agenda","Local event time":"Lokale evenemententijd","Event local time":"Gebeurtenis lokale tijd","Rehearsal":"Repetitie","Snapshot":"Momentopname","Check event time zone":"Controleer de tijdzone van het evenement","No sessions remain. Thank you for joining us.":"Er zijn geen sessies meer. Bedankt dat je bij ons bent gekomen.","Session website":"Sessie website","Add session to calendar":"Voeg sessie toe aan agenda","Close":"Sluiten","Filter programme":"Programma filteren","Find a session or speaker":"Zoek een sessie of spreker","Search sessions":"Zoek sessies","All days":"Alle dagen","All tracks":"Alle thema’s","All rooms":"Alle zalen","Reset filters":"Filters opnieuw instellen","Happening now":"Nu bezig","Calendar: results":"Kalender: resultaten","Calendar: all":"Kalender: alles","Calendar: selected":"Kalender: geselecteerd","Print":"Afdrukken","Play overview":"Overzicht afspelen","Scenes and coverage":"Scènes en opgenomen inhoud","Preview scene":"Voorbeeldscène","Programme playback":"Programma afspelen","Pause":"Pauze","Play":"Afspelen","Previous":"Vorige","Next":"Volgende","Full screen":"Volledig scherm","Restart":"Opnieuw opstarten","Event programme":"Evenement programma","Programme. Space pauses; arrow keys change scene.":"Programma. De ruimte pauzeert; pijltjestoetsen veranderen scène.","Programme paused. Press Space to resume.":"Programma onderbroken. Druk op de spatiebalk om door te gaan.","Programme playing. Press Space to pause.":"Programma afspelen. Druk op de spatiebalk om te pauzeren.","scheduled":"gepland","rescheduled":"opnieuw gepland","cancelled":"geannuleerd","Invalid date":"Ongeldige datum","Invalid end date":"Ongeldige einddatum","Invalid start time":"Ongeldige starttijd","End must follow start; use End date for an overnight session":"Het einde moet het begin volgen; gebruik Einddatum voor een nachtelijke sessie","End defaults to one hour after Start":"Einde is standaard ingesteld op één uur na Start","Missing session title":"Ontbrekende sessietitel","Duplicate Session ID":"Duplicaat Session ID","Unknown time zone":"Onbekende tijdzone","Ambiguous time at daylight saving change":"Dubbelzinnige tijd bij zomertijdverandering","Time does not exist at daylight saving change":"Bij zomertijdverandering bestaat er geen tijd","Room overlaps with":"De zaalbezetting overlapt met","Track overlaps with":"De tijd van het thema overlapt met","Speaker overlaps with":"De planning van de spreker overlapt met","Fix the date, time and session identity issues before exporting the programme.":"Los de problemen met de datum-, tijd- en sessie-identiteit op voordat u het programma exporteert.","This programme could not be laid out. Check the dates and times in the table.":"Dit programma kon niet worden opgesteld. Controleer de data en tijden in de tabel.","Unknown time zone - the calendar file keeps floating times.":"Onbekende tijdzone - het agendabestand behoudt zwevende tijden.","Set a reference time before exporting a rehearsal.":"Stel een referentietijd in voordat u een repetitie exporteert.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Een sessie is te lang voor deze pagina. Vergroot het paginaformaat of kies voor een interactieve HTML pagina.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Een evenementenkit ondersteunt maximaal 32 kamers. Filter het programma voordat u het exporteert.","Row":"Rij","Select":"Selecteer","sessions":"sessies","scenes":"scènes","seconds":"seconden","data issues":"gegevensproblemen","programme issues":"programma problemen","Scene":"Scène","px title type":"px-titeltype","Every selected title completes its reveal. Longest wait:":"Elke geselecteerde titel voltooit zijn onthulling. Langste wachttijd:","Revision:":"Revisie:","Paused":"Gepauzeerd","day":"dag","track":"thema","room":"zaal","Reference time:":"Referentietijd:","Floating time":"Zwevende tijd","Programme revision:":"Programma herziening:","Event time zone:":"Tijdzone evenement:","Generated:":"Gegenereerd:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Het HTML-bestand bevat een ingesloten programma. Publiceer het opnieuw na wijzigingen. De video is een opname.","A session needs more space. Use a taller screen or a closer reading distance.":"Een sessie heeft meer ruimte nodig. Gebruik een groter scherm of een kleinere leesafstand.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Deze sessie eindigt voordat de scène wordt getoond. Kies minder kamers per scherm.","px room and time type":"px kamer- en tijdtype","Longest wait:":"Langste wachttijd:","Select at least one session.":"Selecteer minimaal één sessie.","Fix the date and time issues before exporting these sessions.":"Los de datum- en tijdproblemen op voordat u deze sessies exporteert.","No sessions match these filters.":"Er zijn geen sessies die overeenkomen met deze filters.","Starts in":"Begint binnen","minutes":"minuten","Invalid end time":"Ongeldige eindtijd","Invalid date or time":"Ongeldige datum of tijd","A session may span at most 31 days":"Een sessie mag maximaal 31 dagen duren","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Dit programma heeft {seconds} seconden nodig om elke titel weer te geven. Verleng de exportduur.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Voor het volledige programma zijn {pages} pagina's nodig. Gebruik PDF, PowerPoint of HTML om elke sessie op te nemen."},"tl":{"Programme":"Programa","Untitled session":"Walang pamagat na session","Add to my calendar":"Idagdag sa aking kalendaryo","Local event time":"Oras ng lokal na kaganapan","Event local time":"Lokal na oras ng kaganapan","Rehearsal":"Pag-eensayo","Snapshot":"Snapshot","Check event time zone":"Suriin ang time zone ng kaganapan","No sessions remain. Thank you for joining us.":"Walang natitira pang session. Salamat sa pagsama sa amin.","Session website":"Website ng session","Add session to calendar":"Magdagdag ng session sa kalendaryo","Close":"Isara","Filter programme":"Salain ang programa","Find a session or speaker":"Maghanap ng session o speaker","Search sessions":"Mga sesyon ng paghahanap","All days":"Lahat ng araw","All tracks":"Lahat ng paksa","All rooms":"Lahat ng bulwagan","Reset filters":"I-reset ang mga filter","Happening now":"Kasalukuyang nagaganap","Calendar: results":"Kalendaryo: mga resulta","Calendar: all":"Kalendaryo: lahat","Calendar: selected":"Kalendaryo: napili","Print":"Print","Play overview":"I-play ang pangkalahatang buod","Scenes and coverage":"Mga eksena at saklaw ng nilalaman","Preview scene":"Silipin ang eksena","Programme playback":"Pag-play ng programa","Pause":"I-pause","Play":"I-play","Previous":"Nakaraang","Next":"Susunod","Full screen":"Buong screen","Restart":"I-restart","Event programme":"Programa ng kaganapan","Programme. Space pauses; arrow keys change scene.":"Programa. Space pause; ang mga arrow key ay nagbabago ng eksena.","Programme paused. Press Space to resume.":"Naka-pause ang program. Pindutin ang Space para ipagpatuloy.","Programme playing. Press Space to pause.":"Naglalaro ng programa. Pindutin ang Space para i-pause.","scheduled":"nakaiskedyul","rescheduled":"na-reschedule","cancelled":"kinansela","Invalid date":"Di-wastong petsa","Invalid end date":"Di-wastong petsa ng pagtatapos","Invalid start time":"Di-wastong oras ng pagsisimula","End must follow start; use End date for an overnight session":"Ang pagtatapos ay dapat sumunod sa simula; gamitin ang Petsa ng pagtatapos para sa isang magdamag na sesyon","End defaults to one hour after Start":"Magtatapos ang default sa isang oras pagkatapos ng Start","Missing session title":"Nawawalang pamagat ng session","Duplicate Session ID":"Duplicate Session ID","Unknown time zone":"Hindi kilalang time zone","Ambiguous time at daylight saving change":"Hindi maliwanag na oras sa pagbabago ng daylight saving","Time does not exist at daylight saving change":"Walang oras sa pagbabago ng daylight saving","Room overlaps with":"Kasabay ang paggamit ng bulwagan sa","Track overlaps with":"Kasabay ang iskedyul ng paksa sa","Speaker overlaps with":"Kasabay ang iskedyul ng tagapagsalita sa","Fix the date, time and session identity issues before exporting the programme.":"Ayusin ang petsa, oras at mga isyu sa pagkakakilanlan ng session bago i-export ang programa.","This programme could not be laid out. Check the dates and times in the table.":"Hindi mailatag ang programang ito. Suriin ang mga petsa at oras sa talahanayan.","Unknown time zone - the calendar file keeps floating times.":"Hindi kilalang time zone - ang file ng kalendaryo ay nagpapanatili ng mga oras na lumulutang.","Set a reference time before exporting a rehearsal.":"Magtakda ng oras ng sanggunian bago mag-export ng rehearsal.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Masyadong mahaba ang isang session para sa page na ito. Palakihin ang laki ng page o pumili ng interactive na HTML page.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Sinusuportahan ng event kit ang halos 32 kwarto. I-filter ang program bago i-export.","Row":"hilera","Select":"Pumili","sessions":"mga session","scenes":"mga eksena","seconds":"segundo","data issues":"mga isyu sa data","programme issues":"mga isyu sa programa","Scene":"Eksena","px title type":"uri ng pamagat ng px","Every selected title completes its reveal. Longest wait:":"Ang bawat napiling pamagat ay kumukumpleto sa pagbubunyag nito. Pinakamatagal na paghihintay:","Revision:":"Rebisyon:","Paused":"Naka-pause","day":"araw","track":"paksa","room":"bulwagan","Reference time:":"Oras ng sanggunian:","Floating time":"Lumulutang na oras","Programme revision:":"Pagbabago ng programa:","Event time zone:":"Time zone ng kaganapan:","Generated:":"Binuo:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Kasama sa HTML ang iskedyul. Ilathala itong muli pagkatapos ng mga pagbabago. Ang video ay isang recording.","A session needs more space. Use a taller screen or a closer reading distance.":"Kailangan ng mas maraming espasyo para sa session. Pumili ng mas mataas na screen o mas malapit na distansya ng pagbabasa.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Nagtatapos ang session na ito bago ipakita ang eksena nito. Pumili ng mas kaunting kwarto sa bawat screen.","px room and time type":"px kwarto at uri ng oras","Longest wait:":"Pinakamatagal na paghihintay:","Select at least one session.":"Pumili ng kahit isang session.","Fix the date and time issues before exporting these sessions.":"Ayusin ang mga isyu sa petsa at oras bago i-export ang mga session na ito.","No sessions match these filters.":"Walang mga session na tumutugma sa mga filter na ito.","Starts in":"Magsisimula sa","minutes":"minuto","Invalid end time":"Di-wastong oras ng pagtatapos","Invalid date or time":"Di-wastong petsa o oras","A session may span at most 31 days":"Ang isang session ay maaaring tumagal ng hindi hihigit sa 31 araw","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Ang program na ito ay nangangailangan ng {seconds} segundo upang ipakita ang bawat pamagat. Dagdagan ang tagal ng pag-export.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Ang buong programa ay nangangailangan ng {pages} mga pahina. Gamitin ang PDF, PowerPoint o HTML upang isama ang bawat session."},"sv":{"Programme":"Program","Untitled session":"Namnlös session","Add to my calendar":"Lägg till i min kalender","Local event time":"Lokal evenemangstid","Event local time":"Händelse lokal tid","Rehearsal":"Repetition","Snapshot":"Ögonblicksbild","Check event time zone":"Kontrollera händelsens tidszon","No sessions remain. Thank you for joining us.":"Inga sessioner återstår. Tack för att du är med.","Session website":"Session webbplats","Add session to calendar":"Lägg till session i kalendern","Close":"Stäng","Filter programme":"Filtrera program","Find a session or speaker":"Hitta en session eller talare","Search sessions":"Sök sessioner","All days":"Alla dagar","All tracks":"Alla teman","All rooms":"Alla salar","Reset filters":"Återställ filter","Happening now":"Pågår nu","Calendar: results":"Kalender: resultat","Calendar: all":"Kalender: alla","Calendar: selected":"Kalender: vald","Print":"Skriv ut","Play overview":"Spela upp översikt","Scenes and coverage":"Scener och inkluderat innehåll","Preview scene":"Förhandsgranska scen","Programme playback":"Uppspelning av program","Pause":"Pausa","Play":"Spela upp","Previous":"Föregående","Next":"Nästa","Full screen":"Helskärm","Restart":"Starta om","Event programme":"Eventprogram","Programme. Space pauses; arrow keys change scene.":"Program. Space pauser; piltangenterna byter scen.","Programme paused. Press Space to resume.":"Program pausat. Tryck på blanksteg för att fortsätta.","Programme playing. Press Space to pause.":"Program som spelas upp. Tryck på mellanslag för att pausa.","scheduled":"schemalagd","rescheduled":"planeras om","cancelled":"inställd","Invalid date":"Ogiltigt datum","Invalid end date":"Ogiltigt slutdatum","Invalid start time":"Ogiltig starttid","End must follow start; use End date for an overnight session":"Slutet måste följa början; använd slutdatum för en övernattningssession","End defaults to one hour after Start":"Slut är som standard en timme efter Start","Missing session title":"Sessionstitel saknas","Duplicate Session ID":"Duplicera Session ID","Unknown time zone":"Okänd tidszon","Ambiguous time at daylight saving change":"Tvetydig tid vid sommartid förändring","Time does not exist at daylight saving change":"Tid finns inte vid sommartid","Room overlaps with":"Salens bokning överlappar med","Track overlaps with":"Temats tid överlappar med","Speaker overlaps with":"Talarens schema överlappar med","Fix the date, time and session identity issues before exporting the programme.":"Fixa datum, tid och sessionsidentitetsproblem innan du exporterar programmet.","This programme could not be laid out. Check the dates and times in the table.":"Detta program kunde inte läggas ut. Kontrollera datum och tider i tabellen.","Unknown time zone - the calendar file keeps floating times.":"Okänd tidszon - kalenderfilen håller flytande tider.","Set a reference time before exporting a rehearsal.":"Ställ in en referenstid innan du exporterar en repetition.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"En session är för lång för den här sidan. Öka sidstorleken eller välj en interaktiv HTML-sida.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Ett eventpaket stöder högst 32 rum. Filtrera programmet innan du exporterar.","Row":"Rad","Select":"Välj","sessions":"sessioner","scenes":"scener","seconds":"sekunder","data issues":"datafrågor","programme issues":"programfrågor","Scene":"Scen","px title type":"px titeltyp","Every selected title completes its reveal. Longest wait:":"Varje vald titel fullbordar sin avslöjande. Längsta väntan:","Revision:":"Revision:","Paused":"Pausad","day":"dag","track":"tema","room":"sal","Reference time:":"Referenstid:","Floating time":"Flytande tid","Programme revision:":"Programrevision:","Event time zone:":"Eventets tidszon:","Generated:":"Genererad:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML-filen innehåller ett inbäddat schema. Publicera på nytt efter ändringar. Videon är en inspelning.","A session needs more space. Use a taller screen or a closer reading distance.":"En session behöver mer utrymme. Använd en högre skärm eller ett närmare läsavstånd.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Denna session avslutas innan dess scen visas. Välj färre rum per skärm.","px room and time type":"px rum och tidstyp","Longest wait:":"Längsta väntan:","Select at least one session.":"Välj minst en session.","Fix the date and time issues before exporting these sessions.":"Åtgärda datum- och tidsproblemen innan du exporterar dessa sessioner.","No sessions match these filters.":"Inga sessioner matchar dessa filter.","Starts in":"Börjar in","minutes":"minuter","Invalid end time":"Ogiltig sluttid","Invalid date or time":"Ogiltigt datum eller tid","A session may span at most 31 days":"En session kan sträcka sig över högst 31 dagar","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Det här programmet behöver {seconds} sekunder för att visa varje titel. Öka exporttiden.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Hela programmet behöver {pages} sidor. Använd PDF, PowerPoint eller HTML för att inkludera varje session."},"ms":{"Programme":"Program","Untitled session":"Sesi tanpa tajuk","Add to my calendar":"Tambahkan pada kalendar saya","Local event time":"Waktu acara tempatan","Event local time":"Acara waktu tempatan","Rehearsal":"Latihan","Snapshot":"Syot kilat","Check event time zone":"Semak zon waktu acara","No sessions remain. Thank you for joining us.":"Tiada sesi kekal. Terima kasih kerana menyertai kami.","Session website":"Laman web sesi","Add session to calendar":"Tambahkan sesi pada kalendar","Close":"tutup","Filter programme":"Tapis program","Find a session or speaker":"Cari sesi atau penceramah","Search sessions":"Sesi carian","All days":"Semua hari","All tracks":"Semua tema","All rooms":"Semua dewan","Reset filters":"Tetapkan semula penapis","Happening now":"Sedang berlangsung","Calendar: results":"Kalendar: keputusan","Calendar: all":"Kalendar: semua","Calendar: selected":"Kalendar: dipilih","Print":"Cetak","Play overview":"Mainkan gambaran keseluruhan","Scenes and coverage":"Adegan dan liputan kandungan","Preview scene":"Pratonton adegan","Programme playback":"Main balik program","Pause":"jeda","Play":"Mainkan","Previous":"Sebelumnya","Next":"Seterusnya","Full screen":"Skrin penuh","Restart":"Mulakan semula","Event programme":"Program acara","Programme. Space pauses; arrow keys change scene.":"Program. Jeda ruang; kekunci anak panah menukar adegan.","Programme paused. Press Space to resume.":"Program dijeda. Tekan Space untuk menyambung semula.","Programme playing. Press Space to pause.":"Program bermain. Tekan Space untuk menjeda.","scheduled":"dijadualkan","rescheduled":"dijadualkan semula","cancelled":"dibatalkan","Invalid date":"Tarikh tidak sah","Invalid end date":"Tarikh tamat tidak sah","Invalid start time":"Masa mula tidak sah","End must follow start; use End date for an overnight session":"Tamat mesti mengikuti permulaan; gunakan Tarikh tamat untuk sesi semalaman","End defaults to one hour after Start":"Tamat lalai kepada satu jam selepas Mula","Missing session title":"Tajuk sesi tiada","Duplicate Session ID":"Pendua Session ID","Unknown time zone":"Zon waktu tidak diketahui","Ambiguous time at daylight saving change":"Masa yang tidak jelas pada perubahan penjimatan siang","Time does not exist at daylight saving change":"Masa tidak wujud pada perubahan penjimatan siang","Room overlaps with":"Jadual dewan bertindih dengan","Track overlaps with":"Jadual tema bertindih dengan","Speaker overlaps with":"Jadual penceramah bertindih dengan","Fix the date, time and session identity issues before exporting the programme.":"Betulkan isu identiti tarikh, masa dan sesi sebelum mengeksport program.","This programme could not be laid out. Check the dates and times in the table.":"Program ini tidak dapat disusun. Semak tarikh dan masa dalam jadual.","Unknown time zone - the calendar file keeps floating times.":"Zon waktu tidak diketahui - fail kalendar mengekalkan masa terapung.","Set a reference time before exporting a rehearsal.":"Tetapkan masa rujukan sebelum mengeksport latihan.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Sesi terlalu panjang untuk halaman ini. Besarkan saiz halaman atau pilih halaman HTML interaktif.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Kit acara menyokong paling banyak 32 bilik. Tapis program sebelum mengeksport.","Row":"baris","Select":"Pilih","sessions":"sesi","scenes":"adegan","seconds":"detik","data issues":"isu data","programme issues":"isu program","Scene":"tempat kejadian","px title type":"jenis tajuk px","Every selected title completes its reveal. Longest wait:":"Setiap tajuk yang dipilih melengkapkan pendedahannya. Penantian paling lama:","Revision:":"Semakan:","Paused":"Dijeda","day":"hari","track":"tema","room":"dewan","Reference time:":"Masa rujukan:","Floating time":"Masa terapung","Programme revision:":"Semakan program:","Event time zone:":"Zon waktu acara:","Generated:":"Dijana:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML mengandungi jadual terbenam. Terbitkan semula selepas perubahan. Video ialah rakaman.","A session needs more space. Use a taller screen or a closer reading distance.":"Sesi memerlukan lebih banyak ruang. Gunakan skrin yang lebih tinggi atau jarak bacaan yang lebih dekat.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Sesi ini tamat sebelum adegannya ditunjukkan. Pilih lebih sedikit bilik setiap skrin.","px room and time type":"px bilik dan jenis masa","Longest wait:":"Penantian paling lama:","Select at least one session.":"Pilih sekurang-kurangnya satu sesi.","Fix the date and time issues before exporting these sessions.":"Betulkan isu tarikh dan masa sebelum mengeksport sesi ini.","No sessions match these filters.":"Tiada sesi yang sepadan dengan penapis ini.","Starts in":"Bermula dalam","minutes":"minit","Invalid end time":"Masa tamat tidak sah","Invalid date or time":"Tarikh atau masa tidak sah","A session may span at most 31 days":"Satu sesi boleh berlangsung paling lama 31 hari","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Program ini memerlukan {seconds} saat untuk menunjukkan setiap tajuk. Meningkatkan tempoh eksport.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Program penuh memerlukan {pages} halaman. Gunakan PDF, PowerPoint atau HTML untuk memasukkan setiap sesi."},"ro":{"Programme":"Program","Untitled session":"Sesiune fără titlu","Add to my calendar":"Adaugă la calendarul meu","Local event time":"Ora locală a evenimentului","Event local time":"Ora locală a evenimentului","Rehearsal":"Repetiție","Snapshot":"Instantaneu","Check event time zone":"Verificați fusul orar al evenimentului","No sessions remain. Thank you for joining us.":"Nu mai rămân sesiuni. Vă mulțumim că v-ați alăturat nouă.","Session website":"Site-ul sesiunii","Add session to calendar":"Adăugați o sesiune în calendar","Close":"Închide","Filter programme":"Filtrează programul","Find a session or speaker":"Găsiți o sesiune sau un vorbitor","Search sessions":"Sesiuni de căutare","All days":"Toate zilele","All tracks":"Toate temele","All rooms":"Toate sălile","Reset filters":"Resetați filtrele","Happening now":"În desfășurare","Calendar: results":"Calendar: rezultate","Calendar: all":"Calendar: toate","Calendar: selected":"Calendar: selectat","Print":"Imprimați","Play overview":"Redă prezentarea generală","Scenes and coverage":"Scene și conținut inclus","Preview scene":"Previzualizează scena","Programme playback":"Redarea programului","Pause":"Pauză","Play":"Redă","Previous":"Anterior","Next":"În continuare","Full screen":"Ecran complet","Restart":"Reporniți","Event programme":"Programul evenimentului","Programme. Space pauses; arrow keys change scene.":"Program. Spațiu pauze; tastele săgeată schimbă scena.","Programme paused. Press Space to resume.":"Programul a fost întrerupt. Apăsați pe Space pentru a relua.","Programme playing. Press Space to pause.":"Redare program. Apăsați pe spațiu pentru a întrerupe.","scheduled":"programate","rescheduled":"reprogramat","cancelled":"anulat","Invalid date":"Data nevalidă","Invalid end date":"Data de încheiere nevalidă","Invalid start time":"Ora de începere nevalidă","End must follow start; use End date for an overnight session":"Sfârșitul trebuie să urmeze începutul; utilizați data de încheiere pentru o sesiune peste noapte","End defaults to one hour after Start":"Sfârșitul este implicit la o oră după Start","Missing session title":"Titlul sesiunii lipsește","Duplicate Session ID":"Dublat Session ID","Unknown time zone":"Fus orar necunoscut","Ambiguous time at daylight saving change":"Ora ambiguă la modificarea orei de vară","Time does not exist at daylight saving change":"Ora nu există la schimbarea orasului de vară","Room overlaps with":"Ocuparea sălii se suprapune cu","Track overlaps with":"Orarul temei se suprapune cu","Speaker overlaps with":"Programul vorbitorului se suprapune cu","Fix the date, time and session identity issues before exporting the programme.":"Remediați problemele legate de data, ora și identitatea sesiunii înainte de a exporta programul.","This programme could not be laid out. Check the dates and times in the table.":"Acest program nu a putut fi prezentat. Verificați datele și orele din tabel.","Unknown time zone - the calendar file keeps floating times.":"Fus orar necunoscut - fișierul calendar păstrează timpuri flotante.","Set a reference time before exporting a rehearsal.":"Setați o oră de referință înainte de a exporta o repetiție.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"O sesiune este prea lungă pentru această pagină. Măriți dimensiunea paginii sau alegeți o pagină interactivă HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Un kit de evenimente acceptă cel mult 32 de săli. Filtrați programul înainte de a exporta.","Row":"Rând","Select":"Selectați","sessions":"sesiuni","scenes":"scene","seconds":"secunde","data issues":"probleme de date","programme issues":"probleme de program","Scene":"Scenă","px title type":"tip de titlu px","Every selected title completes its reveal. Longest wait:":"Fiecare titlu selectat își finalizează dezvăluirea. Cea mai lungă așteptare:","Revision:":"Revizie:","Paused":"Întrerupt","day":"zi","track":"temă","room":"sală","Reference time:":"Ora de referinta:","Floating time":"Timp plutitor","Programme revision:":"Revizuirea programului:","Event time zone:":"Fus orar al evenimentului:","Generated:":"Generat:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Fișierul HTML conține programul încorporat. Publicați din nou după modificări. Videoclipul este o înregistrare.","A session needs more space. Use a taller screen or a closer reading distance.":"O sesiune are nevoie de mai mult spațiu. Utilizați un ecran mai înalt sau o distanță de citire mai apropiată.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Această sesiune se încheie înainte ca scena să fie afișată. Alegeți mai puține camere pe ecran.","px room and time type":"px cameră și tip de timp","Longest wait:":"Cea mai lungă așteptare:","Select at least one session.":"Selectați cel puțin o sesiune.","Fix the date and time issues before exporting these sessions.":"Remediați problemele legate de dată și oră înainte de a exporta aceste sesiuni.","No sessions match these filters.":"Nicio sesiune nu corespunde acestor filtre.","Starts in":"Începe în","minutes":"minute","Invalid end time":"Ora de încheiere nevalidă","Invalid date or time":"Data sau ora nevalidă","A session may span at most 31 days":"O sesiune poate dura cel mult 31 de zile","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Acest program are nevoie de {seconds} secunde pentru a afișa fiecare titlu. Măriți durata exportului.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Programul complet are nevoie de {pages} pagini. Folosiți PDF, PowerPoint sau HTML pentru a include fiecare sesiune."},"hi":{"Programme":"कार्यक्रम","Untitled session":"शीर्षक रहित सत्र","Add to my calendar":"मेरे कैलेंडर में जोड़ें","Local event time":"स्थानीय घटना का समय","Event local time":"घटना स्थानीय समय","Rehearsal":"रिहर्सल","Snapshot":"स्नैपशॉट","Check event time zone":"इवेंट समय क्षेत्र की जाँच करें","No sessions remain. Thank you for joining us.":"कोई सत्र शेष नहीं है. हमसे जुडने के लिए तुम्हारा शुक्रिया।","Session website":"सत्र वेबसाइट","Add session to calendar":"कैलेंडर में सत्र जोड़ें","Close":"बंद करें","Filter programme":"कार्यक्रम फ़िल्टर करें","Find a session or speaker":"एक सत्र या वक्ता खोजें","Search sessions":"सत्र खोजें","All days":"सारे दिन","All tracks":"सभी विषय","All rooms":"सभी सभागार","Reset filters":"फ़िल्टर रीसेट करें","Happening now":"अभी चल रहा है","Calendar: results":"कैलेंडर: परिणाम","Calendar: all":"कैलेंडर: सभी","Calendar: selected":"कैलेंडर: चयनित","Print":"प्रिंट करें","Play overview":"सारांश चलाएँ","Scenes and coverage":"दृश्य और शामिल सामग्री","Preview scene":"दृश्य का पूर्वावलोकन करें","Programme playback":"कार्यक्रम चलाना","Pause":"विराम","Play":"चलाएँ","Previous":"पिछला","Next":"अगला","Full screen":"पूर्ण स्क्रीन","Restart":"पुनः प्रारंभ करें","Event programme":"आयोजन कार्यक्रम","Programme. Space pauses; arrow keys change scene.":"कार्यक्रम. अंतरिक्ष रुक जाता है; तीर कुंजियाँ दृश्य बदल देती हैं।","Programme paused. Press Space to resume.":"कार्यक्रम रुका. फिर से शुरू करने के लिए स्पेस दबाएँ।","Programme playing. Press Space to pause.":"प्रोग्राम चल रहा है. रोकने के लिए स्पेस दबाएँ।","scheduled":"अनुसूचित","rescheduled":"पुनर्निर्धारित","cancelled":"रद्द कर दिया गया","Invalid date":"अमान्य दिनांक","Invalid end date":"अमान्य अंतिम तिथि","Invalid start time":"अमान्य आरंभ समय","End must follow start; use End date for an overnight session":"अंत को प्रारंभ का अनुसरण करना चाहिए; रात्रिकालीन सत्र के लिए अंतिम तिथि का उपयोग करें","End defaults to one hour after Start":"प्रारंभ के एक घंटे बाद डिफॉल्ट समाप्त करें","Missing session title":"गुम सत्र शीर्षक","Duplicate Session ID":"डुप्लिकेट Session ID","Unknown time zone":"अज्ञात समय क्षेत्र","Ambiguous time at daylight saving change":"डेलाइट सेविंग परिवर्तन पर अस्पष्ट समय","Time does not exist at daylight saving change":"डेलाइट सेविंग चेंज में समय मौजूद नहीं होता","Room overlaps with":"सभागार का समय इससे टकराता है:","Track overlaps with":"विषय का समय इससे टकराता है:","Speaker overlaps with":"वक्ता का समय इससे टकराता है:","Fix the date, time and session identity issues before exporting the programme.":"प्रोग्राम निर्यात करने से पहले दिनांक, समय और सत्र पहचान संबंधी समस्याओं को ठीक करें।","This programme could not be laid out. Check the dates and times in the table.":"यह कार्यक्रम प्रस्तुत नहीं किया जा सका. तालिका में दिनांक और समय जांचें.","Unknown time zone - the calendar file keeps floating times.":"अज्ञात समय क्षेत्र - कैलेंडर फ़ाइल समय-समय पर तैरती रहती है।","Set a reference time before exporting a rehearsal.":"रिहर्सल निर्यात करने से पहले एक संदर्भ समय निर्धारित करें।","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"इस पृष्ठ के लिए एक सत्र बहुत लंबा है. पेज का आकार बढ़ाएँ या एक इंटरैक्टिव HTML पेज चुनें।","An event kit supports at most 32 rooms. Filter the programme before exporting.":"एक इवेंट किट अधिकतम 32 कमरों को सपोर्ट करती है। निर्यात करने से पहले प्रोग्राम को फ़िल्टर करें।","Row":"पंक्ति","Select":"चयन करें","sessions":"सत्र","scenes":"दृश्य","seconds":"सेकंड","data issues":"डेटा मुद्दे","programme issues":"कार्यक्रम के मुद्दे","Scene":"दृश्य","px title type":"पीएक्स शीर्षक प्रकार","Every selected title completes its reveal. Longest wait:":"प्रत्येक चयनित शीर्षक अपना खुलासा पूरा करता है। सबसे लंबा इंतज़ार:","Revision:":"संशोधन:","Paused":"रुका हुआ","day":"दिन","track":"विषय","room":"सभागार","Reference time:":"संदर्भ समय:","Floating time":"तैरता हुआ समय","Programme revision:":"कार्यक्रम संशोधन:","Event time zone:":"घटना समय क्षेत्र:","Generated:":"उत्पन्न:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML में कार्यक्रम का समय शामिल है। बदलाव के बाद फिर से प्रकाशित करें। वीडियो एक रिकॉर्डिंग है।","A session needs more space. Use a taller screen or a closer reading distance.":"एक सत्र के लिए अधिक स्थान की आवश्यकता होती है. लंबी स्क्रीन या नज़दीकी पढ़ने की दूरी का उपयोग करें।","This session ends before its scene is shown. Choose fewer rooms per screen.":"यह सत्र इसके दृश्य दिखाए जाने से पहले समाप्त हो जाता है। प्रति स्क्रीन कम कमरे चुनें.","px room and time type":"पीएक्स रूम और समय प्रकार","Longest wait:":"सबसे लंबा इंतज़ार:","Select at least one session.":"कम से कम एक सत्र चुनें.","Fix the date and time issues before exporting these sessions.":"इन सत्रों को निर्यात करने से पहले दिनांक और समय की समस्याएँ ठीक करें।","No sessions match these filters.":"कोई भी सत्र इन फ़िल्टर से मेल नहीं खाता.","Starts in":"में शुरू होता है","minutes":"मिनट","Invalid end time":"अमान्य समाप्ति समय","Invalid date or time":"अमान्य दिनांक या समय","A session may span at most 31 days":"एक सत्र अधिकतम 31 दिनों का हो सकता है","This programme needs {seconds} seconds to show every title. Increase the export duration.":"इस प्रोग्राम को प्रत्येक शीर्षक दिखाने के लिए {seconds} सेकंड की आवश्यकता होती है। निर्यात अवधि बढ़ाएँ.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"पूरे कार्यक्रम के लिए {pages} पृष्ठों की आवश्यकता है। प्रत्येक सत्र को शामिल करने के लिए PDF, PowerPoint या HTML का उपयोग करें।"},"bn":{"Programme":"প্রোগ্রাম","Untitled session":"শিরোনামহীন অধিবেশন","Add to my calendar":"আমার ক্যালেন্ডার যোগ করুন","Local event time":"স্থানীয় ইভেন্ট সময়","Event local time":"ঘটনা স্থানীয় সময়","Rehearsal":"মহড়া","Snapshot":"স্ন্যাপশট","Check event time zone":"ইভেন্ট টাইম জোন চেক করুন","No sessions remain. Thank you for joining us.":"কোনো সেশন বাকি নেই। আমাদের সাথে যোগ দেওয়ার জন্য আপনাকে ধন্যবাদ.","Session website":"সেশন ওয়েবসাইট","Add session to calendar":"ক্যালেন্ডারে সেশন যোগ করুন","Close":"বন্ধ","Filter programme":"অনুষ্ঠানসূচি ফিল্টার করুন","Find a session or speaker":"একটি অধিবেশন বা স্পিকার খুঁজুন","Search sessions":"অনুসন্ধান সেশন","All days":"সব দিন","All tracks":"সব বিষয়","All rooms":"সব সভাকক্ষ","Reset filters":"ফিল্টার রিসেট করুন","Happening now":"এখন চলছে","Calendar: results":"ক্যালেন্ডার: ফলাফল","Calendar: all":"ক্যালেন্ডার: সব","Calendar: selected":"ক্যালেন্ডার: নির্বাচিত","Print":"প্রিন্ট","Play overview":"সারসংক্ষেপ চালান","Scenes and coverage":"দৃশ্য ও অন্তর্ভুক্ত বিষয়বস্তু","Preview scene":"পূর্বরূপ দৃশ্য","Programme playback":"অনুষ্ঠানসূচি চালানো","Pause":"বিরতি","Play":"চালান","Previous":"আগের","Next":"পরবর্তী","Full screen":"পূর্ণ পর্দা","Restart":"রিস্টার্ট করুন","Event programme":"ইভেন্ট প্রোগ্রাম","Programme. Space pauses; arrow keys change scene.":"প্রোগ্রাম। স্থান বিরতি; তীর কী দৃশ্য পরিবর্তন করে।","Programme paused. Press Space to resume.":"প্রোগ্রাম থামানো হয়েছে। পুনরায় শুরু করতে স্পেস টিপুন।","Programme playing. Press Space to pause.":"প্রোগ্রাম খেলা। বিরাম দিতে স্পেস টিপুন।","scheduled":"নির্ধারিত","rescheduled":"পুনঃনির্ধারিত","cancelled":"বাতিল","Invalid date":"অবৈধ তারিখ","Invalid end date":"অবৈধ শেষ তারিখ","Invalid start time":"অবৈধ শুরুর সময়","End must follow start; use End date for an overnight session":"শেষ অবশ্যই শুরু অনুসরণ করবে; রাতারাতি সেশনের জন্য শেষ তারিখ ব্যবহার করুন","End defaults to one hour after Start":"শুরুর এক ঘণ্টা পর ডিফল্ট শেষ করুন","Missing session title":"অনুপস্থিত অধিবেশন শিরোনাম","Duplicate Session ID":"ডুপ্লিকেট Session ID","Unknown time zone":"অজানা সময় অঞ্চল","Ambiguous time at daylight saving change":"দিবালোক সংরক্ষণ পরিবর্তন এ অস্পষ্ট সময়","Time does not exist at daylight saving change":"ডেলাইট সেভিং পরিবর্তনে সময় বিদ্যমান নেই","Room overlaps with":"সভাকক্ষের সময়ের সংঘাত:","Track overlaps with":"বিষয়ের সময়ের সংঘাত:","Speaker overlaps with":"বক্তার সময়ের সংঘাত:","Fix the date, time and session identity issues before exporting the programme.":"প্রোগ্রাম রপ্তানি করার আগে তারিখ, সময় এবং সেশনের পরিচয় সংক্রান্ত সমস্যাগুলি ঠিক করুন।","This programme could not be laid out. Check the dates and times in the table.":"এই কর্মসূচী স্থাপন করা যায়নি. টেবিলে তারিখ এবং সময় পরীক্ষা করুন।","Unknown time zone - the calendar file keeps floating times.":"অজানা সময় অঞ্চল - ক্যালেন্ডার ফাইলটি ভাসমান সময় রাখে।","Set a reference time before exporting a rehearsal.":"রিহার্সাল এক্সপোর্ট করার আগে একটি রেফারেন্স সময় সেট করুন।","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"একটি অধিবেশন এই পৃষ্ঠার জন্য খুব দীর্ঘ. পৃষ্ঠার আকার বাড়ান বা একটি ইন্টারেক্টিভ HTML পৃষ্ঠা বেছে নিন।","An event kit supports at most 32 rooms. Filter the programme before exporting.":"একটি ইভেন্ট কিট সর্বাধিক 32টি কক্ষ সমর্থন করে। এক্সপোর্ট করার আগে প্রোগ্রামটি ফিল্টার করুন।","Row":"সারি","Select":"নির্বাচন করুন","sessions":"সেশন","scenes":"দৃশ্য","seconds":"সেকেন্ড","data issues":"তথ্য সমস্যা","programme issues":"প্রোগ্রাম সমস্যা","Scene":"দৃশ্য","px title type":"px শিরোনামের প্রকার","Every selected title completes its reveal. Longest wait:":"প্রতিটি নির্বাচিত শিরোনাম তার প্রকাশ সম্পূর্ণ করে। দীর্ঘতম অপেক্ষা:","Revision:":"পুনর্বিবেচনা:","Paused":"বিরতি দেওয়া হয়েছে","day":"দিন","track":"বিষয়","room":"সভাকক্ষ","Reference time:":"রেফারেন্স সময়:","Floating time":"ভাসমান সময়","Programme revision:":"প্রোগ্রাম পুনর্বিবেচনা:","Event time zone:":"ইভেন্টের সময় অঞ্চল:","Generated:":"উৎপন্ন:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML-এ অনুষ্ঠানসূচি অন্তর্ভুক্ত আছে। পরিবর্তনের পরে আবার প্রকাশ করুন। ভিডিওটি একটি রেকর্ডিং।","A session needs more space. Use a taller screen or a closer reading distance.":"একটি অধিবেশন আরো স্থান প্রয়োজন. একটি লম্বা পর্দা বা একটি কাছাকাছি পড়ার দূরত্ব ব্যবহার করুন.","This session ends before its scene is shown. Choose fewer rooms per screen.":"এই সেশনটি এর দৃশ্য দেখানোর আগেই শেষ হয়ে যায়। প্রতি স্ক্রিনে কম রুম বেছে নিন।","px room and time type":"px রুম এবং সময়ের ধরন","Longest wait:":"দীর্ঘতম অপেক্ষা:","Select at least one session.":"অন্তত একটি অধিবেশন নির্বাচন করুন.","Fix the date and time issues before exporting these sessions.":"এই সেশনগুলি রপ্তানি করার আগে তারিখ এবং সময়ের সমস্যাগুলি ঠিক করুন৷","No sessions match these filters.":"কোন সেশন এই ফিল্টার মেলে না.","Starts in":"শুরু হয়","minutes":"মিনিট","Invalid end time":"অবৈধ শেষ সময়","Invalid date or time":"অবৈধ তারিখ বা সময়","A session may span at most 31 days":"একটি অধিবেশন সর্বাধিক 31 দিনের মধ্যে থাকতে পারে","This programme needs {seconds} seconds to show every title. Increase the export duration.":"প্রতিটি শিরোনাম দেখানোর জন্য এই প্রোগ্রামটির প্রয়োজন {seconds} সেকেন্ড। রপ্তানির সময়কাল বাড়ান।","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"সম্পূর্ণ প্রোগ্রামের জন্য প্রয়োজন {pages} পৃষ্ঠা। প্রতিটি সেশন অন্তর্ভুক্ত করতে PDF, PowerPoint বা HTML ব্যবহার করুন।"},"ur":{"Programme":"پروگرام","Untitled session":"بلا عنوان سیشن","Add to my calendar":"میرے کیلنڈر میں شامل کریں۔","Local event time":"مقامی تقریب کا وقت","Event local time":"واقعہ مقامی وقت کے مطابق","Rehearsal":"ریہرسل","Snapshot":"سنیپ شاٹ","Check event time zone":"ایونٹ کا ٹائم زون چیک کریں۔","No sessions remain. Thank you for joining us.":"کوئی سیشن باقی نہیں رہا۔ ہمارے ساتھ شامل ہونے کا شکریہ۔","Session website":"سیشن کی ویب سائٹ","Add session to calendar":"کیلنڈر میں سیشن شامل کریں۔","Close":"بند","Filter programme":"پروگرام فلٹر کریں","Find a session or speaker":"ایک سیشن یا اسپیکر تلاش کریں۔","Search sessions":"سیشن تلاش کریں۔","All days":"سارے دن","All tracks":"تمام موضوعات","All rooms":"تمام ہال","Reset filters":"فلٹرز کو دوبارہ ترتیب دیں۔","Happening now":"ابھی جاری ہے","Calendar: results":"کیلنڈر: نتائج","Calendar: all":"کیلنڈر: تمام","Calendar: selected":"کیلنڈر: منتخب","Print":"پرنٹ","Play overview":"خلاصہ چلائیں","Scenes and coverage":"مناظر اور شامل مواد","Preview scene":"پیش نظارہ منظر","Programme playback":"پروگرام چلانا","Pause":"توقف","Play":"چلائیں","Previous":"پچھلا","Next":"اگلا","Full screen":"فل سکرین","Restart":"دوبارہ شروع کریں۔","Event programme":"تقریب کا پروگرام","Programme. Space pauses; arrow keys change scene.":"پروگرام۔ خلائی وقفہ؛ تیر والی چابیاں منظر کو تبدیل کرتی ہیں۔","Programme paused. Press Space to resume.":"پروگرام روک دیا گیا۔ دوبارہ شروع کرنے کے لیے اسپیس کو دبائیں۔","Programme playing. Press Space to pause.":"پروگرام چل رہا ہے۔ روکنے کے لیے اسپیس دبائیں۔","scheduled":"شیڈول","rescheduled":"دوبارہ شیڈول","cancelled":"منسوخ","Invalid date":"غلط تاریخ","Invalid end date":"غلط اختتامی تاریخ","Invalid start time":"غلط آغاز کا وقت","End must follow start; use End date for an overnight session":"اختتام کو شروع کی پیروی کرنا چاہیے؛ رات بھر کے سیشن کے لیے اختتامی تاریخ کا استعمال کریں۔","End defaults to one hour after Start":"شروع ہونے کے ایک گھنٹے بعد ڈیفالٹس ختم کریں۔","Missing session title":"سیشن کا عنوان غائب ہے۔","Duplicate Session ID":"ڈپلیکیٹ Session ID","Unknown time zone":"نامعلوم ٹائم زون","Ambiguous time at daylight saving change":"دن کی روشنی کی بچت میں مبہم وقت","Time does not exist at daylight saving change":"دن کی روشنی کی بچت کی تبدیلی میں وقت موجود نہیں ہے۔","Room overlaps with":"ہال کا وقت اس سے متصادم ہے:","Track overlaps with":"موضوع کا وقت اس سے متصادم ہے:","Speaker overlaps with":"مقرر کا وقت اس سے متصادم ہے:","Fix the date, time and session identity issues before exporting the programme.":"پروگرام کو برآمد کرنے سے پہلے تاریخ، وقت اور سیشن کی شناخت کے مسائل کو درست کریں۔","This programme could not be laid out. Check the dates and times in the table.":"یہ پروگرام ترتیب نہیں دیا جا سکا۔ ٹیبل میں تاریخوں اور اوقات کو چیک کریں۔","Unknown time zone - the calendar file keeps floating times.":"نامعلوم ٹائم زون - کیلنڈر فائل تیرتے وقت کو برقرار رکھتی ہے۔","Set a reference time before exporting a rehearsal.":"ریہرسل برآمد کرنے سے پہلے حوالہ کا وقت مقرر کریں۔","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"اس صفحہ کے لیے ایک سیشن بہت طویل ہے۔ صفحہ کا سائز بڑھائیں یا ایک انٹرایکٹو HTML صفحہ منتخب کریں۔","An event kit supports at most 32 rooms. Filter the programme before exporting.":"ایک ایونٹ کٹ زیادہ سے زیادہ 32 کمروں کو سپورٹ کرتی ہے۔ ایکسپورٹ کرنے سے پہلے پروگرام کو فلٹر کریں۔","Row":"قطار","Select":"منتخب کریں۔","sessions":"سیشن","scenes":"مناظر","seconds":"سیکنڈ","data issues":"ڈیٹا کے مسائل","programme issues":"پروگرام کے مسائل","Scene":"منظر","px title type":"px عنوان کی قسم","Every selected title completes its reveal. Longest wait:":"ہر منتخب عنوان اپنا انکشاف مکمل کرتا ہے۔ طویل ترین انتظار:","Revision:":"نظر ثانی:","Paused":"روک دیا گیا","day":"دن","track":"موضوع","room":"ہال","Reference time:":"حوالہ وقت:","Floating time":"تیرتا ہوا وقت","Programme revision:":"پروگرام پر نظر ثانی:","Event time zone:":"ایونٹ ٹائم زون:","Generated:":"تیار کردہ:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML میں شیڈول شامل ہے۔ تبدیلیوں کے بعد دوبارہ شائع کریں۔ ویڈیو ایک ریکارڈنگ ہے۔","A session needs more space. Use a taller screen or a closer reading distance.":"ایک سیشن کو زیادہ جگہ کی ضرورت ہوتی ہے۔ ایک لمبی اسکرین یا قریب سے پڑھنے کا فاصلہ استعمال کریں۔","This session ends before its scene is shown. Choose fewer rooms per screen.":"یہ سیشن اس کا منظر دکھانے سے پہلے ختم ہو جاتا ہے۔ فی اسکرین کم کمرے منتخب کریں۔","px room and time type":"px روم اور وقت کی قسم","Longest wait:":"طویل ترین انتظار:","Select at least one session.":"کم از کم ایک سیشن منتخب کریں۔","Fix the date and time issues before exporting these sessions.":"ان سیشنز کو ایکسپورٹ کرنے سے پہلے تاریخ اور وقت کے مسائل کو ٹھیک کریں۔","No sessions match these filters.":"کوئی سیشن ان فلٹرز سے مماثل نہیں ہے۔","Starts in":"میں شروع ہوتا ہے۔","minutes":"منٹ","Invalid end time":"غلط اختتامی وقت","Invalid date or time":"غلط تاریخ یا وقت","A session may span at most 31 days":"ایک سیشن زیادہ سے زیادہ 31 دن پر محیط ہو سکتا ہے۔","This programme needs {seconds} seconds to show every title. Increase the export duration.":"اس پروگرام کو ہر عنوان دکھانے کے لیے {seconds} سیکنڈز درکار ہیں۔ برآمد کی مدت میں اضافہ کریں۔","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"مکمل پروگرام کے لیے {pages} صفحات درکار ہیں۔ ہر سیشن کو شامل کرنے کے لیے PDF، PowerPoint یا HTML استعمال کریں۔"},"id":{"Programme":"Program","Untitled session":"Sesi tanpa judul","Add to my calendar":"Tambahkan ke kalender saya","Local event time":"Waktu acara lokal","Event local time":"Acara waktu setempat","Rehearsal":"Latihan","Snapshot":"Cuplikan","Check event time zone":"Periksa zona waktu acara","No sessions remain. Thank you for joining us.":"Tidak ada sesi yang tersisa. Terima kasih telah bergabung dengan kami.","Session website":"Situs web sesi","Add session to calendar":"Tambahkan sesi ke kalender","Close":"Tutup","Filter programme":"Filter program","Find a session or speaker":"Temukan sesi atau pembicara","Search sessions":"Sesi pencarian","All days":"Sepanjang hari","All tracks":"Semua tema","All rooms":"Semua ruang acara","Reset filters":"Setel ulang filter","Happening now":"Sedang berlangsung","Calendar: results":"Kalender: hasil","Calendar: all":"Kalender: semuanya","Calendar: selected":"Kalender: dipilih","Print":"Cetak","Play overview":"Putar ikhtisar","Scenes and coverage":"Adegan dan konten yang disertakan","Preview scene":"Pratinjau adegan","Programme playback":"Pemutaran program","Pause":"Jeda","Play":"Putar","Previous":"Sebelumnya","Next":"Selanjutnya","Full screen":"Layar penuh","Restart":"Mulai ulang","Event programme":"Program acara","Programme. Space pauses; arrow keys change scene.":"Program. Jeda spasi; tombol panah mengubah adegan.","Programme paused. Press Space to resume.":"Program dijeda. Tekan Spasi untuk melanjutkan.","Programme playing. Press Space to pause.":"Pemutaran program. Tekan Spasi untuk menjeda.","scheduled":"dijadwalkan","rescheduled":"dijadwalkan ulang","cancelled":"dibatalkan","Invalid date":"Tanggal tidak valid","Invalid end date":"Tanggal akhir tidak valid","Invalid start time":"Waktu mulai tidak valid","End must follow start; use End date for an overnight session":"Akhir harus mengikuti awal; gunakan Tanggal akhir untuk sesi semalam","End defaults to one hour after Start":"Akhiri defaultnya adalah satu jam setelah Mulai","Missing session title":"Judul sesi tidak ada","Duplicate Session ID":"Duplikat Session ID","Unknown time zone":"Zona waktu tidak diketahui","Ambiguous time at daylight saving change":"Waktu yang ambigu pada perubahan musim panas","Time does not exist at daylight saving change":"Waktu tidak ada pada pergantian musim panas","Room overlaps with":"Jadwal ruang bertabrakan dengan","Track overlaps with":"Jadwal tema bertabrakan dengan","Speaker overlaps with":"Jadwal pembicara bertabrakan dengan","Fix the date, time and session identity issues before exporting the programme.":"Perbaiki masalah tanggal, waktu dan identitas sesi sebelum mengekspor program.","This programme could not be laid out. Check the dates and times in the table.":"Program ini tidak dapat ditata. Periksa tanggal dan waktu di tabel.","Unknown time zone - the calendar file keeps floating times.":"Zona waktu tidak diketahui - file kalender menyimpan waktu mengambang.","Set a reference time before exporting a rehearsal.":"Tetapkan waktu referensi sebelum mengekspor latihan.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Sesi terlalu lama untuk halaman ini. Tingkatkan ukuran halaman atau pilih halaman HTML yang interaktif.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Kit acara mendukung maksimal 32 ruangan. Filter program sebelum mengekspor.","Row":"Baris","Select":"Pilih","sessions":"sesi","scenes":"adegan","seconds":"detik","data issues":"masalah data","programme issues":"masalah program","Scene":"Adegan","px title type":"jenis judul px","Every selected title completes its reveal. Longest wait:":"Setiap judul yang dipilih melengkapi pengungkapannya. Penantian terlama:","Revision:":"Revisi:","Paused":"Dijeda","day":"hari","track":"tema","room":"ruang acara","Reference time:":"Waktu referensi:","Floating time":"Waktu mengambang","Programme revision:":"Revisi program:","Event time zone:":"Zona waktu acara:","Generated:":"Dihasilkan:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML berisi jadwal tertanam. Terbitkan ulang setelah perubahan. Video merupakan rekaman.","A session needs more space. Use a taller screen or a closer reading distance.":"Sesi membutuhkan lebih banyak ruang. Gunakan layar yang lebih tinggi atau jarak membaca yang lebih dekat.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Sesi ini berakhir sebelum adegannya ditampilkan. Pilih lebih sedikit ruangan per layar.","px room and time type":"ruang px dan tipe waktu","Longest wait:":"Penantian terlama:","Select at least one session.":"Pilih setidaknya satu sesi.","Fix the date and time issues before exporting these sessions.":"Perbaiki masalah tanggal dan waktu sebelum mengekspor sesi ini.","No sessions match these filters.":"Tidak ada sesi yang cocok dengan filter ini.","Starts in":"Mulai masuk","minutes":"menit","Invalid end time":"Waktu berakhir tidak valid","Invalid date or time":"Tanggal atau waktu tidak valid","A session may span at most 31 days":"Satu sesi dapat berlangsung paling lama 31 hari","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Program ini memerlukan {seconds} detik untuk menampilkan setiap judul. Tingkatkan durasi ekspor.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Program lengkapnya membutuhkan {pages} halaman. Gunakan PDF, PowerPoint atau HTML untuk menyertakan setiap sesi."},"ar":{"Programme":"البرنامج","Untitled session":"جلسة بلا عنوان","Add to my calendar":"أضف إلى التقويم الخاص بي","Local event time":"وقت الحدث المحلي","Event local time":"الحدث بالتوقيت المحلي","Rehearsal":"بروفة","Snapshot":"لقطة","Check event time zone":"تحقق من المنطقة الزمنية للحدث","No sessions remain. Thank you for joining us.":"لا تبقى جلسات. شكرا لانضمامك إلينا.","Session website":"موقع الجلسة","Add session to calendar":"إضافة جلسة إلى التقويم","Close":"إغلاق","Filter programme":"تصفية البرنامج","Find a session or speaker":"ابحث عن جلسة أو متحدث","Search sessions":"جلسات البحث","All days":"كل الأيام","All tracks":"جميع المحاور","All rooms":"جميع القاعات","Reset filters":"إعادة تعيين المرشحات","Happening now":"جارٍ الآن","Calendar: results":"التقويم: النتائج","Calendar: all":"التقويم: الكل","Calendar: selected":"التقويم: محدد","Print":"طباعة","Play overview":"تشغيل النظرة العامة","Scenes and coverage":"المشاهد والمحتوى المشمول","Preview scene":"معاينة المشهد","Programme playback":"تشغيل البرنامج","Pause":"وقفة","Play":"تشغيل","Previous":"السابق","Next":"التالي","Full screen":"شاشة كاملة","Restart":"إعادة التشغيل","Event programme":"برنامج الحدث","Programme. Space pauses; arrow keys change scene.":"البرنامج. توقف الفضاء. مفاتيح الأسهم تغير المشهد.","Programme paused. Press Space to resume.":"توقف البرنامج مؤقتا. الصحافة الفضاء لاستئناف.","Programme playing. Press Space to pause.":"تشغيل البرنامج. اضغط على مسافة للتوقف مؤقتًا.","scheduled":"المقرر","rescheduled":"إعادة جدولة","cancelled":"تم الإلغاء","Invalid date":"تاريخ غير صالح","Invalid end date":"تاريخ الانتهاء غير صالح","Invalid start time":"وقت البدء غير صالح","End must follow start; use End date for an overnight session":"النهاية يجب أن تتبع البداية؛ استخدم تاريخ الانتهاء لجلسة ليلية","End defaults to one hour after Start":"إنهاء الإعدادات الافتراضية بعد ساعة واحدة من البدء","Missing session title":"عنوان الجلسة مفقود","Duplicate Session ID":"مكررة Session ID","Unknown time zone":"منطقة زمنية غير معروفة","Ambiguous time at daylight saving change":"وقت غامض في تغيير التوقيت الصيفي","Time does not exist at daylight saving change":"الوقت غير موجود عند تغيير التوقيت الصيفي","Room overlaps with":"يتعارض حجز القاعة مع","Track overlaps with":"يتعارض توقيت المحور مع","Speaker overlaps with":"يتعارض جدول المتحدث مع","Fix the date, time and session identity issues before exporting the programme.":"أصلح مشاكل التاريخ والوقت وهوية الجلسة قبل تصدير البرنامج.","This programme could not be laid out. Check the dates and times in the table.":"لا يمكن وضع هذا البرنامج. تحقق من التواريخ والأوقات في الجدول.","Unknown time zone - the calendar file keeps floating times.":"منطقة زمنية غير معروفة - يحتفظ ملف التقويم بالأوقات العائمة.","Set a reference time before exporting a rehearsal.":"قم بتعيين وقت مرجعي قبل تصدير البروفة.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"الجلسة طويلة جدًا بالنسبة لهذه الصفحة. قم بزيادة حجم الصفحة أو اختر صفحة HTML تفاعلية.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"تدعم مجموعة الأحداث 32 غرفة على الأكثر. تصفية البرنامج قبل التصدير.","Row":"صف","Select":"اختر","sessions":"جلسات","scenes":"مشاهد","seconds":"ثواني","data issues":"قضايا البيانات","programme issues":"قضايا البرنامج","Scene":"المشهد","px title type":"نوع العنوان بيكسل","Every selected title completes its reveal. Longest wait:":"كل عنوان محدد يكمل الكشف عنه. أطول انتظار:","Revision:":"المراجعة:","Paused":"متوقف مؤقتًا","day":"يوم","track":"محور","room":"قاعة","Reference time:":"الوقت المرجعي:","Floating time":"الوقت العائم","Programme revision:":"مراجعة البرنامج:","Event time zone:":"المنطقة الزمنية للحدث:","Generated:":"تم إنشاؤها:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"يتضمن ملف HTML جدول الفعاليات. أعد نشره بعد التغييرات. الفيديو تسجيل مسبق.","A session needs more space. Use a taller screen or a closer reading distance.":"تحتاج الجلسة إلى مساحة أكبر. استخدم شاشة أطول أو مسافة قراءة أقرب.","This session ends before its scene is shown. Choose fewer rooms per screen.":"تنتهي هذه الجلسة قبل عرض مشهدها. اختر عددًا أقل من الغرف لكل شاشة.","px room and time type":"غرفة px ونوع الوقت","Longest wait:":"أطول انتظار:","Select at least one session.":"حدد جلسة واحدة على الأقل.","Fix the date and time issues before exporting these sessions.":"أصلح مشكلات التاريخ والوقت قبل تصدير هذه الجلسات.","No sessions match these filters.":"لا توجد جلسات تتطابق مع عوامل التصفية هذه.","Starts in":"يبدأ في","minutes":"دقائق","Invalid end time":"وقت الانتهاء غير صالح","Invalid date or time":"التاريخ أو الوقت غير صالح","A session may span at most 31 days":"قد تمتد الجلسة لمدة 31 يومًا على الأكثر","This programme needs {seconds} seconds to show every title. Increase the export duration.":"يحتاج هذا البرنامج إلى {seconds} ثانية لإظهار كل عنوان. زيادة مدة التصدير.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"البرنامج كامل يحتاج إلى {pages} صفحة. استخدم PDF أو PowerPoint أو HTML لتشمل كل جلسة."},"it":{"Programme":"Programma","Untitled session":"Sessione senza titolo","Add to my calendar":"Aggiungi al mio calendario","Local event time":"Orario dell'evento locale","Event local time":"Ora locale dell'evento","Rehearsal":"Prove","Snapshot":"Istantanea","Check event time zone":"Controlla il fuso orario dell'evento","No sessions remain. Thank you for joining us.":"Non rimangono sessioni. Grazie per esserti unito a noi.","Session website":"Sito web della sessione","Add session to calendar":"Aggiungi sessione al calendario","Close":"Chiudi","Filter programme":"Filtra il programma","Find a session or speaker":"Trova una sessione o un relatore","Search sessions":"Sessioni di ricerca","All days":"Tutti i giorni","All tracks":"Tutti i temi","All rooms":"Tutte le sale","Reset filters":"Reimposta i filtri","Happening now":"In corso","Calendar: results":"Calendario: risultati","Calendar: all":"Calendario: tutto","Calendar: selected":"Calendario: selezionato","Print":"Stampa","Play overview":"Riproduci la panoramica","Scenes and coverage":"Scene e contenuti inclusi","Preview scene":"Anteprima della scena","Programme playback":"Riproduzione del programma","Pause":"Pausa","Play":"Riproduci","Previous":"Precedente","Next":"Avanti","Full screen":"Schermo intero","Restart":"Ricominciare","Event programme":"Programma dell'evento","Programme. Space pauses; arrow keys change scene.":"Programma. Lo spazio fa una pausa; i tasti freccia cambiano scena.","Programme paused. Press Space to resume.":"Programma in pausa. Premi la barra spaziatrice per riprendere.","Programme playing. Press Space to pause.":"Programma in riproduzione. Premi la barra spaziatrice per mettere in pausa.","scheduled":"programmato","rescheduled":"riprogrammato","cancelled":"annullato","Invalid date":"Data non valida","Invalid end date":"Data di fine non valida","Invalid start time":"Orario di inizio non valido","End must follow start; use End date for an overnight session":"La fine deve seguire l'inizio; utilizzare la data di fine per una sessione notturna","End defaults to one hour after Start":"Per impostazione predefinita, la fine è un'ora dopo l'inizio","Missing session title":"Titolo della sessione mancante","Duplicate Session ID":"Duplicato Session ID","Unknown time zone":"Fuso orario sconosciuto","Ambiguous time at daylight saving change":"Ora ambigua al cambio dell'ora legale","Time does not exist at daylight saving change":"L'ora non esiste al cambio dell'ora legale","Room overlaps with":"L’occupazione della sala si sovrappone a","Track overlaps with":"L’orario del tema si sovrappone a","Speaker overlaps with":"L’orario del relatore si sovrappone a","Fix the date, time and session identity issues before exporting the programme.":"Risolvi i problemi di data, ora e identità della sessione prima di esportare il programma.","This programme could not be laid out. Check the dates and times in the table.":"Non è stato possibile strutturare questo programma. Controlla le date e gli orari nella tabella.","Unknown time zone - the calendar file keeps floating times.":"Fuso orario sconosciuto: il file del calendario mantiene gli orari fluttuanti.","Set a reference time before exporting a rehearsal.":"Imposta un orario di riferimento prima di esportare una prova.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Una sessione è troppo lunga per questa pagina. Aumenta le dimensioni della pagina o scegli una pagina HTML interattiva.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Un kit per eventi supporta al massimo 32 stanze. Filtrare il programma prima di esportarlo.","Row":"Riga","Select":"Seleziona","sessions":"sessioni","scenes":"scene","seconds":"secondi","data issues":"problemi relativi ai dati","programme issues":"questioni relative al programma","Scene":"Scena","px title type":"tipo di titolo px","Every selected title completes its reveal. Longest wait:":"Ogni titolo selezionato completa la sua rivelazione. Attesa più lunga:","Revision:":"Revisione:","Paused":"In pausa","day":"giorno","track":"tema","room":"sala","Reference time:":"Orario di riferimento:","Floating time":"Tempo fluttuante","Programme revision:":"Revisione del programma:","Event time zone:":"Fuso orario dell'evento:","Generated:":"generato:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"Il file HTML contiene il programma incorporato. Pubblicalo di nuovo dopo le modifiche. Il video è una registrazione.","A session needs more space. Use a taller screen or a closer reading distance.":"Una sessione ha bisogno di più spazio. Utilizza uno schermo più alto o una distanza di lettura più ravvicinata.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Questa sessione termina prima che venga mostrata la scena. Scegli meno stanze per schermo.","px room and time type":"px stanza e tipo di orario","Longest wait:":"Attesa più lunga:","Select at least one session.":"Seleziona almeno una sessione.","Fix the date and time issues before exporting these sessions.":"Risolvi i problemi di data e ora prima di esportare queste sessioni.","No sessions match these filters.":"Nessuna sessione corrisponde a questi filtri.","Starts in":"Inizia tra","minutes":"minuti","Invalid end time":"Ora di fine non valida","Invalid date or time":"Data o ora non valida","A session may span at most 31 days":"Una sessione può durare al massimo 31 giorni","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Questo programma necessita di {seconds} secondi per mostrare ogni titolo. Aumentare la durata dell'esportazione.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Il programma completo richiede {pages} pagine. Usa PDF, PowerPoint o HTML per includere ogni sessione."},"no":{"Programme":"Program","Untitled session":"Økt uten tittel","Add to my calendar":"Legg til i kalenderen min","Local event time":"Lokalt arrangementstid","Event local time":"Arrangement lokal tid","Rehearsal":"Øving","Snapshot":"Øyeblikksbilde","Check event time zone":"Sjekk hendelsens tidssone","No sessions remain. Thank you for joining us.":"Ingen økter gjenstår. Takk for at du ble med oss.","Session website":"Sesjons nettsted","Add session to calendar":"Legg til økt i kalenderen","Close":"Lukk","Filter programme":"Filtrer program","Find a session or speaker":"Finn en økt eller foredragsholder","Search sessions":"Søk etter økter","All days":"Alle dager","All tracks":"Alle temaer","All rooms":"Alle saler","Reset filters":"Tilbakestill filtre","Happening now":"Pågår nå","Calendar: results":"Kalender: resultater","Calendar: all":"Kalender: alle","Calendar: selected":"Kalender: valgt","Print":"Skriv ut","Play overview":"Spill av oversikt","Scenes and coverage":"Scener og inkludert innhold","Preview scene":"Forhåndsvisning av scene","Programme playback":"Avspilling av program","Pause":"Pause","Play":"Spill av","Previous":"Forrige","Next":"Neste","Full screen":"Fullskjerm","Restart":"Start på nytt","Event programme":"Arrangementsprogram","Programme. Space pauses; arrow keys change scene.":"Program. Plass pauser; piltastene endre scene.","Programme paused. Press Space to resume.":"Program satt på pause. Trykk mellomrom for å fortsette.","Programme playing. Press Space to pause.":"Programavspilling. Trykk mellomrom for å pause.","scheduled":"planlagt","rescheduled":"omlagt","cancelled":"kansellert","Invalid date":"Ugyldig dato","Invalid end date":"Ugyldig sluttdato","Invalid start time":"Ugyldig starttid","End must follow start; use End date for an overnight session":"Slutt må følge start; bruk sluttdato for en økt over natten","End defaults to one hour after Start":"Slutt er som standard en time etter Start","Missing session title":"Mangler økttittel","Duplicate Session ID":"Duplikat Session ID","Unknown time zone":"Ukjent tidssone","Ambiguous time at daylight saving change":"Tvetydig tid ved sommertid endring","Time does not exist at daylight saving change":"Tid eksisterer ikke ved sommertidskifte","Room overlaps with":"Bestillingen av salen overlapper med","Track overlaps with":"Tidspunktet for temaet overlapper med","Speaker overlaps with":"Foredragsholderens tidsplan overlapper med","Fix the date, time and session identity issues before exporting the programme.":"Løs problemer med dato, klokkeslett og øktidentitet før du eksporterer programmet.","This programme could not be laid out. Check the dates and times in the table.":"Dette programmet kunne ikke legges ut. Sjekk datoer og klokkeslett i tabellen.","Unknown time zone - the calendar file keeps floating times.":"Ukjent tidssone - kalenderfilen holder flytende tider.","Set a reference time before exporting a rehearsal.":"Angi en referansetid før du eksporterer en øving.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"En økt er for lang for denne siden. Øk sidestørrelsen eller velg en interaktiv HTML-side.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Et eventsett støtter maksimalt 32 rom. Filtrer programmet før eksport.","Row":"Rad","Select":"Velg","sessions":"økter","scenes":"scener","seconds":"sekunder","data issues":"dataproblemer","programme issues":"programproblemer","Scene":"Scene","px title type":"px titteltype","Every selected title completes its reveal. Longest wait:":"Hver valgt tittel fullfører sin avsløring. Lengste ventetid:","Revision:":"Revisjon:","Paused":"Pause","day":"dag","track":"tema","room":"sal","Reference time:":"Referansetid:","Floating time":"Flytende tid","Programme revision:":"Programrevisjon:","Event time zone:":"Tidssone for hendelsen:","Generated:":"Generert:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML-filen inneholder et innebygd program. Publiser på nytt etter endringer. Videoen er et opptak.","A session needs more space. Use a taller screen or a closer reading distance.":"En økt trenger mer plass. Bruk en høyere skjerm eller en nærmere leseavstand.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Denne økten avsluttes før scenen vises. Velg færre rom per skjerm.","px room and time type":"px rom og tidstype","Longest wait:":"Lengste ventetid:","Select at least one session.":"Velg minst én økt.","Fix the date and time issues before exporting these sessions.":"Fiks dato- og klokkeslettproblemene før du eksporterer disse øktene.","No sessions match these filters.":"Ingen økter samsvarer med disse filtrene.","Starts in":"Starter inn","minutes":"minutter","Invalid end time":"Ugyldig sluttid","Invalid date or time":"Ugyldig dato eller klokkeslett","A session may span at most 31 days":"En økt kan vare over 31 dager","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Dette programmet trenger {seconds} sekunder for å vise hver tittel. Øk eksportvarigheten.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Hele programmet trenger {pages} sider. Bruk PDF, PowerPoint eller HTML for å inkludere hver økt."},"ko":{"Programme":"프로그램","Untitled session":"제목 없는 세션","Add to my calendar":"내 캘린더에 추가","Local event time":"현지 이벤트 시간","Event local time":"이벤트 현지 시간","Rehearsal":"리허설","Snapshot":"스냅샷","Check event time zone":"이벤트 시간대 확인","No sessions remain. Thank you for joining us.":"남은 세션이 없습니다. 우리와 함께해주셔서 감사합니다.","Session website":"세션 웹사이트","Add session to calendar":"캘린더에 세션 추가","Close":"닫기","Filter programme":"프로그램 필터링","Find a session or speaker":"세션 또는 발표자 찾기","Search sessions":"세션 검색","All days":"하루 종일","All tracks":"모든 주제","All rooms":"모든 행사장","Reset filters":"필터 재설정","Happening now":"진행 중","Calendar: results":"달력: 결과","Calendar: all":"달력: 모두","Calendar: selected":"달력: 선택됨","Print":"인쇄","Play overview":"개요 재생","Scenes and coverage":"장면 및 포함된 내용","Preview scene":"미리보기 장면","Programme playback":"프로그램 재생","Pause":"일시중지","Play":"재생","Previous":"이전","Next":"다음","Full screen":"전체 화면","Restart":"다시 시작","Event programme":"이벤트 프로그램","Programme. Space pauses; arrow keys change scene.":"프로그램. 공간이 잠시 멈춥니다. 화살표 키는 장면을 변경합니다.","Programme paused. Press Space to resume.":"프로그램이 일시중지되었습니다. 재개하려면 스페이스바를 누르세요.","Programme playing. Press Space to pause.":"프로그램 재생. 일시중지하려면 스페이스바를 누르세요.","scheduled":"예정된","rescheduled":"일정이 변경됨","cancelled":"취소됨","Invalid date":"잘못된 날짜","Invalid end date":"잘못된 종료 날짜","Invalid start time":"잘못된 시작 시간","End must follow start; use End date for an overnight session":"끝은 시작을 따라야 합니다. 야간 세션에는 종료 날짜를 사용하세요.","End defaults to one hour after Start":"종료는 시작 후 1시간으로 기본 설정됩니다.","Missing session title":"세션 제목이 누락되었습니다.","Duplicate Session ID":"중복 Session ID","Unknown time zone":"알 수 없는 시간대","Ambiguous time at daylight saving change":"일광 절약 시간 변경 시 모호한 시간","Time does not exist at daylight saving change":"일광 절약 시간제 변경 시 시간이 존재하지 않습니다.","Room overlaps with":"행사장 일정 겹침:","Track overlaps with":"주제 일정 겹침:","Speaker overlaps with":"발표자 일정 겹침:","Fix the date, time and session identity issues before exporting the programme.":"프로그램을 내보내기 전에 날짜, 시간 및 세션 ID 문제를 수정하세요.","This programme could not be laid out. Check the dates and times in the table.":"이 프로그램을 배치할 수 없습니다. 표에서 날짜와 시간을 확인하세요.","Unknown time zone - the calendar file keeps floating times.":"알 수 없는 시간대 - 달력 파일이 부동 시간을 유지합니다.","Set a reference time before exporting a rehearsal.":"리허설을 내보내기 전에 참조 시간을 설정하세요.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"이 페이지의 세션이 너무 깁니다. 페이지 크기를 늘리거나 대화형 HTML 페이지를 선택하세요.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"이벤트 키트는 최대 32개의 회의실을 지원합니다. 내보내기 전에 프로그램을 필터링하세요.","Row":"열","Select":"선택","sessions":"세션","scenes":"장면","seconds":"초","data issues":"데이터 문제","programme issues":"프로그램 문제","Scene":"장면","px title type":"px 제목 유형","Every selected title completes its reveal. Longest wait:":"선택한 모든 타이틀이 공개를 완료합니다. 가장 오래 기다리는 시간:","Revision:":"개정:","Paused":"일시중지됨","day":"일","track":"주제","room":"행사장","Reference time:":"참고 시간:","Floating time":"부동 시간","Programme revision:":"프로그램 개정:","Event time zone:":"이벤트 시간대:","Generated:":"생성됨:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML에 일정이 포함되어 있습니다. 변경 후 다시 게시하세요. 동영상은 녹화본입니다.","A session needs more space. Use a taller screen or a closer reading distance.":"세션에는 더 많은 공간이 필요합니다. 더 큰 화면을 사용하거나 더 가까운 독서 거리를 사용하세요.","This session ends before its scene is shown. Choose fewer rooms per screen.":"이 세션은 장면이 표시되기 전에 종료됩니다. 화면당 더 적은 수의 방을 선택하세요.","px room and time type":"px 방과 시간 유형","Longest wait:":"가장 오래 기다리는 시간:","Select at least one session.":"세션을 하나 이상 선택하세요.","Fix the date and time issues before exporting these sessions.":"세션을 내보내기 전에 날짜 및 시간 문제를 해결하세요.","No sessions match these filters.":"이 필터와 일치하는 세션이 없습니다.","Starts in":"시작 날짜","minutes":"분","Invalid end time":"잘못된 종료 시간","Invalid date or time":"잘못된 날짜 또는 시간","A session may span at most 31 days":"세션은 최대 31일까지 지속될 수 있습니다.","This programme needs {seconds} seconds to show every title. Increase the export duration.":"이 프로그램은 모든 제목을 표시하는 데 {seconds}초가 필요합니다. 내보내기 기간을 늘립니다.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"전체 프로그램에는 {pages} 페이지가 필요합니다. 모든 세션을 포함하려면 PDF, PowerPoint 또는 HTML를 사용하세요."},"bg":{"Programme":"програма","Untitled session":"Неозаглавена сесия","Add to my calendar":"Добавяне към моя календар","Local event time":"Местно време на събитието","Event local time":"Събитие местно време","Rehearsal":"Репетиция","Snapshot":"Моментна снимка","Check event time zone":"Проверете часовата зона на събитието","No sessions remain. Thank you for joining us.":"Няма останали сесии. Благодарим ви, че се присъединихте към нас.","Session website":"Уебсайт на сесията","Add session to calendar":"Добавете сесия към календара","Close":"затвори","Filter programme":"Филтриране на програмата","Find a session or speaker":"Намерете сесия или лектор","Search sessions":"Сесии за търсене","All days":"Всички дни","All tracks":"Всички теми","All rooms":"Всички зали","Reset filters":"Нулирайте филтрите","Happening now":"В момента","Calendar: results":"Календар: резултати","Calendar: all":"Календар: всички","Calendar: selected":"Календар: избран","Print":"Печат","Play overview":"Възпроизвеждане на обзора","Scenes and coverage":"Сцени и включено съдържание","Preview scene":"Визуализация на сцената","Programme playback":"Възпроизвеждане на програмата","Pause":"Пауза","Play":"Пускане","Previous":"Предишен","Next":"Следваща","Full screen":"Цял екран","Restart":"Рестартирайте","Event programme":"Програма на събитието","Programme. Space pauses; arrow keys change scene.":"програма. Интервални паузи; клавишите със стрелки променят сцената.","Programme paused. Press Space to resume.":"Програмата е на пауза. Натиснете интервал, за да продължите.","Programme playing. Press Space to pause.":"Възпроизвеждане на програма. Натиснете интервал за пауза.","scheduled":"планирано","rescheduled":"пренасрочен","cancelled":"отменен","Invalid date":"Невалидна дата","Invalid end date":"Невалидна крайна дата","Invalid start time":"Невалиден начален час","End must follow start; use End date for an overnight session":"Краят трябва да следва началото; използвайте крайната дата за нощна сесия","End defaults to one hour after Start":"Краят по подразбиране е един час след началото","Missing session title":"Липсва заглавие на сесията","Duplicate Session ID":"Дублиране на Session ID","Unknown time zone":"Неизвестна часова зона","Ambiguous time at daylight saving change":"Двусмислено време при смяна на лятното часово време","Time does not exist at daylight saving change":"Часът не съществува при смяна на лятното часово време","Room overlaps with":"Заетостта на залата се застъпва с","Track overlaps with":"Часът на темата се застъпва с","Speaker overlaps with":"Графикът на лектора се застъпва с","Fix the date, time and session identity issues before exporting the programme.":"Коригирайте проблемите с датата, часа и идентичността на сесията, преди да експортирате програмата.","This programme could not be laid out. Check the dates and times in the table.":"Тази програма не може да бъде изложена. Проверете датите и часовете в таблицата.","Unknown time zone - the calendar file keeps floating times.":"Неизвестна часова зона - файлът на календара поддържа плаващи времена.","Set a reference time before exporting a rehearsal.":"Задайте референтно време, преди да експортирате репетиция.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Една сесия е твърде дълга за тази страница. Увеличете размера на страницата или изберете интерактивна страница HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Един комплект за събития поддържа най-много 32 стаи. Филтрирайте програмата преди експортиране.","Row":"Редете","Select":"Изберете","sessions":"сесии","scenes":"сцени","seconds":"секунди","data issues":"проблеми с данните","programme issues":"програмни въпроси","Scene":"Сцена","px title type":"px тип заглавие","Every selected title completes its reveal. Longest wait:":"Всяко избрано заглавие завършва своето разкриване. Най-дълго чакане:","Revision:":"Ревизия:","Paused":"На пауза","day":"ден","track":"тема","room":"зала","Reference time:":"Референтно време:","Floating time":"Плаващо време","Programme revision:":"Ревизия на програмата:","Event time zone:":"Часова зона на събитието:","Generated:":"Генерирано:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML съдържа вградената програма. Публикувайте отново след промени. Видеото е запис.","A session needs more space. Use a taller screen or a closer reading distance.":"Една сесия се нуждае от повече място. Използвайте по-висок екран или по-близко разстояние за четене.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Тази сесия приключва преди да бъде показана нейната сцена. Изберете по-малко стаи на екран.","px room and time type":"px стая и тип време","Longest wait:":"Най-дълго чакане:","Select at least one session.":"Изберете поне една сесия.","Fix the date and time issues before exporting these sessions.":"Коригирайте проблемите с датата и часа, преди да експортирате тези сесии.","No sessions match these filters.":"Няма сесии, които да съответстват на тези филтри.","Starts in":"Започва в","minutes":"минути","Invalid end time":"Невалиден краен час","Invalid date or time":"Невалидна дата или час","A session may span at most 31 days":"Една сесия може да продължи най-много 31 дни","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Тази програма се нуждае от {seconds} секунди, за да покаже всяко заглавие. Увеличете продължителността на експорта.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Пълната програма изисква {pages} страници. Използвайте PDF, PowerPoint или HTML, за да включите всяка сесия."},"tr":{"Programme":"programı","Untitled session":"Başlıksız oturum","Add to my calendar":"Takvimime ekle","Local event time":"Yerel etkinlik zamanı","Event local time":"Etkinlik yerel saati","Rehearsal":"Prova","Snapshot":"Anlık Görüntü","Check event time zone":"Etkinlik saat dilimini kontrol edin","No sessions remain. Thank you for joining us.":"Hiçbir oturum kalmadı. Bize katıldığınız için teşekkür ederiz.","Session website":"Oturum web sitesi","Add session to calendar":"Oturumu takvime ekle","Close":"Kapat","Filter programme":"Programı filtrele","Find a session or speaker":"Bir oturum veya konuşmacı bulun","Search sessions":"Oturumları ara","All days":"Tüm günler","All tracks":"Tüm konular","All rooms":"Tüm salonlar","Reset filters":"Filtreleri sıfırla","Happening now":"Şu anda devam edenler","Calendar: results":"Takvim: sonuçlar","Calendar: all":"Takvim: hepsi","Calendar: selected":"Takvim: seçildi","Print":"Yazdır","Play overview":"Genel bakışı oynat","Scenes and coverage":"Sahneler ve kapsanan içerik","Preview scene":"Önizleme sahnesi","Programme playback":"Programı oynatma","Pause":"Duraklat","Play":"Oynat","Previous":"Önceki","Next":"Sonraki","Full screen":"Tam ekran","Restart":"Yeniden başlat","Event programme":"Etkinlik programı","Programme. Space pauses; arrow keys change scene.":"Program. Boşluk duraklar; ok tuşları sahneyi değiştirir.","Programme paused. Press Space to resume.":"Program duraklatıldı. Devam etmek için Space tuşuna basın.","Programme playing. Press Space to pause.":"Program oynatılıyor. Duraklatmak için Space tuşuna basın.","scheduled":"planlanmış","rescheduled":"yeniden planlandı","cancelled":"iptal edildi","Invalid date":"Geçersiz tarih","Invalid end date":"Geçersiz bitiş tarihi","Invalid start time":"Geçersiz başlangıç zamanı","End must follow start; use End date for an overnight session":"Bitiş, başlangıcı takip etmelidir; gecelik oturum için Bitiş tarihini kullanın","End defaults to one hour after Start":"Bitiş varsayılan değeri Başlangıç'tan bir saat sonradır","Missing session title":"Oturum başlığı eksik","Duplicate Session ID":"Çoğalt Session ID","Unknown time zone":"Bilinmeyen saat dilimi","Ambiguous time at daylight saving change":"Yaz saati değişikliğinde belirsiz zaman","Time does not exist at daylight saving change":"Yaz saati değişikliğinde saat mevcut değil","Room overlaps with":"Salon kullanımı şununla çakışıyor:","Track overlaps with":"Konu saati şununla çakışıyor:","Speaker overlaps with":"Konuşmacının programı şununla çakışıyor:","Fix the date, time and session identity issues before exporting the programme.":"Programı dışa aktarmadan önce tarih, saat ve oturum kimliği sorunlarını düzeltin.","This programme could not be laid out. Check the dates and times in the table.":"Bu program düzenlenemedi. Tablodaki tarih ve saatleri kontrol edin.","Unknown time zone - the calendar file keeps floating times.":"Bilinmeyen saat dilimi - takvim dosyası değişken saatleri saklıyor.","Set a reference time before exporting a rehearsal.":"Bir provayı dışa aktarmadan önce bir referans süresi ayarlayın.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Bu sayfa için bir oturum çok uzun. Sayfa boyutunu artırın veya etkileşimli bir HTML sayfası seçin.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Bir etkinlik kiti en fazla 32 odayı destekler. Dışa aktarmadan önce programı filtreleyin.","Row":"Sıra","Select":"Seç","sessions":"oturumlar","scenes":"sahneler","seconds":"saniye","data issues":"veri sorunları","programme issues":"program sorunları","Scene":"Sahne","px title type":"px başlık türü","Every selected title completes its reveal. Longest wait:":"Seçilen her başlık, gösterimini tamamlar. En uzun bekleme:","Revision:":"Revizyon:","Paused":"Duraklatıldı","day":"gün","track":"konu","room":"salon","Reference time:":"Referans zamanı:","Floating time":"Değişken zaman","Programme revision:":"Program revizyonu:","Event time zone:":"Etkinlik saat dilimi:","Generated:":"Oluşturuldu:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML dosyası gömülü programı içerir. Değişikliklerden sonra yeniden yayımlayın. Video bir kayıttır.","A session needs more space. Use a taller screen or a closer reading distance.":"Bir oturumun daha fazla alana ihtiyacı var. Daha uzun bir ekran veya daha yakın bir okuma mesafesi kullanın.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Bu oturum, sahnesi gösterilmeden sona erer. Ekran başına daha az oda seçin.","px room and time type":"px oda ve zaman türü","Longest wait:":"En uzun bekleme:","Select at least one session.":"En az bir oturum seçin.","Fix the date and time issues before exporting these sessions.":"Bu oturumları dışa aktarmadan önce tarih ve saat sorunlarını düzeltin.","No sessions match these filters.":"Bu filtrelerle eşleşen oturum yok.","Starts in":"Başlıyor","minutes":"dakika","Invalid end time":"Geçersiz bitiş zamanı","Invalid date or time":"Geçersiz tarih veya saat","A session may span at most 31 days":"Bir oturum en fazla 31 gün sürebilir","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Bu programın her başlığı göstermesi {seconds} saniyeye ihtiyaç duyar. Dışa aktarma süresini artırın.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Programın tamamı için {pages} sayfaya ihtiyaç vardır. Her oturumu dahil etmek için PDF, PowerPoint veya HTML tuşlarını kullanın."},"uk":{"Programme":"програма","Untitled session":"Сесія без назви","Add to my calendar":"Додати в мій календар","Local event time":"Місцевий час події","Event local time":"Подія за місцевим часом","Rehearsal":"Репетиція","Snapshot":"знімок","Check event time zone":"Перевірте часовий пояс події","No sessions remain. Thank you for joining us.":"Сеансів не залишилося. Дякуємо, що приєдналися до нас.","Session website":"Веб-сайт сесії","Add session to calendar":"Додати сеанс до календаря","Close":"Закрити","Filter programme":"Фільтрувати програму","Find a session or speaker":"Знайдіть сесію або спікера","Search sessions":"Сеанси пошуку","All days":"Усі дні","All tracks":"Усі теми","All rooms":"Усі зали","Reset filters":"Скинути фільтри","Happening now":"Зараз триває","Calendar: results":"Календар: результати","Calendar: all":"Календар: всі","Calendar: selected":"Календар: вибрано","Print":"Роздрукувати","Play overview":"Відтворити огляд","Scenes and coverage":"Сцени та включений вміст","Preview scene":"Попередній перегляд сцени","Programme playback":"Відтворення програми","Pause":"Пауза","Play":"Відтворити","Previous":"Попередній","Next":"Далі","Full screen":"Повний екран","Restart":"Перезапустіть","Event programme":"Програма заходу","Programme. Space pauses; arrow keys change scene.":"програма. Пробільні паузи; клавіші зі стрілками змінюють сцену.","Programme paused. Press Space to resume.":"Програму призупинено. Щоб продовжити, натисніть пробіл.","Programme playing. Press Space to pause.":"Відтворення програми. Натисніть пробіл, щоб зробити паузу.","scheduled":"заплановано","rescheduled":"переплановано","cancelled":"скасовано","Invalid date":"Недійсна дата","Invalid end date":"Недійсна дата завершення","Invalid start time":"Недійсний час початку","End must follow start; use End date for an overnight session":"Кінець має слідувати за початком; використовуйте дату завершення для нічного сеансу","End defaults to one hour after Start":"Кінець за умовчанням становить одну годину після початку","Missing session title":"Відсутня назва сесії","Duplicate Session ID":"Дублікат Session ID","Unknown time zone":"Невідомий часовий пояс","Ambiguous time at daylight saving change":"Неоднозначний час при переході на літній час","Time does not exist at daylight saving change":"При переході на літній час час не існує","Room overlaps with":"Бронювання зали перетинається з","Track overlaps with":"Час теми перетинається з","Speaker overlaps with":"Розклад доповідача перетинається з","Fix the date, time and session identity issues before exporting the programme.":"Виправте проблеми з датою, часом і ідентифікацією сеансу перед експортом програми.","This programme could not be laid out. Check the dates and times in the table.":"Цю програму не вдалося викласти. Перевірте дати та час у таблиці.","Unknown time zone - the calendar file keeps floating times.":"Невідомий часовий пояс - файл календаря зберігає плаваючий час.","Set a reference time before exporting a rehearsal.":"Встановіть контрольний час перед експортом репетиції.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Сеанс надто довгий для цієї сторінки. Збільште розмір сторінки або виберіть інтерактивну сторінку HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Набір заходів підтримує щонайбільше 32 кімнати. Відфільтруйте програму перед експортом.","Row":"рядок","Select":"Виберіть","sessions":"сесії","scenes":"сцени","seconds":"секунд","data issues":"проблеми з даними","programme issues":"програмні питання","Scene":"Сцена","px title type":"тип заголовка px","Every selected title completes its reveal. Longest wait:":"Кожен вибраний заголовок завершує своє розкриття. Найдовше очікування:","Revision:":"Версія:","Paused":"Призупинено","day":"день","track":"тема","room":"зала","Reference time:":"Еталонний час:","Floating time":"Плаваючий час","Programme revision:":"Перегляд програми:","Event time zone:":"Часовий пояс події:","Generated:":"Створено:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML містить вбудований розклад. Після змін опублікуйте його знову. Відео є записом.","A session needs more space. Use a taller screen or a closer reading distance.":"Для сеансу потрібно більше місця. Використовуйте вищий екран або меншу відстань для читання.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Цей сеанс закінчується до того, як буде показано його сцену. Виберіть менше кімнат на екран.","px room and time type":"px кімната та тип часу","Longest wait:":"Найдовше очікування:","Select at least one session.":"Виберіть принаймні один сеанс.","Fix the date and time issues before exporting these sessions.":"Виправте проблеми з датою та часом перед експортом цих сеансів.","No sessions match these filters.":"Жоден сеанс не відповідає цим фільтрам.","Starts in":"Починається в","minutes":"хвилин","Invalid end time":"Недійсний час закінчення","Invalid date or time":"Неправильна дата або час","A session may span at most 31 days":"Сеанс може тривати не більше 31 дня","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Цій програмі потрібно {seconds} секунд, щоб показати кожен заголовок. Збільште тривалість експорту.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Повна програма потребує {pages} сторінок. Використовуйте PDF, PowerPoint або HTML, щоб включити кожен сеанс."},"pl":{"Programme":"Program","Untitled session":"Sesja bez tytułu","Add to my calendar":"Dodaj do mojego kalendarza","Local event time":"Lokalny czas wydarzenia","Event local time":"Wydarzenie czasu lokalnego","Rehearsal":"Próba","Snapshot":"Migawka","Check event time zone":"Sprawdź strefę czasową wydarzenia","No sessions remain. Thank you for joining us.":"Nie pozostały żadne sesje. Dziękujemy, że do nas dołączyłeś.","Session website":"Strona sesji","Add session to calendar":"Dodaj sesję do kalendarza","Close":"Zamknij","Filter programme":"Filtruj program","Find a session or speaker":"Znajdź sesję lub mówcę","Search sessions":"Wyszukaj sesje","All days":"Wszystkie dni","All tracks":"Wszystkie tematy","All rooms":"Wszystkie sale","Reset filters":"Zresetuj filtry","Happening now":"Teraz trwa","Calendar: results":"Kalendarz: wyniki","Calendar: all":"Kalendarz: wszystko","Calendar: selected":"Kalendarz: wybrany","Print":"Wydrukuj","Play overview":"Odtwórz przegląd","Scenes and coverage":"Sceny i uwzględniona treść","Preview scene":"Podgląd sceny","Programme playback":"Odtwarzanie programu","Pause":"Pauza","Play":"Odtwórz","Previous":"Poprzedni","Next":"Następny","Full screen":"Pełny ekran","Restart":"Uruchom ponownie","Event programme":"Program wydarzenia","Programme. Space pauses; arrow keys change scene.":"Program. Przestrzeń pauzuje; klawisze strzałek zmieniają scenę.","Programme paused. Press Space to resume.":"Program wstrzymany. Naciśnij spację, aby wznowić.","Programme playing. Press Space to pause.":"Odtwarzanie programu. Naciśnij spację, aby wstrzymać.","scheduled":"zaplanowane","rescheduled":"przełożone","cancelled":"anulowane","Invalid date":"Nieprawidłowa data","Invalid end date":"Nieprawidłowa data zakończenia","Invalid start time":"Nieprawidłowy czas rozpoczęcia","End must follow start; use End date for an overnight session":"Koniec musi nastąpić po początku; użyj daty zakończenia w przypadku sesji nocnej","End defaults to one hour after Start":"Koniec jest domyślnie ustawiony na jedną godzinę po Rozpoczęciu","Missing session title":"Brak tytułu sesji","Duplicate Session ID":"Duplikat Session ID","Unknown time zone":"Nieznana strefa czasowa","Ambiguous time at daylight saving change":"Niejednoznaczny czas zmiany czasu letniego","Time does not exist at daylight saving change":"Czas nie istnieje w przypadku zmiany czasu letniego","Room overlaps with":"Rezerwacja sali pokrywa się z","Track overlaps with":"Termin tematu pokrywa się z","Speaker overlaps with":"Harmonogram prelegenta pokrywa się z","Fix the date, time and session identity issues before exporting the programme.":"Przed eksportowaniem programu napraw problemy z datą, godziną i tożsamością sesji.","This programme could not be laid out. Check the dates and times in the table.":"Tego programu nie można było ułożyć. Sprawdź daty i godziny w tabeli.","Unknown time zone - the calendar file keeps floating times.":"Nieznana strefa czasowa - plik kalendarza przechowuje czasy zmienne.","Set a reference time before exporting a rehearsal.":"Ustaw czas odniesienia przed eksportowaniem próby.","A session is too long for this page. Increase the page size or choose an interactive HTML page.":"Sesja jest za długa dla tej strony. Zwiększ rozmiar strony lub wybierz stronę interaktywną HTML.","An event kit supports at most 32 rooms. Filter the programme before exporting.":"Zestaw eventowy obsługuje maksymalnie 32 pokoje. Przefiltruj program przed eksportem.","Row":"Wiersz","Select":"Wybierz","sessions":"sesje","scenes":"sceny","seconds":"sekundy","data issues":"problemy z danymi","programme issues":"kwestie programowe","Scene":"Scena","px title type":"typ tytułu w px","Every selected title completes its reveal. Longest wait:":"Każdy wybrany tytuł kończy swoje odsłonięcie. Najdłużej oczekiwanie:","Revision:":"Wersja:","Paused":"Wstrzymano","day":"dzień","track":"temat","room":"sala","Reference time:":"Czas odniesienia:","Floating time":"Pływający czas","Programme revision:":"Wersja programu:","Event time zone:":"Strefa czasowa wydarzenia:","Generated:":"Wygenerowano:","HTML contains an embedded schedule. Republish after changes. Video is a recording.":"HTML zawiera osadzony harmonogram. Po zmianach opublikuj go ponownie. Wideo jest nagraniem.","A session needs more space. Use a taller screen or a closer reading distance.":"Sesja wymaga więcej miejsca. Użyj wyższego ekranu lub bliższej odległości czytania.","This session ends before its scene is shown. Choose fewer rooms per screen.":"Ta sesja kończy się przed wyświetleniem jej sceny. Wybierz mniej pokoi na ekran.","px room and time type":"px pokój i typ czasu","Longest wait:":"Najdłużej oczekiwanie:","Select at least one session.":"Wybierz co najmniej jedną sesję.","Fix the date and time issues before exporting these sessions.":"Przed eksportowaniem tych sesji napraw problemy z datą i godziną.","No sessions match these filters.":"Żadna sesja nie pasuje do tych filtrów.","Starts in":"Zaczyna się w","minutes":"minuty","Invalid end time":"Nieprawidłowy czas zakończenia","Invalid date or time":"Nieprawidłowa data lub godzina","A session may span at most 31 days":"Sesja może trwać maksymalnie 31 dni","This programme needs {seconds} seconds to show every title. Increase the export duration.":"Ten program potrzebuje {seconds} sekund na wyświetlenie każdego tytułu. Zwiększ czas trwania eksportu.","The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.":"Pełny program wymaga {pages} stron. Użyj PDF, PowerPoint lub HTML, aby uwzględnić każdą sesję."}};
function agText(text, lang) { return AG_TEXT[lang] && AG_TEXT[lang][text] || text; }
// === /lolly:shared agenda-i18n ===
// === lolly:shared agenda-clock - generated from community/_shared/agenda.js; edit there and run pnpm run sync:shared ===
// Event time is absolute; presentation time is elapsed. Neither depends on frame order.
function agWallParts(ms, zone) {
  var f = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).forEach(function (p) { f[p.type] = p.value; });
  return { date: f.year + '-' + f.month + '-' + f.day, minutes: Number(f.hour) * 60 + Number(f.minute) };
}
function agInstant(day, minute, zone) {
  var wall = Date.parse(day + 'T00:00:00Z') + minute * 60000;
  if (!Number.isFinite(wall)) return { error: 'Invalid date' };
  if (!zone) return { ms: wall, floating: true };
  var offsets = [], candidates = [];
  try {
    [-36, -12, 0, 12, 36].forEach(function (h) {
      var probe = wall + h * 3600000, p = agWallParts(probe, zone);
      var offset = Date.parse(p.date + 'T00:00:00Z') + p.minutes * 60000 - probe;
      if (offsets.indexOf(offset) < 0) offsets.push(offset);
    });
    offsets.forEach(function (offset) {
      var utc = wall - offset, p = agWallParts(utc, zone);
      if (Date.parse(p.date + 'T00:00:00Z') + p.minutes * 60000 === wall) candidates.push(utc);
    });
  } catch (_) { return { error: 'Unknown time zone' }; }
  if (candidates.length !== 1) return { error: candidates.length ? 'Ambiguous time at daylight saving change' : 'Time does not exist at daylight saving change' };
  return { ms: candidates[0] };
}
function agNow(sessions, instant, groupKey) {
  var groups = [];
  sessions.forEach(function (s) {
    if (s.status === 'cancelled') return;
    var name = s[groupKey] || 'All tracks', g = groups.find(function (v) { return v.name === name; });
    if (!g) { g = { name: name, now: [], next: [] }; groups.push(g); }
    if (s.startMs <= instant && instant < s.endMs) g.now.push(s);
    else if (s.startMs > instant) g.next.push(s);
  });
  groups.forEach(function (g) {
    g.next.sort(function (a,b) { return a.startMs - b.startMs; });
    g.next = g.next.filter(function (s) { return s.startMs === g.next[0].startMs; });
  });
  return groups;
}
function agPan(elapsed, overflow, speed, hold) {
  if (overflow <= 0 || elapsed <= hold) return 0;
  var travel = overflow / Math.max(1, speed), t = Math.max(0, elapsed - hold);
  return -overflow * Math.min(1, t / travel);
}
function agSceneAt(scenes, elapsed) {
  var total = scenes.reduce(function (n, s) { return n + s.duration; }, 0);
  if (!scenes.length || total <= 0) return null;
  var t = ((elapsed % total) + total) % total;
  for (var i = 0; i < scenes.length; i++) {
    if (t < scenes[i].duration) return { index: i, local: t, scene: scenes[i], total: total };
    t -= scenes[i].duration;
  }
  return { index: 0, local: 0, scene: scenes[0], total: total };
}
function agCalendar(sessions, title, createdAt) {
  function text(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x1f\x7f]/g, ''); }
  function stamp(ms, floating) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, floating ? '' : 'Z'); }
  var generated = stamp(Number.isFinite(createdAt) ? createdAt : Date.now(), false);
  var lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lolly//Agenda//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:' + text(title)];
  sessions.forEach(function (s) {
    if (!s.valid || !s.title) return;
    var uid = s.eventId ? encodeURIComponent(s.eventId) + '/' + encodeURIComponent(s.id) : text(s.id);
    lines.push('BEGIN:VEVENT','UID:' + uid + '@lolly.tools','DTSTAMP:' + generated,'DTSTART:' + stamp(s.startMs,s.floating),'DTEND:' + stamp(s.endMs,s.floating),'SUMMARY:' + text(s.title),'LOCATION:' + text(s.room),'DESCRIPTION:' + text([s.speaker,s.note].filter(Boolean).join('\n')));
    if (s.link) lines.push('URL:' + text(s.link));
    lines.push('STATUS:' + (s.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(function (line) {
    var out = '', n = 0;
    Array.from(line).forEach(function (ch) { var cp = ch.codePointAt(0), len = cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4; if (n + len > 75) { out += '\r\n '; n = 1; } out += ch; n += len; });
    return out;
  }).join('\r\n') + '\r\n';
}
// === /lolly:shared agenda-clock ===
// How each motion preset brings a scene in and takes it out. Seconds, except rise
// (pixels at 1080p, negative drops from above) and shift (a fraction of the frame
// width). `from` is the opacity a part starts at; `back` overshoots and settles.
var AG_MOTIONS = {
  calm: { enter: 0.6, stagger: 0.08, rise: 8, from: 0.85 },
  editorial: { enter: 1.1, stagger: 0.16, rise: 18, exit: 0.5 },
  expressive: { enter: 0.7, stagger: 0.12, rise: 34, grow: 0.08, back: true, exit: 0.4 },
  broadcast: { enter: 0.4, stagger: 0.07, shift: -0.03, wipe: true, exit: 0.3 },
  cascade: { enter: 0.55, stagger: 0.22, rise: -46, back: true, exit: 0.35 },
  slide: { enter: 0.8, stagger: 0.06, shift: 0.02, carousel: true, exit: 0.6 },
};
var agEase = function (p) { return 1 - Math.pow(1 - p, 3); };
var agBack = function (p) { var c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

/**
 * The pose of one part of a scene at `local` seconds into a scene `duration` long.
 * Part -1 is the scene as a whole (the carousel moves it); 0 is the heading and the
 * cards follow. A programme of one scene still leaves and returns at its loop point,
 * so an exported loop has no jump.
 */
function agMotionPose(preset, local, duration, part, sceneCount) {
  var m = AG_MOTIONS[preset];
  var rest = { opacity: 1, x: 0, y: 0, scale: 1, clip: 1 };
  if (!m) return rest;
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var leave = m.exit && sceneCount >= 1 ? clamp((duration - local) / m.exit) : 1;
  if (part < 0) {
    if (!m.carousel) return rest;
    var inn = agEase(clamp(local / m.enter));
    return { opacity: Math.min(inn, leave), x: (1 - inn) * 0.12 - (1 - leave) * 0.12, y: 0, scale: 1, clip: 1 };
  }
  var p = clamp((local - part * m.stagger) / m.enter);
  var eased = m.back ? agBack(p) : agEase(p);
  var from = m.from === undefined ? 0 : m.from;
  return {
    opacity: Math.min(from + (1 - from) * agEase(p), m.carousel ? 1 : leave),
    x: (1 - eased) * (m.shift || 0),
    y: (1 - eased) * (m.rise || 0) - (m.carousel ? 0 : (1 - leave) * 12),
    scale: 1 - (1 - eased) * (m.grow || 0),
    clip: m.wipe ? agEase(p) : 1,
  };
}

// === lolly:shared backdrop-shaders - generated from community/_shared/backdrop-shaders.js; edit there and run pnpm run sync:shared ===
    var FLUX_HEADER = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec4 u_colors[6];
uniform float u_colorsCount;
uniform vec4 u_colorBack;
uniform vec4 u_colorAccent;
uniform float u_intensity;
uniform float u_density;
uniform float u_brandMix;
in mediump vec2 v_objectUV;
out vec4 fragColor;
const float TAU = 6.28318530718;
mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

// A non-wrapping ramp: even a single swatch keeps shadows and lit facets.
// Interpolating squared channels avoids a dark seam between bright swatches.
vec3 palette(float t) {
  float at = clamp(t, 0.0, 1.0) * max(0.0, u_colorsCount - 1.0);
  vec3 c = u_colors[0].rgb;
  for (int i = 1; i < 6; i++) {
    if (float(i) >= u_colorsCount) break;
    float blend = smoothstep(0.0, 1.0, clamp(at - float(i - 1), 0.0, 1.0));
    c = sqrt(mix(c * c, u_colors[i].rgb * u_colors[i].rgb, blend));
  }
  return c;
}
vec3 finish(float light, float hue, float rim, vec2 p) {
  float l = clamp(light, 0.0, 1.0);
  vec3 spectrum = 0.5 + 0.5 * cos(TAU * (hue + l * 0.32 + vec3(0.0, 0.33, 0.67)));
  spectrum = spectrum * (0.2 + 0.85 * l) + rim * 0.26;
  vec3 brand = palette((l - 0.08) * 1.42 + 0.08 * sin(hue * TAU)) * (0.28 + 0.95 * l);
  brand += u_colorAccent.rgb * rim * 0.32;
  brand = mix(brand, mix(u_colorAccent.rgb, vec3(1.0), 0.4), clamp(rim * 0.46, 0.0, 0.5));
  vec3 c = mix(spectrum, brand, u_brandMix);
  c = mix(u_colorBack.rgb, c, smoothstep(0.015, 0.3, l));
  // Gentle edge falloff preserves the chosen ground on light and dark palettes.
  return mix(c, u_colorBack.rgb, 0.2 * smoothstep(0.4, 1.65, length(p)));
}
`;
    var CUSTOM_SHADERS = {
      silkFlowFragmentShader: FLUX_HEADER + `
void main() {
  vec2 p = v_objectUV * 2.0;
  vec2 q = turn(-0.45) * p;
  float t = u_time * 0.24;
  // Nested displacement makes broad folds curl into finer silk filaments.
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    q += (0.18 + u_intensity * 0.22) / (1.0 + f * 0.5)
      * sin(q.yx * (1.7 + f * 0.65) + vec2(t, -t * 0.7) + f * 1.6);
    q = turn(0.16) * q;
  }
  float fold = q.y * (5.0 + u_density * 9.0) + sin(q.x * 2.1 + t) * 1.7;
  fold += 0.45 * sin(fold * 0.65 + q.x * 2.3 - t);
  float crest = 0.5 + 0.5 * sin(fold);
  float satin = pow(crest, 1.7);
  float threadPhase = fold * 7.0 + q.x * 4.0;
  float thread = pow(0.5 + 0.5 * sin(threadPhase), 10.0) * smoothstep(0.15, 0.8, crest);
  thread *= 1.0 - smoothstep(0.6, 2.0, fwidth(threadPhase));
  float rim = pow(crest, 48.0) + thread * 0.4;
  float light = 0.09 + satin * (0.58 + u_intensity * 0.2) + thread * 0.09;
  fragColor = vec4(finish(light, q.x * 0.16 + t * 0.035, rim, p), 1.0);
}
`,
      prismBloomFragmentShader: FLUX_HEADER + `
void main() {
  vec2 p = v_objectUV * 2.0;
  float t = u_time * 0.2;
  float r = length(p);
  float petals = floor(5.0 + u_density * 7.0);
  float wedge = TAU / petals;
  float angle = atan(p.y, p.x) + t * 0.16;
  float folded = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
  vec2 q = r * vec2(cos(folded), sin(folded));
  // Mirrored curved facets open and close around a luminous centre.
  float curve = length(q - vec2(0.6 + 0.15 * sin(t), 0.34));
  float phase = curve * (13.0 + u_density * 9.0) - t * 1.2
    + sin(r * 5.0 - t) * (0.5 + u_intensity * 1.8);
  float facet = 0.5 + 0.5 * cos(phase);
  float beams = pow(0.5 + 0.5 * cos(folded * petals), 6.0);
  float etchPhase = q.y * 48.0 + sin(q.x * 12.0 - t) * 2.0;
  float etch = pow(0.5 + 0.5 * cos(etchPhase), 18.0) * pow(facet, 4.0);
  etch *= 1.0 - smoothstep(0.6, 2.0, fwidth(etchPhase));
  float rim = pow(facet, 28.0) * (0.4 + beams * 0.6) + etch * 0.6;
  float halo = exp(-r * r * 2.2);
  float light = 0.06 + pow(facet, 3.0) * (0.4 + u_intensity * 0.28)
    + halo * 0.15 + beams * 0.09;
  fragColor = vec4(finish(light, r * 0.22 - t * 0.06, rim, p), 1.0);
}
`,
      liquidContoursFragmentShader: FLUX_HEADER + `
float terrain(vec2 p, float t) {
  float h = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 4; i++) {
    p += sin(p.yx * 1.2 + t * 0.3) * (0.2 + u_intensity * 0.35);
    h += amplitude * sin(p.x + t) * cos(p.y - t * 0.6);
    p = turn(0.83) * p * 1.85 + 1.4;
    amplitude *= 0.45;
  }
  return h;
}
void main() {
  vec2 p = v_objectUV * 2.0;
  float t = u_time * 0.22;
  float h = terrain(p * 1.65, t);
  float bands = h * (7.0 + u_density * 15.0) + t * 0.45;
  float ridge = 0.5 + 0.5 * sin(bands);
  float width = max(fwidth(bands), 0.015);
  float line = 1.0 - smoothstep(0.035, 0.035 + width * 1.3, abs(cos(bands)));
  // Screen-space slope gives the contours a metallic, embossed edge.
  vec2 slope = vec2(dFdx(h), dFdy(h)) / max(length(fwidth(p)), 0.0001);
  vec3 normal = normalize(vec3(-slope * 1.4, 1.0));
  float shine = pow(max(dot(normal, normalize(vec3(-0.5, 0.7, 1.0))), 0.0), 12.0);
  float light = 0.12 + ridge * 0.34 + h * 0.12 + shine * (0.2 + u_intensity * 0.25);
  fragColor = vec4(finish(light, h * 0.32 + t * 0.04, line * 0.55 + shine * 0.6, p), 1.0);
}
`,
    };
// === /lolly:shared backdrop-shaders ===
  function tr(text, values) { var translated=agText(text, data.lang || 'en'); Object.keys(values||{}).forEach(function(key){translated=translated.split('{'+key+'}').join(String(values[key]));}); return translated; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = tr(text);
    return n;
  }
  function on(node, event, fn) {
    node.addEventListener(event, fn, { signal: signal });
  }
  function button(label, fn) {
    var b = el('button', '', label);
    b.type = 'button';
    on(b, 'click', fn);
    return b;
  }
  function eventInstant() {
    if (exporting)
      return data.clockMode === 'rehearsal' ? exportInstant + elapsed * 1000 : exportInstant;
    if (Number.isFinite(data.referenceMs)) return data.referenceMs;
    if (paused && Number.isFinite(pausedInstant)) return pausedInstant;
    if (data.tz) return Date.now();
    var d = new Date();
    return Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    );
  }
  function allSessions() {
    return data.sessions.slice().sort(function (a, b) {
      return (a.startMs || Infinity) - (b.startMs || Infinity) || a.index - b.index;
    });
  }
  function rowsForScreen() {
    var rows = allSessions().filter(function (s) {
      return (
        (!data.roomFilter || s.room === data.roomFilter) &&
        (!data.trackFilter || !s.track || s.track === data.trackFilter) &&
        (!data.eventDay || s.rawDate === data.eventDay)
      );
    });
    rows = rows.filter(function (s) { return s.status !== 'cancelled'; });
    if ((data.layout === 'intermission' || data.layout === 'soon')) {
      var upcoming = rows.filter(function (s) { return s.startMs > eventInstant(); });
      var first = upcoming.length ? upcoming[0].startMs : Infinity;
      rows = upcoming.filter(function (s) { return s.startMs === first; });
    }
    if (data.layout === 'closing') rows = [];
    if (data.layout === 'departures' && !(exporting && data.clockMode === 'evergreen'))
      rows = rows.filter(function (s) {
        return !s.valid || s.endMs > eventInstant();
      });
    if (
      (data.layout === 'board' || data.layout === 'rooms') &&
      !(exporting && data.clockMode === 'evergreen')
    ) {
      var eligible = rows.filter(function (s) {
        return s.valid;
      });
      rows = [];
      agNow(eligible, eventInstant(), data.layout === 'rooms' ? 'room' : 'track').forEach(
        function (g) {
          g.now.forEach(function (s) {
            rows.push(Object.assign({}, s, { stateLabel: data.labels.now + ' · ' + g.name }));
          });
          g.next.forEach(function (s) {
            rows.push(Object.assign({}, s, { stateLabel: data.labels.next + ' · ' + g.name }));
          });
        }
      );
    }
    if (data.layout === 'chapters')
      rows.sort(function (a, b) {
        return a.track.localeCompare(b.track) || a.startMs - b.startMs;
      });
    if (data.sceneOrder && data.sceneOrder.length) rows.sort(function (a,b) {
      var ai = data.sceneOrder.indexOf(a.id), bi = data.sceneOrder.indexOf(b.id);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || a.startMs - b.startMs;
    });
    return rows;
  }
  function header(parent, label) {
    var h = el('header', 'ag-screen-head');
    var kicker = el('p', 'ag-kicker', data.subtitle || 'Programme');
    h.append(kicker);
    h.append(el('h1', '', data.title));
    var logo = root.querySelector('[data-ag-logo]');
    if (logo) {
      var copy = logo.cloneNode(true);
      copy.removeAttribute('data-ag-logo');
      copy.className = 'ag-brand-logo';
      h.append(copy);
      h.classList.add('ag-has-logo');
    }
    if (label) h.append(el('p', 'ag-section-label', label));
    parent.append(h);
  }
  function card(s, interactive) {
    var c = el('article', 'ag-screen-card');
    c.dataset.session = s.id;
    c.style.setProperty('--track', s.colour);
    // Type that sits on the track colour itself (the Festival cards) picks the
    // paler or darker ink by the colour's luminance.
    var tc = /^#[0-9a-f]{6}$/i.test(s.colour || '') ? [1, 3, 5].map(function (i) { return parseInt(s.colour.slice(i, i + 2), 16); }) : null;
    if (tc) c.style.setProperty('--track-ink', 0.2126 * tc[0] + 0.7152 * tc[1] + 0.0722 * tc[2] > 150 ? '#14181f' : '#ffffff');
    var info = [s.status !== 'scheduled' && tr(s.status), s.stateLabel, s.rawDate, s.timeText, data.showRooms && s.room]
      .filter(Boolean)
      .join(' · ');
    c.append(el('p', 'ag-card-meta', info));
    if (s.image && (data.look === 'gallery' || data.layout === 'spotlight' || interactive)) {
      var photo = el('img', 'ag-session-photo'); photo.src = s.image; photo.alt = ''; photo.loading = 'eager'; c.append(photo); c.classList.add('ag-with-photo');
    }
    var heading = el(interactive ? 'button' : 'h2', 'ag-card-title');
    var title = el('span', 'ag-title-text', s.title || 'Untitled session');
    title.dir = 'auto';
    heading.append(title);
    if (interactive) {
      heading.type = 'button';
      on(heading, 'click', function () {
        openDetail(s, true);
      });
    }
    c.append(heading);
    var meta = el('div', 'ag-card-detail');
    if (data.showSpeakers && s.speaker) meta.append(el('p', 'ag-speaker-name', s.speaker));
    if (s.trackName || s.track) meta.append(el('p', 'ag-track-label', s.trackName || s.track));
    c.append(meta);
    if (!s.valid) c.append(el('p', 'ag-data-warning', s.issues.join('. ')));
    if (interactive) {
      var lab = el('label', 'ag-select-session'),
        check = el('input');
      check.type = 'checkbox';
      check.checked = selected.has(s.id);
      check.setAttribute('aria-label', tr('Select') + ' ' + s.title);
      on(check, 'change', function () {
        if (check.checked) selected.add(s.id);
        else selected.delete(s.id);
      });
      lab.append(check, document.createTextNode(' ' + tr('Add to my calendar')));
      c.append(lab);
    }
    return c;
  }
  function measure() {
    var computed = getComputedStyle(root);
    width = parseFloat(computed.width) || root.clientWidth || 1920;
    height = parseFloat(computed.height) || root.clientHeight || 1080;
    scale = Math.max(0.3, Math.min(width, height) / 1080);
    root.style.setProperty('--ag-scale', scale);
    var base = (data.distance === 'hall' ? 58 : data.distance === 'desk' ? 32 : 44) * scale;
    root.style.setProperty('--ag-type', base + 'px');
    root.classList.toggle('ag-narrow', width / height < 0.85);
    root.classList.toggle('ag-ribbon', data.layout === 'ribbon' || width / height > 4);
  }
  function titleSpeed(text) {
    return (data.speed * (parseFloat(getComputedStyle(text).fontSize) || 44 * scale)) / 44;
  }
  function sceneDOM(scene, index, full) {
    var n = el('section', 'ag-scene' + (full ? ' ag-full-text' : ''));
    header(n, data.layout === 'chapters' && scene.rows[0] ? scene.rows[0].trackName : '');
    if (data.layout === 'soon' && scene.rows[0]) { var wait = Math.max(0,Math.ceil((scene.rows[0].startMs-eventInstant())/60000)); n.append(el('p','ag-screen-message',tr('Starts in')+' '+wait+' '+tr('minutes'))); }
    if (data.message) n.append(el('p', 'ag-screen-message', data.message));
    var list = el('div', 'ag-scene-list');
    scene.rows.forEach(function (s) {
      list.append(card(s, false));
    });
    if (!scene.rows.length)
      list.append(el('p', 'ag-empty', 'No sessions remain. Thank you for joining us.'));
    n.append(list);
    var foot = el('footer', 'ag-screen-footer');
    var timeLabel = data.tz || tr('Local event time');
    if (exporting && data.clockMode === 'evergreen')
      timeLabel = tr('Programme') + ' · ' + (data.tz || tr('Event local time'));
    if (Number.isFinite(data.referenceMs) || exporting)
      timeLabel += ' · ' + tr(exporting && data.clockMode === 'rehearsal' ? 'Rehearsal' : 'Snapshot');
    var clock = agWallParts(eventInstant(), data.tz);
    if (!(exporting && data.clockMode === 'evergreen'))
      timeLabel =
        String(Math.floor(clock.minutes / 60)).padStart(2, '0') +
        ':' +
        String(clock.minutes % 60).padStart(2, '0') +
        ' · ' +
        timeLabel;
    if (data.zoneWarning) timeLabel = tr('Check event time zone');
    if (data.diagnostics.length) timeLabel += ' · ' + data.diagnostics.length + ' ' + tr('data issues');
    foot.append(
      el('span', '', timeLabel),
      el(
        'span',
        '',
        String(index + 1).padStart(2, '0') + ' / ' + String(scenes.length).padStart(2, '0')
      )
    );
    n.append(foot);
    return n;
  }
  function planScenes() {
    root.classList.toggle('ag-reduced', data.motion === 'off' || reduced.matches);
    measure();
    var rows = rowsForScreen();
    var size =
      data.layout === 'spotlight' || root.classList.contains('ag-ribbon')
        ? 1
        : Math.max(
            1,
            Math.min(
              4,
              Math.floor(
                (height * 0.63) / (parseFloat(root.style.getPropertyValue('--ag-type')) * 3.8)
              ) *
                ((data.layout === 'overview' || data.layout === 'rooms') && width / height >= 0.85
                  ? 2
                  : 1)
            )
          );
    scenes = [];
    var batch = [];
    rows.forEach(function (s) {
      if (
        batch.length &&
        (batch.length >= size || (data.layout === 'chapters' && batch[0].track !== s.track))
      ) {
        scenes.push({ rows: batch, duration: data.dwell });
        batch = [];
      }
      batch.push(s);
    });
    if (batch.length || !scenes.length) scenes.push({ rows: batch, duration: data.dwell });
    // Split until each scene fits, then measure its actual glyph travel.
    var issues = [], titlePixels = Infinity, anchorPixels = Infinity;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i], node = sceneDOM(s, i, false);
      live.replaceChildren(node);
      var list = node.querySelector('.ag-scene-list');
      if (list.scrollHeight > list.clientHeight + 1 && s.rows.length > 1) {
        var mid = Math.ceil(s.rows.length / 2);
        scenes.splice(i, 1, {rows:s.rows.slice(0,mid),duration:data.dwell}, {rows:s.rows.slice(mid),duration:data.dwell});
        i--; continue;
      }
      if (list.scrollHeight > list.clientHeight + 1) issues.push(tr('A session needs more space. Use a taller screen or a closer reading distance.'));
      var reading = 0;
      node.querySelectorAll('.ag-title-text').forEach(function (text) {
        titlePixels = Math.min(titlePixels, parseFloat(getComputedStyle(text).fontSize));
        var overflow = Math.max(0, text.scrollWidth - text.parentElement.clientWidth);
        if (overflow) reading += 4 + overflow / titleSpeed(text);
      });
      node.querySelectorAll('.ag-card-meta').forEach(function (text) { anchorPixels=Math.min(anchorPixels,parseFloat(getComputedStyle(text).fontSize)); });
      s.duration = Math.ceil(Math.max(data.dwell,reading));
    }
    current = -1;
    root.dataset.cycleSeconds = String(
      scenes.reduce(function (n, s) {
        return n + s.duration;
      }, 0)
    );
    root.dataset.clipMs = String(Number(root.dataset.cycleSeconds) * 1000);
    var cycle = Number(root.dataset.cycleSeconds), offset = 0, instant = eventInstant();
    var coverage = scenes.flatMap(function(scene) {
      var at = offset; offset += scene.duration;
      return scene.rows.map(function(session) {
        var finishesBeforeShown = session.startMs <= instant && session.endMs > instant && session.endMs <= instant + at * 1000;
        if (finishesBeforeShown) issues.push(session.title + ': ' + tr('This session ends before its scene is shown. Choose fewer rooms per screen.'));
        return {id:session.id,room:session.room,track:session.track,firstShown:at,longestWait:cycle,finishesBeforeShown:finishesBeforeShown};
      });
    });
    root.dataset.coverage = JSON.stringify({ scenes: scenes.length, seconds: cycle, longestWait: cycle, titlePixels: Number.isFinite(titlePixels)?titlePixels:0, anchorPixels:Number.isFinite(anchorPixels)?anchorPixels:0, sessions: rows.length, revision: data.revision, complete:!issues.length,issues:issues,items:coverage });
  }
  function paint(t) {
    elapsed = t;
    if (page || disposed || legacy && !exporting) return;
    if (
      (!exporting || data.clockMode === 'rehearsal') &&
      Math.floor(eventInstant() / 60000) !== lastEventMinute
    ) {
      lastEventMinute = Math.floor(eventInstant() / 60000);
      if (['board', 'rooms', 'departures', 'intermission', 'soon'].includes(data.layout)) planScenes();
      else current = -1;
    }
    var at = agSceneAt(scenes, t);
    if (!at) return;
    if (current !== at.index) {
      current = at.index;
      var n = sceneDOM(at.scene, current, false);
      live.replaceChildren(n);
      pans = Array.from(n.querySelectorAll('.ag-title-text')).map(function (text) {
        return {
          text: text,
          speed: titleSpeed(text),
          overflow: Math.max(0, text.scrollWidth - text.parentElement.clientWidth),
          direction: getComputedStyle(text).direction === 'rtl' ? -1 : 1,
        };
      });
      var offset = 0;
      pans.forEach(function(p){p.offset=offset;if(p.overflow)offset+=4+p.overflow/p.speed;});
    }
    var still = data.motion === 'off' || reduced.matches;
    root.classList.toggle('ag-reduced', still);
    pans.forEach(function (p) {
      p.text.style.transform = still
        ? 'none'
        : 'translateX(' + p.direction * agPan(at.local-p.offset, p.overflow, p.speed, 2) + 'px)';
    });
    var scene = live.firstElementChild;
    if (scene) {
      // The heading enters first and each card after it, so a scene builds rather
      // than appears. The pose is a function of the scene's own clock, so a video
      // frame, a thumbnail and the live screen agree.
      var parts = [scene.querySelector('.ag-screen-head'), scene.querySelector('.ag-screen-message')]
        .concat(Array.from(scene.querySelectorAll('.ag-screen-card')))
        .filter(Boolean);
      var whole = agMotionPose(still ? 'off' : data.motion, at.local, at.scene.duration, -1, scenes.length);
      scene.style.opacity = String(whole.opacity);
      scene.style.transform = 'translateX(' + whole.x * width + 'px)';
      parts.forEach(function (part, i) {
        var pose = agMotionPose(still ? 'off' : data.motion, at.local, at.scene.duration, i, scenes.length);
        part.style.opacity = String(pose.opacity);
        part.style.transform =
          'translate(' + pose.x * width + 'px,' + pose.y * scale + 'px) scale(' + pose.scale + ')';
        part.style.clipPath = pose.clip < 1 ? 'inset(0 ' + (100 - pose.clip * 100).toFixed(2) + '% 0 0)' : '';
      });
    }
    drawBackground(still ? 0 : t, at.total);
  }
  function filtered() {
    return allSessions().filter(function (s) {
      return (
        (!filter.day || s.rawDate === filter.day) &&
        (!filter.track || s.track === filter.track) &&
        (!filter.room || s.room === filter.room) &&
        (!filter.q ||
          [s.title, s.speaker, s.note, s.track, s.room]
            .join(' ')
            .toLowerCase()
            .includes(filter.q.toLowerCase()))
      );
    });
  }
  function downloadCalendar(rows) {
    if (!rows.length) {
      window.alert(tr('Select at least one session.'));
      return;
    }
    if (
      rows.some(function (s) {
        return !s.valid;
      })
    ) {
      window.alert(tr('Fix the date and time issues before exporting these sessions.'));
      return;
    }
    var a = el('a'),
      url = URL.createObjectURL(
        new Blob([agCalendar(rows, data.title)], { type: 'text/calendar;charset=utf-8' })
      );
    a.href = url;
    a.download = 'agenda.ics';
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  function stateUrl(id) {
    var p = new URLSearchParams();
    Object.keys(filter).forEach(function (k) {
      if (filter[k]) p.set(k, filter[k]);
    });
    if (id) p.set('session', id);
    return '#agenda=' + encodeURIComponent(p.toString());
  }
  function saveUrl(id, replace) {
    if (!document.body.hasAttribute('data-lolly-portable')) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', stateUrl(id));
  }
  function readUrl() {
    if (!document.body.hasAttribute('data-lolly-portable')) return;
    var raw = '';
    try {
      raw = location.hash.startsWith('#agenda=') ? decodeURIComponent(location.hash.slice(8)) : '';
    } catch (_) {}
    var p = new URLSearchParams(raw);
    Object.keys(filter).forEach(function (k) {
      filter[k] = p.get(k) || '';
    });
    var previous = root.querySelector('dialog');
    if (previous) previous.remove();
    renderPage();
    var s = data.sessions.find(function (s) {
      return s.id === p.get('session');
    });
    if (s) openDetail(s, false);
  }
  function openDetail(s, push) {
    var prior = root.querySelector('dialog');
    if (prior) prior.remove();
    var returnFocus = document.activeElement;
    var dialog = el('dialog', 'ag-dialog');
    dialog.setAttribute('aria-label', s.title);
    dialog.append(
      el('p', 'ag-kicker', s.rawDate + ' · ' + s.timeText),
      el('h2', '', s.title),
      el('p', '', s.speaker),
      el('p', '', s.room + ' · ' + s.trackName),
      el('p', '', s.note)
    );
    if (s.link) { var link = el('a', '', 'Session website'); link.href = s.link; link.rel = 'noopener noreferrer'; dialog.append(link); }
    if (s.status !== 'scheduled') dialog.append(el('p', '', s.status));
    dialog.append(
      button('Add session to calendar', function () {
        downloadCalendar([s]);
      }),
      button('Close', function () {
        dialog.close();
      })
    );
    on(dialog, 'close', function () {
      dialog.remove();
      saveUrl('', false);
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    });
    root.append(dialog);
    dialog.showModal();
    if (push) saveUrl(s.id, false);
  }
  function renderPage() {
    root.classList.add('ag-page');
    root.tabIndex = -1;
    live.replaceChildren();
    header(live, '');
    var controls = el('nav', 'ag-page-controls');
    controls.setAttribute('aria-label', tr('Filter programme'));
    var search = el('input');
    search.type = 'search';
    search.placeholder = tr('Find a session or speaker');
    search.setAttribute('aria-label', tr('Search sessions'));
    search.value = filter.q;
    on(search, 'input', function () {
      filter.q = search.value;
      renderResults();
      saveUrl('', true);
    });
    controls.append(search);
    ['day', 'track', 'room'].forEach(function (k) {
      var select = el('select');
      select.setAttribute('aria-label', tr(k));
      select.append(new Option(tr('All ' + (k === 'day' ? 'days' : k + 's')), ''));
      var seen = new Set();
      data.sessions.forEach(function (s) {
        var v = s[k === 'day' ? 'rawDate' : k];
        if (v && !seen.has(v)) {
          seen.add(v);
          select.append(new Option(v, v));
        }
      });
      select.value = filter[k];
      on(select, 'change', function () {
        filter[k] = select.value;
        renderResults();
        saveUrl('', false);
      });
      controls.append(select);
    });
    controls.append(
      button('Reset filters', function () { filter = {q:'',day:'',track:'',room:''}; renderPage(); saveUrl('',false); }),
      button('Happening now', function () {
        var instant = eventInstant(), rows = filtered().filter(function(s){return s.startMs <= instant && instant < s.endMs && s.status !== 'cancelled';});
        var list = live.querySelector('.ag-page-results'); list.replaceChildren(); rows.forEach(function(s){list.append(card(s,true));}); live.querySelector('.ag-results-count').textContent = rows.length + ' ' + tr('sessions');
      }),
      button('Calendar: results', function () { downloadCalendar(filtered()); }),
      button('Calendar: all', function () {
        downloadCalendar(data.sessions);
      }),
      button('Calendar: selected', function () {
        downloadCalendar(
          data.sessions.filter(function (s) {
            return selected.has(s.id);
          })
        );
      }),
      button('Print', function () {
        window.print();
      }),
      button('Play overview', function () { page = false; root.classList.remove('ag-page'); root.tabIndex=0; planScenes(); paint(0); root.focus(); })
    );
    live.append(controls, el('p', 'ag-results-count'), el('div', 'ag-page-results'));
    renderResults();
  }
  function renderResults() {
    var rows = filtered(),
      list = live.querySelector('.ag-page-results');
    if (!list) return;
    list.replaceChildren();
    rows.forEach(function (s) {
      list.append(card(s, true));
    });
    if (!rows.length) list.append(el('p','ag-empty','No sessions match these filters.'));
    live.querySelector('.ag-results-count').textContent = rows.length + ' ' + tr('sessions');
  }
  function rgba(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      1,
    ];
  }
  function initBackground() {
    root.dataset.background = data.background;
    root.style.setProperty('--ag-background-intensity', String(data.intensity));
    var image = root.querySelector('[data-ag-background]');
    if (data.background === 'image' && image) { var picture = image.cloneNode(true); picture.removeAttribute('data-ag-background'); picture.className = 'ag-background-photo'; root.prepend(picture); }
    if (data.strictPalette) return;
    if (!['silk', 'luminous', 'contours'].includes(data.background)) return;
    var gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return;
    var shaders = [];
    function compile(type, source) {
      var s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      shaders.push(s);
      return s;
    }
    try {
      var vs = compile(
        gl.VERTEX_SHADER,
        '#version 300 es\nin vec2 position;out vec2 v_objectUV;void main(){v_objectUV=position*0.5;gl_Position=vec4(position,0.0,1.0);}'
      );
      var fs = compile(
        gl.FRAGMENT_SHADER,
        CUSTOM_SHADERS[
          data.background === 'silk'
            ? 'silkFlowFragmentShader'
            : data.background === 'luminous'
              ? 'prismBloomFragmentShader'
              : 'liquidContoursFragmentShader'
        ]
      );
      var program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
      gl.useProgram(program);
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      var pos = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      function uniform(name, value) {
        gl.uniform1f(gl.getUniformLocation(program, name), value);
      }
      var colors = data.palette.tracks.slice(0, 6);
      while (colors.length < 6) colors.push(colors[0]);
      gl.uniform4fv(
        gl.getUniformLocation(program, 'u_colors'),
        new Float32Array(colors.flatMap(rgba))
      );
      gl.uniform1f(
        gl.getUniformLocation(program, 'u_colorsCount'),
        Math.min(6, data.palette.tracks.length)
      );
      gl.uniform4fv(gl.getUniformLocation(program, 'u_colorBack'), rgba(data.palette.paper));
      gl.uniform4fv(gl.getUniformLocation(program, 'u_colorAccent'), rgba(colors[0]));
      uniform('u_intensity', data.intensity);
      uniform('u_density', 0.4);
      uniform('u_brandMix', 1);
      glState = { gl: gl, program: program, buffer: buffer, shaders: shaders, uniform: uniform };
      on(canvas, 'webglcontextlost', function (e) {
        e.preventDefault();
        canvas.style.visibility = 'hidden';
      });
      on(canvas, 'webglcontextrestored', function () {
        canvas.style.visibility = '';
        glState = null;
        initBackground();
        drawBackground(elapsed, Number(root.dataset.cycleSeconds) || 60);
      });
    } catch (_) {
      shaders.forEach(function (s) {
        gl.deleteShader(s);
      });
      canvas.style.visibility = 'hidden';
    }
  }
  function drawBackground(t, total) {
    if (!glState) return;
    // A periodic phase keeps the end of an exported cycle continuous with its start.
    var phase = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / Math.max(1, total));
    var w = Math.max(1, Math.round(width * Math.min(1, 1280 / Math.max(width, height)))),
      h = Math.max(1, Math.round((w * height) / width));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    glState.gl.viewport(0, 0, w, h);
    glState.uniform('u_time', (data.variation || 1) + phase * (data.motion === 'expressive' ? 20 : 8));
    glState.gl.drawArrays(glState.gl.TRIANGLES, 0, 6);
  }
  function tick(now) {
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    if (
      !document.hidden &&
      !paused &&
      !reduced.matches &&
      data.motion !== 'off' &&
      !exporting &&
      !canvas.__lollyFrameDriven &&
      !page
    )
      paint((now - start) / 1000);
    frame = requestAnimationFrame(tick);
  }
  function dispose() {
    if (wakeLock) { wakeLock.release().catch(function(){}); wakeLock=null; }
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    abort.abort();
    observer.disconnect();
    if (glState) {
      glState.shaders.forEach(function (s) {
        glState.gl.deleteShader(s);
      });
      glState.gl.deleteBuffer(glState.buffer);
      glState.gl.deleteProgram(glState.program);
      glState.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
  function prepare(format, opts) {
    if (format === 'html' || format === 'ics' || format === 'zip') return function () {};
    if (opts.thumbnail && (legacy || page)) return function () {};
    exportInstant = eventInstant();
    exporting = true;
    if (!Number.isFinite(exportInstant) || exportInstant === 0)
      exportInstant = Number.isFinite(data.referenceMs) ? data.referenceMs : Date.now();
    if (data.clockMode === 'rehearsal' && !Number.isFinite(data.referenceMs)) {
      exporting = false;
      throw new Error(tr('Set a reference time before exporting a rehearsal.'));
    }
    var oldWidth = root.style.width,
      oldHeight = root.style.height,
      oldPage = page,
      oldElapsed = elapsed;
    root.classList.remove('ag-legacy');
    try {
      var unit = ['px', 'mm', 'cm', 'in', 'pt'].includes(opts.unit) ? opts.unit : 'px';
      root.style.width = Number(opts.width) > 0 ? opts.width + unit : width + 'px';
      root.style.height = Number(opts.height) > 0 ? opts.height + unit : height + 'px';
      page = false;
      root.classList.remove('ag-page');
      planScenes();
      var duration = Number(root.dataset.cycleSeconds);
      var motion =
        ['mp4', 'webm', 'gif', 'apng', 'webp-anim'].includes(format) ||
        (format === 'pptx' && data.pptxMode === 'animated');
      staticExport = !motion;
      if (opts.thumbnail) {
        // A gallery preview is one settled scene, not a complete programme export.
        staticExport = true;
        paint(2);
      } else if (motion) {
        var coverage = JSON.parse(root.dataset.coverage);
        if (!coverage.complete) throw new Error(coverage.issues.join(' '));
        if (opts.durationUserSet === false) opts.duration = duration;
        if (opts.duration && opts.duration < duration) {
          throw new Error(
            tr('This programme needs {seconds} seconds to show every title. Increase the export duration.',{seconds:duration})
          );
        }
        opts.duration = opts.duration || duration;
        paint(0);
      } else {
        var pages = [];
        // Full-text exports are measured and paged; their titles never rely on motion.
        var rows = allSessions().filter(function(s) { return (!data.roomFilter || s.room === data.roomFilter) && (!data.trackFilter || !s.track || s.track === data.trackFilter) && (!data.eventDay || s.rawDate === data.eventDay); }),
          batch = [];
        function push() {
          if (!batch.length && pages.length) return;
          var n = sceneDOM({ rows: batch }, pages.length, true);
          n.dataset.pdfPage = '';
          n.style.width = width + 'px';
          n.style.height = height + 'px';
          pages.push(n);
          batch = [];
        }
        rows.forEach(function (s) {
          batch.push(s);
          var probe = sceneDOM({ rows: batch }, pages.length, true);
          live.replaceChildren(probe);
          var list = probe.querySelector('.ag-scene-list');
          if (list.scrollHeight > list.clientHeight + 1 && batch.length > 1) {
            batch.pop();
            push();
            batch = [s];
          }
        });
        push();
        live.replaceChildren();
        pages.forEach(function (n, i) {
          n.querySelector('.ag-screen-footer').lastElementChild.textContent =
            i + 1 + ' / ' + pages.length;
          live.append(n);
        });
        root.classList.add('ag-export-pages');
        if (
          pages.some(function (n) {
            var l = n.querySelector('.ag-scene-list');
            return l.scrollHeight > l.clientHeight + 1;
          })
        ) {
          throw new Error(
            tr('A session is too long for this page. Increase the page size or choose an interactive HTML page.')
          );
        }
        if (!['pdf', 'pdf-cmyk', 'pptx'].includes(format) && pages.length > 1) {
          throw new Error(
            tr('The full programme needs {pages} pages. Use PDF, PowerPoint or HTML to include every session.',{pages:pages.length})
          );
        }
      }
    } catch (error) {
      cleanup();
      throw error;
    }
    function cleanup() {
      staticExport = false;
      exporting = false;
      page = oldPage;
      elapsed = oldElapsed;
      root.classList.remove('ag-export-pages');
      root.classList.toggle('ag-legacy', legacy);
      root.style.width = oldWidth;
      root.style.height = oldHeight;
      if (page) renderPage();
      else {
        planScenes();
        paint(elapsed);
      }
      start = performance.now() - elapsed * 1000;
    }
    return cleanup;
  }
  function showScenes() {
    var dialog=el('dialog','ag-dialog ag-coverage');
    dialog.append(el('h2','','Scenes and coverage'));
    var report=JSON.parse(root.dataset.coverage);
    dialog.append(el('p','',scenes.length+' '+tr('scenes')+' · '+report.seconds+' '+tr('seconds')+' · '+Math.round(report.titlePixels)+' '+tr('px title type')+' · '+Math.round(report.anchorPixels)+' '+tr('px room and time type')));
    dialog.append(el('p','',(report.complete?tr('Every selected title completes its reveal. Longest wait:'):tr('Longest wait:'))+' '+report.longestWait+' '+tr('seconds')+'. '+tr('Revision:')+' '+data.revision));
    report.issues.forEach(function(issue){dialog.append(el('p','ag-data-warning',issue));});
    var grid=el('div','ag-contact');
    scenes.forEach(function(scene,i){
      var thumb=el('section','ag-contact-item');
      thumb.append(el('h3','',tr('Scene')+' '+(i+1)+' · '+scene.duration+' '+tr('seconds')));
      scene.rows.forEach(function(s){thumb.append(card(s,false));});
      thumb.append(button('Preview scene',function(){dialog.close();page=false;root.classList.remove('ag-page');elapsed=scenes.slice(0,i).reduce(function(n,s){return n+s.duration;},0);pausedAt=elapsed;start=performance.now()-elapsed*1000;paint(elapsed);}));
      grid.append(thumb);
    });
    dialog.append(grid,button('Close',function(){dialog.close();}));
    on(dialog,'close',function(){dialog.remove();});root.append(dialog);dialog.showModal();
  }
  root.__lollyPresentation = {
    prepare: prepare,
    dispose: dispose,
    get duration() {
      return Number(root.dataset.cycleSeconds) || data.dwell;
    },
    get mode() {
      return data.pptxMode;
    },
    get title() {
      return data.title;
    },
    get animate() {
      return data.motion !== 'off';
    },
    get notes() {
      return (
        'Event time zone: ' +
        (data.tz || 'floating') +
        '. Video time: ' +
        data.clockMode +
        '. Exported video is a recorded programme and does not receive live updates. Full session details follow in the readable slides.'
      );
    },
    readable: function (opts) {
      return prepare('pdf', opts);
    },
    kit: function () {
      var rooms = Array.from(new Set(data.sessions.map(function(s){return s.room;}).filter(Boolean)));
      if (rooms.length > 32) throw new Error(tr('An event kit supports at most 32 rooms. Filter the programme before exporting.'));
      function markup(overrides) {
        var clone = root.cloneNode(true), content = Object.assign({},data,overrides);
        clone.classList.remove('ag-enhanced','ag-page','ag-legacy');
        Array.from(clone.classList).filter(function(name){return name.startsWith('ag-layout-');}).forEach(function(name){clone.classList.remove(name);}); clone.querySelector('.ag-live').replaceChildren();
        clone.querySelectorAll('[data-export-hide],dialog,.ag-background-photo').forEach(function(n){n.remove();});
        clone.querySelector('[data-ag-document]').textContent = JSON.stringify(content).replace(/</g,'\\u003c');
        if(content.roomFilter) clone.querySelectorAll('.ag-fallback article').forEach(function(article){if(article.dataset.room!==content.roomFilter)article.remove();});
        return clone.outerHTML;
      }
      var variants = [{name:'programme',markup:markup({layout:'page'})},{name:'foyer',markup:markup({layout:'overview',roomFilter:''})}];
      rooms.forEach(function(room,i){variants.push({name:'room-'+(i+1)+'-'+room.replace(/[^a-z0-9_-]/gi,'-').slice(0,60),markup:markup({layout:'board',roomFilter:room})});});
      var sheet=root.cloneNode(true);sheet.classList.remove('ag-enhanced','ag-page','ag-legacy');sheet.classList.add('ag-contact-sheet');sheet.querySelector('.ag-live').replaceChildren();sheet.querySelectorAll('[data-export-hide],dialog').forEach(function(n){n.remove();});
      var contact=el('section','ag-fallback ag-contact');header(contact,'Scenes and coverage');scenes.forEach(function(scene,i){var group=el('section','ag-contact-item');group.append(el('h2','',tr('Scene')+' '+(i+1)+' · '+scene.duration+' '+tr('seconds')));scene.rows.forEach(function(s){group.append(card(s,false));});contact.append(group);});sheet.querySelector('.ag-fallback').replaceWith(contact);
      variants.push({name:'contact-sheet',markup:sheet.outerHTML,static:true});
      return { variants:variants, video:!!data.kitVideo, readme:tr('Programme revision:')+' '+data.revision+'\n'+tr('Event time zone:')+' '+(data.tz || tr('Floating time'))+'\n'+tr('Generated:')+' '+new Date().toISOString()+'\n'+(Number.isFinite(data.referenceMs) ? tr('Snapshot')+' · '+tr('Reference time:')+' '+new Date(data.referenceMs).toISOString() : tr('Local event time'))+'\n'+tr('HTML contains an embedded schedule. Republish after changes. Video is a recording.')+'\n', calendar:agCalendar(data.sessions,data.title) };
    },
    poster: function () {
      var oldPage=page,oldLegacy=legacy,oldExporting=exporting,oldStatic=staticExport;
      page=false;legacy=false;exporting=true;staticExport=true;
      root.classList.remove('ag-page','ag-legacy');measure();
      var rows=rowsForScreen(),scene=sceneDOM({rows:rows.slice(0,1)},0,true);
      live.replaceChildren(scene);drawBackground(0,60);
      function restore(){page=oldPage;legacy=oldLegacy;exporting=oldExporting;staticExport=oldStatic;root.classList.toggle('ag-legacy',legacy);if(page)renderPage();else{planScenes();paint(elapsed);}}
      var list=scene.querySelector('.ag-scene-list');
      if(list.scrollHeight>list.clientHeight+1){restore();throw new Error(tr('A session is too long for this page. Increase the page size or choose an interactive HTML page.'));}
      return restore;
    },
    freeze: function () {
      var reference=data.referenceMs;data.referenceMs=eventInstant();
      return function(){data.referenceMs=reference;};
    },
  };
  canvas.__lollyFrameRender = function (t, seconds) {
    if (staticExport) return;
    paint(t * (seconds || Number(root.dataset.cycleSeconds) || 60));
  };
  root.classList.add('ag-enhanced', 'ag-layout-' + data.layout);
  root.dir = /^(ar|ur|he)(-|$)/.test(data.lang || '') ? 'rtl' : 'ltr';
  var observer = new ResizeObserver(function () {
    if (!exporting && !page) {
      planScenes();
      paint(elapsed);
    } else if (!exporting) {
      measure();
      drawBackground(0, 60);
    }
  });
  observer.observe(root);
  on(document, 'visibilitychange', function () {
    start = performance.now() - elapsed * 1000;
  });
  on(root, 'keydown', function (e) {
    if (page || e.target !== root) return;
    if (e.key === ' ') {
      e.preventDefault();
      pausedInstant = eventInstant(); paused = !paused;
      if (paused) pausedAt = elapsed;
      else start = performance.now() - pausedAt * 1000;
      root.classList.toggle('ag-paused',paused); root.dataset.pausedLabel=tr('Paused'); pause.textContent=tr(paused?'Play':'Pause');
      root.setAttribute(
        'aria-label',
        paused
          ? tr('Programme paused. Press Space to resume.')
          : tr('Programme playing. Press Space to pause.')
      );
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      var i = (current + (e.key === 'ArrowRight' ? 1 : -1) + scenes.length) % scenes.length;
      elapsed = scenes.slice(0, i).reduce(function (n, s) {
        return n + s.duration;
      }, 0);
      pausedAt = elapsed;
      start = performance.now() - elapsed * 1000;
      paint(elapsed);
    }
  });
  on(window, 'popstate', readUrl);
  on(reduced, 'change', function () {
    if (!page && !exporting) {
      planScenes();
      paint(elapsed);
    }
  });
  if (data.diagnostics.length) {
    var issues = el('details', 'ag-diagnostics');
    issues.setAttribute('data-export-hide', '');
    issues.append(el('summary', '', data.diagnostics.length + ' ' + tr('programme issues')));
    data.diagnostics.slice(0, 30).forEach(function (d) {
      issues.append(el('p', '', (d.row ? tr('Row') + ' ' + d.row + ': ' : '') + d.message));
    });
    root.append(issues);
  }
  {
    var controls = el('nav', 'ag-screen-controls');
    controls.setAttribute('data-export-hide', '');
    controls.setAttribute('aria-label', tr('Programme playback'));
    function step(delta) {
      var i = (current + delta + scenes.length) % scenes.length;
      elapsed = scenes.slice(0, i).reduce(function (n, s) {
        return n + s.duration;
      }, 0);
      start = performance.now() - elapsed * 1000;
      pausedAt = elapsed;
      paint(elapsed);
    }
    var pause = button('Pause', function () {
      pausedInstant = eventInstant(); paused = !paused;
      root.classList.toggle('ag-paused',paused);root.dataset.pausedLabel=tr('Paused');
      pause.textContent = tr(paused ? 'Play' : 'Pause');
      if (paused) pausedAt = elapsed;
      else start = performance.now() - pausedAt * 1000;
    });
    controls.append(
      button('Previous', function () {
        step(-1);
      }),
      pause,
      button('Next', function () {
        step(1);
      }),
      button('Full screen', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else { root.requestFullscreen?.(); if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function(lock){wakeLock=lock;}).catch(function(){}); }
      }),
      button('Restart', function () { elapsed=0; pausedAt=0; start=performance.now(); paint(0); }),
      button('Programme', function () { page=true; renderPage(); }),
      button('Scenes and coverage', function () { showScenes(); })
    );
    root.append(controls);
  }
  root.tabIndex = page ? -1 : 0;
  root.setAttribute('aria-label', tr(page ? 'Event programme' : 'Programme. Space pauses; arrow keys change scene.'));
  initBackground();
  if (page) {
    measure();
    renderPage();
    readUrl();
    drawBackground(0, 60);
  } else {
    planScenes();
    paint(0);
  }
  document.fonts.ready.then(function () {
    if (!disposed && !exporting && !page) {
      planScenes();
      paint(elapsed);
    }
  });
  frame = requestAnimationFrame(tick);
})();
