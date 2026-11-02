// Discover every authored brand color instead of maintaining a selector allowlist.
const fs = require('node:fs');
const postcss = require('postcss');
const files=[];
const skip=new Set(['palette-generated.css','app-palette.css','palette-surfaces.css']);
function include(file){
 if(skip.has(file)||files.includes(file))return;
 const source=fs.readFileSync('app/'+file,'utf8');
 for(const match of source.matchAll(/@import\s+["']\.\/([^"']+\.css)["']/g))include(match[1]);
 files.push(file);
}
for(const match of fs.readFileSync('app/layout.tsx','utf8').matchAll(/import\s+["']\.\/([^"']+\.css)["']/g))include(match[1]);

const pattern = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|(?:rgba?|hsla?)\([^()]*\)/gi;
function parse(token) {
  let rgb, alpha=1;
  if(token[0]==='#') {
    let v=token.slice(1);if(v.length<5)v=[...v].map(x=>x+x).join('');
    rgb=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16));if(v.length===8)alpha=parseInt(v.slice(6),16)/255;
  } else {
    const v=token.match(/[\d.]+/g)?.map(Number);if(!v||v.length<3)return null;
    alpha=v[3]??1;
    if(token.startsWith('hsl')){
      const [h,s,l]=[v[0],v[1]/100,v[2]/100],a=s*Math.min(l,1-l);
      rgb=[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));});
    }else rgb=v.slice(0,3);
  }
  const [r,g,b]=rgb.map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  const sat=d?d/(1-Math.abs(2*l-1)):0;
  let hue=!d?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  hue=(hue*60+360)%360;
  const hex='#'+rgb.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('').toUpperCase();
  return {hex,alpha,hue,sat};
}
const semantic = /(?:^|[.\s:#\["'=-])(?:warning|danger|danger-btn|dialog-danger|error|success|positive|negative|over|watch|no_budget|done|completed|skipped|cancelled|confirmed|used|ready|offline|invalid|late|connection-dot|realtime-state|status-chip|status|green|sync-status|enabled|disabled|integrity-empty|tf-success|tf-warning|tf-error|red)(?:$|[.\s:#\]"'=) -])/i;
const colors=new Set(), audit=[];
const originalVars=new Set();
for(const file of files)postcss.parse(fs.readFileSync('app/'+file,'utf8')).walkRules(r=>{
 if(r.selector===':root'||/^html\[data-theme="dark"\]$/.test(r.selector))r.walkDecls(d=>{if(d.prop.startsWith('--')&&pattern.test(d.value))originalVars.add(d.prop.slice(2));pattern.lastIndex=0;});
});
function replace(value, selector, prop) {
  if(semantic.test(selector)||/^--(?:tf-(?:success|warning|error)|red)/.test(prop)) {
    return value.replace(/var\(--([a-z0-9-]+)([,)]?)/gi,(full,key,tail)=>originalVars.has(key)?`var(--brand-original-${key}${tail}`:full);
  }
  return value.replace(pattern, token=>{
    const p=parse(token);
    if(!p||p.sat<.08||p.alpha===0)return token;
    colors.add(p.hex);
    const variable=`--brand-tone-${p.hex.slice(1).toLowerCase()}`;
    return p.alpha===1?`var(${variable})`:`color-mix(in srgb, var(${variable}) ${+(p.alpha*100).toFixed(4)}%, transparent)`;
  });
}
function scope(selector) {
  if(selector===':root')return 'html[data-palette]';
  if(/^html\b/.test(selector))return selector.replace(/^html/,'html[data-palette]');
  return 'html[data-palette] '+selector;
}
function transform(node,file) {
  if(node.type==='atrule') {
    if(/keyframes|import|property/.test(node.name))return null;
    const out=node.clone({nodes:[]});for(const child of node.nodes||[]){const next=transform(child,file);if(next)out.append(next);}return out.nodes.length?out:null;
  }
  if(node.type!=='rule')return null;
  const group=postcss.root();
  for(const selector of postcss.list.comma(node.selector)) {
    const out=postcss.rule({selector:scope(selector)});
    for(const d of node.nodes||[])if(d.type==='decl') {
      const value=replace(d.value,selector,d.prop);
      if(value!==d.value||(semantic.test(selector)&&/color|background|border|shadow|fill|stroke|outline/.test(d.prop)&&/(?:var\(|#|rgba?\(|hsla?\()/.test(d.value))){out.append(d.clone({value}));audit.push({file,selector,property:d.prop});}
      if((selector===':root'||/^html\[data-theme="dark"\]$/.test(selector))&&originalVars.has(d.prop.slice(2)))out.append(d.clone({prop:'--brand-original-'+d.prop.slice(2)}));
    }
    if(out.nodes.length)group.append(out);
  }
  return group.nodes.length?group.nodes:null;
}
function toneValues(colors,end) {
  // All aliases preserve the original relative luminance, including tinted text/borders.
  const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  const srgb=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const weights=[.2126,.7152,.0722],base=rgb(end).map(linear),y=base.reduce((n,v,i)=>n+v*weights[i],0),out={};
  for(const hex of colors){
    const raw=rgb(hex),src=raw.map(linear),target=src.reduce((n,v,i)=>n+v*weights[i],0);
    const max=Math.max(...raw)/255,min=Math.min(...raw)/255,l=(max+min)/2;
    const saturation=max===min?0:(max-min)/(1-Math.abs(2*l-1));
    const strength=Math.min(1,saturation*3);
    const mapped=base.map(v=>target<=y?(y?v*target/y:0):v+(1-v)*(target-y)/(1-y||1));
    out['--brand-tone-'+hex.slice(1).toLowerCase()]='#'+mapped.map(v=>srgb(Math.max(0,Math.min(1,v*strength+target*(1-strength))))).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  return out;
}
const output=postcss.root();
for(const file of files){const root=postcss.parse(fs.readFileSync('app/'+file,'utf8'));for(const n of root.nodes){const next=transform(n,file);if(next)output.append(next);}}
const paletteColors=[...colors].sort();
const css='/* Generated by scripts/generate-palette-coverage.cjs. Default/semantic colors are preserved. */\n'+output.toString()+'\n';
const js='// Generated brand-tone engine; plain JS bootstrap shares this exact implementation.\nexport const TONE_COLORS='+JSON.stringify(paletteColors)+';\nexport '+toneValues.toString()+'\nexport const TONE_ENGINE_SOURCE='+JSON.stringify(toneValues.toString())+';\n';
const summary=JSON.stringify({files,colors:paletteColors.length,declarations:audit.length,selectors:new Set(audit.map(x=>x.file+':'+x.selector)).size},null,2)+'\n';
for(const [path,value] of [['app/palette-generated.css',css],['lib/palette-tones.js',js],['docs/THEME-COVERAGE.json',summary]]) {
  if(process.argv.includes('--check')){if(!fs.existsSync(path)||fs.readFileSync(path,'utf8')!==value)throw Error('Theme coverage stale: '+path);}else fs.writeFileSync(path,value);
}
console.log(`Palette coverage: ${files.length} stylesheets, ${paletteColors.length} colors, ${audit.length} declarations, ${new Set(audit.map(x=>x.file+':'+x.selector)).size} selectors.`);
