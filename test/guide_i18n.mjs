// Robust guide i18n manager: maps EN translations by ES text (not index),
// so inserting/removing guide content never misaligns translations.
//   node guide_i18n.mjs dump        -> writes es_en_map.json from current GUIDE_EN
//   node guide_i18n.mjs rebuild     -> prints new GUIDE_EN (by index) using es_en_map.json
//                                      + lists indices whose ES has no EN yet
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
const HTML='../index.html', MAP='es_en_map.json';
const SEL='nav .grp, nav a, main h1, main h2, main h3, main h4, main p, main li, main th, main td, main figcaption, .note, .tip, .warn';
function load(){
  const html=readFileSync(HTML,'utf8');
  const s=html.indexOf('const GUIDE_EN={'); const e=html.indexOf('\n};',s);
  const GUIDE_EN=eval('('+html.slice(s+'const GUIDE_EN='.length, e+2)+')');
  const a=html.indexOf('<div class="guide-embed" id="guideContent"'); const b=html.indexOf('<!-- ===== END GUIDE',a);
  const els=parse(html.slice(a,b)).querySelectorAll(SEL).map(x=>x.innerHTML.trim());
  return {GUIDE_EN, els};
}
const norm=s=>s.replace(/\s+/g,' ').trim();
const mode=process.argv[2];
if(mode==='dump'){
  const {GUIDE_EN,els}=load(); const map={};
  els.forEach((es,i)=>{ if(GUIDE_EN[i]!=null) map[norm(es)]=GUIDE_EN[i]; });
  writeFileSync(MAP, JSON.stringify(map,null,0));
  console.log('es->en pairs saved:', Object.keys(map).length);
}else if(mode==='rebuild'){
  const {els}=load(); const map=JSON.parse(readFileSync(MAP,'utf8'));
  const extra=JSON.parse(readFileSync('new_en.json','utf8')||'{}'); // {normalizedES: EN} for new strings
  const out=[]; const missing=[];
  const isCode=h=>{const t=h.replace(/<[^>]+>/g,'').trim(); return /^<code>/.test(h)&&h.endsWith('</code>')&&!/[a-záéíóúñ]{4,}\s+[a-záéíóúñ]{3,}/i.test(t);};
  els.forEach((es,i)=>{
    const k=norm(es); const en=map[k]??extra[k];
    if(en!=null){ out.push(`${i}:\`${en.replace(/`/g,'\\`')}\`,`); }
    else if(!isCode(es) && es.length>0){ missing.push({i, es:k.slice(0,90)}); }
  });
  writeFileSync('new_guide_en.txt', 'const GUIDE_EN={\n'+out.join('\n')+'\n};');
  console.log('GUIDE_EN entries:',out.length,'| total els:',els.length,'| missing(non-code):',missing.length);
  missing.forEach(m=>console.log(`  [${m.i}] ${m.es}`));
}

// extra mode: template for new section (nav L links + main section L)
if(process.argv[2]==='tpl'){
  const { readFileSync, writeFileSync }=await import('node:fs');
  const { parse }=await import('node-html-parser');
  const html=readFileSync('../index.html','utf8');
  const s=html.indexOf('const GUIDE_EN={'); const e=html.indexOf('\n};',s);
  const G=eval('('+html.slice(s+'const GUIDE_EN='.length, e+2)+')');
  const a=html.indexOf('<div class="guide-embed" id="guideContent"'); const b=html.indexOf('<!-- ===== END GUIDE',a);
  const SELx='nav .grp, nav a, main h1, main h2, main h3, main h4, main p, main li, main th, main td, main figcaption, .note, .tip, .warn';
  const els=parse(html.slice(a,b)).querySelectorAll(SELx).map(x=>x.innerHTML.trim());
  const map=JSON.parse(readFileSync('es_en_map.json','utf8'));
  const nn=s=>s.replace(/\s+/g,' ').trim();
  const tpl={};
  els.forEach((es,i)=>{ const k=nn(es);
    const isNew=((i>=49&&i<=56)||i>=1168);
    if(isNew && map[k]==null && es.length>0) tpl[k]=es; });
  writeFileSync('tpl_es.json', JSON.stringify(tpl,null,1));
  console.log('template entries:',Object.keys(tpl).length);
}
