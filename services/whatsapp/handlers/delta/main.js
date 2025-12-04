const textoHandler  = require('./texto');
const imagemHandler = require('./imagem');
const ajudaHandler  = require('./ajuda');

async function handleTexto(message, accountId, client) {
  try {
    const body = (message.body || '').trim().toUpperCase();

    if (body === "AJUDA" || body === "*AJUDA") {
        return ajudaHandler(client, message, {});
    }

    return textoHandler(client, message, body, {}); 

  } catch (err) {
    console.error('[DELTA main] erro em handleTexto:', err);
    return message.reply('❌ Erro ao processar mensagem (DELTA).');
  }
}

async function handleImagem(message, accountId, client) {
  try {
    return imagemHandler(client, message, {}); 
  } catch (err) {
    console.error('[DELTA main] erro em handleImagem:', err);
    return message.reply('❌ Erro ao processar imagem (DELTA).');
  }
}

module.exports = {
  handleTexto,
  handleImagem
};
