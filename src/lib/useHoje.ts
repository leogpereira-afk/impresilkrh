import { useEffect, useState } from 'react';
import { diaLocalISO } from './format';
/** Atualiza telas que ficam abertas de um dia para o outro. */
export function useHoje() {
  const [hoje,setHoje]=useState(()=>new Date());
  useEffect(()=>{
    const conferir=()=>setHoje(atual=>diaLocalISO(atual)===diaLocalISO(new Date()) ? atual : new Date());
    const timer=window.setInterval(conferir,30000);
    window.addEventListener('focus',conferir);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',conferir);};
  },[]);
  return hoje;
}
