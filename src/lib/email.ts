// Adaptador de e-mail. Em produção, configure RESEND_API_KEY (ou outro provedor)
// e EMAIL_FROM no .env. Sem provedor configurado, o envio é "simulado" (apenas
// registrado no log do servidor) — o restante do sistema funciona normalmente.

interface Email {
  para: string;
  assunto: string;
  html: string;
}

export async function enviarEmail(
  e: Email,
): Promise<{ ok: boolean; simulado?: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_FROM ?? "rh@impresilk.com.br";

  if (!key) {
    console.log(`[email:simulado] para=${e.para} assunto="${e.assunto}"`);
    return { ok: true, simulado: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: e.para,
        subject: e.assunto,
        html: e.html,
      }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error("Falha ao enviar e-mail:", err);
    return { ok: false };
  }
}

// Monta um resumo HTML simples de pendências para o digest do RH.
export function montarDigestHtml(
  nome: string,
  itens: { titulo: string; mensagem?: string | null }[],
): string {
  const linhas = itens
    .map(
      (i) =>
        `<li style="margin-bottom:8px"><strong>${i.titulo}</strong>${i.mensagem ? `<br/><span style="color:#475569">${i.mensagem}</span>` : ""}</li>`,
    )
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#16334f">Impresilk · Resumo de pendências de RH</h2>
      <p>Olá, ${nome}. Estas são as pendências que requerem atenção:</p>
      <ul style="padding-left:18px">${linhas || "<li>Nenhuma pendência. 🎉</li>"}</ul>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Mensagem automática do sistema de RH Impresilk.</p>
    </div>`;
}
