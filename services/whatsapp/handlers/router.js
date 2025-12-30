// services/whatsapp/handlers/router.js
const deltaMain = require('./delta/main');
const msiMain   = require('./msi/main');
const sacMain = require('./sac/main');


// Usa o SQLite do bot (db/bot.db)
const db = require('../../../db/db');

// =====================================================
// Helpers assíncronos para SQLite
// =====================================================
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

/**
 * Obtém a API (DELTA / MSI) liberada para o usuário,
 * usando LID -> telefone (whatsapp_lid_map) e depois usuarios.telefone.
 */
async function getUserAPI(whatsappFrom) {
  const rawId = (whatsappFrom || '').split('@')[0].trim();

  console.log('[router] from:', whatsappFrom, 'rawId:', rawId);

  let telefoneResolvido = null;

  try {
    const rowMap = await dbGet(
      'SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1',
      [rawId]
    );

    if (rowMap && rowMap.telefone) {
      telefoneResolvido = rowMap.telefone;
      console.log('[router] telefone resolvido via whatsapp_lid_map:', telefoneResolvido);
    } else {
      const apenasDigitos = rawId.replace(/\D/g, '');
      telefoneResolvido = apenasDigitos || null;
      console.log('[router] telefone resolvido direto dos dígitos:', telefoneResolvido);
    }
  } catch (err) {
    console.error('[router] Erro ao buscar LID:', err);
    return null;
  }

  if (!telefoneResolvido) return null;

  try {
    const rowUser = await dbGet(
      'SELECT api FROM usuarios WHERE telefone = ? LIMIT 1',
      [telefoneResolvido]
    );

    const api = rowUser?.api ? rowUser.api.toUpperCase() : null;
    console.log('[router] api encontrada para telefone', telefoneResolvido, '=>', api);
    return api;
  } catch (err) {
    console.error('[router] Erro ao buscar API em usuarios:', err);
    return null;
  }
}

/**
 * Extrai um telefone do texto da mensagem de validação
 */
function extrairTelefoneDoTexto(texto) {
  if (!texto) return null;
  const match = texto.replace(/\s+/g, '').match(/(\d{10,13})/);
  return match ? match[1] : null;
}

/**
 * Fluxo de validação de número
 */
async function tryHandleValidationReply(message) {
  if (!message.hasQuotedMsg) return false;

  const fromRawId = (message.from || '').split('@')[0].trim();

  let quoted;
  try {
    quoted = await message.getQuotedMessage();
  } catch (err) {
    console.error('[router] Erro ao obter quotedMessage:', err);
    return false;
  }

  const quotedBody = quoted?.body || '';
  const telefone = extrairTelefoneDoTexto(quotedBody);

  if (!telefone) {
    console.log('[router] Não foi possível extrair telefone da validação.');
    return false;
  }

  try {
    // Busca existente
    const rowMap = await dbGet(
      'SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1',
      [fromRawId]
    );

    if (!rowMap) {
      await dbRun(
        'INSERT INTO whatsapp_lid_map (lid, telefone) VALUES (?, ?)',
        [fromRawId, telefone]
      );
      console.log('[router] Novo mapeamento criado:', fromRawId, '=>', telefone);
    } else if (rowMap.telefone !== telefone) {
      await dbRun(
        'UPDATE whatsapp_lid_map SET telefone = ? WHERE lid = ?',
        [telefone, fromRawId]
      );
      console.log('[router] Mapeamento atualizado:', fromRawId, '=>', telefone);
    }

    // Agora tenta recuperar API
    const api = await getUserAPI(message.from);

    if (api) {
      const telefoneLimpo = telefone.replace(/\D/g, '');
      const usuario = await dbGet(
        'SELECT nome FROM usuarios WHERE telefone = ? LIMIT 1',
        [telefoneLimpo]
      );

      const { gerarMensagemBoasVindas } = require('../../usuariosService');
      const msgBoasVindas = await gerarMensagemBoasVindas(
        usuario?.nome || "Usuário",
        api
      );

      await message.reply(
        '✅ *Número validado com sucesso!* Seu acesso está liberado. 🎉'
      );

      await message.client.sendMessage(message.from, msgBoasVindas);

    } else {
      await message.reply(
        '✅ Número validado, mas nenhuma API foi configurada para este telefone.'
      );
    }

    return true;

  } catch (err) {
    console.error('[router] Erro ao salvar mapeamento:', err);
    await message.reply('⚠️ Erro interno ao validar seu número.');
    return true;
  }
}

// =====================================================
// TEXTO
// =====================================================
async function handleTexto(message, accountId, client) {
  const api = await getUserAPI(message.from);

  // 1️⃣ Se NÃO tem API conhecida
  if (!api) {

    // tentativa de validação (fluxo atual – mantém)
    const handled = await tryHandleValidationReply(message);
    if (handled) return;

    // 2️⃣ tenta SAC (NOVO)
    const sacHandled = await sacMain.handleTexto(message, accountId, client);
    if (sacHandled) return;

    // 3️⃣ fallback antigo (inalterado)
    return message.reply(
      '❗ Seu número não tem permissão para usar o BOT.\n' +
      'Se você acabou de solicitar acesso, responda à mensagem de validação enviada pelo BOT.'
    );
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

// =====================================================
// IMAGEM
// =====================================================
async function handleImagem(message, accountId, client) {
  const api = await getUserAPI(message.from);

  if (!api) {
    return message.reply(
      '❗ Seu número não tem permissão.\n' +
      'Responda à mensagem de validação enviada pelo BOT para liberar o acesso.'
    );
  }

  switch (api) {
    case 'DELTA':
      return deltaMain.handleImagem(message, accountId, client);

    case 'MSI':
      return msiMain.handleImagem(message, accountId, client);

    default:
      return message.reply('❗ API não configurada.');
  }
}

module.exports = {
  handleTexto,
  handleImagem,
};
