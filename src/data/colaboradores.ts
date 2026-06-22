import type { Colaborador, Perfil } from "./types";
import { mulberry32, gerarCPF, email, slug, HOJE } from "./_gen";

// Quadro de colaboradores — Base de Dados RH (planilha real da empresa), com 100
// registros (Impresilk, Neon, Forte Mais). Inclui perfil comportamental, humor/
// engajamento e estilo de aprendizagem. CPF/telefone/endereço são fictícios e estáveis.

type Spec = {
  nome: string; empresa?: string; areaId: string; cargoId?: string; funcao?: string;
  nivel?: string; salario?: number; adicionais?: number; statusId?: string; sexo?: string;
  humor?: string; estilo?: string; perfilComp?: string; nascimento?: string; admissao?: string;
  gestor?: string; perfil?: Perfil; risco?: string; potencial?: string;
  ehDirecao?: boolean; semPessoais?: boolean; cargoLivre?: string;
};

const DIRECAO: Spec[] = [
  { nome: "Maria Inês", cargoLivre: "Fundadora", areaId: "direcao", ehDirecao: true, statusId: "direcao", nascimento: "1958-03-14", admissao: "1984-01-10", empresa: "Impresilk" },
  { nome: "Pedro Ramos", cargoLivre: "Fundador", areaId: "direcao", ehDirecao: true, statusId: "direcao", nascimento: "1956-07-22", admissao: "1984-01-10", empresa: "Impresilk" },
  { nome: "Leonardo Gonçalves", cargoLivre: "Diretor Geral", areaId: "direcao", ehDirecao: true, statusId: "direcao", gestor: "Pedro Ramos", perfil: "GESTOR", nascimento: "1979-05-30", admissao: "2005-02-01", empresa: "Impresilk" },
  { nome: "Larissa Andrade Souza", cargoId: "rh-dp", areaId: "adm", nivel: "N3", salario: 2450, statusId: "ativo", perfil: "ADMIN_RH", gestor: "Leonardo Gonçalves", nascimento: "1990-06-18", admissao: "2019-08-01", sexo: "Feminino", humor: "Motivado", perfilComp: "Sanguíneo", estilo: "Visual", risco: "Baixo", potencial: "Alto", empresa: "Impresilk" },
];

const EQUIPE: Spec[] = [
  { nome: "Adenilton Ribeiro Neves", empresa: "Impresilk", areaId: "producao", cargoId: "serralheiro", nivel: "N2", salario: 1900.0, adicionais: 179.45, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1980-04-17", admissao: "2023-08-10", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Adilson Barbosa Fonseca", empresa: "Impresilk", areaId: "producao", cargoId: "atendente-comercial", nivel: "N5", salario: 1955.43, statusId: "ativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1984-12-04", admissao: "2014-08-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Alto" },
  { nome: "Adriano Nunes Araújo", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N5", salario: 2473.04, statusId: "ativo", sexo: "Masculino", humor: "Estável", estilo: "Visual", perfilComp: "Melancólico", nascimento: "1996-01-09", admissao: "2014-08-01", gestor: "Saulo Rodrigues Ferreira", risco: "Médio", potencial: "Médio" },
  { nome: "Alex Alves Araújo", empresa: "Neon", areaId: "adm", cargoId: "designer-grafico", nivel: "N2", salario: 1679.9, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Melancólico", nascimento: "1999-03-19", admissao: "2023-09-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Álvaro de Jesus Lelis Fonseca", empresa: "Neon", areaId: "adm", cargoId: "designer-grafico", nivel: "N3", salario: 2500.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", admissao: "2023-04-18", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Andre Juneo Ferreira Vieira", empresa: "Neon", areaId: "producao", cargoId: "instalador-cv", nivel: "N3", salario: 1600.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "2002-08-03", admissao: "2022-11-24", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Alto" },
  { nome: "Adriano Pinheiro Lima", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N1", salario: 2141.37, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1987-06-28", admissao: "2025-08-15", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Alto" },
  { nome: "Alice Veloso Pereira", empresa: "Impresilk", areaId: "adm", cargoId: "rh-dp", nivel: "N1", salario: 800.0, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1995-12-10", admissao: "2024-10-08", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Anderson Ribeiro Rocha", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", nascimento: "1994-06-03", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Camila Cristina Rodrigues Costa Magalhães", empresa: "Forte Mais", areaId: "adm", funcao: "Financeiro", nivel: "N2", salario: 400.0, statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1989-05-08", admissao: "2023-07-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Alexandro Soares Rafael", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1800.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Sanguíneo", nascimento: "1988-12-18", admissao: "2025-07-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Camila Cristina Rodrigues Costa Magalhães (2)", empresa: "Neon", areaId: "adm", funcao: "Ass Istente Financeiro", nivel: "N3", salario: 600.0, statusId: "ativo", sexo: "Feminino", humor: "Estável", estilo: "Visual", perfilComp: "Colérico", nascimento: "1989-05-08", admissao: "2023-02-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Alto" },
  { nome: "Anna Clara Souza Cruz", empresa: "Impresilk", areaId: "adm", funcao: "Recepcionista", nivel: "N3", salario: 1365.81, statusId: "inativo", sexo: "Feminino", humor: "Desmotivado", estilo: "Visual", perfilComp: "Sanguíneo", nascimento: "1994-03-22", admissao: "2023-02-08", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Alto" },
  { nome: "Emile Carvalho Alves", empresa: "Neon", areaId: "comercial", cargoId: "atendente-comercial", nivel: "N2", salario: 1365.81, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Sanguíneo", admissao: "2023-07-06", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Andre Maia Costa", empresa: "Impresilk", areaId: "adm", funcao: "Assistente de Compras", nivel: "N1", salario: 1844.77, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", nascimento: "2003-10-29", admissao: "2024-11-14", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Arlen Fabiano Niz de Souza", empresa: "Impresilk", areaId: "adm", cargoId: "analista-pcp", nivel: "N1", salario: 2500.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1997-08-27", admissao: "2025-02-19", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Guilherme Gonçalves Ferreira", empresa: "Forte Mais", areaId: "adm", funcao: "Auxiliar de Engenharia", nivel: "N3", salario: 1365.81, adicionais: 350.0, statusId: "inativo", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1999-05-17", admissao: "2023-01-23", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Alto" },
  { nome: "Deivid Oliveira Silva", empresa: "Neon", areaId: "producao", cargoId: "instalador-cv", nivel: "N2", salario: 1365.81, statusId: "inativo", sexo: "Masculino", humor: "Estável", nascimento: "2003-12-13", admissao: "2023-07-20", gestor: "Saulo Rodrigues Ferreira", risco: "Médio", potencial: "Médio" },
  { nome: "Breno de Sousa Alves", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N2", salario: 1461.41, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "2002-08-16", admissao: "2024-02-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Bruno Dias do Nascimento", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N2", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "2002-10-03", admissao: "2024-03-04", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Barbara Patrícia F. Vasconcelos", empresa: "Impresilk", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N4", salario: 1816.67, statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1996-04-04", admissao: "2016-09-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Bruno Dias do Nascimento (2)", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1720.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "2022-10-03", admissao: "2024-09-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Camila Cristina Rodrigues C. Magalhães", empresa: "Impresilk", areaId: "adm", cargoId: "coordenador-administrativo", nivel: "N3", salario: 1955.43, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1989-05-08", admissao: "2022-12-01", gestor: "Leonardo Gonçalves", risco: "Baixo", potencial: "Alto" },
  { nome: "Candida Eliza David Barros", empresa: "Impresilk", areaId: "comercial", cargoId: "atendente-comercial", nivel: "N1", salario: 1680.97, statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1988-11-20", admissao: "2024-12-17", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Maria Fernanda", empresa: "Neon", areaId: "comercial", funcao: "Estagiária", nivel: "N2", salario: 682.91, statusId: "inativo", sexo: "Feminino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "2005-03-27", admissao: "2023-09-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Médio", potencial: "Médio" },
  { nome: "Charles Alves Dias", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1872.5, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "1975-10-18", admissao: "2025-12-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Daniel Pereira de Oliveira", empresa: "Impresilk", areaId: "producao", cargoId: "pintor-cv", nivel: "N4", salario: 1680.97, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Melancólico", nascimento: "1959-03-30", admissao: "2018-05-10", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Marcos Rodrigues Lopes", empresa: "Forte Mais", areaId: "adm", funcao: "Auxiliar de Engenharia", nivel: "N2", salario: 1600.0, adicionais: 500.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1993-05-23", admissao: "2023-08-14", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Emanuele Dias Ribeiro", empresa: "Impresilk", areaId: "adm", cargoId: "atendente-comercial", nivel: "N1", salario: 1571.0, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "2004-12-04", admissao: "2025-06-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Gabriel Ferreira Caldeira", empresa: "Impresilk", areaId: "comercial", cargoId: "projetista", nivel: "N3", salario: 2000.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1998-05-23", admissao: "2023-03-23", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Pedro Henrique Golçalves Pereira", empresa: "Neon", areaId: "adm", funcao: "Compras", nivel: "N4", salario: 320.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "1995-05-08", admissao: "2021-01-10", gestor: "Leonardo Gonçalves", perfil: "GESTOR", risco: "Baixo", potencial: "Alto" },
  { nome: "Gracielle Silva Almeida", empresa: "Impresilk", areaId: "adm", funcao: "Recepcionista", nivel: "N3", salario: 1365.81, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "1986-08-08", admissao: "2023-06-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Guilherme", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1600.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Hémerson Hale Cardoso Vieira", empresa: "Impresilk", areaId: "comercial", funcao: "Almoxarife", nivel: "N1", salario: 1720.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1998-11-01", admissao: "2024-11-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Hugo César Barbosa Gusmão", empresa: "Impresilk", areaId: "producao", cargoId: "atendente-comercial", nivel: "N2", salario: 1500.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1988-06-14", admissao: "2024-02-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Demerval Vieira", empresa: "Impresilk", areaId: "comercial", cargoId: "designer-grafico", nivel: "N1", salario: 2000.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", admissao: "2026-01-20", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Médio" },
  { nome: "Pedro Henrique Silva Lopes", empresa: "Neon", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N3", salario: 1461.41, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "2000-12-10", admissao: "2021-11-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Rony Plablo Soares Queiroz", empresa: "Neon", areaId: "producao", cargoId: "lider-montagem-portas", nivel: "N3", salario: 1750.0, statusId: "ativo", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1993-12-23", admissao: "2021-11-01", gestor: "Saulo Rodrigues Ferreira", risco: "Médio", potencial: "Alto" },
  { nome: "Hugo Vinicius Ramos de Araújo Veloso", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N4", salario: 1935.0, statusId: "inativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "1998-04-05", admissao: "2021-01-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Médio" },
  { nome: "Jelio dos Santos Lopes Junior", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N4", salario: 1712.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Melancólico", nascimento: "1998-12-31", admissao: "2018-09-21", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Jefferson Matheus Matarazzo R. Silva", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1697.82, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1996-01-18", admissao: "2024-11-15", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "João Lucas Dias de Oliveira", empresa: "Impresilk", areaId: "adm", cargoId: "projetista", nivel: "N2", salario: 1365.81, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1997-11-03", admissao: "2023-08-10", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "José Jhon Pereira", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N3", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1988-12-25", admissao: "2022-06-07", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Wellington Silva Novais", empresa: "Neon", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N4", salario: 2500.0, statusId: "ativo", sexo: "Masculino", humor: "Estável", estilo: "Visual", perfilComp: "Colérico", nascimento: "1988-09-17", admissao: "2021-06-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Médio", potencial: "Alto" },
  { nome: "José Jhon Pereira (2)", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1988-12-25", admissao: "2024-11-14", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Lorena Taloany Soares dos Santos", empresa: "Impresilk", areaId: "adm", funcao: "Recepcionista", nivel: "N5", salario: 1365.81, statusId: "inativo", sexo: "Feminino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "2023-10-05", admissao: "1999-06-14", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Alto" },
  { nome: "Dermeval Vieira", empresa: "Impresilk", areaId: "comercial", cargoId: "designer-grafico", nivel: "N1", salario: 2000.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", admissao: "2026-02-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Médio" },
  { nome: "Márcio Rafael Barbosa Souza", empresa: "Impresilk", areaId: "producao", cargoId: "impressor", nivel: "N2", salario: 1700.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", nascimento: "1987-02-11", admissao: "2024-06-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Marco Tulio de Souza Rocha Juniro", empresa: "Impresilk", areaId: "adm", cargoId: "designer-grafico", nivel: "N3", salario: 1500.0, statusId: "inativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1999-08-22", admissao: "2023-02-08", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Alto" },
  { nome: "Maria Elaine Moreira Ramos", empresa: "Impresilk", areaId: "comercial", cargoId: "atendente-comercial", nivel: "N1", salario: 1461.41, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "1986-02-10", admissao: "2024-11-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Maria Imaculada Alves Silva", empresa: "Impresilk", areaId: "adm", funcao: "Auxiliar de Qualidade", nivel: "N2", salario: 1461.41, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "2000-09-21", admissao: "2024-05-10", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Maria Luiza Lasarin de Melo", empresa: "Impresilk", areaId: "adm", cargoId: "designer-grafico", nivel: "N2", salario: 1650.0, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "2001-04-12", admissao: "2023-12-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Mateus Carlos de Sousa", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N3", salario: 1700.0, statusId: "inativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "1994-04-09", admissao: "2022-05-02", gestor: "Saulo Rodrigues Ferreira", risco: "Alto", potencial: "Médio" },
  { nome: "Jhonnata Gonçalves da Silva", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1571.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "2006-05-07", admissao: "2025-07-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Dermeval Vieira (2)", empresa: "Impresilk", areaId: "comercial", cargoId: "designer-grafico", nivel: "N1", salario: 2140.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", nascimento: "1969-09-10", admissao: "2026-02-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Médio" },
  { nome: "Douglas Thiago Silva Siqueira", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N1", salario: 2140.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "1985-06-04", admissao: "2025-09-20", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Eberth Soares Santos", empresa: "Impresilk", areaId: "comercial", cargoId: "designer-grafico", nivel: "N5", salario: 2668.79, statusId: "ativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Visual", perfilComp: "Melancólico", nascimento: "1982-12-09", admissao: "2011-06-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Alto", potencial: "Médio" },
  { nome: "Luan Daniel Rodrigues Nunes", empresa: "Neon", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1461.41, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "2005-12-01", admissao: "2024-06-22", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Elnatã Pereira dos Santos", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-assistente", nivel: "N1", salario: 1872.5, statusId: "ativo", sexo: "Masculino", humor: "Motivado", nascimento: "2001-07-01", admissao: "2025-12-01", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Reinaldo Barbosa de Moura", empresa: "Impresilk", areaId: "producao", cargoId: "serralheiro", nivel: "N2", salario: 1900.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Melancólico", nascimento: "1975-03-05", admissao: "2024-02-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Ronaldo Barbosa de Moura", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N3", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Melancólico", nascimento: "1985-08-13", admissao: "2023-04-11", gestor: "Saulo Rodrigues Ferreira", risco: "Médio", potencial: "Médio" },
  { nome: "Luis Fernando Soares Silva", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1571.0, statusId: "inativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Visual", perfilComp: "Sanguíneo", nascimento: "2006-09-21", admissao: "2025-09-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Alto" },
  { nome: "José Adilando", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1800.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", admissao: "2026-02-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Mateus Henrique Pereira Cardoso", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1720.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1999-11-15", admissao: "2024-12-17", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Leonardo Moura Pereira", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-assistente", nivel: "N1", salario: 1750.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1991-02-09", admissao: "2025-12-01", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Alto" },
  { nome: "Andre Luiz Oliveira Pacheco", empresa: "Neon", areaId: "producao", cargoId: "instalador-cv", nivel: "N1", salario: 1461.41, statusId: "ativo", sexo: "Masculino", nascimento: "2001-11-05", admissao: "2024-11-01", gestor: "Saulo Rodrigues Ferreira", risco: "Médio", potencial: "Médio" },
  { nome: "Gabriel Darly Gomes Matos", empresa: "Neon", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1600.0, statusId: "ativo", sexo: "Masculino", nascimento: "2006-04-07", admissao: "2024-11-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Silvio Eduardo Moura Oliveira", empresa: "Impresilk", areaId: "producao", cargoId: "impressor", nivel: "N3", salario: 1557.6, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1993-08-01", admissao: "2022-09-02", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Tatiane Soares de Oliveira", empresa: "Impresilk", areaId: "producao", funcao: "Assistente de Qualidade", nivel: "N2", salario: 1900.0, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Sanguíneo", nascimento: "1989-12-13", admissao: "2024-02-09", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Thiago Henrique Oliveira Alves", empresa: "Impresilk", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N2", salario: 1579.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1992-08-05", admissao: "2023-12-05", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Thiago Ferreira Acacio", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-assistente", nivel: "N1", salario: 1539.37, statusId: "inativo", sexo: "Masculino", humor: "Motivado", nascimento: "1989-04-04", admissao: "2024-11-01", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Victor Ian da Silva Freitas", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1579.37, statusId: "inativo", sexo: "Masculino", nascimento: "2004-08-09", admissao: "2024-11-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Ewerton Duarte Amaral", empresa: "Impresilk", areaId: "producao", cargoId: "impressor", nivel: "N1", salario: 1897.91, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Fleumático", nascimento: "1994-02-07", admissao: "2024-08-20", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Vinicius Muniz Leite Silva", empresa: "Impresilk", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N1", salario: 1579.37, statusId: "inativo", sexo: "Masculino", nascimento: "2002-05-02", admissao: "2024-11-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Médio", potencial: "Médio" },
  { nome: "José Adilando Pereira", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1800.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", admissao: "2026-02-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Viviane Cristine de Menezes Silva Santos", empresa: "Impresilk", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N3", salario: 1365.81, statusId: "inativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1987-06-20", admissao: "2021-11-11", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Wesley Cardoso Silva", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N3", salario: 1365.81, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "2003-10-05", admissao: "2022-11-24", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Wesley Cardoso Silva (2)", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1476.05, statusId: "inativo", sexo: "Masculino", humor: "Desmotivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "2023-10-05", gestor: "Pedro Henrique Golçalves Pereira", risco: "Alto", potencial: "Alto" },
  { nome: "Jessica Fernanda Souza Sampaio", empresa: "Impresilk", areaId: "comercial", cargoId: "gerente-administrativo", nivel: "N4", salario: 2543.34, statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "1992-10-29", admissao: "2018-05-02", gestor: "Leonardo Gonçalves", perfil: "GESTOR", risco: "Baixo", potencial: "Médio" },
  { nome: "Jose Adilando Pereira (2)", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1926.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", nascimento: "1986-05-12", admissao: "2026-02-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Kelly Raissa Soares Ruas", empresa: "Impresilk", areaId: "adm", funcao: "Assistente Administrativo", nivel: "N1", salario: 2200.0, statusId: "ativo", sexo: "Feminino", estilo: "Visual", perfilComp: "Melancólico", nascimento: "1997-06-29", admissao: "2026-05-19", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Lucas Natalino Ferreira Silva", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N4", salario: 2300.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "1991-12-30", admissao: "2019-01-11", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Médio" },
  { nome: "Marcella Laiara Rocha Farias", empresa: "Impresilk", areaId: "adm", cargoId: "atendente-comercial", nivel: "N1", salario: 1816.67, statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "2007-02-25", admissao: "2025-12-01", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Nailton Antunes da Silva", empresa: "Impresilk", areaId: "producao", cargoId: "serralheiro", nivel: "N4", salario: 2588.06, statusId: "aviso", sexo: "Masculino", humor: "Estável", estilo: "Auditivo", perfilComp: "Fleumático", nascimento: "1981-10-12", admissao: "2019-09-02", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Osmane Vinicius Nepomuceno Oliveira", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N3", salario: 1897.91, statusId: "aviso", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1994-09-29", admissao: "2022-09-02", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Alto" },
  { nome: "Paulo Alves Cordeiro", empresa: "Impresilk", areaId: "producao", cargoId: "soldador", nivel: "N5", salario: 2588.06, statusId: "ativo", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1986-11-21", admissao: "2015-06-16", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Alto" },
  { nome: "Pedro Henrique Golçalves Pereira (2)", empresa: "Impresilk", areaId: "adm", cargoId: "gerente-operacoes", nivel: "N4", salario: 2696.4, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Sanguíneo", nascimento: "1995-05-08", admissao: "2021-04-05", gestor: "Leonardo Gonçalves", perfil: "GESTOR", risco: "Baixo", potencial: "Alto" },
  { nome: "Raphael Terra Alves Sales", empresa: "Impresilk", areaId: "producao", cargoId: "assistente-suprimentos", nivel: "N1", salario: 2675.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Colérico", nascimento: "1989-12-16", admissao: "2025-08-15", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Ricardo Soares Rocha", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N1", salario: 1816.67, statusId: "ativo", sexo: "Masculino", admissao: "2026-05-21", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Samuel Juneo Fernandes Lopes", empresa: "Impresilk", areaId: "comercial", cargoId: "designer-grafico", nivel: "N2", salario: 1720.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1995-02-26", admissao: "2024-02-27", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Rodrigo Moreira Silva", empresa: "Impresilk", areaId: "producao", cargoId: "lider-producao", nivel: "N1", salario: 2675.0, statusId: "inativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "1995-04-13", admissao: "2025-08-15", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Ronivon Cardoso dos Santos", empresa: "Impresilk", areaId: "producao", cargoId: "instalador-cv", nivel: "N1", salario: 2247.0, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", nascimento: "1971-06-24", admissao: "2025-02-20", gestor: "Saulo Rodrigues Ferreira", risco: "Baixo", potencial: "Alto" },
  { nome: "Saulo Rodrigues Ferreira", empresa: "Impresilk", areaId: "producao", cargoId: "gerente-montagem-portas", nivel: "N5", salario: 2461.54, adicionais: 1038.46, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1987-11-19", admissao: "2010-09-03", gestor: "Leonardo Gonçalves", perfil: "GESTOR", risco: "Baixo", potencial: "Alto" },
  { nome: "Sidney Nunes da Silva", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cv", nivel: "N3", salario: 1897.91, statusId: "ativo", sexo: "Masculino", humor: "Estável", estilo: "Cinestésico", perfilComp: "Fleumático", nascimento: "1980-02-29", admissao: "2021-12-23", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Thiago", empresa: "Impresilk", areaId: "producao", cargoId: "analista-pcp", nivel: "N1", statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Fleumático", admissao: "2026-05-06", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Médio" },
  { nome: "Sally", empresa: "Impresilk", areaId: "comercial", cargoId: "consultor-vendas", nivel: "N1", statusId: "ativo", sexo: "Feminino", humor: "Motivado", estilo: "Cinestésico", perfilComp: "Colérico", admissao: "2026-05-06", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Alto" },
  { nome: "Thiago Cardoso Rodrigues", empresa: "Impresilk", areaId: "producao", cargoId: "analista-pcp", nivel: "N1", salario: 2500.0, statusId: "ativo", sexo: "Masculino", admissao: "2026-05-06", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
  { nome: "Vinicius Aguiar Rodrigues", empresa: "Impresilk", areaId: "producao", cargoId: "operador-cnc", nivel: "N3", salario: 2215.38, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Auditivo", perfilComp: "Colérico", nascimento: "1994-06-01", admissao: "2022-06-07", gestor: "Pedro Henrique Golçalves Pereira", risco: "Baixo", potencial: "Alto" },
  { nome: "Vinicius Silva Lins de Oliveira", empresa: "Impresilk", areaId: "comercial", cargoId: "projetista", nivel: "N1", salario: 1840.4, statusId: "ativo", sexo: "Masculino", humor: "Motivado", estilo: "Visual", perfilComp: "Fleumático", nascimento: "1999-05-17", admissao: "2024-11-01", gestor: "Jessica Fernanda Souza Sampaio", risco: "Baixo", potencial: "Médio" },
  { nome: "Reinaldo Tadeu Campos Saraiva", empresa: "Impresilk", areaId: "producao", cargoId: "serralheiro", nivel: "N1", statusId: "ativo", sexo: "Masculino", nascimento: "1986-10-25", admissao: "2026-06-02", gestor: "Pedro Henrique Golçalves Pereira", risco: "Médio", potencial: "Médio" },
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
    id, nome: spec.nome, empresa: spec.empresa,
    email: spec.semPessoais ? undefined : email(spec.nome),
    cargoId: spec.cargoId ?? null,
    cargoLivre: spec.cargoLivre ?? (!spec.cargoId ? spec.funcao : undefined),
    funcao: spec.funcao,
    nivelId: spec.nivel ?? null, areaId: spec.areaId,
    gestorId: spec.gestor ? slug(spec.gestor) : null,
    salario: spec.salario ?? null, adicionais: spec.adicionais ?? 0,
    riscoSaida: spec.risco ?? "Baixo", potencial: spec.potencial ?? "Médio",
    statusId: spec.statusId ?? "ativo", perfil: spec.perfil ?? "COLABORADOR",
    ehDirecao: spec.ehDirecao ?? false,
    dataNascimento: spec.nascimento, dataAdmissao: spec.admissao, dataDesligamento: null,
    sexo: spec.sexo, humor: spec.humor, estiloAprendizagem: spec.estilo,
    perfilComportamental: spec.perfilComp,
    qtdFilhos: 0, valeTransporte: i % 3 !== 0,
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
    base.qtdFilhos = rint(0, 3);
    if (!spec.ehDirecao) {
      base.conjugeNome = i % 3 === 0 ? null : `${CONJ_NOMES[i % CONJ_NOMES.length]} ${CONJ_SOBRE[i % CONJ_SOBRE.length]}`;
      base.conjugeTelefone = base.conjugeNome ? `(38) 9${rint(8000, 9999)}-${rint(1000, 9999)}` : null;
    }
  }
  // v2 — motivação (0-100), tempo no cargo, filhos e contato de emergência
  if (!spec.semPessoais) {
    base.cidade = "Montes Claros/MG";
    const baseMot = spec.humor === "Motivado" ? 82 : spec.humor === "Estável" ? 56 : spec.humor === "Desmotivado" ? 28 : 62;
    base.motivacao = Math.max(5, Math.min(100, baseMot + rint(-8, 12)));
    base.motivacaoAnterior = Math.max(5, Math.min(100, base.motivacao + rint(-10, 8)));
    if (spec.admissao) {
      const adm = new Date(spec.admissao);
      const mesesCasa = Math.max(0, Math.round((HOJE.getTime() - adm.getTime()) / (86400000 * 30.44)));
      const ini = new Date(adm);
      ini.setMonth(ini.getMonth() + rint(0, Math.floor(mesesCasa / 2)));
      base.dataInicioCargo = ini.toISOString().slice(0, 10);
    }
    const nF = base.qtdFilhos ?? 0;
    if (nF > 0 && !spec.ehDirecao) {
      const nomesF = ["Ana", "Pedro", "Maria", "João", "Laura", "Lucas", "Sofia", "Gabriel"];
      base.filhos = Array.from({ length: nF }, (_, k) => {
        const idade = rint(1, 17);
        const nasc = new Date(HOJE);
        nasc.setFullYear(nasc.getFullYear() - idade);
        return { nome: nomesF[(i + k) % nomesF.length], nascimento: nasc.toISOString().slice(0, 10) };
      });
    }
    if (!spec.ehDirecao) {
      const parentesco = base.conjugeNome ? "Cônjuge" : ["Mãe", "Pai", "Irmão(ã)"][i % 3];
      base.contatoEmergencia = {
        nome: base.conjugeNome ?? `${CONJ_NOMES[(i + 2) % CONJ_NOMES.length]} ${CONJ_SOBRE[(i + 1) % CONJ_SOBRE.length]}`,
        parentesco,
        telefone: base.conjugeTelefone ?? `(38) 9${rint(8000, 9999)}-${rint(1000, 9999)}`,
      };
    }
  }

  // Desligados: data de desligamento sintética (a planilha não a traz) para
  // alimentar turnover e offboarding — entre 6 e 30 meses após a admissão.
  if (spec.statusId === "inativo" && spec.admissao) {
    let desl = new Date(spec.admissao);
    desl.setMonth(desl.getMonth() + rint(6, 30));
    if (desl.getTime() > HOJE.getTime()) desl = new Date(HOJE.getTime() - rint(15, 220) * 86400000);
    base.dataDesligamento = desl.toISOString().slice(0, 10);
  }
  return base;
}

export const COLABORADORES: Colaborador[] = [...DIRECAO, ...EQUIPE].map(construir);
