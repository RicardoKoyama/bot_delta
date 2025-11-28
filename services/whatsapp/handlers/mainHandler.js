const db = require('../../../db/db');
const textoHandler = require('./textoHandler');
const imagemHandler = require('./imagemHandler');

module.exports = async function mainHandler(client, msg) {
  const from = msg.from;
  const body = (msg.body || "").trim();
  const type = msg.type;

  console.log(`📩 Mensagem recebida de ${from}: [${type}] ${body}`);

  // 1 — Validar usuário autorizado
  const usuario = await buscarUsuarioAutorizado(from);
  if (!usuario) {
    console.log(`❌ Número não autorizado: ${from}`);
    return; // 💡 Não responde nada
  }

  // 2 — Identificar tipo da mensagem
  if (type === "chat") {
    console.log('Mensagem recebida');
    return textoHandler(client, msg, body, usuario);
  }

  if (type === "image") {
    return imagemHandler(client, msg, usuario);
  }

  // Outros tipos podem ser adicionados depois
  console.log(`ℹ️ Tipo de mensagem não suportado: ${type}`);
  return;
};



// FUNÇÃO — Buscar usuário autorizado no SQLite
function buscarUsuarioAutorizado(numero) {
  return new Promise((resolve) => {
    const tel = numero.replace(/\D/g, "");  // normaliza

    db.get(
      `SELECT * FROM usuarios
       WHERE phone_number = ?
         AND is_active = 1
         AND date(validade) >= date('now')`,
      [tel],
      (err, row) => {
        if (err) return resolve(null);
        resolve(row);
      }
    );
  });
}
