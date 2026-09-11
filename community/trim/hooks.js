/* global onInit, onInput, exportFile */
var _trimKey='',_trimSource=null,_trimJob=null;
function vals(model){var o={};model.forEach(function(i){o[i.id]=i.value;});return o;}
function fmtBytes(n){if(!(n>=0))return'';if(n<1024)return n+' B';var u=['KB','MB','GB'],x=n,p=-1;do{x/=1024;p++;}while(x>=1024&&p<2);return(x<10?x.toFixed(1):Math.round(x))+' '+u[p];}
function fmtTime(n){n=Math.max(0,Number(n)||0);var m=Math.floor(n/60),s=n-m*60;return m?m+':'+s.toFixed(2).padStart(5,'0'):s.toFixed(2)+'s';}
function base(name){return String(name||'clip').replace(/\.[^.]+$/,'');}
function options(v){var f=v.source;return{start:Number(v.start)||0,end:Number(v.end)||undefined,container:v.container||'keep',mute:Boolean(v.mute),audioOnly:v.audioOnly&&v.audioOnly!=='off'?v.audioOnly:false,sourceName:f&&f.name,sourceMime:f&&(f.mime||f.type)};}
function key(v){var f=v.source;return[f&&f.url,f&&f.size,v.start,v.end,v.container,v.mute,v.audioOnly].join('|');}
function job(host,v){var k=key(v);if(k===_trimKey&&_trimSource===v.source.bytes&&_trimJob)return _trimJob;_trimKey=k;_trimSource=v.source.bytes;_trimJob=Promise.resolve().then(function(){return host.media.trim(v.source.bytes,options(v));});return _trimJob;}
async function compute(ctx){
 var v=vals(ctx.model),f=v.source,o={hasFile:false,available:false,fileName:'',fileSize:'',sourceUrl:'',isVideo:false,error:'',rangeText:'',modeText:'',pending:false,done:false,durationText:'',containerText:'',cutText:'',sizeAfter:''};
 if(!f||!f.bytes)return o;
 o.hasFile=true;o.fileName=f.name||'clip';o.fileSize=fmtBytes(f.size||f.bytes.length);o.sourceUrl=f.url||'';o.isVideo=String(f.mime||f.type||'').indexOf('video/')===0||/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name||'');
 if(!ctx.host||!ctx.host.media||typeof ctx.host.media.trim!=='function'){o.error='Media trimming is not available in this app; it needs a browser with local media codecs.';return o;}
 o.available=true;
 const start=Math.max(0,Number(v.start)||0),end=Number(v.end)||0;
 o.rangeText=fmtTime(start)+' → '+(end>0?fmtTime(end):'end');
 o.modeText=v.audioOnly&&v.audioOnly!=='off'?'Extract '+String(v.audioOnly).toUpperCase():(v.container==='gif'?'Animated GIF':(v.container==='keep'?'Keep container':String(v.container).toUpperCase()))+(v.mute?' · muted':'');
 if(end>0&&end<=start){o.error='End must be after start. Use 0 for the end of the file.';return o;}
 o.pending=true;if(ctx.report)ctx.report(o);
 try{const r=await job(ctx.host,v);o.done=true;o.duration=r.durationBefore;o.durationText=fmtTime(r.durationBefore)+' → '+fmtTime(r.durationAfter);o.containerText=String(r.container||'media').toUpperCase();o.cutText=r.lossless?'Packet-copy cut':'Re-encoded for exact boundaries';o.sizeAfter=fmtBytes(r.bytes.length);}catch(e){o.error=String(e&&e.message||e);}
 o.pending=false;
 return o;
}
function onInit(ctx){return compute(ctx);}function onInput(ctx){return compute(ctx);}
async function exportFile(ctx){var v=vals(ctx.model),f=v.source;if(!f||!f.bytes)throw new Error('Choose an audio or video file first.');if(!ctx.host||!ctx.host.media||typeof ctx.host.media.trim!=='function')throw new Error('Media trimming is not available in this app; it needs a browser with local media codecs.');var r=await job(ctx.host,v),ext=r.container==='opus'?'opus':r.container;return{bytes:r.bytes,mime:r.mime,filename:base(f.name)+'-trimmed.'+ext};}
