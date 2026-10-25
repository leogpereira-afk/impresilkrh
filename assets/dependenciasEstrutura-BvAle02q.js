function g(n,r,t){return r.filter(e=>e.cargoId===n).length+t.filter(e=>e.cargoId===n).length}function l(n,r,t,e,a){return[...r,...t,...e,...a].filter(d=>d.areaId===n).length}export{l as a,g as d};
