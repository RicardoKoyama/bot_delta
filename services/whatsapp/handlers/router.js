const deltaMain = require('./delta/main');
const msiMain   = require('./msi/main');

// Usa o SQLite do bot (db/bot.db)
const db = require('../../../db/db');

/**
 * Obtém a API (DELTA / MSI) liberada para o usuário,
 * usando LID -> telefone (whatsapp_lid_map) e depois usuarios.telefone.
 */
function getUserAPI(whatsappFrom) {
  // whatsappFrom vem tipo: '32087751000096@c.us' ou '5514996665935@c.us'
  const rawId = (whatsappFrom || '').split('@')[0].trim();

  return new Promise((resolve) => {
    console.log('[router] from:', whatsappFrom, 'rawId:', rawId);

    // 1) Tenta localizar LID na tabela whatsapp_lid_map
    db.get(
      `SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1`,
      [rawId],
      (errMap, rowMap) => {
        if (errMap) {
          console.error('[router] Erro ao buscar LID em whatsapp_lid_map:', errMap);
          return resolve(null);
        }

        const telefone = rowMap?.telefone || rawId.replace(/\D/g, '');
        console.log('[router] telefone resolvido:', telefone, 'viaLid:', !!rowMap);

        if (!telefone) {
          return resolve(null);
        }

        // 2) Com o telefone em mãos, busca a API na tabela usuarios
        db.get(
          `SELECT api FROM usuarios WHERE telefone = ? LIMIT 1`,
          [telefone],
          (errUser, rowUser) => {
            if (errUser) {
              console.error('[router] Erro ao buscar API em usuarios:', errUser);
              return resolve(null);
            }

            const api = rowUser?.api ? rowUser.api.toUpperCase() : null;
            console.log('[router] api encontrada para telefone', telefone, '=>', api);
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
    return message.reply('❗ Seu número não tem permissão para usar o BOT.');
  }

  switch (api) {
    case 'DELTA':
      return deltaMain.handleTexto(message, accountId, client);

    case 'MSI':
      return msiMain.handleTexto(message, accountId, client);

    default:
      return message.reply('❗ API não configurada para seu usuário.');
  }
}

async function handleImagem(message, accountId, client) {
  const api = await getUserAPI(message.from);

  if (!api) {
    return message.reply('❗ Seu número não tem permissão para usar o BOT.');
  }

  switch (api) {
    case 'DELTA':
      return deltaMain.handleImagem(message, accountId, client);

    case 'MSI':
      return msiMain.handleImagem(message, accountId, client);

    default:
      return message.reply('❗ API não configurada para seu usuário.');
  }
}

module.exports = {
  handleTexto,
  handleImagem,
};
