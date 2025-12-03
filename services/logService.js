const db = require("../db/db");

function registrarLog({ telefone, tipo, mensagem, info = {} }) {
  return new Promise(resolve => {
    const jsonInfo = JSON.stringify(info);

    db.run(
      `INSERT INTO logs (data_hora, telefone, tipo, mensagem, info)
       VALUES (datetime('now','localtime'), ?, ?, ?, ?)`,
      [telefone, tipo, mensagem, jsonInfo],
      (err) => {
        if (err) console.error("❌ Erro ao registrar log:", err);
        resolve();
      }
    );
  });
}

module.exports = { registrarLog };
