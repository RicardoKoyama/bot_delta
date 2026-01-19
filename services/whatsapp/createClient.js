// services/whatsapp/createClient.js
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
    disableSeen: true,
    authStrategy: new LocalAuth({
      clientId: `conta_${conta.id}`,
      dataPath: sessionDir
    })
  });

  // ----------------------------------------
  // QR CODE GERADO
  // ----------------------------------------
  client.on('qr', async (qr) => {
    try {
      const qrBase64 = await qrcode.toDataURL(qr);

      db.run(
        `UPDATE contas_whatsapp 
           SET status = ?, 
               qr_data = ?, 
               atualizado_em = datetime('now','localtime')
         WHERE id = ?`,
        ['qr', qrBase64, conta.id],
        (err) => {
          if (err) {
            console.error('Erro ao salvar QR no banco:', err);
          }
        }
      );

      console.log(`📱 QR gerado para conta ${conta.nome}`);
    } catch (e) {
      console.error('Erro ao gerar QR base64:', e);
    }
  });

  // ----------------------------------------
  // READY
  // ----------------------------------------
  client.on('ready', () => {
    console.log(`🟢 Conta ${conta.nome} conectada`);

    db.run(
      `UPDATE contas_whatsapp 
         SET status = 'ativo', 
             qr_data = NULL, 
             atualizado_em = datetime('now','localtime') 
       WHERE id = ?`,
      [conta.id],
      (err) => {
        if (err) {
          console.error('Erro ao atualizar status da conta para ativo:', err);
        }
      }
    );
  });

  // ----------------------------------------
  // AUTH FAILURE
  // ----------------------------------------
  client.on('auth_failure', (msg) => {
    console.log(`❌ Falha na conta ${conta.nome}: ${msg}`);

    db.run(
      `UPDATE contas_whatsapp 
         SET status = 'erro', 
             atualizado_em = datetime('now','localtime') 
       WHERE id = ?`,
      [conta.id],
      (err) => {
        if (err) {
          console.error('Erro ao salvar falha de autenticação:', err);
        }
      }
    );
  });

  // ----------------------------------------
  // DISCONNECTED
  // ----------------------------------------
  client.on('disconnected', (reason) => {
    console.log(`🔴 Conta ${conta.nome} desconectada: ${reason}`);

    db.run(
      `UPDATE contas_whatsapp 
         SET status = 'desconectado', 
             atualizado_em = datetime('now','localtime') 
       WHERE id = ?`,
      [conta.id],
      (err) => {
        if (err) {
          console.error('Erro ao salvar desconexão da conta:', err);
        }
      }
    );

    // tenta reconectar
    client.initialize();
  });

  // ----------------------------------------
  // RECEBIMENTO DE MENSAGENS
  // ----------------------------------------
  client.on('message', async (msg) => {
    try {
      const router = require('./handlers/router');

      if (msg.type === 'image') {
        await router.handleImagem(msg, conta.id, client);
      } else {
        await router.handleTexto(msg, conta.id, client);
      }
    } catch (err) {
      console.error('Erro no handler de mensagem:', err);
    }
  });

  return client;
}

module.exports = createClient;
