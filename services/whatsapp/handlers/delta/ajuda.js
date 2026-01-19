// ajuda.js — responde com os comandos da API habilitada
const db = require('../../../../db/db');

async function responder(client, msg, texto) {
  return client.sendMessage(msg.from, texto, { sendSeen: false });
}

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
            return responder(client, msg, "❌ Não encontrei comandos para esta API.");
        }

        let comandos;
        try {
            comandos = JSON.parse(row.comandos);
        } catch (e) {
            return responder(client, msg, "❌ Erro ao interpretar comandos da API.");
        }

        let texto = `📘 *COMANDOS DISPONÍVEIS*\n\n`;
        comandos.forEach((c, i) => {
            texto += `${i + 1}. ${c}\n`;
        });

        return responder(client, msg, texto);

    } catch (err) {
        console.error("Erro no AJUDA:", err);
        return responder(client, msg, "❌ Erro ao carregar comandos.");
    }
};
