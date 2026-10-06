(function(){var c=localStorage.getItem('theme'),s=window.matchMedia('(prefers-color-scheme:dark)').matches;var t=(c==='light'||c==='dark'||c==='brand')?c:(s?'dark':'light');var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark'||t==='brand');})();
;
document.documentElement.classList.add('shots-motion');