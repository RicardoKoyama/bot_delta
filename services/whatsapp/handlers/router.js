const deltaTexto = require('./delta/texto');
const deltaImagem = require('./delta/imagem');
const deltaMain   = require('./delta/main');

const msiTexto = require('./msi/texto');
const msiImagem = require('./msi/imagem');
const msiMain   = require('./msi/main');

const { pool } = require('../../../services/dbService');

async function getUserAPI(whatsappNumber) {
    const number = whatsappNumber.replace('@c.us', '').replace(/\D/g, '');

    const { rows } = await pool.query(`
        SELECT api
        FROM usuarios
        WHERE telefone = $1
        LIMIT 1
    `, [number]);

    return rows[0]?.api?.toUpperCase() || null;
}

async function handleTexto(message, accountId, client) {
    const api = await getUserAPI(message.from);

    if (!api) {
        return message.reply("❗ Seu número não tem permissão para usar o BOT.");
    }

    switch (api) {
        case 'DELTA':
            return deltaMain.handleTexto(message, accountId, client);

        case 'MSI':
            return msiMain.handleTexto(message, accountId, client);

        default:
            return message.reply("❗ API não configurada para seu usuário.");
    }
}

async function handleImagem(message, accountId, client) {
    const api = await getUserAPI(message.from);

    if (!api) {
        return message.reply("❗ Seu número não tem permissão para usar o BOT.");
    }

    switch (api) {
        case 'DELTA':
            return deltaMain.handleImagem(message, accountId, client);

        case 'MSI':
            return msiMain.handleImagem(message, accountId, client);

        default:
            return message.reply("❗ API não configurada para seu usuário.");
    }
}

module.exports = {
    handleTexto,
    handleImagem
};
