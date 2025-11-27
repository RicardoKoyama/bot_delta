const db = require('../../db/db');
const createClient = require('./createClient');

class WhatsAppManager {
  constructor() {
    this.clients = {};
  }

  async iniciarTodas() {
    db.all("SELECT * FROM contas_whatsapp", async (err, contas) => {
      if (err) return console.error(err);

      for (const conta of contas) {
        await this.iniciarConta(conta);
      }
    });
  }

  async iniciarConta(conta) {
    console.log(`🚀 Iniciando conta: ${conta.nome}`);

    const client = await createClient(conta);
    this.clients[conta.id] = client;

    client.initialize();
  }
}

module.exports = new WhatsAppManager();
