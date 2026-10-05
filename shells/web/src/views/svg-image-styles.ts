// SPDX-License-Identifier: MPL-2.0
/** Flatten bounded static class styles without installing source CSS in the page. */
const properties = new Set(['fill','stroke','fill-rule','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stop-color','stop-opacity','color-interpolation','clip-rule','clip-path','paint-order','display']);
export function inlineSvgImageStyles(root: Element): void {
  const styles=[...root.querySelectorAll('style')], elements=[root,...root.querySelectorAll('*')];
  if(elements.length>4096)throw new Error('This SVG has too many elements to unpack.');
  if(!styles.length){for(const element of elements)element.removeAttribute('class');return;}
  const rules:Array<{selector:string;declarations:string;specificity:[number,number,number];order:number}>=[];
  for(const style of styles){
    if(style.namespaceURI!==root.namespaceURI||[...style.attributes].some(attribute=>!['type','id'].includes(attribute.name))||style.hasAttribute('type')&&style.getAttribute('type')!=='text/css')throw new Error('This SVG has unsupported stylesheet attributes.');
    const css=(style.textContent??'').replace(/\/\*[\s\S]*?\*\//g,'');
    let at=0;
    for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
      if(css.slice(at,match.index).trim())throw new Error('This SVG has unsupported CSS rules.');
      at=match.index!+match[0].length;
      const declarations=match[2]!.trim();
      for(const declaration of declarations.split(';')){
        if(!declaration.trim())continue;
        const colon=declaration.indexOf(':');
        if(colon<1||!properties.has(declaration.slice(0,colon).trim())||/!important/i.test(declaration))throw new Error('This SVG has unsupported CSS declarations.');
      }
      for(const selector of match[1]!.split(',').map(value=>value.trim())){
        if(selector!=='*'&&!/^(?:[A-Za-z][A-Za-z0-9-]*)?(?:[.#][A-Za-z_][A-Za-z0-9_-]*)*$/.test(selector)||!selector)throw new Error('This SVG has unsupported CSS selectors.');
        const specificity:[number,number,number]=[(selector.match(/#/g)??[]).length,(selector.match(/\./g)??[]).length,/^[A-Za-z]/.test(selector)?1:0];
        rules.push({selector,declarations,specificity,order:rules.length});
        if(rules.length>64)throw new Error('This SVG has too many CSS rules to unpack.');
      }
    }
    if(css.slice(at).trim())throw new Error('This SVG has unsupported CSS rules.');
  }
  rules.sort((a,b)=>a.specificity[0]-b.specificity[0]||a.specificity[1]-b.specificity[1]||a.specificity[2]-b.specificity[2]||a.order-b.order);
  let budget=0;
  for(const element of elements){
    if(element.localName==='style')continue;
    const declarations=rules.filter(rule=>element.matches(rule.selector)).map(rule=>rule.declarations);
    if(declarations.length){
      const inline=declarations.join(';')+';'+(element.getAttribute('style')??'');budget+=inline.length;
      if(budget>1_000_000)throw new Error('This SVG has too much CSS to unpack.');
      element.setAttribute('style',inline);
    }
    element.removeAttribute('class');
  }
  for(const style of styles)style.remove();
}
