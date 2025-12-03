const db = require("../db/db");

// Normalizar telefone no formato 55DDDNÚMERO
function normalizarTelefone(tel) {
  tel = (tel || "").replace(/\D/g, "");
  if (!tel.startsWith("55")) tel = "55" + tel;
  return tel;
}

function formatarNome(nome) {
  return (nome || "")
    .toLowerCase()
    .split(" ")
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function gerarMensagemBoasVindas(nome) {
  const nomeFmt = formatarNome(nome);
  return `Prezado(a) *${nomeFmt}*,

🎉 *Seja muito bem-vindo ao BOT da Koyama Tecnologia!*`;
}

function cadastrarUsuario({ nome, telefone, dias = 15, ativo = 1, admin = 0 }) {
  return new Promise((resolve, reject) => {
    const numero = normalizarTelefone(telefone);
    const nomeFmt = formatarNome(nome);

    const validade = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .substring(0, 10);

    db.run(
      `INSERT INTO usuarios (nome, telefone, validade, ativo, administrador)
       VALUES (?, ?, ?, ?, ?)`,
      [nomeFmt, numero, validade, ativo, admin],
      async (err) => {
        if (err) return reject(err);
        resolve({ nome: nomeFmt, numero, validade });
      }
    );
  });
}

module.exports = {
  cadastrarUsuario,
  normalizarTelefone,
  formatarNome,
  gerarMensagemBoasVindas
};
