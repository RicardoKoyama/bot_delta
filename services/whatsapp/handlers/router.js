// services/whatsapp/handlers/router.js
const deltaMain = require('./delta/main');
const msiMain   = require('./msi/main');

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
      resolve(this); // this.lastID, this.changes se precisar
    });
  });
}

/**
 * Obtém a API (DELTA / MSI) liberada para o usuário,
 * usando LID -> telefone (whatsapp_lid_map) e depois usuarios.telefone.
 */
async function getUserAPI(whatsappFrom) {
  // whatsappFrom vem tipo: '32087751000096@c.us' ou '5514996665935@c.us'
  const rawId = (whatsappFrom || '').split('@')[0].trim();

  console.log('[router] from:', whatsappFrom, 'rawId:', rawId);

  // 1) tenta localizar LID na tabela whatsapp_lid_map
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
      // se não achou mapeamento, tenta se o próprio rawId já for telefone (caso legado)
      const apenasDigitos = rawId.replace(/\D/g, '');
      telefoneResolvido = apenasDigitos || null;
      console.log('[router] telefone resolvido direto dos dígitos:', telefoneResolvido);
    }
  } catch (err) {
    console.error('[router] Erro ao buscar LID em whatsapp_lid_map:', err);
    return null;
  }

  if (!telefoneResolvido) {
    return null;
  }

  // 2) Com o telefone em mãos, busca a API na tabela usuarios
  try {
    const rowUser = await dbGet(
      'SELECT api FROM usuarios WHERE telefone = ? LIMIT 1',
      [telefoneResolvido]
    );

    const api = rowUser && rowUser.api ? String(rowUser.api).toUpperCase() : null;
    console.log('[router] api encontrada para telefone', telefoneResolvido, '=>', api);
    return api;
  } catch (errUser) {
    console.error('[router] Erro ao buscar API em usuarios:', errUser);
    return null;
  }
}

/**
 * Tenta extrair um telefone da mensagem QUOTED (mensagem de validação).
 * Suposição: o texto da mensagem de validação contém o telefone com
 * pelo menos 10 dígitos consecutivos. Ex.: "Seu número é 14991234567".
 */
function extrairTelefoneDoTexto(texto) {
  if (!texto) return null;

  // Procura um bloco de 10 a 13 dígitos seguidos
  const match = texto.replace(/\s+/g, '').match(/(\d{10,13})/);
  if (!match) return null;

  return match[1]; // telefone em dígitos
}

/**
 * Fluxo de validação de número:
 * - Usuário responde (reply) a uma mensagem de validação enviada pelo BOT.
 * - Pegamos o LID do remetente (message.from).
 * - Pegamos o telefone do texto da mensagem original (quoted.body).
 * - Gravamos/atualizamos em whatsapp_lid_map(lid, telefone).
 */
async function tryHandleValidationReply(message) {
  // Precisa ser reply
  if (!message.hasQuotedMsg) return false;

  const fromRawId = (message.from || '').split('@')[0].trim();

  let quoted;
  try {
    quoted = await message.getQuotedMessage();
  } catch (err) {
    console.error('[router] Erro ao obter quotedMessage para validação:', err);
    return false;
  }

  const quotedBody = quoted && quoted.body ? quoted.body : '';
  const telefone = extrairTelefoneDoTexto(quotedBody);

  if (!telefone) {
    console.log('[router] Não foi possível extrair telefone da mensagem de validação.');
    return false;
  }

  try {
    // Verifica se já existe mapeamento
    const rowMap = await dbGet(
      'SELECT id, telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1',
      [fromRawId]
    );

    if (!rowMap) {
      // insere novo
      await dbRun(
        'INSERT INTO whatsapp_lid_map (lid, telefone) VALUES (?, ?)',
        [fromRawId, telefone]
      );
      console.log('[router] Novo mapeamento LID → telefone criado:', fromRawId, '=>', telefone);
    } else if (rowMap.telefone !== telefone) {
      // atualiza se o telefone for diferente
      await dbRun(
        'UPDATE whatsapp_lid_map SET telefone = ? WHERE id = ?',
        [telefone, rowMap.id]
      );
      console.log('[router] Mapeamento LID atualizado:', fromRawId, '=>', telefone);
    } else {
      console.log('[router] Mapeamento LID já estava correto, nada a atualizar.');
    }
    // Após salvar o mapeamento LID → telefone
    const api = await getUserAPI(message.from);

    // Se API encontrada, enviamos boas-vindas automaticamente
    if (api) {
      // Buscar dados do usuário (nome)
      const telefoneLimpo = telefone.replace(/\D/g, "");
      const usuario = await dbGet(
        "SELECT nome FROM usuarios WHERE telefone = ? LIMIT 1",
        [telefoneLimpo]
      );

      // Carregar função de gerar mensagem
      const { gerarMensagemBoasVindas } = require('../../usuariosService');
      const msgBoasVindas = await gerarMensagemBoasVindas(usuario?.nome || "Usuário", api);

      // Enviar boas-vindas
      await message.reply(
        '✅ *Número validado com sucesso!*\n' +
        'Seu acesso ao BOT está liberado! 🎉\n\n' +
        'Aguarde, enviarei as instruções iniciais...'
      );

      await message.client.sendMessage(message.from, msgBoasVindas);

    } else {
      await message.reply(
        '✅ Seu número foi validado, mas ainda não há API configurada para seu usuário.'
      );
    }

    return true;

  } catch (err) {
    console.error('[router] Erro ao salvar mapeamento LID → telefone:', err);
    await message.reply(
      '⚠️ Ocorreu um erro ao validar seu número. Tente novamente mais tarde ou fale com o suporte.'
    );
    return true; // consideramos tratado para não cair na mensagem de "não autorizado"
  }
}

// =====================================================
// Roteamento de TEXTO
// =====================================================
async function handleTexto(message, accountId, client) {
  const api = await getUserAPI(message.from);

  // Se não achou API, tenta primeiro tratar como reply de validação de número
  if (!api) {
    const handledValidation = await tryHandleValidationReply(message);
    if (handledValidation) {
      // já respondeu algo (sucesso ou erro de validação)
      return;
    }

    // Não era validação → mantém regra de "não autorizado"
    return message.reply(
      '❗ Seu número não tem permissão para usar o BOT.\n' +
      'Se você acabou de solicitar acesso pelo site, responda à mensagem de validação enviada pelo BOT Koyama Tecnologia.'
    );
  }

  // Se API já está configurada, delega para o BOT correto
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
// Roteamento de IMAGEM
// (por enquanto não participa da validação de número)
// =====================================================
async function handleImagem(message, accountId, client) {
  const api = await getUserAPI(message.from);

  if (!api) {
    return message.reply(
      '❗ Seu número não tem permissão para usar o BOT.\n' +
      'Para começar a usar, primeiro valide seu número respondendo à mensagem de validação enviada pelo BOT.'
    );
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
