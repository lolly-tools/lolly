// Voice Recorder — live level meter + coaching.
//
// The runtime drives `onLevel` from host.recorder (mic meter / recording) once per
// audio sample (engine v1.17). Hooks are DOM-free, so the shell computes the raw
// AudioLevel { rms, peak, dbfs, clipping, t } and we turn it here into the values the
// (logic-less) template renders: the bar %, the dB read-out, a tone, and a coaching
// tip. Keys that don't match an input id land in `extras` for the template.

// Per-mount state (persists across onLevel calls via the hook-factory closure).
// okStreak counts consecutive all-clear frames (→ "Sounds great" after a while).
var okStreak = 0;

function inputVal(model, id, dflt) {
  var it = (model || []).find(function (i) { return i.id === id; });
  return it && it.value != null && it.value !== '' ? it.value : dflt;
}

// rms bands [tooQuiet, tooLoud] per target level.
var BANDS = { soft: [0.02, 0.18], normal: [0.05, 0.32], loud: [0.10, 0.5] };

function onInit() {
  // Idle defaults so the still (png/svg) export + gallery thumbnail read cleanly
  // before any mic level has arrived.
  return { live: false, barPct: 0, peakPct: 0, dbText: '', tone: 'ok', barTone: 'ok', clipping: false, tip: '' };
}

function onLevel(ctx) {
  var level = ctx.level, model = ctx.model;
  var target = inputVal(model, 'targetLevel', 'normal');
  var showTips = inputVal(model, 'showTips', true);
  var band = BANDS[target] || BANDS.normal;
  var quiet = band[0], hot = band[1];

  // Scale rms so a healthy voice fills most of the bar (~0.5 rms reads as full).
  var barPct = Math.round(Math.min(1, level.rms / 0.5) * 100);
  var peakPct = Math.round(Math.min(1, level.peak) * 100);
  var hasSignal = level.peak > 0 && level.dbfs !== -Infinity;
  var dbText = hasSignal ? (Math.round(Math.max(-60, level.dbfs)) + ' dB') : '−∞ dB';

  var clipping = level.clipping;
  var tooQuiet = level.rms < quiet;
  var tooLoud = !clipping && level.rms > hot;

  // Background-noise cues — present only from a v1.19 raw meter (undefined otherwise,
  // so each is guarded). The sound-check runs the mic RAW, so these read the true room;
  // during the take the recording suppresses noise, so they fall quiet (which is fine —
  // a noisy-room warning is a pre-record check). 'speaking' gates them so a normal soft
  // voice isn't mistaken for a noisy room.
  var floor = level.noiseFloor;
  var noisy = floor != null && isFinite(floor) && floor > -50;
  var humming = level.hum != null && level.hum >= 0.25;
  var hissy = level.hiss != null && level.hiss >= 0.45 && noisy;
  // A steady loudness envelope (v1.20) at an audible level = a CONSTANT drone (fan/AC/
  // hiss), not speech. Speech modulates the rms (peaks + gaps); a hiss holds it flat, so
  // without this a mid-level hiss keeps a high snr and reads as "speaking" → "Nice and
  // clear". Gate 'speaking' on it so the noise tips below fire instead.
  var droning = level.steady != null && level.steady >= 0.6 && level.rms > quiet;
  var speaking = !droning && (level.snr != null ? level.snr > 12 : level.rms > quiet);

  var tone = 'ok', tip = '';
  if (clipping) { tone = 'hot'; tip = 'You’re clipping — ease off or back away a little'; okStreak = 0; }
  else if (tooLoud) { tone = 'hot'; tip = 'A touch hot — pull back from the mic'; okStreak = 0; }
  else if (!speaking && humming) { tone = 'low'; tip = 'Electrical hum — try another cable or power socket'; okStreak = 0; }
  else if (!speaking && droning) { tone = 'low'; tip = 'Steady background noise — turn off fans, AC or air circulation'; okStreak = 0; }
  else if (!speaking && hissy) { tone = 'low'; tip = 'Background hiss — turn off nearby fans or AC'; okStreak = 0; }
  else if (!speaking && noisy) { tone = 'low'; tip = 'Noisy room — a quieter spot will sound cleaner'; okStreak = 0; }
  else if (tooQuiet) { tone = 'low'; tip = 'Too quiet — move closer or speak up'; okStreak = 0; }
  else {
    tone = 'ok'; okStreak++;
    tip = okStreak > 45 ? 'Sounds great — relax and keep going' : 'Nice and clear';
  }

  return {
    live: true,
    barPct: barPct,
    peakPct: peakPct,
    dbText: dbText,
    clipping: clipping,
    tone: tone,
    barTone: clipping || tooLoud ? 'hot' : tooQuiet ? 'low' : 'ok',
    tip: showTips ? tip : ''
  };
}
