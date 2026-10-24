# Publicação das correções e compactação do RH

Autorização do dono em 24/10/2026: “subir”, após a prévia descrita em `2026-10-24-correcoes-auditoria-previa.md`. Decisão D-012.

## Escopo

Publicar a mesma implementação revisada, com A01 a A16 e compactação em Treinamentos, Vagas e Colaboradores. Nenhuma migration, alteração de Educação, credenciais ou escrita de teste em dados reais. A prévia fictícia continua separada e não integra o build produtivo.

## Preparação e ordem

- Revalidar a main e reservar a vez antes de reaplicar o commit aprovado sobre ela.
- Rodar a verificação completa e o build no ramo de publicação.
- Publicar somente a function `sync`, conferir a versão e todos os arquivos servidos, e então publicar a interface.
- Conferir o deploy, o cache `impresilk-rh-v17`, os arquivos de rotas e a navegação no site oficial.

O workflow `functions.yml` do Painel foi lido nesta entrega: seu disparo manual republica também todas as functions do Painel e do PCP, sem pular corpos iguais. Para limitar o efeito ao RH autorizado, a publicação de `sync` usa o conector oficial do Supabase, que envia os mesmos cinco arquivos à API de deploy individual. O projeto e a configuração de autenticação existente são preservados. Não há alteração de workflows nem uso de token em arquivo.

Estado anterior conferido pelo conector: `sync` v100 ativa, `verify_jwt=false`, com autenticação no próprio corpo; os quatro arquivos `_shared` não mudaram no ramo. As outras functions do RH não precisam de publicação.

As evidências finais de publicação e navegação serão registradas na Passagem da vez e no relatório privado da entrega, após a conferência do ambiente servido.
