const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const qrcode = require('qrcode');
const db = require('../../db/db');

async function createClient(conta) {
  
  const sessionDir = path.join(__dirname, '../../sessions', `conta_${conta.id}`);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    },
    authStrategy: new LocalAuth({
      clientId: `conta_${conta.id}`,
      dataPath: sessionDir
    })
  });

  // Evento QR → salvar no DB
  client.on('qr', async qr => {
    const qrBase64 = await qrcode.toDataURL(qr);
    db.run(
      "UPDATE contas_whatsapp SET status=?, qr_data=?, updated_at=datetime('now') WHERE id=?",
      ['qr', qrBase64, conta.id]
    );
    console.log(`📱 QR gerado para conta ${conta.nome}`);
  });

  // Quando conectar
  client.on('ready', () => {
    console.log(`🟢 Conta ${conta.nome} conectada`);
    db.run(
      "UPDATE contas_whatsapp SET status='ativo', qr_data=NULL, updated_at=datetime('now') WHERE id=?",
      [conta.id]
    );
  });

  // Erro de autenticação
  client.on('auth_failure', msg => {
    console.log(`❌ Falha na conta ${conta.nome}: ${msg}`);
    db.run(
      "UPDATE contas_whatsapp SET status='erro', updated_at=datetime('now') WHERE id=?",
      [conta.id]
    );
  });

  // Desconectou
  client.on('disconnected', reason => {
    console.log(`🔴 Conta ${conta.nome} desconectada: ${reason}`);
    db.run(
      "UPDATE contas_whatsapp SET status='desconectado', updated_at=datetime('now') WHERE id=?",
      [conta.id]
    );
    client.initialize(); // tenta reconectar automaticamente
  });

  return client;
}

module.exports = createClient;
