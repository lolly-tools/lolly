
window.__lollyChipField=function(canvas,opt){
  opt=opt||{};
  var ctx=canvas.getContext('2d');
  // GENERATED at build time from docs/site/formats-catalog.json (chipExtensions()) -
  // every format the catalog says Lolly can WRITE. Not a hand list: the last one was
  // written when Lolly exported 27 formats and was still claiming 27 long after the
  // real answer had passed 40, because nothing failed when it fell behind.
  var exts=[".SVG",".PDF",".PNG",".JPG",".WEBP",".GIF",".TIFF",".AVIF",".PSD",".MP4",".WEBM",".MP3",".M4A",".PPTX",".SCORM",".CSV",".JSON",".PENPOT",".WAV",".OPUS",".EPS",".EMF",".DXF",".EXR",".ICO",".APNG",".HTML",".MD",".TXT",".ICS",".VCF",".DTCG",".ASE",".GPL",".SCSS",".ZIP",".SVGZ",".BMP",".WMF",".WOFF",".TTF",".OTF",".EPUB",".DOCX",".ODT",".GZ",".TAR"];
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
(function(){var order=['light','dark','brand'];var btn=document.querySelector('.nav-theme-toggle');if(!btn)return;function apply(t){var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark'||t==='brand');localStorage.setItem('theme',t);}btn.addEventListener('click',function(){var cur=document.documentElement.dataset.theme||'light';var i=order.indexOf(cur);apply(order[i<0?0:(i+1)%order.length]);});window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(e){if(!localStorage.getItem('theme')){var r=document.documentElement;r.dataset.theme=e.matches?'dark':'light';r.classList.toggle('dark',e.matches);}});})();
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
      svg.removeAttribute('width');svg.removeAttribute('height');
      var img=fig.querySelector('.showcase-fallback');
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
  creds.forEach(function(c){
    var btn=c.querySelector('.shot-cred-btn');if(!btn)return;
    btn.addEventListener('click',function(e){
      e.preventDefault();
      var open=!c.hasAttribute('data-open');
      closeAll(c);
      if(open){c.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}else close(c);
    });
  });
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
  else if(e.key==='Escape'){if(input.value){input.value='';close();}else{input.blur();}}
});
document.addEventListener('click',function(e){if(!wrap.contains(e.target)&&!out.contains(e.target))close();});
addEventListener('resize',place);
addEventListener('scroll',place,true);   // capture: the rail scrolls, not the window
})();
;
(function(){var ham=document.getElementById('navHamburger');var menu=document.getElementById('navMobileMenu');if(!ham||!menu)return;ham.addEventListener('click',function(){var open=menu.classList.toggle('open');ham.classList.toggle('open',open);ham.setAttribute('aria-expanded',open?'true':'false');});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');});});document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!ham.contains(e.target)){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');}});})();
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
  const trigger = document.querySelector('.lang-fab');
  const menu = document.querySelector('.lang-menu');
  if (!trigger || !menu) return;
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
  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
  }
  function close() {
    if (!isOpen) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    isOpen = false;
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', positionMenu);
  }
  function open() {
    if (isOpen) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    isOpen = true;
    positionMenu();
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', positionMenu);
  }
  function onOutside(e) {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = [...menu.querySelectorAll('.lang-menu-item')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(i + step + items.length) % items.length].focus();
  }
  trigger.addEventListener('click', () => isOpen ? close() : open());
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
if((!produced||!canOpus)&&!hasTts){var bar=btn.closest('.listen-bar');if(bar)bar.remove();return;}
var busy=false;
function open(auto){if(busy)return;busy=true;btn.classList.add('is-loading');
import('/info/docs-player.js').then(function(m){
  m.openDocsPlayer({slug:btn.getAttribute('data-listen-slug'),title:btn.getAttribute('data-listen-title'),autoplay:!!auto,trigger:btn});
}).catch(function(e){console.warn('docs player failed to load',e);}).finally(function(){busy=false;btn.classList.remove('is-loading');});}
btn.addEventListener('click',function(){open(true);});
try{var s=sessionStorage.getItem('lolly-docs-listen');
if(s&&JSON.parse(s).slug===btn.getAttribute('data-listen-slug'))open(JSON.parse(s).auto);}catch(e){}
})();