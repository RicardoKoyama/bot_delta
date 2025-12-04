// ajuda.js — responde com os comandos da API habilitada
const db = require('../../../../db/db');

function sqlGet(sql, params) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row || null));
    });
}

module.exports = async function ajudaHandler(client, msg, usuario) {
    try {
        // Para este BOT, a API sempre será Delta
        const apiNome = "Delta";

        const row = await sqlGet(
            "SELECT comandos FROM apis WHERE nome = ? LIMIT 1",
            [apiNome]
        );

        if (!row) {
            return msg.reply("❌ Não encontrei comandos para esta API.");
        }

        let comandos;
        try {
            comandos = JSON.parse(row.comandos);
        } catch (e) {
            return msg.reply("❌ Erro ao interpretar comandos da API.");
        }

        let texto = `📘 *COMANDOS DISPONÍVEIS*\n\n`;
        comandos.forEach((c, i) => {
            texto += `${i + 1}. ${c}\n`;
        });

        return msg.reply(texto);

    } catch (err) {
        console.error("Erro no AJUDA:", err);
        return msg.reply("❌ Erro ao carregar comandos.");
    }
};
