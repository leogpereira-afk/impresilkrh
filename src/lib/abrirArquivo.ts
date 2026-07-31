// ============================================================================
// Abrir um anexo em nova aba sem cair no bloqueio de pop-up.
//
// O problema: os anexos moram no IndexedDB e, quando não estão nesta máquina,
// são baixados da nuvem — um PDF de 5 MB vira ~7 MB de base64. O código antigo
// fazia `await` desse download e só DEPOIS chamava window.open(). Quando a
// resposta chegava, a "ativação transitória" do clique já tinha expirado e o
// navegador bloqueava a janela em silêncio: o botão simplesmente não fazia nada.
//
// A regra do navegador é essa: window.open() precisa acontecer DENTRO do gesto
// do usuário. Então a janela é aberta primeiro, ainda em branco, e recebe o
// conteúdo quando ele chega. Se o arquivo não vier, a janela é fechada e o
// motivo aparece na tela — nunca mais um clique mudo.
// ============================================================================

export async function abrirAnexoEmNovaAba(
  carregar: () => Promise<string | null>,
  avisar: (mensagem: string) => void,
  titulo = "Documento",
): Promise<void> {
  const w = window.open("", "_blank");
  if (!w) {
    avisar("O navegador bloqueou a nova aba. Libere os pop-ups deste site e tente de novo.");
    return;
  }
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head>` +
    `<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;padding:24px">Abrindo o arquivo…</body></html>`,
  );
  let dataUrl: string | null = null;
  try {
    dataUrl = await carregar();
  } catch {
    dataUrl = null;
  }
  if (!dataUrl) {
    w.close();
    avisar("Arquivo não encontrado neste computador nem na nuvem (pode ter sido anexado offline em outro PC).");
    return;
  }
  w.document.open();
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head>` +
    `<body style="margin:0"><iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe></body></html>`,
  );
  w.document.close();
}
