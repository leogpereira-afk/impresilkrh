import{z as r,H as s,D as n}from"./index-CSfPFS7m.js";/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=r("Hourglass",[["path",{d:"M5 22h14",key:"ehvnwv"}],["path",{d:"M5 2h14",key:"pdyrp9"}],["path",{d:"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",key:"1d314k"}],["path",{d:"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",key:"1vvvr6"}]]);function c(t,e=s){return t.filter(a=>!a.ehDirecao).map(a=>({c:a,sit:n(a,e),marcado:a.statusId==="experiencia"})).filter(a=>!!a.sit).sort((a,i)=>a.sit.diasParaFim-i.sit.diasParaFim)}function p(t){const e=t[0];if(!e)return"";const a=e.sit.fim.toLocaleDateString("pt-BR"),i=e.sit.diasParaFim;return i<0?`A de ${e.c.nome} venceu em ${a}`:i===0?`A de ${e.c.nome} termina HOJE, ${a}`:`A próxima termina em ${a} · ${i} dia(s)`}export{m as H,p,c as q};
