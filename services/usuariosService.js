const db = require("../db/db");

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

function gerarMensagemValidacao(numeroReal) {
  return `
Olá! 👋  

Para liberar seu acesso ao *BOT Koyama Tecnologia*, precisamos validar seu número.

📱 *Número detectado:* ${numeroReal}

➡️ *Basta responder esta mensagem* (qualquer texto).  
Ao responder, seu número será validado automaticamente e você poderá começar a usar o bot.
`;
}

async function gerarMensagemBoasVindas(nome, api) {
  const nomeFmt = formatarNome(nome);

  const infoApi = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM apis WHERE UPPER(nome) = UPPER(?)", [api], (err, row) =>
      err ? reject(err) : resolve(row)
    );
  });

  let comandosLista = "";

  if (infoApi?.comandos) {
    try {
      const arr = JSON.parse(infoApi.comandos);
      comandosLista = arr.map(cmd => `• ${cmd}`).join("\n");
    } catch {}
  }

  return `
Olá *${nomeFmt}* 👋

🎉 *Seu acesso foi liberado com sucesso!*  

📌 *API Selecionada:* ${api}

🛠 *Comandos disponíveis nesta API:*  
${comandosLista}

🕒 *Período de teste:* 15 dias  
Durante esse período, você poderá explorar nossas automações, consultas inteligentes e integrações avançadas.

➡️ Para dúvidas ou suporte, chame pelo nosso WhatsApp: +55 14 99665-5659
`;
}

function cadastrarUsuario({ nome, telefone, email, api, dias = 15, ativo = 1, admin = 0, cliente_id = null }) {
  return new Promise((resolve, reject) => {
    const numero = normalizarTelefone(telefone);
    const nomeFmt = formatarNome(nome);

    const validade = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .substring(0, 10);

    db.run(
      `INSERT INTO usuarios (nome, telefone, email, api, validade, ativo, administrador, cliente_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nomeFmt, numero, email, api, validade, ativo, admin, cliente_id],
      async (err) => {
        if (err) return reject(err);

        resolve({
          nome: nomeFmt,
          numero,
          email,
          api,
          validade,
          mensagemValidacao: gerarMensagemValidacao(numero)
        });
      }
    );
  });
}

module.exports = {
  cadastrarUsuario,
  normalizarTelefone,
  formatarNome,
  gerarMensagemBoasVindas,
  gerarMensagemValidacao
};
