// imagem.js — handler DELTA com reaproveitamento total do texto.js
const { decodeImage } = require("./decoder");
const textoHandler = require("./texto");

// ============================================================
// Handler principal de imagem
// ============================================================
module.exports = async function imagemHandler(client, msg, usuario) {
  try {
    const media = await msg.downloadMedia();
    if (!media) {
      return msg.reply("❌ Não consegui baixar a imagem.");
    }

    const result = await decodeImage(media);

    console.log("📡 Resultado da decodificação:", result);

    // ========================================================
    // A) QR CODE DA DELTA (URL com id=XXXX)
    // ========================================================
    if (result.type === "QR_DELTA" && result.raw) {
      // Delegamos diretamente para o texto.js
      // Ele já sabe buscar produto + preço
      return textoHandler(client, msg, result.raw, usuario);
    }

    // ========================================================
    // B) GTIN / EAN / GS1 (com ou sem lote)
    // ========================================================
    if (result.gtin) {

      let aviso = `📦 *Código detectado:* ${result.gtin}`;
      if (result.lote) {
        aviso += `\n🔹 *Lote:* ${result.lote}`;
      }

      // Apenas informativo
      await msg.reply(aviso);

      // Encaminha GTIN para o texto.js
      // (texto.js resolve produto, preço, etc.)
      return textoHandler(client, msg, result.gtin, usuario);
    }

    // ========================================================
    // C) Digital Link sem GTIN válido
    // ========================================================
    if (result.type === "DIGITAL_LINK") {
      return msg.reply(
        "❗ Código reconhecido como Digital Link, mas não foi possível identificar um GTIN válido."
      );
    }

    // ========================================================
    // D) Nenhum código reconhecido
    // ========================================================
    return msg.reply(
      "❌ Não consegui identificar nenhum código válido na imagem."
    );

  } catch (err) {
    console.error("❌ Erro no handler de imagem:", err);
    return msg.reply("❌ Erro ao processar a imagem.");
  }
};
