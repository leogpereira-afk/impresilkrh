# Revogação de RH com a tela aberta

Autorização D-017. A sessão recebe sinal privado de alteração de perfil, suspende acesso aos avisos antes da consulta e aplica o perfil confirmado ou encerra a sessão. Erros/conexão perdida mantêm o calendário e sino ocultos. Respostas antigas são descartadas por geração. Revalidação ao voltar para a aba, foco, online, token e temporizador auxiliar; o caminho normal usa Realtime.

Banco: rh_acesso_sinais contém somente user_id e revisão; RLS própria, sem escrita pelo cliente. Trigger privado security definer com search_path fixo sinaliza alteração e exclusão de perfis. Não replica a tabela de perfis ou dados de pessoas; nenhuma edição de conta real para teste. Publicar migration antes da interface. Cache rh-v21.

Validação: trigger e RLS em PGlite isolado; cliente com canal e servidor fictícios (revogação, rebaixamento, respostas fora de ordem, logout e reconexão); suíte completa e build; conferir schema publicado e arquivos servidos, sessão RH real somente leitura.
