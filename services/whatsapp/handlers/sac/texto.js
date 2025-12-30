const { getEstado, setEstado } = require('./estado');
const repo = require('./repo');
const crypto = require('crypto');

function gerarProtocolo() {
  const data = new Date();
  const ymd = data.toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SAC-${ymd}-${rand}`;
}

function gerarToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  async process(message, accountId, client) {
    const lid = (message.from || '').split('@')[0].trim();

    // verifica se já existe chamado ativo
    const existente = await repo.existeChamadoAtivoPorLid(lid);

    if (existente) {
      await message.reply(
        `📌 Você já possui um chamado em andamento.\n\n` +
        `Protocolo: *${existente.protocolo}*\n\n` +
        `Acompanhe pelo link:\n` +
        `https://www.koyamatecnologia.com.br/portal-sac/cliente/?token=${existente.token_formulario}`
      );
      return true;
    }

    // cria novo chamado
    const protocolo = gerarProtocolo();
    const token = gerarToken();

    const chamadoId = await repo.criarChamado({
      lid,
      protocolo,
      token
    });

    await repo.registrarEvento(
      chamadoId,
      'pre_chamado_criado',
      'Chamado iniciado via WhatsApp'
    );

    await message.reply(
      `👋 Olá! Seu atendimento foi iniciado.\n\n` +
      `📌 *Protocolo:* ${protocolo}\n\n` +
      `Para continuar, preencha o formulário:\n` +
      `👉 https://www.koyamatecnologia.com.br/portal-sac/cliente/?token=${token}`
    );

    return true;
  }
};
