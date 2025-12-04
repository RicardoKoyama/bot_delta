// services/whatsapp/WhatsAppManager.js
const db = require('../../db/db');
const createClient = require('./createClient');

class WhatsAppManager {
  constructor() {
    this.clients = {};       // clients[id]
    this.clientsByName = {}; // clients["BOT_1"]
  }

  // Inicia todas as contas cadastradas em contas_whatsapp
  async iniciarTodas() {
    db.all('SELECT * FROM contas_whatsapp', async (err, contas) => {
      if (err) {
        console.error('Erro ao carregar contas_whatsapp:', err);
        return;
      }

      for (const conta of contas) {
        try {
          await this.iniciarConta(conta);
        } catch (e) {
          console.error(`Erro ao iniciar conta ${conta.nome}:`, e);
        }
      }
    });
  }

  // Inicia uma conta específica
  async iniciarConta(conta) {
    console.log(`🚀 Iniciando conta: ${conta.nome}`);

    const client = await createClient(conta);

    this.clients[conta.id] = client;
    this.clientsByName[conta.nome] = client;

    client.initialize();
  }

  getClient(id) {
    return this.clients[id] || null;
  }

  getClientByName(nome) {
    return this.clientsByName[nome] || null;
  }

  /**
   * Envia mensagem para um número.
   * número em qualquer formato (com +, espaços, etc) → apenas dígitos + "@c.us"
   */
  async enviarMensagem(numero, mensagem, idConta = null) {
    try {
      // escolhe cliente ativo
      let client = null;

      if (idConta) {
        client = this.clients[idConta];
      } else {
        const ids = Object.keys(this.clients);
        if (!ids.length) {
          throw new Error('Nenhuma conta WhatsApp ativa.');
        }
        client = this.clients[ids[0]];
      }

      if (!client) {
        throw new Error('Cliente WhatsApp não encontrado.');
      }

      // normaliza número
      const apenasDigitos = String(numero).replace(/\D/g, '');
      const chatId = `${apenasDigitos}@c.us`;

      // envia mensagem
      await client.sendMessage(chatId, mensagem);

      console.log('📤 Mensagem enviada com sucesso para:', chatId);
      return true;
    } catch (err) {
      console.error('❌ Erro ao enviar mensagem:', err);
      return false;
    }
  }
}

module.exports = new WhatsAppManager();
