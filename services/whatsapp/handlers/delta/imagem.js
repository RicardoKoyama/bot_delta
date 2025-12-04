// imagem.js — handler do projeto DELTA usando decoder universal

const fs = require("fs");
const { decodeImage } = require("./decoder");
const textoHandler = require("./texto");

module.exports = async function imagemHandler(client, msg, usuario) {
  try {
    const media = await msg.downloadMedia();
    if (!media) {
      return msg.reply("❌ Não consegui baixar a imagem.");
    }

    //msg.reply("🔎 Lendo código da imagem...");

    const result = await decodeImage(media);

    console.log("📡 Resultado da decodificação:", result);

    // =============================
    // A) QR DELTA (URL com id=XXXX)
    // =============================
    if (result.type === "QR_DELTA") {
      return textoHandler(client, msg, result.raw, usuario);
    }

    // =============================
    // B) EAN / GTIN / DATA MATRIX
    // =============================
    const gtin = result.gtin;
    const lote = result.lote || null;

    if (gtin) {
      let complemento = "";
      if (lote) complemento = `\n🔹 *Lote lido:* ${lote}`;

      await msg.reply(`📦 *GTIN detectado:* ${gtin}${complemento}`);

      // consulta DELTA via GTIN
      return textoHandler(client, msg, gtin, usuario);
    }

    // =============================
    // C) Digital Link sem GTIN válido
    // =============================
    if (result.type === "DIGITAL_LINK") {
      return msg.reply("❗ Digital Link reconhecido, mas sem GTIN válido.");
    }

    // =============================
    // D) Nada reconhecido
    // =============================
    return msg.reply("❌ Não consegui identificar nenhum código válido na imagem.");

  } catch (err) {
    console.error("❌ Erro no handler de imagem:", err);
    return msg.reply("❌ Erro ao processar a imagem.");
  }
};
