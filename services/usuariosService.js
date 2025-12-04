// services/usuariosService.js
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

/**
 * NOVO: Mensagem inicial de validação
 * Essa é a primeira mensagem que o usuário recebe.
 * Ele deve responder a essa mensagem para validarmos o LID.
 */
function gerarMensagemValidacao(numeroReal) {
  return `
Olá! 👋  

Para liberar seu acesso ao *BOT Koyama Tecnologia*, precisamos validar seu número.

📱 *Número detectado:* ${numeroReal}

➡️ *Basta responder esta mensagem* (qualquer texto).  
Ao responder, seu número será validado automaticamente e você poderá começar a usar o bot.
`;
}

/**
 * Mensagem tradicional de boas-vindas
 * Essa mensagem só será enviada após o número ser validado.
 */
async function gerarMensagemBoasVindas(nome, api) {
  const nomeFmt = formatarNome(nome);

  // Buscar dados da API
  const infoApi = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM apis WHERE UPPER(nome) = UPPER(?)", [api], (err, row) =>
      err ? reject(err) : resolve(row)
    );
  });

  // Lista de comandos formatada
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

➡️ É só enviar a palavra *ajuda* que você verá os comandos disponíveis para consulta.
`;
}

/**
 * Cadastrar usuário vindo da Landing Page
 * OBS: Agora NÃO envia mais boas-vindas aqui.
 * O fluxo correto:
 *   1. Cadastrar usuário
 *   2. Retornar mensagem de validação
 *   3. Após validação via WhatsApp, o router envia mensagem de boas-vindas
 */
function cadastrarUsuario({ nome, telefone, email, api, dias = 15, ativo = 1, admin = 0 }) {
  return new Promise((resolve, reject) => {
    const numero = normalizarTelefone(telefone);
    const nomeFmt = formatarNome(nome);

    // validade = data de hoje + dias
    const validade = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .substring(0, 10);

    db.run(
      `INSERT INTO usuarios (nome, telefone, email, api, validade, ativo, administrador)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nomeFmt, numero, email, api, validade, ativo, admin],
      async (err) => {
        if (err) return reject(err);

        // Retornamos o novo usuário e a mensagem de validação
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
