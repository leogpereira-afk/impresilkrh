# Prévia visual do RH com relevo

Estado: implementação local, aguardando aprovação visual para publicar (D-013).
Branch `codex/rh-visual-3d-20261024`, base `c85147a`, cache preparado `impresilk-rh-v18`.

## O que mudou

- Ícones internos em bases com iluminação, chanfro e sombra, reaproveitando os símbolos existentes. Sem dependência ou motor 3D novo.
- Cartões e botões com profundidade; movimento discreto nos elementos interativos. A opção local de reduzir movimentos também alcança os modais. CSS respeita a preferência do sistema operacional.
- Busca mais evidente no celular e computador, localização atual e favoritos legíveis. Busca acessível por combobox/listbox, setas, Enter e Escape, inclusive sem resultados e quando as permissões recebidas mudam.
- Campos com alvos de pelo menos 44 px, texto de 16 px no celular, foco visível, dicas mais legíveis e rótulos associados. Grupos de controles preservam os rótulos próprios e não tornam cada checkbox obrigatório.
- Cartões recolhíveis anunciam título, estado e corpos com IDs distintos, inclusive quando um cartão contém mais de um corpo. Mantida a persistência anterior.
- Temas claro e escuro, incluindo a variante oficial branca da marca sobre fundo escuro.

## Verificação realizada

- `npm run verificar`: lint, TypeScript, 2.293 testes em 164 arquivos, 22 testes do protocolo e 7 conferências de ID aprovados.
- `npm run build`: aprovado após o ajuste final da variante da marca. Nenhuma dependência alterada; usado o mesmo node_modules previamente instalado com npm ci e lockfile idêntico à base.
- `git diff --check`: sem erro.
- Revisão independente de navegação e campos. Corrigidos IDs duplicados em cartões com vários corpos, especificidade do foco/erro, preservação do posicionamento de botões ao reduzir movimento e obrigatoriedade indevida em grupos.
- A primeira suíte completa apontou ausência de scrollIntoView no JSDOM de um teste de integração. O teste passou a simular a API e consultar os resultados acessíveis por option; o código produtivo não precisou de contorno para o ambiente de teste. A suíte completa seguinte passou.
- Navegador local em 390 × 844 e 1440 × 1000: navegação por menu, busca vazia e filtrada, setas/Enter/Escape, retorno de foco, cartões recolhíveis, formulários, temas claro/escuro e favoritos.
- Criado um treinamento fictício pela interface e confirmado após recarga. Favorito, tema escuro e redução de movimentos persistiram após recarga; o estilo computado confirmou transição de 0 s quando reduzido. Os campos móveis mostraram 16 px e foco visível, sem transbordamento horizontal nas telas verificadas.
- Treinamentos, Recrutamento e Colaboradores foram conferidos visualmente. Não é uma auditoria manual exaustiva de todas as telas ou um teste em aparelho físico. A preferência de movimento do sistema operacional foi implementada em CSS; o controle interno foi o verificado no navegador.

## Prévia e preservação

Prévia local em `http://127.0.0.1:5575/treinamento`, com dados explicitamente fictícios, backend desligado e CSP limitada ao servidor local. Capturas e logs ficam fora deste repositório público. Nenhuma mutation de produção, migration ou function foi alterada.

Não houve publicação desta versão. O site permanece com o produto da D-012 e cache v17; o push da reserva da vez apenas republicou o mesmo produto. Publicação futura exige nova reserva, integração com a main vigente e nova conferência antes do push aprovado.
