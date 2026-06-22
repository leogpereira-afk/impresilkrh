import type { Colaborador, Perfil } from "./types";
import { mulberry32, gerarCPF, email, slug } from "./_gen";

// Apêndice F — Quadro de colaboradores (dados reais). CPF/telefone/endereço são
// fictícios, porém estáveis (gerados deterministicamente) apenas para demonstração.

type Spec = {
  nome: string;
  cargoId?: string;
  cargoLivre?: string;
  areaId: string;
  nivel?: string;
  salario?: number;
  refMin?: number;
  refMax?: number;
  enquadramento?: string;
  obs?: string;
  gestor?: string; // nome do gestor
  perfil?: Perfil;
  nascimento?: string;
  admissao?: string;
  desligamento?: string;
  risco?: string;
  potencial?: string;
  statusId?: string;
  ehDirecao?: boolean;
  semPessoais?: boolean; // assessorias externas (não são pessoas físicas)
};

const DIRECAO: Spec[] = [
  { nome: "Maria Inês", cargoLivre: "Fundadora", areaId: "direcao", ehDirecao: true, statusId: "direcao", nascimento: "1958-03-14", admissao: "1984-01-10" },
  { nome: "Pedro Ramos", cargoLivre: "Fundador", areaId: "direcao", ehDirecao: true, statusId: "direcao", nascimento: "1956-07-22", admissao: "1984-01-10" },
  { nome: "Leonardo Gonçalves", cargoLivre: "Diretor Geral", areaId: "direcao", ehDirecao: true, statusId: "direcao", gestor: "Pedro Ramos", perfil: "GESTOR", nascimento: "1979-05-30", admissao: "2005-02-01" },
  { nome: "Consultorias", cargoLivre: "Consultoria", areaId: "direcao", ehDirecao: true, statusId: "externo", gestor: "Leonardo Gonçalves", semPessoais: true },
  { nome: "Contabilidade", cargoLivre: "Contabilidade", areaId: "direcao", ehDirecao: true, statusId: "externo", gestor: "Leonardo Gonçalves", semPessoais: true },
  { nome: "Jurídico", cargoLivre: "Jurídico", areaId: "direcao", ehDirecao: true, statusId: "externo", gestor: "Leonardo Gonçalves", semPessoais: true },
];

const EQUIPE: Spec[] = [
  { nome: "Pedro Henrique Gonçalves", cargoId: "gerente-operacoes", areaId: "adm", nivel: "N1", salario: 1926.0, refMin: 3500, refMax: 5500, enquadramento: "Crítico", obs: "Ajuste prioritário", gestor: "Leonardo Gonçalves", perfil: "GESTOR", nascimento: "1982-04-12", admissao: "2017-02-01", risco: "Alto", potencial: "Alto" },
  { nome: "Jéssica Fernanda S. Sampaio", cargoId: "gerente-administrativo", areaId: "adm", nivel: "N1", salario: 1816.64, refMin: 3000, refMax: 5500, enquadramento: "Crítico", obs: "Ajuste prioritário", gestor: "Leonardo Gonçalves", perfil: "GESTOR", nascimento: "1986-09-25", admissao: "2018-05-10", risco: "Alto", potencial: "Alto" },
  { nome: "Saulo Rodrigues Ferreira", cargoId: "gerente-montagem-portas", areaId: "montagem", nivel: "N2", salario: 2416.54, refMin: 2200, refMax: 3000, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", perfil: "GESTOR", nascimento: "1984-11-03", admissao: "2016-08-15", risco: "Médio", potencial: "Alto" },
  { nome: "Camila Cristina R. Sampaio", cargoId: "coordenador-administrativo", areaId: "adm", nivel: "N1", salario: 1955.43, refMin: 2800, refMax: 4500, enquadramento: "Crítico", obs: "Ajuste prioritário", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1990-01-18", admissao: "2019-03-01", risco: "Alto", potencial: "Alto" },
  { nome: "Larissa Andrade Souza", cargoId: "rh-dp", areaId: "adm", nivel: "N3", salario: 2450.0, refMin: 1900, refMax: 3000, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", perfil: "ADMIN_RH", nascimento: "1990-06-18", admissao: "2019-08-01", risco: "Baixo", potencial: "Alto" },
  { nome: "Rodrigo Moreira Silva", cargoId: "analista-pcp", areaId: "adm", nivel: "N1", salario: 2675.0, refMin: 2500, refMax: 4000, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1991-08-07", admissao: "2022-06-13", risco: "Médio", potencial: "Alto" },
  { nome: "Raphael Terra Alves", cargoId: "assistente-suprimentos", areaId: "adm", nivel: "N1", salario: 2675.0, refMin: 2800, refMax: 3100, enquadramento: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1992-11-12", admissao: "2023-01-09", risco: "Médio", potencial: "Médio" },
  { nome: "Adriano Nunes Araújo", cargoId: "lider-montagem-portas", areaId: "montagem", nivel: "N2", salario: 2473.04, refMin: 2200, refMax: 3000, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Saulo Rodrigues Ferreira", perfil: "GESTOR", nascimento: "1988-06-15", admissao: "2015-09-20", risco: "Médio", potencial: "Alto" },
  { nome: "Adriano Pinheiro Lima", cargoId: "instalador-cv", areaId: "montagem", nivel: "N3", salario: 2140.0, refMin: 1800, refMax: 2500, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1991-02-22", admissao: "2018-01-15", risco: "Médio", potencial: "Médio" },
  { nome: "Douglas Thiago Silva", cargoId: "instalador-cv", areaId: "montagem", nivel: "N3", salario: 2140.0, refMin: 1800, refMax: 2300, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1993-07-30", admissao: "2019-06-03", risco: "Alto", potencial: "Médio" },
  { nome: "Lucas Natalino Ferreira", cargoId: "instalador-cv", areaId: "montagem", nivel: "N4", salario: 2350.0, refMin: 1800, refMax: 2400, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1990-12-11", admissao: "2016-11-01", risco: "Médio", potencial: "Alto" },
  { nome: "Ronivon Cardoso dos Santos", cargoId: "instalador-cv", areaId: "montagem", nivel: "N4", salario: 2247.0, refMin: 1800, refMax: 2500, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1989-03-05", admissao: "2017-07-19", risco: "Médio", potencial: "Médio" },
  { nome: "José Adilando Pereira", cargoId: "instalador-assistente", areaId: "montagem", nivel: "N5", salario: 1926.0, refMin: 1621, refMax: 1800, enquadramento: "Acima", obs: "Monitorar compressão", gestor: "Adriano Nunes Araújo", nascimento: "1979-10-08", admissao: "2014-04-12", risco: "Médio", potencial: "Médio" },
  { nome: "Tiago Mendes Rocha", cargoId: "instalador-assistente", areaId: "montagem", nivel: "N2", salario: 1666.0, refMin: 1621, refMax: 1800, enquadramento: "Dentro", obs: "Desligado", gestor: "Adriano Nunes Araújo", nascimento: "1996-04-10", admissao: "2022-03-01", desligamento: "2026-03-15", risco: "Alto", potencial: "Médio", statusId: "inativo" },
  { nome: "André Maia Costa", cargoId: "impressor", areaId: "producao", nivel: "N1", salario: 1840.4, refMin: 1800, refMax: 2400, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1995-05-14", admissao: "2022-03-10", risco: "Baixo", potencial: "Médio" },
  { nome: "Ewerton Duarte Amaral", cargoId: "impressor", areaId: "producao", nivel: "N2", salario: 1897.91, refMin: 1800, refMax: 2400, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1994-08-21", admissao: "2021-02-08", risco: "Baixo", potencial: "Médio" },
  { nome: "Bruno Dias do Nascimento", cargoId: "operador-cv", areaId: "producao", nivel: "N4", salario: 2033.0, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1987-06-15", admissao: "2015-05-04", risco: "Baixo", potencial: "Alto" },
  { nome: "Charles Alves Dias", cargoId: "operador-cv", areaId: "producao", nivel: "N3", salario: 1872.5, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1992-09-09", admissao: "2018-10-22", risco: "Baixo", potencial: "Médio" },
  { nome: "Elnata Pereira dos Santos", cargoId: "operador-cv", areaId: "producao", nivel: "N3", salario: 1872.5, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1993-11-28", admissao: "2019-01-14", risco: "Baixo", potencial: "Médio" },
  { nome: "Osmané Vinicius Neponuceno", cargoId: "operador-cv", areaId: "producao", nivel: "N3", salario: 1897.91, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1991-04-17", admissao: "2018-03-26", risco: "Baixo", potencial: "Médio" },
  { nome: "Sidney Nunes da Silva", cargoId: "operador-cv", areaId: "producao", nivel: "N3", salario: 1897.91, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1990-07-02", admissao: "2017-12-05", risco: "Baixo", potencial: "Médio", statusId: "experiencia" },
  { nome: "Vinicius Aguiar Rodrigues", cargoId: "operador-cnc", areaId: "producao", nivel: "N5", salario: 2215.38, refMin: 1621, refMax: 2200, enquadramento: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1985-02-19", admissao: "2014-09-08", risco: "Médio", potencial: "Alto" },
  { nome: "Daniel Pereira de Oliveira", cargoId: "pintor-cv", areaId: "producao", nivel: "N1", salario: 1680.97, refMin: 2000, refMax: 2200, enquadramento: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1996-06-08", admissao: "2025-09-15", risco: "Alto", potencial: "Médio" },
  { nome: "Demerval Vieira", cargoId: "designer-grafico", areaId: "producao", nivel: "N4", salario: 2140.0, refMin: 1800, refMax: 2300, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1989-06-03", admissao: "2016-04-20", risco: "Médio", potencial: "Alto" },
  { nome: "Eberth Soares Santos", cargoId: "designer-grafico", areaId: "producao", nivel: "N5", salario: 2668.79, refMin: 1800, refMax: 2300, enquadramento: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1984-10-15", admissao: "2013-07-01", risco: "Baixo", potencial: "Alto" },
  { nome: "Vinicius Silva Lins", cargoId: "projetista", areaId: "producao", nivel: "N1", salario: 1840.4, refMin: 2200, refMax: 3500, enquadramento: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1997-01-27", admissao: "2024-02-12", risco: "Alto", potencial: "Alto" },
  { nome: "Nailton Antunes da Silva", cargoId: "serralheiro", areaId: "serralheria", nivel: "N5", salario: 2588.06, refMin: 1800, refMax: 2500, enquadramento: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1980-08-30", admissao: "2012-05-14", risco: "Baixo", potencial: "Médio" },
  { nome: "Paulo Alves Cordeiro", cargoId: "soldador", areaId: "serralheria", nivel: "N5", salario: 2588.06, refMin: 1800, refMax: 2500, enquadramento: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1981-12-19", admissao: "2013-02-26", risco: "Baixo", potencial: "Médio" },
  { nome: "Adilson Barbosa", cargoId: "atendente-comercial", areaId: "comercial", nivel: "N5", salario: 1955.43, refMin: 1621, refMax: 2000, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1983-06-03", admissao: "2015-01-19", risco: "Baixo", potencial: "Médio" },
  { nome: "Marcella Laiara Rocha", cargoId: "atendente-comercial", areaId: "comercial", nivel: "N3", salario: 1816.67, refMin: 1650, refMax: 1950, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1995-06-22", admissao: "2020-10-05", risco: "Baixo", potencial: "Alto" },
  { nome: "Patrícia Gomes Lopes", cargoId: "atendente-comercial", areaId: "comercial", nivel: "N2", salario: 1716.0, refMin: 1621, refMax: 2000, enquadramento: "Dentro", obs: "Desligado", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1997-02-15", admissao: "2023-06-01", desligamento: "2026-05-20", risco: "Alto", potencial: "Médio", statusId: "inativo" },
  { nome: "Barbara Patricia Ferreira", cargoId: "consultor-vendas", areaId: "comercial", nivel: "N2", salario: 1816.67, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1994-03-22", admissao: "2021-08-30", risco: "Médio", potencial: "Alto" },
  { nome: "Candida Elia David Barros", cargoId: "consultor-vendas", areaId: "comercial", nivel: "N1", salario: 1680.97, refMin: 1621, refMax: 2200, enquadramento: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1998-09-28", admissao: "2025-03-17", risco: "Médio", potencial: "Médio" },
];

const RUAS = ["Rua das Acácias", "Av. Cula Mangabeira", "Rua Coronel Prates", "Av. Mestra Fininha", "Rua Dois de Maio"];
const BAIRROS = ["Centro", "Major Prates", "Cândida Câmara", "Todos os Santos", "Ibituruna"];
const CONJ_NOMES = ["Maria", "João", "Ana", "Carlos", "Fernanda", "Roberto"];
const CONJ_SOBRE = ["Silva", "Souza", "Santos", "Costa"];

function construir(spec: Spec, i: number): Colaborador {
  const rng = mulberry32(1000 + i * 97);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  const id = slug(spec.nome);

  const base: Colaborador = {
    id,
    nome: spec.nome,
    email: spec.semPessoais ? undefined : email(spec.nome),
    cargoId: spec.cargoId ?? null,
    cargoLivre: spec.cargoLivre,
    nivelId: spec.nivel ?? null,
    areaId: spec.areaId,
    gestorId: spec.gestor ? slug(spec.gestor) : null,
    salario: spec.salario ?? null,
    refMin: spec.refMin ?? null,
    refMax: spec.refMax ?? null,
    enquadramento: spec.enquadramento ?? null,
    observacaoEnquadramento: spec.obs ?? null,
    riscoSaida: spec.risco ?? "Baixo",
    potencial: spec.potencial ?? "Médio",
    statusId: spec.statusId ?? "ativo",
    perfil: spec.perfil ?? "COLABORADOR",
    ehDirecao: spec.ehDirecao ?? false,
    dataNascimento: spec.nascimento,
    dataAdmissao: spec.admissao,
    dataDesligamento: spec.desligamento ?? null,
    qtdFilhos: 0,
    valeTransporte: i % 3 !== 0,
  };

  if (!spec.semPessoais) {
    base.cpf = gerarCPF(i + 100);
    base.telefone = `(38) 9${rint(8000, 9999)}-${rint(1000, 9999)}`;
    base.enderecoRua = RUAS[i % RUAS.length];
    base.enderecoNumero = String(rint(50, 1500));
    base.enderecoComplemento = i % 4 === 0 ? `Apto ${rint(11, 305)}` : null;
    base.enderecoBairro = BAIRROS[i % BAIRROS.length];
    base.enderecoCep = `393${rint(10, 99)}-${rint(100, 999)}`;
    base.matriculaEsocial = `${rint(10000, 99999)}-${rint(0, 9)}`;
    base.qtdFilhos = spec.ehDirecao ? rint(1, 3) : rint(0, 3);
    if (!spec.ehDirecao) {
      base.conjugeNome = i % 3 === 0 ? null : `${CONJ_NOMES[i % CONJ_NOMES.length]} ${CONJ_SOBRE[i % CONJ_SOBRE.length]}`;
      base.conjugeTelefone = base.conjugeNome ? `(38) 9${rint(8000, 9999)}-${rint(1000, 9999)}` : null;
    }
  }

  return base;
}

export const COLABORADORES: Colaborador[] = [...DIRECAO, ...EQUIPE].map(construir);
