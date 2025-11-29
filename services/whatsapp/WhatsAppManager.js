const db = require('../../db/db');
const createClient = require('./createClient');

class WhatsAppManager {
  constructor() {
    this.clients = {}; // clients[id] = client
    this.clientsByName = {}; // opcional: clients["BOT_1"] = client
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

    // salva por ID
    this.clients[conta.id] = client;

    // salva por nome (ex: BOT_1)
    this.clientsByName[conta.nome] = client;

    client.initialize();
  }

  // buscar por ID
  getClient(id) {
    return this.clients[id] || null;
  }

  // buscar por nome (recomendado)
  getClientByName(nome) {
    return this.clientsByName[nome] || null;
  }
}

module.exports = new WhatsAppManager();
