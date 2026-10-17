function i(c){const o=[...c].sort((e,t)=>t.dataInicio.localeCompare(e.dataInicio)||e.id.localeCompare(t.id));return o.find(e=>e.status==="Aberto")??o[0]}export{i as c};
