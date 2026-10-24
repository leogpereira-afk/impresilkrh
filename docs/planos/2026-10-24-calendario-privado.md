# Calendário reservado ao RH

Pedido do dono: avisos e dados do RH somente para quem tem autorização RH; validar Comercial e publicar. Ajuste adicional: mês legível no cabeçalho azul.

Implementação: coleção eventos restrita ao ADMIN_RH no sync; menu, rota e componente Calendário negam demais perfis, inclusive com permissões amplas ou dados antigos no navegador. No Painel, painel-agenda valida conta e perfil ativo do RH antes de consultar as coleções privadas. Nenhum cadastro real alterado.

Validar: leitura/escrita do servidor por perfil, URL direta, RH autorizado, conta inativa, falha na consulta e contraste do mês. Servidor antes da interface. Cache rh-v19.
