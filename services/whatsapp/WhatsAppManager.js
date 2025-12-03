const db = require('../../db/db');
const createClient = require('./createClient');

class WhatsAppManager {
  constructor() {
    this.clients = {};      // clients[id]
    this.clientsByName = {}; // clients["BOT_1"]
  }

  async iniciarTodas() {
    db.all("SELECT * FROM contas_whatsapp", async (err, contas) => {
      if (err) {
        console.error("Erro ao carregar contas_whatsapp:", err);
        return;
      }

      for (const conta of contas) {
        await this.iniciarConta(conta);
      }
    });
  }

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
}

module.exports = new WhatsAppManager();
