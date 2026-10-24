/* Original Riwaaz-e-Kashmir avatars (hand-built SVG, 100x100). AV[id] -> svg markup */
(function(){
const SK={a:'#f6d3b8',b:'#f0c3a2',c:'#e3a982',d:'#c98a64'};
function eyes(iris){return [40,60].map((x,i)=>`<ellipse cx="${x}" cy="55" rx="5.4" ry="6.6" fill="#fff"/><ellipse cx="${x}" cy="56" rx="4.3" ry="5.6" fill="${iris}"/><ellipse cx="${x}" cy="57" rx="2.4" ry="3.3" fill="#1b1410"/><circle cx="${x-1.7}" cy="53.4" r="1.7" fill="#fff"/><circle cx="${x+1.6}" cy="58.6" r=".9" fill="#fff" opacity=".9"/><path d="M${x-6} 52.2Q${x} 47.6 ${x+6} 52.2" fill="none" stroke="#1b1410" stroke-width="1.7" stroke-linecap="round"/>`).join('')}
function face(skin,iris,o){o=o||{};return `<path d="M42 80h16v10H42z" fill="${skin}"/><ellipse cx="50" cy="54" rx="24" ry="25" fill="${skin}"/><ellipse cx="26.5" cy="58" rx="3" ry="4.4" fill="${skin}"/><ellipse cx="73.5" cy="58" rx="3" ry="4.4" fill="${skin}"/>${eyes(iris)}<path d="M34 46.5Q40 43.8 45.5 46" fill="none" stroke="#3a2a22" stroke-width="1.3" stroke-linecap="round"/><path d="M54.5 46Q60 43.8 66 46.5" fill="none" stroke="#3a2a22" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="32" cy="64" rx="5" ry="3" fill="#ff8aa0" opacity=".42"/><ellipse cx="68" cy="64" rx="5" ry="3" fill="#ff8aa0" opacity=".42"/><path d="M49 62.5q1 .8 2 0" fill="none" stroke="#a8683f" stroke-width="1" stroke-linecap="round"/><path d="${o.grin?'M44.5 67Q50 74 55.5 67Z':'M45.5 67.5Q50 71.5 54.5 67.5'}" fill="${o.grin?'#c8505f':'none'}" stroke="#a63d4c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`}
function body(c,trim,o){o=o||{};return `<path d="M12 100Q14 80 36 77L50 86L64 77Q86 80 88 100Z" fill="${c}"/><path d="M36 77L50 86L64 77" fill="none" stroke="${trim}" stroke-width="2.2" stroke-linejoin="round"/>${o.pat?`<g fill="${trim}" opacity=".85"><circle cx="26" cy="94" r="1.4"/><circle cx="74" cy="94" r="1.4"/><circle cx="50" cy="96" r="1.4"/><circle cx="36" cy="89" r="1.2"/><circle cx="64" cy="89" r="1.2"/></g>`:''}`}
const H={ // hair parts: back (behind head) and front (fringe)
 long:c=>[`<path d="M23 54Q20 20 50 18Q80 20 77 54Q80 84 70 96L30 96Q20 84 23 54Z" fill="${c}"/>`,`<path d="M26 52Q27 24 50 24Q73 24 74 52Q64 36 52 38Q40 34 26 52Z" fill="${c}"/><path d="M38 28Q46 34 44 42" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/>`],
 bob:c=>[`<path d="M23 52Q21 20 50 18Q79 20 77 52Q79 70 73 74L27 74Q21 70 23 52Z" fill="${c}"/>`,`<path d="M25 54Q24 24 50 24Q76 24 75 54Q70 38 56 36Q44 40 40 44Q32 42 25 54Z" fill="${c}"/>`],
 braids:c=>[`<path d="M24 52Q22 20 50 18Q78 20 76 52L76 56L24 56Z" fill="${c}"/><path d="M26 58Q20 72 26 90" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M74 58Q80 72 74 90" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="26" cy="92" r="3.2" fill="#c9a961"/><circle cx="74" cy="92" r="3.2" fill="#c9a961"/>`,`<path d="M26 52Q27 24 50 24Q73 24 74 52Q66 36 54 36Q44 40 40 44Q32 40 26 52Z" fill="${c}"/>`],
 short:c=>[`<path d="M24 50Q22 20 50 18Q78 20 76 50Q76 40 70 34L30 34Q24 40 24 50Z" fill="${c}"/>`,`<path d="M25 52Q22 22 50 21Q78 22 75 52Q72 38 62 34Q52 42 38 36Q28 40 25 52Z" fill="${c}"/>`],
 side:c=>[`<path d="M24 50Q22 20 50 18Q78 20 76 50L24 50Z" fill="${c}"/>`,`<path d="M24 54Q20 22 50 20Q80 22 76 54Q74 40 64 36Q54 30 36 40Q28 44 24 54Z" fill="${c}"/><path d="M40 30Q52 28 62 36" stroke="#fff" stroke-opacity=".22" stroke-width="2" fill="none"/>`],
 cover:c=>['','']
};
const HEAD={
 hijab:(c,t)=>`<path d="M20 58Q16 14 50 12Q84 14 80 58Q84 84 72 94L28 94Q16 84 20 58Z" fill="${c}"/>`,
 hijabFront:(c,t)=>`<path d="M28 52Q28 28 50 27Q72 28 72 52Q64 34 50 34Q36 34 28 52Z" fill="${c}"/><path d="M27 54Q27 26 50 25Q73 26 73 54" fill="none" stroke="${t}" stroke-width="1.6"/>`,
 beanie:(c,t)=>`<path d="M24 46Q22 14 50 13Q78 14 76 46Z" fill="${c}"/><rect x="22" y="40" width="56" height="9" rx="4.5" fill="${t}"/><circle cx="50" cy="11" r="5" fill="${t}"/><path d="M30 41v7M38 41v7M46 41v7M54 41v7M62 41v7M70 41v7" stroke="${c}" stroke-opacity=".35" stroke-width="1.3"/>`,
 kulla:(c,t)=>`<path d="M27 42Q27 20 50 19Q73 20 73 42Q50 36 27 42Z" fill="${c}"/><path d="M27 42Q50 36 73 42" fill="none" stroke="${t}" stroke-width="2"/>`,
 cap:(c,t)=>`<path d="M25 44Q25 16 50 16Q75 16 75 44Z" fill="${c}"/><path d="M22 44H84Q82 49 70 48H25Z" fill="${t}"/><circle cx="50" cy="15" r="2.2" fill="${t}"/>`,
 shawl:(c,t)=>`<path d="M17 62Q12 10 50 10Q88 10 83 62Q86 86 76 96L24 96Q14 86 17 62Z" fill="${c}"/><path d="M17 62Q12 10 50 10Q88 10 83 62" fill="none" stroke="${t}" stroke-width="2"/>`,
 crocus:()=>`<g transform="translate(70 28)"><path d="M0 0L-7-7Q-1-12 3-5Z" fill="#8a5fc4"/><path d="M0 0L7-7Q1-12-3-5Z" fill="#8a5fc4"/><path d="M0 0L-9 2Q-8 9 0 8Z" fill="#a47ae0"/><path d="M0 0L9 2Q8 9 0 8Z" fill="#a47ae0"/><path d="M0 0L-3-6M0 0L1-7M0 0L4-5" stroke="#e5484d" stroke-width="1.2"/></g>`,
 jhumka:()=>`<g fill="#c9a961"><circle cx="25" cy="66" r="2"/><path d="M22.5 68h5l-2.5 6z"/><circle cx="75" cy="66" r="2"/><path d="M72.5 68h5l-2.5 6z"/></g>`,
 glasses:()=>`<g fill="none" stroke="#2a2018" stroke-width="1.6"><circle cx="40" cy="56" r="8.5"/><circle cx="60" cy="56" r="8.5"/><path d="M48.5 55h3"/></g>`,
 camera:()=>`<g transform="translate(66 86)"><rect x="-9" y="-6" width="18" height="12" rx="2.5" fill="#2a2a30"/><rect x="-4" y="-9" width="8" height="4" rx="1" fill="#2a2a30"/><circle cx="0" cy="0" r="4" fill="#9fb8d0" stroke="#e8e8e8" stroke-width="1.2"/></g>`,
 scarf:(c)=>`<path d="M30 80Q50 92 70 80L72 90Q50 102 28 90Z" fill="${c}"/><path d="M60 88L68 100L58 98Z" fill="${c}"/>`
};
function av(o){ // o: bg[2], skin, iris, hair:[style,color], head:[type,color,trim], cloth:[color,trim], extras
 const hr=o.hair?H[o.hair[0]](o.hair[1]):['',''];
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="${o.id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.bg[0]}"/><stop offset="1" stop-color="${o.bg[1]}"/></linearGradient><clipPath id="${o.id}c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${o.id}c)"><rect width="100" height="100" fill="url(#${o.id}b)"/><path d="M0 74L22 46L38 64L58 36L82 66L100 52V100H0Z" fill="#fff" opacity=".16"/><circle cx="82" cy="20" r="8" fill="#fff" opacity=".22"/>`;
 if(o.head&&o.head[0]==='hijab'||o.head&&o.head[0]==='shawl')s+=HEAD[o.head[0]](o.head[1],o.head[2]);
 s+=hr[0]+body(o.cloth[0],o.cloth[1],{pat:o.pat})+(o.extras&&o.extras.includes('scarf')?HEAD.scarf(o.cloth[1]):'')+face(SK[o.skin],o.iris,{grin:o.grin});
 s+=hr[1];
 if(o.head){const t=o.head[0];if(t==='hijab')s+=HEAD.hijabFront(o.head[1],o.head[2]);else if(t==='shawl')s+=HEAD.hijabFront(o.head[1],o.head[2]);else if(t!=='none')s+=HEAD[t](o.head[1],o.head[2])}
 (o.extras||[]).forEach(e=>{if(e!=='scarf')s+=HEAD[e]()});
 return s+'</g></svg>'}
const L=[
 ['saffron',{bg:['#c9a0e8','#f4c2d7'],skin:'a',iris:'#6a3fa0',hair:['long','#241a2e'],cloth:['#7a4fb8','#f0d890'],extras:['crocus','jhumka'],pat:1,grin:1}],
 ['emerald',{bg:['#2f8a6a','#bfe3c8'],skin:'b',iris:'#2a6a58',hair:['cover','#000'],head:['hijab','#1f6b52','#e6c76a'],cloth:['#17543f','#e6c76a'],extras:['jhumka'],pat:1}],
 ['rose',{bg:['#f08aa8','#ffd9c4'],skin:'a',iris:'#8a4a2a',hair:['bob','#3a2418'],cloth:['#c0395a','#f6d68a'],extras:['jhumka'],pat:1,grin:1}],
 ['snowcap',{bg:['#7fb4e0','#e8f2fb'],skin:'b',iris:'#3a6a9a',hair:['braids','#4a2a18'],head:['beanie','#e8f0f8','#c9a961'],cloth:['#e5484d','#f6f1e4'],grin:1}],
 ['ivory',{bg:['#e8c88a','#fff2d2'],skin:'a',iris:'#5a3a22',hair:['cover','#000'],head:['shawl','#f4eede','#c9a961'],cloth:['#8a6a1c','#f4eede'],extras:['jhumka'],pat:1}],
 ['sunset',{bg:['#f08a5a','#ffd28a'],skin:'c',iris:'#5a3a22',hair:['braids','#1f1814'],cloth:['#2a6a58','#f6d68a'],extras:['crocus'],grin:1}],
 ['trekker',{bg:['#4a9a7a','#cfe8c8'],skin:'b',iris:'#3a2a1a',hair:['short','#2a1a10'],head:['beanie','#c9a961','#2a5a45'],cloth:['#2a5a45','#c9a961'],extras:['scarf'],grin:1}],
 ['kulla',{bg:['#3a6a58','#d6c88a'],skin:'c',iris:'#2a1a10',hair:['short','#16100c'],head:['kulla','#2a1f1a','#c9a961'],cloth:['#6a4a2a','#e6c76a'],pat:1}],
 ['shades',{bg:['#2a2f4a','#7a8ac8'],skin:'a',iris:'#2a3a5a',hair:['side','#d8c08a'],cloth:['#1a1f35','#c9a961'],extras:['glasses'],grin:1}],
 ['scarf',{bg:['#9aa8b8','#e8eef4'],skin:'d',iris:'#2a1a10',hair:['short','#0f0a08'],cloth:['#4a5a68','#e5484d'],extras:['scarf'],grin:1}],
 ['lens',{bg:['#e8a05a','#fbe3b0'],skin:'b',iris:'#4a2e1a',hair:['side','#2a1a10'],head:['cap','#3a4a3f','#c9a961'],cloth:['#3a4a3f','#c9a961'],extras:['camera'],grin:1}],
 ['pheran',{bg:['#c24a4a','#f4c8a0'],skin:'a',iris:'#3a2a1a',hair:['side','#1a120d'],cloth:['#a83a3a','#f0d890'],pat:1}]
];
const AV={};L.forEach(([id,o])=>{o.id=id;AV[id]=av(o)});
window.AV=AV;window.AV_IDS=L.map(x=>x[0]);
})();
