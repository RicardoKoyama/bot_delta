const db = require("../db/db");

// --- Normalizar telefone no formato 55DDDNÚMERO ---
function normalizarTelefone(tel) {
  tel = (tel || "").replace(/\D/g, "");
  if (!tel.startsWith("55")) tel = "55" + tel;
  return tel;
}

// --- Capitalizar nome ---
function formatarNome(nome) {
  return (nome || "")
    .toLowerCase()
    .split(" ")
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// --- Gera mensagem de boas-vindas com API + comandos ---
async function gerarMensagemBoasVindas(nome, api) {
  const nomeFmt = formatarNome(nome);

  // Buscar dados da API escolhida
  const infoApi = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM apis WHERE nome = ?", [api], (err, row) =>
      err ? reject(err) : resolve(row)
    );
  });

  // Montagem da mensagem
  let comandosLista = "";

  if (infoApi?.comandos) {
    try {
      const arr = JSON.parse(infoApi.comandos);
      comandosLista = arr.map(cmd => `• ${cmd}`).join("\n");
    } catch {}
  }

  return `
Olá *${nomeFmt}* 👋

🎉 *Seja bem-vindo ao BOT da Koyama Tecnologia!*

Você selecionou a API: *${api}*  
Aqui estão os comandos disponíveis:

${comandosLista}

Seu acesso é válido por *15 dias* para testes.  
Qualquer dúvida estou à disposição! 🚀
`;
}

// --- Cadastrar usuário no banco ---
function cadastrarUsuario({ nome, telefone, email, api, dias = 15, ativo = 1, admin = 0 }) {
  return new Promise((resolve, reject) => {
    const numero = normalizarTelefone(telefone);
    const nomeFmt = formatarNome(nome);

    const validade = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .substring(0, 10);

    db.run(
      `INSERT INTO usuarios (nome, telefone, email, api, validade, ativo, administrador)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nomeFmt, numero, email, api, validade, ativo, admin],
      async (err) => {
        if (err) return reject(err);

        resolve({ nome: nomeFmt, numero, email, api, validade });
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
