
window.__lollyChipField=function(canvas,opt){
  opt=opt||{};
  var ctx=canvas.getContext('2d');
  // GENERATED at build time from docs/site/formats-catalog.json (chipExtensions()) -
  // every format the catalog says Lolly can WRITE. Not a hand list: the last one was
  // written when Lolly exported 27 formats and was still claiming 27 long after the
  // real answer had passed 40, because nothing failed when it fell behind.
  var exts=[".SVG",".PDF",".PNG",".JPG",".WEBP",".GIF",".TIFF",".AVIF",".JXL",".PSD",".MP4",".WEBM",".MP3",".M4A",".PPTX",".SCORM",".CSV",".JSON",".PENPOT",".LOTTIE",".WAV",".OPUS",".EPS",".EMF",".DXF",".EXR",".ICO",".APNG",".HTML",".MD",".TXT",".ICS",".VCF",".DTCG",".ASE",".GPL",".SCSS",".ZIP",".SVGZ",".BMP",".WMF",".WOFF",".TTF",".OTF",".EPUB",".DOCX",".ODT",".GZ",".TAR"];
  // Headline formats appear ~2x as often as the rest: listing them again weights
  // them double in the pick pool (each favored ext is in the pool twice).
  var extPool=exts.concat(['.PDF','.SVG','.PNG','.MP4','.PPTX']);
  var floaters=[], fragments=[];
  // The chip colours, resolved at bake time. Two fields only: the box and its label.
  var defaultPal=function(){return{fill:'#1c4a2e',label:'#30ba78'};};
  var palette=opt.palette||defaultPal;
  var pal=palette();
  // Ambient chip population scales with canvas width so wide heroes aren't sparse
  // and narrow/mobile ones aren't crowded - and with height past a hero's worth,
  // since the landing's field runs on behind the covers band: twice the height at
  // the same count would be half the density. Short mastheads are unaffected.
  function targetFloaters(){ return Math.max(5, Math.min(22, Math.round(cw/100*Math.max(1, ch/600)))); }
  // Logical (CSS-pixel) canvas size. The backing store is scaled by devicePixelRatio
  // so the animation stays crisp on HiDPI/Retina displays instead of being a 1x
  // bitmap the browser upscales; all motion math below stays in these logical units.
  var dpr=Math.max(1, window.devicePixelRatio||1);
  var cw=800, ch=400;

  function resize(){
    dpr=Math.max(1, window.devicePixelRatio||1);
    cw=canvas.parentElement.offsetWidth||800;
    ch=canvas.parentElement.offsetHeight||400;
    canvas.width=Math.round(cw*dpr);
    canvas.height=Math.round(ch*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(still) paintOnce();
  }
  function rand(a,b){return a+Math.random()*(b-a);}

  // Bake one chip (filled box + label) into an offscreen sprite. Both the ambient
  // floaters and the click-burst fragments reuse this, so the chip look lives in
  // one place; callers add their own motion fields. Pre-compositing also lets a
  // chip fade as a single group instead of each layer fading over the bg.
  // ext/fs are passed back out so a palette change can re-bake the SAME chip
  // rather than replacing it with a different word at a different size.
  function makeChip(ext,fs){
    ext=ext||extPool[Math.floor(Math.random()*extPool.length)];
    fs=fs||rand(10,22);
    var weight='700';
    ctx.font=weight+' '+fs+'px SUSE,sans-serif';
    var tw=ctx.measureText(ext).width;
    var px=fs*0.75,py=fs*0.75;
    var w=tw+px*2, h=fs+py*2, r=Math.round(fs*0.38);
    var spr=document.createElement('canvas');
    spr.width=Math.ceil(w*dpr); spr.height=Math.ceil(h*dpr);
    var sx=spr.getContext('2d');
    sx.scale(dpr,dpr);
    sx.lineJoin='round';
    rr(sx,0,0,w,h,r);
    // Borderless: a solid fill (hero background) so overlapping chips occlude each
    // other cleanly instead of letting labels behind them bleed through. The chips
    // read apart via the soft drop shadow cast at blit time (see drawChip).
    sx.fillStyle=pal.fill; sx.fill();
    sx.fillStyle=pal.label;
    sx.font=weight+' '+fs+'px SUSE,sans-serif';
    // Centre on the actual glyph box, not the em box: these labels are all-caps
    // with no descenders, so a 'middle' baseline leaves them riding high with a
    // gap at the bottom. Offset the baseline by half the ink height to balance.
    sx.textAlign='center'; sx.textBaseline='alphabetic';
    var m=sx.measureText(ext);
    var asc=m.actualBoundingBoxAscent||fs*0.7, desc=m.actualBoundingBoxDescent||0;
    sx.fillText(ext,w/2,h/2+(asc-desc)/2);
    return{spr:spr,w:w,h:h,ext:ext,fs:fs};
  }

  // Ambient chip: drifts up from below the canvas, anti-gravity, with a gentle
  // leaf-like sway. The tilt tracks the horizontal sway so it reads as floating,
  // not spinning. initial=true spreads the first batch across the full height so
  // the hero isn't empty on load; otherwise it starts just below the bottom edge.
  function makeFloater(initial){
    var c=makeChip();
    var x=rand(c.w*0.6, cw-c.w*0.6);
    var y=initial ? rand(-c.h, ch) : ch+c.h+rand(0,ch*0.35);
    return{
      spr:c.spr, w:c.w, h:c.h, ext:c.ext, fs:c.fs,
      baseX:x, x:x, y:y, vy:rand(-0.95,-0.45),
      swayPhase:rand(0,Math.PI*2), swayFreq:rand(0.006,0.016), swayAmp:rand(6,20),
      rot:0, tilt:rand(0.18,0.79)
    };
  }

  // Click burst: a chip flung outward from (x,y); drag + gravity + fade in tick().
  function makeFragment(x,y,angle){
    var c=makeChip();
    var spd=rand(4.5,11.0);
    return{
      spr:c.spr, w:c.w, h:c.h,
      x:x,y:y,
      vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd,
      rot:rand(-0.5,0.5), vrot:rand(-0.022,0.022),
      alpha:rand(0.8,1.0), life:1
    };
  }

  function explodeAt(x,y){
    var count=Math.floor(rand(12,18));
    for(var i=0;i<count;i++){
      var angle=(i/count)*Math.PI*2+rand(-0.3,0.3);
      var f=makeFragment(x,y,angle);
      f.vx*=1.5; f.vy*=1.5;
      fragments.push(f);
    }
  }

  function rr(c,x,y,w,h,r){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);
    c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);
    c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);
    c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);
    c.arcTo(x,y,x+r,y,r);c.closePath();
  }

  // Blit a chip sprite. No drop shadow: per-frame shadowBlur forces a separate blur
  // pass on every chip every frame, which dominated the hero's render cost. The
  // chips' solid fill already occludes cleanly, so overlapping chips still read apart.
  function drawChip(c,alpha){
    ctx.save();
    ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.globalAlpha=alpha;
    ctx.drawImage(c.spr,-c.w/2,-c.h/2,c.w,c.h);
    ctx.restore();
  }

  function tick(){
    ctx.clearRect(0,0,cw,ch);

    // Fragments: drag + gravity, fade out
    for(var i=fragments.length-1;i>=0;i--){
      var f=fragments[i];
      f.vx*=0.972; f.vy=f.vy*0.972+0.03;
      f.x+=f.vx; f.y+=f.vy; f.rot+=f.vrot;
      f.life-=0.0045;
      if(f.life<=0){fragments.splice(i,1);continue;}
      // Hold the chip at full opacity for most of its life, then fall off a cliff
      // over the last ~18%. A linear fade leaves chips semi-transparent the whole
      // time, so their solid fill goes translucent and overlapping chips bleed
      // through (muddy). Squaring the tail makes the late drop bite harder.
      var t=f.life/0.18, fade=t>=1?1:t*t;
      drawChip(f, f.alpha*fade);
    }

    // Floaters: drift up, sway, fade at the top/bottom edges, recycle off-top.
    for(var i=floaters.length-1;i>=0;i--){
      var fl=floaters[i];
      fl.swayPhase+=fl.swayFreq;
      fl.y+=fl.vy;
      fl.x=fl.baseX+Math.sin(fl.swayPhase)*fl.swayAmp;
      fl.rot=Math.sin(fl.swayPhase)*fl.tilt;
      // No fade: chips ride in fully opaque from below the bottom edge, and the
      // canvas edge simply clips them as they pass the top. Drop once fully above.
      if(fl.y<-fl.h){ floaters.splice(i,1); continue; }
      drawChip(fl, 1);
    }

    // Replenish to the responsive target (also restocks after a resize grows it).
    while(floaters.length<targetFloaters()) floaters.push(makeFloater(false));

    if(running) requestAnimationFrame(tick);
  }

  // One frame, no loop - the reduced-motion rendering. The field still SAYS what it
  // says (formats, drifting); it just doesn't move while saying it.
  function paintOnce(){
    fill(true);
    ctx.clearRect(0,0,cw,ch);
    for(var i=0;i<floaters.length;i++) drawChip(floaters[i],1);
  }
  function fill(initial){
    while(floaters.length<targetFloaters()) floaters.push(makeFloater(initial));
  }

  var still=!!opt.reduceMotion && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var running=false;
  function start(){
    if(running||still)return;
    running=true; requestAnimationFrame(tick);
  }
  function stop(){ running=false; }
  // Re-bake every chip in the current palette, in place: same word, same size, same
  // position, new colours. A theme flip should recolour the field, not restart it.
  function rebake(){
    pal=palette();
    for(var i=0;i<floaters.length;i++){
      var fl=floaters[i], c=makeChip(fl.ext,fl.fs);
      fl.spr=c.spr; fl.w=c.w; fl.h=c.h;
    }
    if(still) paintOnce();
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  if(opt.burst){
    // Click/tap over the band bursts a ring of chips from the point. The canvas is
    // pointer-events:none, so we listen on the document and gate on its parent (the
    // .hero-wrap on the landing, the masthead band on an article); coords are mapped
    // into the canvas box, which covers the whole parent.
    var band=canvas.parentElement;
    var burstAt=function(e){
      if(!band.contains(e.target))return;
      if(still)return;               // a band that holds still holds still when clicked
      var rect=canvas.getBoundingClientRect();
      explodeAt(e.clientX-rect.left,e.clientY-rect.top);
    };
    if(opt.burstGuard){
      // On a page of prose the band contains real text and may later contain real
      // controls, so the effect yields to both: no burst from a link/button, and none
      // when the pointer was dragged (a text selection) rather than clicked. Fires on
      // pointerUP for exactly that reason - at pointerdown a drag is indistinguishable
      // from a tap.
      var dx=0,dy=0,downT=0;
      band.addEventListener('pointerdown',function(e){ dx=e.clientX; dy=e.clientY; downT=Date.now(); });
      band.addEventListener('pointerup',function(e){
        if(e.button!==0)return;
        if(e.target.closest('a,button,input,select,textarea,label,summary,[role="button"],[contenteditable]'))return;
        if(Math.abs(e.clientX-dx)>6||Math.abs(e.clientY-dy)>6)return;   // dragged: a selection
        if(Date.now()-downT>600)return;                                 // held: not a tap
        var sel=window.getSelection&&window.getSelection();
        if(sel&&!sel.isCollapsed)return;                                // text is selected
        burstAt(e);
      });
    }else{
      document.addEventListener('pointerdown',burstAt);
    }
  }
  fill(true);
  if(still){
    paintOnce();
  }else if(opt.pause){
    // Two gates, both cheap and both about not animating for nobody: off screen
    // (the reader has scrolled into the article) and hidden tab.
    var onScreen=true;
    var sync=function(){ if(onScreen && !document.hidden) start(); else stop(); };
    if(window.IntersectionObserver){
      new IntersectionObserver(function(es){ onScreen=es[0].isIntersecting; sync(); }).observe(canvas.parentElement);
    }
    document.addEventListener('visibilitychange',sync);
    sync();
  }else{
    start();
  }
  return {rebake:rebake,start:start,stop:stop};
};

;
(function(){
  var el=document.getElementById('fmt-catalog-data'),dlg=document.getElementById('fmt-dialog');
  if(!el||!dlg)return;var data;try{data=JSON.parse(el.textContent);}catch(e){return;}
  var DIR={in:'Reads · import only',out:'Writes · export only',both:'Reads & writes · round-trip'};
  var q=function(id){return dlg.querySelector(id);};
  function open(tok){var f=data.formats[tok];if(!f)return;
    q('#fmt-dlg-icon').innerHTML=(data.catIcons&&data.catIcons[f.category])||'';
    q('#fmt-dlg-dir').textContent=DIR[f.dir]||'';
    q('#fmt-dlg-name').textContent=f.name;
    q('#fmt-dlg-full').textContent=f.full+' · '+f.category;
    q('#fmt-dlg-desc').textContent=f.desc;
    var us=q('#fmt-dlg-specs');us.textContent='';
    ((data.specifics&&data.specifics[tok])||[]).forEach(function(s){var li=document.createElement('li');li.textContent=s;us.appendChild(li);});
    var ul=q('#fmt-dlg-feats');ul.textContent='';
    (f.features||[]).forEach(function(k){var li=document.createElement('li');li.textContent=(data.features&&data.features[k])||k;ul.appendChild(li);});
    var md=f.metadata||null,mEl=q('#fmt-dlg-meta');
    var names=function(v){return (v&&v.length?v:[]).map(function(k){return (data.metaLabels&&data.metaLabels[k])||k;}).join(', ')||'nothing';};
    mEl.textContent=md?('Metadata: reads '+names(md.reads)+' · writes '+names(md.writes)+' · round trip '+md.preserves+'.'+(md.note?' '+md.note:'')):'';
    var un=q('#fmt-dlg-unsup'),unWrap=q('#fmt-dlg-unsup-wrap');un.textContent='';
    var gaps=(data.unsupported&&data.unsupported[tok])||[];
    gaps.forEach(function(s){var li=document.createElement('li');li.textContent=s;un.appendChild(li);});
    unWrap.hidden=gaps.length===0;
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
  }
  document.addEventListener('click',function(e){
    var chip=e.target.closest&&e.target.closest('.fmt-chip');
    if(chip){e.preventDefault();open(chip.getAttribute('data-fmt'));return;}
    if(e.target===dlg)dlg.close();
  });
})();
;
(function(){var order=['light','dark','brand'];var r=document.documentElement;function sync(){var cur=r.dataset.theme||'light';document.querySelectorAll('[data-theme-set]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-theme-set')===cur));});}function apply(t){r.dataset.theme=t;r.classList.toggle('dark',t==='dark'||t==='brand');try{localStorage.setItem('theme',t);}catch(e){}sync();}var btn=document.querySelector('.site-fab--theme');if(btn)btn.addEventListener('click',function(){var cur=r.dataset.theme||'light';var i=order.indexOf(cur);apply(order[i<0?0:(i+1)%order.length]);});document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('[data-theme-set]');if(s)apply(s.getAttribute('data-theme-set'));});window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(e){var stored=null;try{stored=localStorage.getItem('theme');}catch(err){}if(!stored){r.dataset.theme=e.matches?'dark':'light';r.classList.toggle('dark',e.matches);sync();}});sync();})();
;
(function(){
  var els=document.querySelectorAll('.shot');if(!els.length)return;
  if(!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('shot--in');});return;}
  function land(el){
    // The RENDERED image, which on a dual shot in dark mode is the second one.
    // Blink fetches display:none images too, so keying off the first would happen
    // to work - and would be landing the motion on the wrong file's decode.
    var imgs=el.querySelectorAll('img'),img=imgs[0];
    for(var k=0;k<imgs.length;k++){if(getComputedStyle(imgs[k]).display!=='none'){img=imgs[k];break;}}
    // Decoded already (cache) → settle now. Otherwise settle on load, so the
    // motion always carries real pixels. A failed image still lands, or the shot
    // would be stuck invisible at opacity 0.
    if(!img||img.complete){el.classList.add('shot--in');return;}
    var go=function(){el.classList.add('shot--in');};
    img.addEventListener('load',go,{once:true});
    img.addEventListener('error',go,{once:true});
  }
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);land(e.target);}});
  },{threshold:0,rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(el){io.observe(el);});
})();
;
(function(){
  var els=document.querySelectorAll('.showcase');if(!els.length)return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;  // the <img> is already the finished state
  var ZOOM=0.22;   // p=0 shows this fraction of each axis, centred - deep in the streets
  var items=[];

  // Swap the <img> for live SVG parsed from the same file. Only ever an upgrade:
  // any failure (offline, 404, unparseable, no <svg> root) leaves the image alone,
  // so the worst case is a still screenshot rather than a broken one.
  function upgrade(fig,done){
    var src=fig.getAttribute('data-shot');if(!src)return;
    fetch(src,{credentials:'same-origin'}).then(function(r){
      if(!r.ok)throw new Error(r.status);return r.text();
    }).then(function(text){
      // Strip the credential from the DOM copy: a manifest whose hash binding no
      // longer matches its bytes is a FALSE NEGATIVE waiting to happen if anyone
      // saves this markup out. The file keeps its credential; the credential line
      // on this block points at the file.
      text=text.replace(/<metadata>[\s\S]*?<\/metadata>/g,'').replace(/<\?xml[^>]*\?>/g,'');
      // An inline SVG joins the PAGE's id space, so namespace anything it defines
      // before it can collide with another asset's clipPath or filter.
      text=text.replace(/\bid="([^"]+)"/g,'id="sc-$1"')
               .replace(/url\(#([^)]+)\)/g,'url(#sc-$1)')
               .replace(/\bhref="#([^"]+)"/g,'href="#sc-$1"');
      var doc=new DOMParser().parseFromString(text,'image/svg+xml');
      var svg=doc.documentElement;
      if(!svg||svg.nodeName!=='svg'||doc.querySelector('parsererror'))throw new Error('unparseable');
      svg.setAttribute('class','showcase-art');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('focusable','false');
      // The figure is fit-content, so the art's intrinsic width sizes it. An SVG with
      // no width of its own falls back to the caption's width and the block shrinks
      // under the reader, moving every heading below it: carry the image's size over.
      var img=fig.querySelector('.showcase-fallback');
      svg.removeAttribute('width');svg.removeAttribute('height');
      if(img&&img.getAttribute('width')&&img.getAttribute('height')){svg.setAttribute('width',img.getAttribute('width'));svg.setAttribute('height',img.getAttribute('height'));}
      var stage=fig.querySelector('.showcase-stage');
      if(!stage)return;
      // The image carried the accessible description; the live SVG is decorative,
      // so the description moves to the stage rather than being lost in the swap.
      if(img){stage.setAttribute('role','img');stage.setAttribute('aria-label',img.getAttribute('alt')||'');}
      stage.appendChild(document.importNode(svg,true));
      if(img)img.remove();
      done(fig,stage.querySelector('.showcase-art'));
    }).catch(function(){/* keep the <img> */});
  }

  function activate(fig,svg){
    var vb=(fig.getAttribute('data-viewbox')||'').split(/\s+/).map(Number);
    if(!svg||vb.length!==4||vb.some(function(n){return !isFinite(n);}))return;
    // Index the leaves in paint order for the stagger. Leaves only: a <g> wrapping
    // half the drawing would otherwise fade as one lump and swallow the layering.
    var leaves=svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,image,text,use');
    for(var i=0;i<leaves.length;i++){leaves[i].setAttribute('data-sc-i','');leaves[i].style.setProperty('--i',i);}
    svg.style.setProperty('--n',leaves.length||1);
    items.push({fig:fig,svg:svg,vb:vb});
    fig.classList.add('showcase--live');
    mark();
  }

  // Fetch when the block is within a screen of the viewport, not on load: this is
  // the one shot on the site worth a few hundred KB, and only for a reader who is
  // actually heading towards it.
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);upgrade(e.target,activate);}});
    },{rootMargin:'100% 0px'});
    els.forEach(function(el){io.observe(el);});
  }else{
    els.forEach(function(el){upgrade(el,activate);});
  }

  var dirty=false;
  function frame(){
    dirty=false;
    var vh=window.innerHeight||document.documentElement.clientHeight;
    items.forEach(function(it){
      var r=it.fig.getBoundingClientRect();
      // 0 when the block's top is still near the fold, 1 by the time its middle
      // has risen to just above centre. Clamped, so scrolling past holds the end.
      var p=(vh*0.9-r.top)/Math.max(1,(vh*0.55+r.height*0.35));
      p=p<0?0:p>1?1:p;
      it.fig.style.setProperty('--p',p.toFixed(4));
      var e=1-Math.pow(1-p,3);                       // ease-out: the camera decelerates into the wide shot
      var f=ZOOM+(1-ZOOM)*e;                         // fraction of each axis on show
      var w=it.vb[2]*f,h=it.vb[3]*f;
      var x=it.vb[0]+(it.vb[2]-w)/2,y=it.vb[1]+(it.vb[3]-h)/2;
      it.svg.setAttribute('viewBox',x.toFixed(2)+' '+y.toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2));
    });
  }
  function mark(){if(!dirty){dirty=true;requestAnimationFrame(frame);}}
  addEventListener('scroll',mark,{passive:true});
  addEventListener('resize',mark);
  frame();
})();
;
(function(){
  // "Copy signed source" - the banked art's third action (plans/105 section 6). Fetches the
  // SAME file the other two actions point at and puts its text on the clipboard, so a
  // reader can paste it straight into /verify's box and check the credential without
  // downloading anything. Wired FIRST, and independently of the reveal below: an
  // always-open line (a figure's, a page asset's) carries data-static and is
  // deliberately absent from that list.
  var copies=document.querySelectorAll('.shot-cred-copy');
  for(var ci=0;ci<copies.length;ci++)(function(btn){
    var label=btn.querySelector('.shot-cred-copy-label')||btn;
    var rest=label.textContent,timer=null;
    function say(word){
      clearTimeout(timer);
      label.textContent=word;
      // Long enough to read, short enough that the button is honest about its label
      // again before anyone tries a second copy.
      timer=setTimeout(function(){label.textContent=rest;},2400);
    }
    btn.addEventListener('click',function(){
      var src=btn.getAttribute('data-copy-src');if(!src)return;
      fetch(src,{credentials:'same-origin'}).then(function(r){
        if(!r.ok)throw new Error(r.status);return r.text();
      }).then(function(text){
        // No clipboard (an insecure origin, an old browser, a denied permission) is
        // a refusal to pretend: the button says so rather than reporting a copy that
        // never happened. The file is still one link away.
        if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error('no clipboard');
        return navigator.clipboard.writeText(text);
      }).then(function(){
        say(btn.getAttribute('data-copied')||'Copied');
      }).catch(function(){
        say(btn.getAttribute('data-copy-failed')||'Copy failed');
      });
    });
  })(copies[ci]);
  var creds=document.querySelectorAll('.shot-cred:not([data-static])');if(!creds.length)return;
  function close(c){c.removeAttribute('data-open');var b=c.querySelector('.shot-cred-btn');if(b)b.setAttribute('aria-expanded','false');}
  function closeAll(except){creds.forEach(function(c){if(c!==except)close(c);});}
  // Keep an opened line inside the viewport. It grows from the artwork's corner
  // toward inline-start, so on a narrow crop it can run past that edge of the
  // screen; measure it and slide it back by the overshoot (plus an 8px margin).
  function clamp(c){
    var line=c.querySelector('.shot-cred-line');if(!line)return;
    line.style.setProperty('--cred-shift','0px');
    var r=line.getBoundingClientRect(),edge=8,w=document.documentElement.clientWidth;
    var shift=r.left<edge?edge-r.left:(r.right>w-edge?w-edge-r.right:0);
    if(shift)line.style.setProperty('--cred-shift',Math.round(shift)+'px');
  }
  creds.forEach(function(c){
    var btn=c.querySelector('.shot-cred-btn');if(!btn)return;
    btn.addEventListener('mouseenter',function(){clamp(c);});
    btn.addEventListener('focus',function(){clamp(c);});
    btn.addEventListener('click',function(e){
      e.preventDefault();
      var open=!c.hasAttribute('data-open');
      closeAll(c);
      if(open){clamp(c);c.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}else close(c);
    });
  });
  window.addEventListener('resize',function(){var o=document.querySelector('.shot-cred[data-open]');if(o)clamp(o);});
  // Escape closes the open line and returns focus to its trigger, matching how the
  // app's own overlays behave.
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var open=document.querySelector('.shot-cred[data-open]');
    if(!open)return;
    close(open);
    var b=open.querySelector('.shot-cred-btn');if(b)b.focus();
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.shot-cred'))closeAll(null);
  });
})();
;
(function(){var els=document.querySelectorAll('.reveal');if(!els.length)return;
  // Pre-reveal on BOTH widths (plans/168 WP-3). Desktop used to wait for 10% of a band
  // to be inside the viewport minus 32px, which on this page's tall bands meant a
  // normally-paced scroller met an empty screen before the content faded in - the
  // un-revealed band still holds its layout space, so the gap is real, not perceived.
  // A positive bottom rootMargin starts the fade while the band is still below the fold.
  var opts={threshold:0,rootMargin:window.matchMedia('(max-width:768px)').matches
    ?'0px 0px 20% 0px'
    :'0px 0px 25% 0px'};
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});},opts);
  els.forEach(function(el){io.observe(el);});})();
;
(function(){
  // Adapted from shuding/liquid-glass (https://github.com/shuding/liquid-glass)
  var ns='http://www.w3.org/2000/svg';
  var xl='http://www.w3.org/1999/xlink';

  function smoothStep(a,b,t){t=Math.max(0,Math.min(1,(t-a)/(b-a)));return t*t*(3-2*t);}
  function len(x,y){return Math.sqrt(x*x+y*y);}
  function rrSDF(x,y,w,h,r){var qx=Math.abs(x)-w+r,qy=Math.abs(y)-h+r;return Math.min(Math.max(qx,qy),0)+len(Math.max(qx,0),Math.max(qy,0))-r;}

  function buildGlass(btn,idx){
    var rect=btn.getBoundingClientRect();
    var W=Math.round(rect.width)||180,H=Math.round(rect.height)||48;
    var id='lg'+idx;

    var canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    var ctx=canvas.getContext('2d');
    var n=W*H,raw=new Float32Array(n*2),maxS=0;

    for(var i=0;i<n;i++){
      var px=i%W,py=Math.floor(i/W);
      var ux=(px+0.5)/W-0.5,uy=(py+0.5)/H-0.5;
      var d=rrSDF(ux,uy,0.3,0.2,0.55);
      var disp=smoothStep(0.8,0,d-0.15);
      var sc=smoothStep(0,1,disp);
      var dx=ux*sc-ux,dy=uy*sc-uy;
      raw[i*2]=dx;raw[i*2+1]=dy;
      if(Math.abs(dx)>maxS)maxS=Math.abs(dx);
      if(Math.abs(dy)>maxS)maxS=Math.abs(dy);
    }
    maxS=(maxS*0.5)||0.01;

    var img=new Uint8ClampedArray(n*4);
    for(var i=0;i<n;i++){
      img[i*4]  =Math.round((raw[i*2]  /maxS+0.5)*255);
      img[i*4+1]=Math.round((raw[i*2+1]/maxS+0.5)*255);
      img[i*4+2]=0;img[i*4+3]=255;
    }
    ctx.putImageData(new ImageData(img,W,H),0,0);

    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('width','0');svg.setAttribute('height','0');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('class','lg-svg');
    svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;overflow:hidden';

    var defs=document.createElementNS(ns,'defs');
    var filter=document.createElementNS(ns,'filter');
    filter.setAttribute('id',id);
    filter.setAttribute('filterUnits','userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters','sRGB');
    filter.setAttribute('x','0');filter.setAttribute('y','0');
    filter.setAttribute('width',String(W));filter.setAttribute('height',String(H));

    var feImg=document.createElementNS(ns,'feImage');
    feImg.setAttribute('result','map');
    feImg.setAttribute('x','0');feImg.setAttribute('y','0');
    feImg.setAttribute('width',String(W));feImg.setAttribute('height',String(H));
    feImg.setAttribute('preserveAspectRatio','none');
    var mapUrl=canvas.toDataURL();
    feImg.setAttribute('href',mapUrl);            // modern feImage href
    feImg.setAttributeNS(xl,'href',mapUrl);       // legacy xlink fallback (older engines)

    var feDisp=document.createElementNS(ns,'feDisplacementMap');
    feDisp.setAttribute('in','SourceGraphic');feDisp.setAttribute('in2','map');
    feDisp.setAttribute('xChannelSelector','R');feDisp.setAttribute('yChannelSelector','G');
    // 2x displacement so the refraction visibly bends whatever passes behind the
    // button (format chips, the lollipop) instead of only whispering at the edge.
    var REFRACTION_BOOST=2;
    feDisp.setAttribute('scale',String((maxS*2*W*REFRACTION_BOOST).toFixed(2)));

    filter.appendChild(feImg);filter.appendChild(feDisp);
    defs.appendChild(filter);svg.appendChild(defs);
    document.body.appendChild(svg);

    var bf='url(#'+id+') blur(0.4px) contrast(1.15) brightness(1.07) saturate(1.2)';
    // Apply synchronously. The filter auto-re-renders when its feImage map finishes
    // loading, so there's no need to defer - and NOT via img.decode(), which never
    // resolves in a hidden/throttled tab and would leave the glass unapplied.
    btn.style.backdropFilter=bf;
    btn.style.webkitBackdropFilter=bf;
  }

  function paint(){
    // Clear any filters from a previous pass so a re-run (e.g. after webfonts change
    // the button size) rebuilds cleanly instead of stacking duplicate-id filters.
    document.querySelectorAll('svg.lg-svg').forEach(function(s){ s.remove(); });
    // PRIMARY only. The displacement backdrop paints the button blank in some
    // renderers (Chromium at rest, recovering only on the hover transform), which
    // is a nuisance under the primary's black-on-white label and a blank white
    // box under the secondary's white-on-glass one - so the secondary keeps the
    // stylesheet's plain blur and never takes the SVG filter. .btn-compact (the
    // persona lanes, plans/177) opts out for the same reason over the pane's flat
    // ground; small utility buttons keep their plain fill.
    document.querySelectorAll('.btn-primary:not(.btn-compact)').forEach(function(btn,i){
      try{ buildGlass(btn,i); }catch(e){ if(window.console)console.warn('liquid-glass failed',e); }
    });
  }
  // Two rAFs so layout has settled and the buttons have their final size; re-run once
  // on full load as a belt-and-braces guard for a cold image cache.
  requestAnimationFrame(function(){ requestAnimationFrame(paint); });
  window.addEventListener('load', paint);
})();
;
(function(){
  var canvas=document.getElementById('heroCanvas');
  if(!canvas)return;
  // The landing hero: default palette, always running, and it bursts when tapped.
  window.__lollyChipField(canvas,{burst:true});
})();
;
(function(){
  var canvas=document.querySelector('.docs-mast-canvas');
  if(!canvas)return;
  function tok(name,fallback){
    var v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v||fallback;
  }
  function palette(){
    var th=document.documentElement.dataset.theme;
    var dark=th==='dark'||th==='brand';  // brand is a dark ground too
    // Dark: the landing's own chip fill over the dark band, under color-dodge -
    // the same glow the front door has. Light: a mint chip on a near-white band,
    // normal blend, so the field reads as watermark rather than decoration.
    return dark
      ? {fill:'#1c4a2e', label:tok('--green','#30ba78')}
      : {fill:tok('--border','#d8ede4'), label:tok('--green','#30ba78')};
  }
  var field=window.__lollyChipField(canvas,{palette:palette,pause:true,reduceMotion:true,burst:true,burstGuard:true});
  // The [data-theme] flip (docs theme toggle) and the OS preference both change the answer.
  new MutationObserver(function(){ field.rebake(); })
    .observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  var mq=window.matchMedia('(prefers-color-scheme:dark)');
  if(mq.addEventListener) mq.addEventListener('change',function(){ field.rebake(); });
})();
;
(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href$="/verify"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();var w=Math.min(1100,screen.availWidth*.8),h=Math.min(850,screen.availHeight*.9);window.open(a.href,'lolly-verify','popup,width='+w+',height='+h+',left='+((screen.availWidth-w)/2)+',top='+((screen.availHeight-h)/2));});})();
;
(function(){
var wrap=document.querySelector('.docs-search');if(!wrap)return;
var input=document.getElementById('docs-search');
var out=document.getElementById('docs-search-results');
var base=wrap.getAttribute('data-search-base')||'/info';
var records=null,pending=null,active=-1,timer;

// Fold case and diacritics, so "recuperer" finds "récupérer" and the reverse.
// NFD splits an accented letter into base + combining mark and the range strip
// removes the mark; scripts that neither case-fold nor decompose pass through
// unchanged, which is the correct no-op rather than a wrong transform.
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

function load(){
  if(records)return Promise.resolve(records);
  if(!pending)pending=fetch(base+'/search-index.json')
    .then(function(r){return r.ok?r.json():[];})
    .then(function(j){records=j.map(function(r){r._=norm(r.h+' '+r.t+' '+r.x);return r;});return records;})
    .catch(function(){records=[];return records;});
  return pending;
}

// Every term must appear somewhere in the record - an AND, so adding a word
// narrows rather than widens. Where it matched decides the rank: a heading beats
// a page title beats body prose.
function score(r,terms){
  var h=norm(r.h),t=norm(r.t),s=0;
  for(var i=0;i<terms.length;i++){
    var q=terms[i];
    if(r._.indexOf(q)<0)return 0;
    if(h.indexOf(q)===0)s+=8;else if(h.indexOf(q)>=0)s+=5;
    else if(t.indexOf(q)>=0)s+=3;else s+=1;
  }
  if(!r.h)s+=1;
  return s;
}

function close(){out.hidden=true;out.textContent='';active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}

// Below 1000px the field folds into a round button (.site-fab--search). Pressing it
// opens the field over the bar and moves focus there; Escape on an empty field, or a
// tap anywhere else, folds it again and returns focus to the button.
var fab=document.querySelector('.site-fab--search'),bar=wrap.closest('.site-bar');
// The clear control: shown while there is text to clear, and also while the folded field
// is open over the bar, where it is the visible way to close the field again. Its name
// says which it will do.
var clearBtn=wrap.querySelector('.docs-search-clear');
function syncClear(){if(!clearBtn)return;var open=!!bar&&bar.classList.contains('is-searching');clearBtn.hidden=!input.value&&!open;clearBtn.setAttribute('aria-label',input.value?(clearBtn.getAttribute('data-clear')||'Clear search'):(clearBtn.getAttribute('data-close')||'Close'));}
function openField(){if(!bar)return;bar.classList.add('is-searching');fab.setAttribute('aria-expanded','true');input.focus();load();syncClear();}
function foldField(focusFab){if(!bar||!bar.classList.contains('is-searching'))return;bar.classList.remove('is-searching');if(fab){fab.setAttribute('aria-expanded','false');if(focusFab)fab.focus();}syncClear();}
if(fab)fab.addEventListener('click',openField);
if(clearBtn)clearBtn.addEventListener('click',function(){if(input.value){input.value='';close();syncClear();input.focus();}else foldField(true);});
input.addEventListener('input',syncClear);

// The panel is position:fixed to escape the sidebar's scroll clipping, so it has
// to be told where the input is - and told again whenever that moves. Clamped so
// a narrow window can't push it off the inline edge.
function place(){
  if(out.hidden)return;
  var r=input.getBoundingClientRect();
  var w=out.offsetWidth||340;
  var x=Math.max(8,Math.min(r.left,document.documentElement.clientWidth-w-8));
  out.style.top=(r.bottom+6)+'px';
  out.style.left=x+'px';
}

function render(list){
  out.textContent='';active=-1;input.removeAttribute('aria-activedescendant');
  if(!list.length){
    var e=document.createElement('div');
    e.className='docs-search-empty';
    e.textContent=out.getAttribute('data-empty')||'No matches';
    out.appendChild(e);
  }else{
    list.forEach(function(r,n){
      var a=document.createElement('a');
      a.className='docs-search-hit';a.id='docs-hit-'+n;a.setAttribute('role','option');
      a.href=base+'/'+r.p+'.html'+(r.a?'#'+r.a:'');
      var h=document.createElement('span');h.className='hit-h';h.textContent=r.h||r.t;a.appendChild(h);
      if(r.h){var c=document.createElement('span');c.className='hit-c';c.textContent=r.t;a.appendChild(c);}
      if(r.x){var x=document.createElement('span');x.className='hit-x';x.textContent=r.x;a.appendChild(x);}
      out.appendChild(a);
    });
  }
  out.hidden=false;input.setAttribute('aria-expanded','true');place();
}

function run(){
  var q=input.value.trim();
  if(!q){close();return;}
  load().then(function(rs){
    if(input.value.trim()!==q)return;   // a later keystroke already won
    var terms=norm(q).split(/\s+/).filter(Boolean);
    var hits=[];
    for(var i=0;i<rs.length;i++){var s=score(rs[i],terms);if(s>0)hits.push({r:rs[i],s:s});}
    hits.sort(function(a,b){return b.s-a.s;});
    render(hits.slice(0,12).map(function(x){return x.r;}));
  });
}

function move(d){
  var links=out.querySelectorAll('.docs-search-hit');if(!links.length)return;
  active=(active+d+links.length)%links.length;
  for(var i=0;i<links.length;i++)links[i].classList.toggle('is-active',i===active);
  input.setAttribute('aria-activedescendant',links[active].id);
  links[active].scrollIntoView({block:'nearest'});
}

input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,90);});
input.addEventListener('focus',load);
input.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'){e.preventDefault();move(1);}
  else if(e.key==='ArrowUp'){e.preventDefault();move(-1);}
  else if(e.key==='Enter'){var l=out.querySelector('.docs-search-hit.is-active');if(l){e.preventDefault();l.click();}}
  else if(e.key==='Escape'){if(input.value){input.value='';close();syncClear();}else if(bar&&bar.classList.contains('is-searching')){foldField(true);}else{input.blur();}}
});
document.addEventListener('click',function(e){if(!wrap.contains(e.target)&&!out.contains(e.target)){close();if(!fab||!fab.contains(e.target))foldField(false);}});
addEventListener('resize',place);
addEventListener('scroll',place,true);   // capture: the rail scrolls, not the window
})();
;
(function(){
var menu=document.querySelector('.site-menu');if(!menu)return;var sum=menu.querySelector('summary');
function close(focus){if(!menu.open)return;menu.open=false;if(focus&&sum)sum.focus();}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menu.open){e.preventDefault();close(menu.contains(document.activeElement));}});
document.addEventListener('pointerdown',function(e){if(menu.open&&!menu.contains(e.target))close(false);});
menu.addEventListener('focusout',function(e){if(menu.open&&e.relatedTarget&&!menu.contains(e.relatedTarget))close(false);});
menu.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.site-sheet a[href]'))close(false);});
})();
;
(function(){
  var btn=document.getElementById('docJumpBtn'),nav=document.getElementById('docJumpNav');
  if(!btn||!nav)return;
  function setOpen(open){nav.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');}
  btn.addEventListener('click',function(e){e.stopPropagation();setOpen(nav.hidden);});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false);});
  document.addEventListener('click',function(e){if(!nav.hidden&&!nav.contains(e.target)&&!btn.contains(e.target))setOpen(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!nav.hidden){setOpen(false);btn.focus();}});
})();
;

(function(){
  // Two ways in: the round Language button in the bar, and the Language row in the
  // phone menu. The row closes the menu first, so the language menu then hangs from the
  // menu's own button, which is where focus returns when it closes.
  const triggers = [...document.querySelectorAll('.site-fab--lang, .site-lang-row')];
  const menu = document.querySelector('.lang-menu');
  if (!triggers.length || !menu) return;
  let anchor = triggers[0];
  const list = menu.querySelector('.lang-menu-list');
  const sortTabs = [...menu.querySelectorAll('.lang-sort-tab')];
  // Reorder the menu in place: speakers (descending data-speakers) or A–Z
  // (data-name). The choice persists via the 'langSort' localStorage key,
  // shared same-origin with the app's language menu.
  function applySort(mode, persist) {
    sortTabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.sort === mode)));
    const items = [...list.querySelectorAll('.lang-menu-item')];
    items.sort((a, b) => mode === 'az'
      ? a.dataset.name.localeCompare(b.dataset.name, 'en')
      : (Number(b.dataset.speakers) - Number(a.dataset.speakers)) || (Number(a.dataset.idx) - Number(b.dataset.idx)));
    items.forEach(item => list.appendChild(item));
    if (persist) { try { localStorage.setItem('langSort', mode); } catch (err) {} }
  }
  try { if (localStorage.getItem('langSort') === 'az') applySort('az', false); } catch (err) {}
  let isOpen = false;
  // Under the button it hangs from, its inline-end edge on the button's, held 8px
  // inside the window either way and no taller than the room below.
  function positionMenu() {
    const rect = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = menu.offsetWidth;
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.maxHeight = Math.max(160, window.innerHeight - rect.bottom - 24) + 'px';
    if (document.documentElement.dir === 'rtl') {
      menu.style.right = 'auto';
      menu.style.left = Math.max(8, Math.min(rect.left, vw - w - 8)) + 'px';
    } else {
      menu.style.left = 'auto';
      menu.style.right = Math.max(8, Math.min(vw - rect.right, vw - w - 8)) + 'px';
    }
  }
  function close(returnFocus) {
    if (!isOpen) return;
    menu.hidden = true;
    triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
    isOpen = false;
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', positionMenu);
    if (returnFocus && anchor) anchor.focus();
  }
  function open(from) {
    if (isOpen) return;
    const sheet = from.closest('details');
    if (sheet) { sheet.open = false; anchor = sheet.querySelector('summary') || from; } else anchor = from;
    menu.hidden = false;
    from.setAttribute('aria-expanded', 'true');
    isOpen = true;
    positionMenu();
    const current = menu.querySelector('.lang-menu-item[aria-pressed="true"]') || menu.querySelector('.lang-menu-item');
    if (current) current.focus();
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', positionMenu);
  }
  function onOutside(e) {
    if (!menu.contains(e.target) && !triggers.some(t => t.contains(e.target))) close(false);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = [...menu.querySelectorAll('.lang-menu-item')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(i + step + items.length) % items.length].focus();
  }
  triggers.forEach(t => t.addEventListener('click', () => isOpen ? close(true) : open(t)));
  // Focus moving on out of the open list closes it, so the control that takes focus
  // next is never hidden beneath the list (WCAG 2.4.11). Back onto its own button is
  // not leaving: the list hangs from there.
  menu.addEventListener('focusout', e => {
    const to = e.relatedTarget;
    if (isOpen && to && !menu.contains(to) && !triggers.includes(to)) close(false);
  });
  menu.addEventListener('click', e => {
    const tab = e.target.closest('.lang-sort-tab');
    if (tab) {
      if (tab.getAttribute('aria-selected') === 'true') return;
      applySort(tab.dataset.sort === 'az' ? 'az' : 'speakers', true);
      // Re-appending items blurs a focused one to <body> in browsers that don't
      // focus buttons on click - keep focus inside the open menu.
      if (!menu.contains(document.activeElement)) tab.focus();
      return;
    }
    const btn = e.target.closest('.lang-menu-item');
    if (!btn) return;
    try { localStorage.setItem('lang', btn.dataset.lang); } catch(err) {}
    location.href = btn.dataset.href;
  });
})();

;
(function(){
var btn=document.querySelector('.docs-listen');if(!btn)return;
// The ladder (plan 131 B.3): a produced page needs Ogg/Opus playback; every page can
// fall back to the device voice (speechSynthesis). Remove the control only when there
// is genuinely nothing to play - a produced page this browser can't decode (iOS Safari
// before 18.4) AND no device voice, or a device-voice page with no speechSynthesis
// (some webkitgtk - the Linux gap a native command will close).
var produced=btn.hasAttribute('data-listen-produced');
var hasTts=('speechSynthesis' in window)&&(typeof SpeechSynthesisUtterance!=='undefined');
var canOpus=false;try{canOpus=!!document.createElement('audio').canPlayType('audio/ogg; codecs=opus');}catch(e){}
if((!produced||!canOpus)&&!hasTts){var bar=btn.closest('.listen-bar');btn.remove();if(bar&&!bar.children.length)bar.remove();return;}
var busy=false;
function open(auto){if(busy)return;busy=true;btn.classList.add('is-loading');
import('/info/docs-player.js').then(function(m){
  m.openDocsPlayer({slug:btn.getAttribute('data-listen-slug'),title:btn.getAttribute('data-listen-title'),autoplay:!!auto,trigger:btn});
}).catch(function(e){console.warn('docs player failed to load',e);}).finally(function(){busy=false;btn.classList.remove('is-loading');});}
btn.addEventListener('click',function(){open(true);});
try{var s=sessionStorage.getItem('lolly-docs-listen');
if(s&&JSON.parse(s).slug===btn.getAttribute('data-listen-slug'))open(JSON.parse(s).auto);}catch(e){}
})();
;

"use strict";var LollyDocsReading=(()=>{var w=Object.defineProperty;var j=Object.getOwnPropertyDescriptor;var B=Object.getOwnPropertyNames;var W=Object.prototype.hasOwnProperty;var K=(c,r)=>{for(var m in r)w(c,m,{get:r[m],enumerable:!0})},z=(c,r,m,n)=>{if(r&&typeof r=="object"||typeof r=="function")for(let a of B(r))!W.call(c,a)&&a!==m&&w(c,a,{get:()=>r[a],enumerable:!(n=j(r,a))||n.enumerable});return c};var V=c=>z(w({},"__esModule",{value:!0}),c);var G={};K(G,{COPY_FEEDBACK_MS:()=>F,enhanceDocsReading:()=>_,shellCommands:()=>O});function O(c){let r=c.split(`
`),m=/^\s*\$ /,n;if(r.some(s=>m.test(s))){n=[];let s=!1;for(let d of r)m.test(d)?(n.push(d.replace(m,"")),s=/\\$/.test(d)):s&&(n.push(d),s=/\\$/.test(d))}else n=r.filter(s=>!/^\s*#/.test(s));let a=s=>{let d=null;for(let p=0;p<s.length;p++){let y=s[p];if(d){y===d&&(d=null);continue}if(y==='"'||y==="'"){d=y;continue}if(y==="#"&&p>0&&/\s/.test(s[p-1]))return s.slice(0,p).trimEnd()}return s};return n.map(a).join(`
`).replace(/\n{3,}/g,`

`).replace(/^\n+|\n+$/g,"")}var F=2400,M=8,S=new WeakMap;function _(c,r){var P;let m=S.get(c);if(m)return m;let n=c.ownerDocument,a=n.defaultView,{labels:s}=r,d=[],p=new Map,y=new WeakSet,g=n.createElement("div");g.className="doc-visually-hidden",g.setAttribute("role","status"),g.setAttribute("aria-live","polite"),g.setAttribute("aria-atomic","true"),c.appendChild(g),d.push(g);let b=e=>{g.textContent="",setTimeout(()=>{g.textContent=e},30)};for(let e of c.querySelectorAll(".doc-code[data-copy]")){let t=e.querySelector(":scope > .doc-code-bar"),l=(P=e.querySelector("pre code"))!=null?P:e.querySelector("pre");if(!t||!l||t.querySelector(".doc-copy"))continue;let o=n.createElement("span");o.className="doc-copy-slot";let i=n.createElement("button");i.type="button",i.className="doc-copy",i.dataset.docCopy="",i.setAttribute("aria-label",s.copyNamed(e.dataset.label||s.copy)),r.copyIcon&&i.insertAdjacentHTML("afterbegin",r.copyIcon);let u=n.createElement("span");u.textContent=s.copy,i.appendChild(u);let h=n.createElement("span");h.className="doc-copy-toast",h.setAttribute("aria-hidden","true"),h.hidden=!0,o.append(i,h),t.appendChild(o),d.push(o);let f=n.createElement("div");f.className="doc-copy-help",f.hidden=!0;let E=n.createElement("span");E.textContent=s.help;let v=n.createElement("button");v.type="button",v.className="doc-copy",v.dataset.docSelect="",v.textContent=s.select,f.append(E,v),e.appendChild(f),d.push(f)}let k=e=>{var t,l;return(l=(t=e.closest(".doc-copy-slot"))==null?void 0:t.querySelector(".doc-copy-toast"))!=null?l:null},H=e=>{clearTimeout(p.get(e)),p.delete(e);let t=k(e);t&&(t.hidden=!0)},q=(e,t)=>{var E;let l=k(e);if(!l)return;clearTimeout(p.get(e)),l.textContent=t,l.style.setProperty("--doc-toast-shift","0px"),l.removeAttribute("data-above"),l.hidden=!1;let o=l.getBoundingClientRect(),i=(E=n.elementFromPoint)==null?void 0:E.call(n,Math.min(Math.max(o.left+o.width/2,0),a.innerWidth-1),Math.min(Math.max(o.top+o.height/2,0),a.innerHeight-1)),u=!!i&&!c.contains(i)&&!i.contains(c);(o.bottom>a.innerHeight-M||u)&&l.setAttribute("data-above","");let h=n.documentElement.clientWidth,f=o.left<M?M-o.left:o.right>h-M?h-M-o.right:0;f&&l.style.setProperty("--doc-toast-shift",`${Math.round(f)}px`),p.set(e,setTimeout(()=>H(e),F))},x=()=>{for(let e of[...p.keys()])H(e)},A=e=>{var v,R,$;let t=e.target,l=t==null?void 0:t.closest("[data-doc-select]"),o=t==null?void 0:t.closest(".doc-code");if(l&&o&&c.contains(l)){let T=(v=o.querySelector("pre code"))!=null?v:o.querySelector("pre");if(!T)return;let I=n.createRange();I.selectNodeContents(T);let L=a.getSelection();L==null||L.removeAllRanges(),L==null||L.addRange(I),b(s.selected);return}let i=t==null?void 0:t.closest("[data-doc-copy]");if(!i||!o||!c.contains(i)||y.has(i))return;let u=(R=o.querySelector("pre code"))!=null?R:o.querySelector("pre");if(!u)return;y.add(i),H(i);let h=($=u.textContent)!=null?$:"",f=o.dataset.copy==="shell"?O(h):h,E;try{E=r.writeText(f)}catch(T){E=Promise.reject(T)}E.then(()=>{q(i,s.copied),b(s.copied)},()=>{q(i,s.copyFailed),b(`${s.copyFailed} ${s.help}`);let T=o.querySelector(":scope > .doc-copy-help");T&&(T.hidden=!1)}).finally(()=>{y.delete(i)})},D=e=>{e.key==="Escape"&&x()},C=()=>{var o,i;let e=decodeURIComponent(a.location.hash.slice(1));if(!e)return;let t=n.getElementById(e);if(!t||!c.contains(t))return;let l=!1;t instanceof a.HTMLDetailsElement&&!t.open&&(t.open=!0,l=!0);for(let u=(o=t.parentElement)==null?void 0:o.closest("details");u;u=(i=u.parentElement)==null?void 0:i.closest("details"))u.open||(u.open=!0,l=!0);l&&t.scrollIntoView()};c.addEventListener("click",A),n.addEventListener("keydown",D),a.addEventListener("resize",x),r.openOnHash&&(a.addEventListener("hashchange",C),C());let N=()=>{c.removeEventListener("click",A),n.removeEventListener("keydown",D),a.removeEventListener("resize",x),a.removeEventListener("hashchange",C);for(let e of p.values())clearTimeout(e);p.clear();for(let e of d)e.remove();S.delete(c)};return S.set(c,N),N}return V(G);})();
(function(){var root=document.querySelector('.docs-content');if(!root)return;var l={};try{l=JSON.parse(root.getAttribute('data-reading')||'{}')}catch(e){}LollyDocsReading.enhanceDocsReading(root,{openOnHash:true,copyIcon:l.icon||'',writeText:function(s){return navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(s):Promise.reject(new Error('unavailable'))},labels:{copy:l.copy||'Copy',copied:l.copied||'Copied to clipboard',copyFailed:l.copyFailed||'Copy did not work',help:l.help||'',select:l.select||'Select text',selected:l.selected||'',copyNamed:function(x){return (l.copyNamed||'Copy {label}').replace('{label}',x)}}});})();

;

"use strict";var LollyDocsStrip=(()=>{var d=Object.defineProperty;var a=Object.getOwnPropertyDescriptor;var r=Object.getOwnPropertyNames;var i=Object.prototype.hasOwnProperty;var u=(e,t)=>{for(var c in t)d(e,c,{get:t[c],enumerable:!0})},f=(e,t,c,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of r(t))!i.call(e,n)&&n!==c&&d(e,n,{get:()=>t[n],enumerable:!(o=a(t,n))||o.enumerable});return e};var v=e=>f(d({},"__esModule",{value:!0}),e);var g={};u(g,{enhancePathwaysStrip:()=>h});function h(e){let t=()=>{let n=e.scrollWidth-e.clientWidth;if(n<=1){e.setAttribute("data-strip-edges","");return}let l=Math.abs(e.scrollLeft),s=[l>1?"start":"",l<n-1?"end":""].filter(Boolean).join(" ");e.getAttribute("data-strip-edges")!==s&&e.setAttribute("data-strip-edges",s)},c=e.querySelector(".docs-pathway.active");if(c&&e.scrollWidth>e.clientWidth){let n=e.getBoundingClientRect(),l=c.getBoundingClientRect();e.scrollLeft+=l.left+l.width/2-(n.left+n.width/2)}t(),e.addEventListener("scroll",t,{passive:!0});let o=typeof ResizeObserver=="function"?new ResizeObserver(t):null;return o==null||o.observe(e),()=>{e.removeEventListener("scroll",t),o==null||o.disconnect()}}return v(g);})();
(function(){document.querySelectorAll('nav.docs-pathways').forEach(function(s){LollyDocsStrip.enhancePathwaysStrip(s);});})();

;

"use strict";var LollyAgentCopy=(()=>{var M=Object.defineProperty;var B=Object.getOwnPropertyDescriptor;var $=Object.getOwnPropertyNames;var j=Object.prototype.hasOwnProperty;var _=(t,e)=>{for(var n in e)M(t,n,{get:e[n],enumerable:!0})},Y=(t,e,n,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of $(e))!j.call(t,r)&&r!==n&&M(t,r,{get:()=>e[r],enumerable:!(o=B(e,r))||o.enumerable});return t};var X=t=>Y(M({},"__esModule",{value:!0}),t);var ie={};_(ie,{wireAgentCopy:()=>re});var S=null,H=[];function O(t){H.push(t),S&&t.appendChild(S)}function k(t){var n;let e=H.lastIndexOf(t);e>=0&&H.splice(e,1),S&&((n=H[H.length-1])!=null?n:document.body).appendChild(S)}var N=["hashchange","popstate","lolly:navigate"];var v=[],b=0,T=0,R=!1,A=0,h=null,D=new Set;function P(t){let e=new URL(t);return e.pathname+(e.hash.startsWith("#/")?e.hash.split("?")[0]:"")}function z(){if(h){if(P(h)!==P(window.location.href)){h=null;return}window.history.replaceState(window.history.state,"",h),window.dispatchEvent(new window.Event("lolly:url-state"))}}var G=new Set,V=new Set;function C(){if(!(A||T)){for(let t of[...G])t();if(!v.length){h=null;for(let t of[...V])V.delete(t),t()}}}function L(){let t=v.length>0||T>0;t!==R&&(R=t,N.forEach(e=>{t?window.addEventListener(e,q):window.removeEventListener(e,q)}))}var q=t=>{var e;if(t.type==="popstate"){let n=v[v.length-1];if(!T&&n&&window.location.href!==n.initialHref){h=null,[...v].forEach(o=>o.record.nav());return}if(z(),T){T-=1,L(),C();return}(e=v[v.length-1])==null||e.record.pop();return}h=null,[...v].forEach(n=>n.record.nav())};function J(t){t.owed=!1,A+=1,D.add(t),setTimeout(()=>{if(D.delete(t),A-=1,t.seq<b||location.href!==t.pushedHref){C();return}b-=1,T+=1,L();try{history.back()}catch{T-=1,L()}C()})}function W(t){let e={record:t,owed:!1,seq:0,pushedHref:"",initialHref:window.location.href};try{history.pushState(history.state,"",location.href),b+=1,e.seq=b,e.owed=!0,e.pushedHref=location.href}catch{}v.push(e),L();let n=!0;return{disown:()=>{e.owed&&(e.owed=!1,b-=1)},release:()=>{if(!n)return;n=!1;let o=v.indexOf(e);o>=0&&v.splice(o,1),L(),e.owed?J(e):C()}}}function F(t,e){var c,E,p;let n=document.createElement("dialog");n.className=e.className,e.ariaLabel&&n.setAttribute("aria-label",e.ariaLabel),n.innerHTML=t,((c=e.container)!=null?c:document.body).appendChild(n);let o=!1,r=null,l=()=>typeof e.cancelValue=="function"?e.cancelValue(n):e.cancelValue,u=a=>{var s;o||(o=!0,r==null||r.release(),k(n),n.open&&n.close(),n.remove(),(s=e.onClose)==null||s.call(e,a))},i={nav:()=>{r==null||r.disown(),u()},pop:()=>{r==null||r.disown(),u(l())}};return n.addEventListener("cancel",a=>{a.preventDefault(),e.onEscape?e.onEscape(n):u(l())}),n.addEventListener("close",()=>u()),n.addEventListener("click",a=>{if(a.target!==n||e.dismissOnBackdrop===!1)return;let s=n.getBoundingClientRect();(a.clientX<s.left||a.clientX>s.right||a.clientY<s.top||a.clientY>s.bottom)&&u(l())}),e.backStack!==!1&&(r=W(i)),n.showModal(),O(n),(p=(E=e.initialFocus)==null?void 0:E.call(e,n))==null||p.focus(),{el:n,close:u}}function I(t,e){let n=URL.createObjectURL(t);K(n,e),setTimeout(()=>URL.revokeObjectURL(n),1e3)}function K(t,e){let n=document.createElement("a");n.href=t,n.download=e,document.body.appendChild(n),n.click(),document.body.removeChild(n)}var Q=null;function U(){return Q}var Z=2400,ee=t=>{var e;return typeof navigator!="undefined"&&((e=navigator.clipboard)!=null&&e.writeText)?navigator.clipboard.writeText(t):Promise.reject(new Error("unavailable"))};async function te(t,e,n){let o=n.defaultView;if(!o)return;let r=new o.Blob([t],{type:"text/markdown;charset=utf-8"}),l=U();l!=null&&l.export.download?await l.export.download(r,e):I(r,e)}function ne(t,e){let n=t.querySelector(`.agent-pill-icon[data-agent-action="${e}"]`);if(!n)return null;let o=t.ownerDocument.createElement("button");o.type="button",o.className="agent-pill-icon",o.dataset.agentAction=e;for(let r of["data-tip","aria-label"]){let l=n.getAttribute(r);l&&o.setAttribute(r,l)}return o.replaceChildren(...[...n.childNodes].map(r=>r.cloneNode(!0))),o}function oe(t,e,n){var m,y;let o=t.ownerDocument,r=(m=t.parentElement)!=null?m:o.body;(y=r.querySelector("dialog.agent-dialog"))==null||y.close();let l=F("",{className:"agent-dialog",container:r}),u=l.el,i=`agent-dialog-title-${Math.random().toString(36).slice(2,8)}`;u.setAttribute("aria-labelledby",i);let c=o.createElement("div");c.className="agent-dialog-head";let E=o.createElement("h2");E.id=i,E.textContent=t.dataset.title||"AI Instructions";let p=o.createElement("div");p.className="agent-dialog-tools";for(let f of["copy","download"]){let d=ne(t,f);d&&p.appendChild(d)}let a=o.createElement("button");a.type="button",a.className="agent-pill-icon agent-dialog-close",a.setAttribute("aria-label",t.dataset.close||"Close"),a.dataset.tip=t.dataset.close||"Close",a.innerHTML=t.dataset.closeIcon||"\xD7",p.appendChild(a),c.append(E,p);let s=o.createElement("p");s.className="agent-dialog-status",s.setAttribute("aria-live","polite");let w=o.createElement("pre");w.className="agent-dialog-body",w.tabIndex=0,w.setAttribute("autofocus",""),w.textContent=e,u.append(c,s,w),w.focus(),u.addEventListener("click",f=>{var x;let d=f.target;if(d.closest(".agent-dialog-close")){l.close();return}let g=(x=d.closest("[data-agent-action]"))==null?void 0:x.dataset.agentAction;(g==="copy"||g==="download")&&n(g)})}function re(t,e={}){var r,l,u;let n=(r=e.writeText)!=null?r:ee,o=(l=e.save)!=null?l:te;for(let i of t.querySelectorAll("[data-agent-pill]")){if(i.dataset.agentWired)continue;i.dataset.agentWired="1";let c=i.querySelector(".agent-copy-label"),E=(u=c==null?void 0:c.textContent)!=null?u:"",p=i.querySelector(".agent-copy-status"),a,s=(m,y)=>{var d;c&&(c.textContent=m),i.dataset.state=y,p&&(p.textContent=m);let f=(d=i.parentElement)==null?void 0:d.querySelector(".agent-dialog-status");f&&(f.textContent=m),clearTimeout(a),a=setTimeout(()=>{var x;c&&(c.textContent=E),delete i.dataset.state,p&&(p.textContent="");let g=(x=i.parentElement)==null?void 0:x.querySelector(".agent-dialog-status");g&&(g.textContent="")},Z)},w=m=>{var d;let y=(d=i.dataset.agentText)!=null?d:"";if(!y)return;if(m==="view"){oe(i,y,w);return}if(m==="download"){Promise.resolve(o(y,i.dataset.filename||"lolly-ai-instructions.md",i.ownerDocument)).catch(()=>s("Download did not work","failed"));return}let f;try{f=n(y)}catch(g){f=Promise.reject(g)}f.then(()=>s(i.dataset.copied||"Copied","done"),()=>s(i.dataset.failed||"Copy did not work","failed"))};i.addEventListener("click",m=>{var d,g;let f=(g=(d=m.target.closest("[data-agent-action]"))==null?void 0:d.dataset.agentAction)!=null?g:"copy";f==="download"&&m.preventDefault(),w(f)})}}return X(ie);})();
LollyAgentCopy.wireAgentCopy(document);

;
(function(){
var band=document.querySelector('.docs-masthead'),strip=band&&band.querySelector('.docs-pathways');if(!strip)return;
function fit(){var b=band.getBoundingClientRect(),r=strip.getBoundingClientRect();band.style.setProperty('--mast-clear',Math.round(r.bottom-b.top+8)+'px');}
fit();if(window.ResizeObserver)new ResizeObserver(fit).observe(band);
})();