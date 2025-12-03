const { pool } = require('../../../../services/dbService');
const { decodeQRCodeImage } = require('../../../../handlers/qrHandle');

module.exports = {
    process: async (message, accountId, client) => {
        const media = await message.downloadMedia();
        if (!media) return message.reply("❗ Não consegui ler a imagem.");

        const codigo = await decodeQRCodeImage(media);
        if (!codigo) return message.reply("❗ Nenhum código identificado na imagem.");

        const { rows } = await pool.query(`
            SELECT produto, nome, referenciafabrica
            FROM produtos
            WHERE gtin = $1 OR codigobarras = $1
            LIMIT 1
        `, [codigo]);

        if (!rows.length)
            return message.reply("❗ Produto MSI não encontrado.");

        const p = rows[0];

        let msg = `📦 *PRODUTO ENCONTRADO*\n\n`;
        msg += `*${p.nome}*\n`;
        msg += `🔹 Ref: ${p.referenciafabrica}\n`;
        msg += `🔹 Código Interno: ${p.produto}\n`;

        return message.reply(msg);
    }
};
