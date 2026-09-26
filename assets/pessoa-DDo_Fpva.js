import{z as a,a as c,j as t}from"./index-CSfPFS7m.js";import{i as h}from"./identidade-DXsFyC0s.js";/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=a("ArrowRightLeft",[["path",{d:"m16 3 4 4-4 4",key:"1x1c3m"}],["path",{d:"M20 7H4",key:"zbl0bi"}],["path",{d:"m8 21-4-4 4-4",key:"h9nckh"}],["path",{d:"M4 17h16",key:"g4d7ey"}]]);/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=a("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]]);/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=a("Link2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);function L({colaboradorId:s,nome:n,cpf:p,className:d}){const i=c(),e=s?i.colabById.get(s):void 0,m=p??(e==null?void 0:e.cpf),o=h(m),r=n??(e==null?void 0:e.nome)??s??"—";return t.jsxs("span",{className:d,children:[t.jsx("span",{className:"font-medium text-slate-800",children:r})," ",o?t.jsx("span",{className:"whitespace-nowrap rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium tabular-nums text-slate-500",title:"ID da pessoa — 6 primeiros dígitos do CPF",children:o}):t.jsx("span",{className:"whitespace-nowrap rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800",title:"Sem CPF no cadastro: esta ficha não casa pela chave forte, só pelo nome — e nome se repete.",children:"sem ID"})]})}export{y as A,k as L,L as P,u as a};
