const { decodeImage } = require('./utils/decodeUtils');
const { pool } = require('../../../../services/dbService');

module.exports = {
    process: async (message, accountId, client) => {
        const buffer = await message.downloadMedia();
        if (!buffer) return message.reply("❗ Não consegui ler a imagem.");

        const codigo = await decodeImage(buffer.data);
        if (!codigo) return message.reply("❗ Código não identificado na imagem.");

        // Consulta produto MSI pelo GTIN/EAN
        const { rows } = await pool.query(`
            SELECT nome, referenciafabrica, produto
            FROM produtos
            WHERE gtin = $1 OR codigobarras = $1
            LIMIT 1
        `, [codigo]);

        if (!rows.length) {
            return message.reply("❗ Produto não encontrado no MSI.");
        }

        const p = rows[0];
        let msg = "📦 *PRODUTO ENCONTRADO:*\n\n";
        msg += `*${p.nome}*\n`;
        msg += `🔹 Ref: ${p.referenciafabrica}\n`;
        msg += `🔹 Código Interno: ${p.produto}\n`;

        return message.reply(msg);
    }
};
