const deltaTexto = require('./delta/texto');
const deltaImagem = require('./delta/imagem');
const deltaMain   = require('./delta/main');

const msiTexto = require('./msi/texto');
const msiImagem = require('./msi/imagem');
const msiMain   = require('./msi/main');

const db = require('../../../db/db');

function getUserAPI(whatsappFrom) {
  // whatsappFrom vem tipo: '5514996665935@c.us' ou 'XYZLID123@c.us'
  const raw = whatsappFrom.replace('@c.us', '').trim();

  return new Promise((resolve) => {
    // 1) tenta achar na whatsapp_lid_map
    db.get(
      `SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1`,
      [raw],
      (errMap, rowMap) => {
        if (errMap) {
          console.error('Erro ao buscar LID no whatsapp_lid_map:', errMap);
          return resolve(null);
        }

        // Se achou mapeamento, usa o telefone; senão, tenta tratar raw como telefone direto
        const telefone = rowMap?.telefone || raw.replace(/\D/g, '');

        if (!telefone) {
          return resolve(null);
        }

        // 2) com o telefone em mãos, busca a API liberada na tabela usuarios
        db.get(
          `SELECT api FROM usuarios WHERE telefone = ? LIMIT 1`,
          [telefone],
          (errUser, rowUser) => {
            if (errUser) {
              console.error('Erro ao buscar API do usuário no SQLite:', errUser);
              return resolve(null);
            }
            const api = rowUser?.api ? rowUser.api.toUpperCase() : null;
            resolve(api);
          }
        );
      }
    );
  });
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
