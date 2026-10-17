import { cn } from "@/lib/cn";
import silkRosto from '@/assets/brand/silk-rosto.webp';
import './silk-header.css';

export function PageHeader({title,description,children,className,tom='marinho'}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  tom?: 'marinho' | 'azul' | 'petroleo' | 'ardosia';
}) {
  return <header className={cn('silk-faixa',className)} data-tom={tom}>
    <img className="silk-imagem" src={silkRosto} alt="" width={72} height={80} />
    <div className="silk-texto"><p className="silk-contexto">PESSOAS · RH IMPRESILK</p><h1>{title}</h1>
      {description&&<p>{description}</p>}
    </div>
    {children&&<div className="silk-acoes">{children}</div>}
  </header>;
}
