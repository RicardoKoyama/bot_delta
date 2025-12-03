const { pool } = require('../../../../services/dbService');
const { gerarFaturamento } = require('./utils/fatHelper');  // ainda vou criar abaixo
const { MessageMedia } = require('whatsapp-web.js');

async function consultaCliente(termo) {
    const { rows } = await pool.query(`
        SELECT codigo, nome, telefone, limitecredito
        FROM vp_jlf_whatsapp_consulta_cliente
        WHERE nome ILIKE $1
        LIMIT 10
    `, [`%${termo}%`]);

    if (!rows.length) return "❗ Nenhum cliente encontrado.";

    let msg = "📌 *CLIENTES ENCONTRADOS:*\n\n";

    rows.forEach((c, i) => {
        msg += `*${i+1}.* ${c.nome}\n`;
        msg += `📞 ${c.telefone}\n`;
        msg += `Limite Crédito: ${c.limitecredito}\n\n`;
    });

    return msg;
}

async function consultaProduto(termo) {
    const { rows } = await pool.query(`
        SELECT nome, referenciafabrica, produto
        FROM produtos
        WHERE nome ILIKE $1
        LIMIT 15
    `, [`%${termo}%`]);

    if (!rows.length) return "❗ Nenhum produto encontrado.";

    let msg = "📦 *PRODUTOS:*\n\n";

    rows.forEach((p, i) => {
        msg += `*${i+1}.* ${p.nome}\n`;
        msg += `🔹 Ref: ${p.referenciafabrica}\n`;
        msg += `🔹 Cód Interno: ${p.produto}\n\n`;
    });

    return msg;
}

async function consultaFaturamento(periodo, message, client) {
    const path = await gerarFaturamento(periodo);
    
    const media = MessageMedia.fromFilePath(path);
    return client.sendMessage(message.from, media, { caption: "📊 FATURAMENTO" });
}

module.exports = {
    process: async (message, accountId, client) => {
        const texto = message.body.trim().toUpperCase();

        const [cmd, ...rest] = texto.split(' ');
        const termo = rest.join(' ').trim();

        switch (cmd) {
            case "CC":
                if (!termo) return message.reply("Use: *CC NOME DO CLIENTE*");
                return message.reply(await consultaCliente(termo));

            case "CP":
                if (!termo) return message.reply("Use: *CP NOME DO PRODUTO*");
                return message.reply(await consultaProduto(termo));

            case "FAT":
                if (!termo) return message.reply("Use: *FAT 01/01/2025 31/01/2025*");
                return consultaFaturamento(termo, message, client);

            default:
                return message.reply("❗ Comando inválido para MSI.\nUse: CC / CP / FAT");
        }
    }
};
