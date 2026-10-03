import{z as u}from"./index-CWlUkTWL.js";/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=u("Camera",[["path",{d:"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",key:"1tc9qg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]]);function M(s,d=320,g=.72){return new Promise((r,n)=>{const t=new FileReader;t.onload=()=>{const o=String(t.result),a=new Image;a.onload=()=>{const l=Math.max(a.width,a.height)||1,c=Math.min(1,d/l),i=Math.max(1,Math.round(a.width*c)),h=Math.max(1,Math.round(a.height*c)),e=document.createElement("canvas");e.width=i,e.height=h;const m=e.getContext("2d");if(!m){r(o);return}m.drawImage(a,0,0,i,h);try{r(e.toDataURL("image/jpeg",g))}catch{r(o)}},a.onerror=()=>n(new Error("Não foi possível ler a imagem.")),a.src=o},t.onerror=()=>n(new Error("Falha ao ler o arquivo.")),t.readAsDataURL(s)})}export{x as C,M as c};
