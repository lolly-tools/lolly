/* global onInit, onInput, exportFile */
var _trimKey='',_trimSource=null,_trimJob=null;
var SHARE_EDGES={'1080':1080,'720':720,'480':480};
var CODEC_NAMES={avc:'H.264',hevc:'HEVC',vp8:'VP8',vp9:'VP9',av1:'AV1',prores:'ProRes',aac:'AAC',opus:'Opus',mp3:'MP3',vorbis:'Vorbis',flac:'FLAC','pcm-s16':'PCM'};
var TURNS={90:'90° clockwise',180:'180°',270:'90° anticlockwise'};
function vals(model){var o={};model.forEach(function(i){o[i.id]=i.value;});return o;}
function fmtBytes(n){if(!(n>=0))return'';if(n<1024)return n+' B';var u=['KB','MB','GB'],x=n,p=-1;do{x/=1024;p++;}while(x>=1024&&p<2);return(x<10?x.toFixed(1):Math.round(x))+' '+u[p];}
function fmtTime(n){n=Math.max(0,Number(n)||0);var m=Math.floor(n/60),s=n-m*60;return m?m+':'+s.toFixed(2).padStart(5,'0'):s.toFixed(2)+'s';}
function base(name){return String(name||'clip').replace(/\.[^.]+$/,'');}
function codecName(c){return c?(CODEC_NAMES[c]||String(c).toUpperCase()):'unknown codec';}
function boxName(c){return c==='webm'?'WebM':c==='opus'?'Ogg':String(c||'this container').toUpperCase();}
function mode(v){return v.make==='poster'||v.make==='sheet'?v.make:'clip';}
function plainError(e){var m=String(e&&e.message||e).replace(/^media trim:\s*/,'');return m.charAt(0).toUpperCase()+m.slice(1);}
function options(v){
 var f=v.source,m=mode(v),o={start:Number(v.start)||0,end:Number(v.end)||undefined,container:v.container||'keep',mute:Boolean(v.mute),audioOnly:v.audioOnly&&v.audioOnly!=='off'?v.audioOnly:false,sourceName:f&&f.name,sourceMime:f&&(f.mime||f.type),rotate:Number(v.rotate)||0};
 if(m==='poster'){o.output='poster';delete o.end;}
 if(m==='sheet'){o.output='contact-sheet';o.sheetFrames=Number(v.frames)||12;}
 if(m!=='clip'){o.image=v.imageFormat==='png'?'png':'jpeg';return o;}
 o.cut=v.cut==='keyframe'?'keyframe':'exact';
 if(SHARE_EDGES[v.shareSize])o.maxShortEdge=SHARE_EDGES[v.shareSize];
 if(Number(v.maxMB)>0)o.targetBytes=Math.round(Number(v.maxMB)*1048576);
 return o;
}
function key(v){var f=v.source;return[f&&f.url,f&&f.size,JSON.stringify(options(v))].join('|');}
function job(host,v){var k=key(v);if(k===_trimKey&&_trimSource===v.source.bytes&&_trimJob)return _trimJob;_trimKey=k;_trimSource=v.source.bytes;_trimJob=Promise.resolve().then(function(){return host.media.trim(v.source.bytes,options(v));});return _trimJob;}
function skew(x){var ms=Math.round(Math.abs(x)*1000);return ms===0?'with the picture':ms+' ms '+(x>0?'after':'before')+' the picture';}
function reasonText(r,rep,box,t){
 switch(r){
  case'cut-between-key-frames':return'the start falls '+fmtTime(rep.keyFrameGap)+' after the nearest key frame';
  case'codec-not-in-container':return boxName(box)+' cannot carry '+codecName(t.codec);
  case'format-requested':return'you chose '+boxName(box);
  case'rotation-needs-pixels':return boxName(box)+' has no orientation setting, so the turn is drawn into the picture';
  case'resize':return'the sharing size needs a smaller picture';
  case'target-size':return'the size limit needs a lower bitrate';
  case'container-timing':return'the cut falls inside a packet and '+boxName(box)+' cannot hide the lead-in';
  case'removed-by-request':return'removed as you asked';
  case'not-primary':return'only the main picture and sound are kept';
  default:return String(r);
 }
}
function trackLine(t,rep,box){
 var what=t.kind==='video'?'Picture':t.kind==='audio'?'Sound':'Other track',name=codecName(t.codec),why=(t.reasons||[]).map(function(r){return reasonText(r,rep,box,t);});
 if(t.action==='copy')return{label:what,text:name+' copied, packets unchanged'};
 if(t.action==='drop')return{label:what,text:name+' left out: '+why.join('; ')};
 return{label:what,text:name+' re-encoded'+(t.outputCodec&&t.outputCodec!==t.codec?' to '+codecName(t.outputCodec):'')+' because '+why.join('; ')};
}
function describe(o,r,v){
 var rep=r.report,m=mode(v);
 if(!rep){if(m!=='clip')throw new Error('This version of the app cannot make poster frames or contact sheets yet. Update the app, or choose Clip.');o.notes=[{label:'Note',text:'This version of the app does not report how the clip was made, and ignores turning, sharing size and size limits.'}];return;}
 var notes=[],box=r.container;
 o.methodText=rep.method==='copy'?'Fast copy: no re-encode, no quality lost':rep.method==='mixed'?'Partly re-encoded':rep.method==='frames'?'Drawn from the video frames':'Re-encoded';
 (rep.tracks||[]).forEach(function(t){notes.push(trackLine(t,rep,box));});
 if(m==='clip'&&rep.actualStart<rep.requestedStart-0.0005&&rep.keyFrameGap>=0.0005){
  var early=rep.requestedStart-rep.actualStart;
  notes.push({label:'Start',text:v.cut!=='keyframe'?'Starts on the key frame already showing at your start point.':'Starts at '+fmtTime(rep.actualStart)+', the key frame '+fmtTime(early)+' before your start point.'});
 }else if((rep.tracks||[]).some(function(t){return(t.reasons||[]).indexOf('cut-between-key-frames')>=0;})){
  notes.push({label:'Start',text:'Starts exactly at your start point. A fast cut would start '+fmtTime(rep.keyFrameGap)+' earlier without re-encoding the picture.'});
 }
 var s=rep.sync;
 if(s)notes.push(s.ok?{label:'Sync',text:s.method==='packets'?'Sound and picture keep the source timing, packet for packet.':'Sound and picture stay in step, within '+Math.round(s.tolerance*1000)+' ms.'}:{label:'Check sync',warn:true,text:'The sound starts '+skew(s.startSkew)+' (source: '+skew(s.expectedStartSkew)+') and ends '+skew(s.endSkew)+' (source: '+skew(s.expectedEndSkew)+').'});
 var a=rep.orientation;
 if(a&&!a.ok)notes.push({label:'Check orientation',warn:true,text:'The clip shows '+a.width+' × '+a.height+' where '+a.expectedWidth+' × '+a.expectedHeight+' was expected.'});
 else if(a&&a.requested)notes.push({label:'Orientation',text:'Turned '+TURNS[a.requested]+(a.method==='flag'?' with the orientation setting; the picture itself is unchanged.':' by drawing the turn into the picture.')});
 else if(a&&a.sourceRotation)notes.push({label:'Orientation',text:'Kept the source orientation ('+a.sourceRotation+'°).'});
 else if(rep.method==='frames'&&Number(v.rotate))notes.push({label:'Orientation',text:'Turned '+TURNS[Number(v.rotate)]+'.'});
 var c=rep.color;
 if(c&&!c.kept)notes.push({label:'Colour',warn:true,text:'Colour information changed from '+(c.source||'none declared')+' to '+(c.output||'none declared')+'.'});
 else if(c&&c.source)notes.push({label:'Colour',text:'Colour information kept ('+c.source+').'});
 if(rep.size)o.sizeText=rep.size.width+' × '+rep.size.height;
 var g=rep.target;
 if(g)notes.push(g.met?{label:'Size limit',text:'Within the '+fmtBytes(g.bytes)+' limit.'}:{label:'Size limit',warn:true,text:'Still over the '+fmtBytes(g.bytes)+' limit after '+g.attempts+(g.attempts===1?' attempt':' attempts')+'. This is the smallest result; shorten the clip or choose a smaller sharing size.'});
 o.notes=notes;
}
async function compute(ctx){
 var v=vals(ctx.model),f=v.source,m=mode(v),o={hasFile:false,available:false,fileName:'',fileSize:'',sourceUrl:'',isVideo:false,error:'',rangeText:'',modeText:'',pending:false,done:false,durationText:'',containerText:'',cutText:'',sizeAfter:'',sizeText:'',methodText:'',notes:[],isClip:m==='clip',isPoster:m==='poster',isSheet:m==='sheet',clipVideo:false,startLabel:'Start (seconds)',downloadLabel:'Download clip'};
 if(!f||!f.bytes)return o;
 o.hasFile=true;o.fileName=f.name||'clip';o.fileSize=fmtBytes(f.size||f.bytes.length);o.sourceUrl=f.url||'';o.isVideo=String(f.mime||f.type||'').indexOf('video/')===0||/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name||'');
 o.clipVideo=o.isClip&&o.isVideo&&(!v.audioOnly||v.audioOnly==='off')&&v.container!=='gif';
 o.canTurn=o.isVideo&&(!o.isClip||!v.audioOnly||v.audioOnly==='off');
 if(o.isPoster){o.startLabel='Poster frame at (seconds)';o.downloadLabel='Download poster frame';}
 if(o.isSheet)o.downloadLabel='Download contact sheet';
 if(!ctx.host||!ctx.host.media||typeof ctx.host.media.trim!=='function'){o.error='Media trimming is not available in this app; it needs a browser with local media codecs.';return o;}
 o.available=true;
 const start=Math.max(0,Number(v.start)||0),end=Number(v.end)||0;
 o.rangeText=o.isPoster?'Frame at '+fmtTime(start):fmtTime(start)+' → '+(end>0?fmtTime(end):'end');
 o.modeText=o.isPoster?'Poster frame · '+(v.imageFormat==='png'?'PNG':'JPEG'):o.isSheet?'Contact sheet · '+(Number(v.frames)||12)+' frames':v.audioOnly&&v.audioOnly!=='off'?'Extract '+String(v.audioOnly).toUpperCase():(v.container==='gif'?'Animated GIF':(v.container==='keep'?'Keep container':String(v.container).toUpperCase()))+(v.mute?' · muted':'');
 if(!o.isClip&&!o.isVideo){o.error='Poster frames and contact sheets need a video.';return o;}
 if(!o.isPoster&&end>0&&end<=start){o.error='End must be after start. Use 0 for the end of the file.';return o;}
 o.pending=true;if(ctx.report)ctx.report(o);
 try{
  const r=await job(ctx.host,v);
  o.done=true;o.duration=r.durationBefore;
  o.durationText=o.isPoster?'Frame at '+fmtTime(start):o.isSheet?(r.frameCount||0)+' frames':fmtTime(r.durationBefore)+' → '+fmtTime(r.durationAfter);
  o.containerText=boxName(r.container);
  o.cutText=r.report?'':r.lossless?'Packet-copy cut':'Re-encoded';
  o.sizeAfter=fmtBytes(r.bytes.length);
  describe(o,r,v);
 }catch(e){o.done=false;o.error=plainError(e);}
 o.pending=false;
 return o;
}
function onInit(ctx){return compute(ctx);}function onInput(ctx){return compute(ctx);}
async function exportFile(ctx){
 var v=vals(ctx.model),f=v.source,m=mode(v);
 if(!f||!f.bytes)throw new Error('Choose an audio or video file first.');
 if(!ctx.host||!ctx.host.media||typeof ctx.host.media.trim!=='function')throw new Error('Media trimming is not available in this app; it needs a browser with local media codecs.');
 var r=await job(ctx.host,v),ext=r.container==='opus'?'opus':r.container,suffix=m==='poster'?'-poster':m==='sheet'?'-contact-sheet':'-trimmed';
 if(m!=='clip'&&!r.report)throw new Error('This version of the app cannot make poster frames or contact sheets yet. Update the app, or choose Clip.');
 return{bytes:r.bytes,mime:r.mime,filename:base(f.name)+suffix+'.'+ext};
}
