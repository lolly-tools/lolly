function dataUrl(bytes,mime){var chunks=[];for(var i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode.apply(null,bytes.subarray(i,i+32768)));return 'data:'+mime+';base64,'+btoa(chunks.join(''));}
function analysis(host,bytes){if(typeof host.audio.analyse!=='function')return Promise.resolve(null);return host.audio.analyse(bytes,{buckets:72,fps:1,bands:8});}
function job(host,v){
 const k=jobKey(v);if(k===_cleanJobKey&&v.source.bytes===_cleanSource&&_cleanJob)return _cleanJob;
 _cleanJobKey=k;_cleanSource=v.source.bytes;
 _cleanJob=Promise.resolve().then(async function(){
  var r=await host.audio.clean(v.source.bytes,cleanOpts(v));
  var preview=r.mime.indexOf('audio/')===0&&r.bytes.length<=8*1024*1024?{bytes:r.bytes,mime:r.mime,duration:r.durationAfter,excerpt:false}:r.preview;
  r.previewUrl='';r.afterWave=[];r.previewNote='';
  if(preview){r.previewUrl=dataUrl(preview.bytes,preview.mime);r.previewNote=preview.excerpt?'First '+fmtTime(preview.duration)+' · full-quality PCM audition':'Full cleaned recording';try{var a=await analysis(host,preview.bytes);r.afterWave=bars(a&&a.peaks);}catch(e){r.previewNote+=' · waveform unavailable';}}
  else r.previewNote='This shell could not prepare a playback preview. Download to listen to the complete result.';
  return r;
 });
 return _cleanJob;
}async function compute(ctx){
 var v=vals(ctx.model),f=v.source,o={hasFile:false,available:false,isVideo:isVideo(f),fileName:'',fileSize:'',sourceUrl:'',error:'',wave:[],afterWave:[],previewUrl:'',previewNote:'',pending:false,done:false,before:'',after:'',trimmed:'',peak:'',operations:'',outputText:''};
 if(!f||!f.bytes)return o;o.hasFile=true;o.fileName=f.name||'recording';o.fileSize=fmtBytes(f.size||f.bytes.length);o.sourceUrl=f.url||'';
 if(!ctx.host||!ctx.host.audio||typeof ctx.host.audio.clean!=='function'){o.error='Audio cleanup is not available in this app.';return o;}o.available=true;
 o.pending=true;if(ctx.report)ctx.report(o);
 if(!_cleanAnalyses.has(f.bytes))_cleanAnalyses.set(f.bytes,analysis(ctx.host,f.bytes).catch(function(){return null;}));
 try{
  var results=await Promise.all([_cleanAnalyses.get(f.bytes),job(ctx.host,v)]),a=results[0],r=results[1];
  if(a){o.wave=bars(a.peaks);o.beforeDuration=fmtTime(a.duration);}
  o.done=true;o.before=fmtLufs(r.loudnessBefore);o.after=fmtLufs(r.loudnessAfter);o.trimmed=fmtTime(r.secondsTrimmed);o.peak=isFinite(r.truePeakDb)?r.truePeakDb.toFixed(1)+' dBTP':'Silence';o.operations=r.operations.join(' · ')||'Decoded and re-encoded';o.outputText=(r.container||r.format).toUpperCase()+' · '+fmtTime(r.durationAfter)+' · '+fmtBytes(r.bytes.length);
  o.previewUrl=r.previewUrl;o.afterWave=r.afterWave;o.previewNote=r.previewNote;
 }catch(e){o.error=String(e&&e.message||e);}
 o.pending=false;return o;
}
/* global onInit, onInput, exportFile */
var _cleanJobKey='', _cleanJob=null;
function vals(model){var o={};model.forEach(function(i){o[i.id]=i.value;});return o;}
function fmtBytes(n){if(!(n>=0))return'';if(n<1024)return n+' B';var u=['KB','MB','GB'],x=n,p=-1;do{x/=1024;p++;}while(x>=1024&&p<2);return(x<10?x.toFixed(1):Math.round(x))+' '+u[p];}
function fmtTime(n){n=Math.max(0,Number(n)||0);var m=Math.floor(n/60),s=n-m*60;return m?m+':'+s.toFixed(1).padStart(4,'0'):s.toFixed(1)+'s';}
function fmtLufs(n){return n==null||!isFinite(n)?'No measurable programme':Number(n).toFixed(1)+' LUFS';}
function base(name){return String(name||'recording').replace(/\.[^.]+$/,'');}
function cleanOpts(v){return{denoise:v.denoise||'off',normalize:v.normalize==='off'?'off':Number(v.normalize),trimSilence:Boolean(v.trimSilence),output:v.audioFormat||'wav',sourceName:v.source&&v.source.name,sourceMime:v.source&&(v.source.mime||v.source.type)};}
function jobKey(v){var f=v.source;return[f&&f.url,f&&f.size,v.denoise,v.normalize,v.trimSilence,v.audioFormat].join('|');}
function job(host,v){const k=jobKey(v);if(k===_cleanJobKey&&_cleanJob)return _cleanJob;_cleanJobKey=k;_cleanJob=host.audio.clean(v.source.bytes,cleanOpts(v));_cleanJob.catch(function(){if(_cleanJobKey===k){_cleanJobKey='';_cleanJob=null;}});return _cleanJob;}
function budget(p,ms){return new Promise(function(resolve){var done=false,t=setTimeout(function(){if(!done){done=true;resolve(null);}},ms);p.then(function(v){if(!done){done=true;clearTimeout(t);resolve(v);}},function(){if(!done){done=true;clearTimeout(t);resolve(null);}});});}
function bars(peaks){var a=[];if(!peaks)return a;for(let i=0;i<peaks.length;i+=Math.max(1,Math.ceil(peaks.length/72)))a.push({h:Math.max(3,Math.round((peaks[i]||0)*54))});return a;}
async function compute(ctx){
 var v=vals(ctx.model),f=v.source,o={hasFile:false,available:false,fileName:'',fileSize:'',sourceUrl:'',error:'',wave:[],pending:false,done:false,before:'',after:'',trimmed:'',peak:'',operations:'',outputText:''};
 if(!f||!f.bytes)return o;o.hasFile=true;o.fileName=f.name||'recording';o.fileSize=fmtBytes(f.size||f.bytes.length);o.sourceUrl=f.url||'';
 if(!ctx.host||!ctx.host.audio||typeof ctx.host.audio.clean!=='function'){o.error='Audio cleanup is not available in this app.';return o;}o.available=true;
 try{if(typeof ctx.host.audio.analyse==='function'){const a=await ctx.host.audio.analyse(f.bytes,{buckets:72,fps:1,bands:8});o.wave=bars(a.peaks);o.beforeDuration=fmtTime(a.duration);}}catch(e){o.error=String(e&&e.message||e);}
 try{const r=await budget(job(ctx.host,v),1100);if(!r){o.pending=true;return o;}o.done=true;o.before=fmtLufs(r.loudnessBefore);o.after=fmtLufs(r.loudnessAfter);o.trimmed=fmtTime(r.secondsTrimmed);o.peak=isFinite(r.truePeakDb)?r.truePeakDb.toFixed(1)+' dBTP':'Silence';o.operations=r.operations.join(' · ')||'Decoded and re-encoded';o.outputText=(r.container||r.format).toUpperCase()+' · '+fmtTime(r.durationAfter)+' · '+fmtBytes(r.bytes.length);}
 catch(e){o.error=String(e&&e.message||e);}return o;
}
function onInit(ctx){return compute(ctx);}function onInput(ctx){return compute(ctx);}
async function exportFile(ctx){var v=vals(ctx.model),f=v.source;if(!f||!f.bytes)throw new Error('Choose an audio or video file first.');if(!ctx.host||!ctx.host.audio||typeof ctx.host.audio.clean!=='function')throw new Error('Audio cleanup is not available in this app.');var r=await job(ctx.host,v),ext=r.container||r.format;return{bytes:r.bytes,mime:r.mime,filename:base(f.name)+'-clean.'+ext};}
