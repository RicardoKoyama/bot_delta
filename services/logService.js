const db = require("../db/db");

function registrarLog({ phone, tipo, mensagem, info = {} }) {
  return new Promise(resolve => {
    const jsonInfo = JSON.stringify(info);

    db.run(
      `INSERT INTO logs_bot (data_hora, phone, tipo, mensagem, info)
       VALUES (datetime('now','localtime'), ?, ?, ?, ?)`,
      [phone, tipo, mensagem, jsonInfo],
      (err) => {
        if (err) console.error("❌ Erro ao registrar log:", err);
        resolve();
      }
    );
  });
}

module.exports = { registrarLog };
