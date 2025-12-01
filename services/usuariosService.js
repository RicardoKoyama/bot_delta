const db = require("../db/db");
const whatsappManager = require("./whatsapp/WhatsAppManager");

// ---------------------------------------------
// Normalizar telefone: 55 + DDD + número
// ---------------------------------------------
function normalizarTelefone(tel) {
  tel = (tel || "").replace(/\D/g, "");
  if (!tel.startsWith("55")) tel = "55" + tel;
  return tel;
}

// ---------------------------------------------
// Capitalizar nome
// ---------------------------------------------
function formatarNome(nome) {
  return (nome || "")
    .toLowerCase()
    .split(" ")
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// ---------------------------------------------
// Texto da mensagem de boas-vindas
// ---------------------------------------------
function gerarMensagemBoasVindas(nome) {
  const nomeFmt = formatarNome(nome);

  return `Prezado(a) *${nomeFmt}*,

🎉 *Seja muito bem-vindo ao BOT da Koyama Tecnologia!*

Agora você já pode consultar produtos Delta de forma rápida e simples.

🧭 *Meios de consulta:*
• Envie *nome do produto*, ex barcelona - busca por descrição que contenha *barcelona*
• Envie *código*, ex: 3186 — busca pelo código do produto
• Envie uma *foto do QR Code da peça* — consulta automática do produto`;
}

// ---------------------------------------------
// Criar usuário (painel ou WhatsApp)
// ---------------------------------------------
function cadastrarUsuario({ nome, telefone, dias = 15, ativo = 1, admin = 0 }) {
  return new Promise((resolve, reject) => {
    const numero = normalizarTelefone(telefone);
    const nomeFmt = formatarNome(nome);

    const validade = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .substring(0, 10);

    db.run(
      `INSERT INTO usuarios (nome, phone_number, validade, is_active, is_admin)
       VALUES (?, ?, ?, ?, ?)`,
      [nomeFmt, numero, validade, ativo, admin],
      async (err) => {
        if (err) {
          console.error("❌ Erro ao inserir usuário:", err);
          return reject(err);
        }

        // Enviar boas-vindas
        try {
          const wa = whatsappManager.getClientByName("BOT_1");
          if (wa) {
            const msg = gerarMensagemBoasVindas(nomeFmt);
            await wa.sendMessage(`${numero}@c.us`, msg);
          }
        } catch (e) {
          console.error("⚠️ Erro ao enviar boas-vindas:", e);
        }

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
