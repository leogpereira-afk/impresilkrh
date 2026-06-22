// Reduz uma imagem (foto de avatar) para uma miniatura leve antes de salvar.
// Sem isso, uma foto de 1 MB vira ~1,3 MB de base64 e estoura a cota do
// localStorage. Aqui ela cai para ~10-30 KB (320 px, JPEG), preservando a
// qualidade necessária para um avatar.
export function comprimirImagem(file: File, maxLado = 320, qualidade = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const maior = Math.max(img.width, img.height) || 1;
        const escala = Math.min(1, maxLado / maior);
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl); // sem canvas: usa o original
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", qualidade));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
