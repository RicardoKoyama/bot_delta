const db = require('../../../db/db');
const textoHandler = require('./textoHandler');
const imagemHandler = require('./imagemHandler');
const whatsappManager = require("../../whatsapp/WhatsAppManager");

// --------------------------------------------------------
//  FUNÇÃO PRINCIPAL
// --------------------------------------------------------
module.exports = async function mainHandler(client, msg) {
  const from = msg.from;
  const body = (msg.body || "").trim();
  const type = msg.type;

  console.log(`📩 Mensagem recebida de ${from}: [${type}] ${body}`);

  // 1 — Validar usuário autorizado
  const usuario = await buscarUsuarioAutorizado(from);
  if (!usuario) {
    console.log(`❌ Número não autorizado: ${from}`);
    return; // Não responde nada
  }

  // 2 — Tentar tratar comando de cadastro
  const cadastroFeito = await tentarCadastroViaComando(msg, usuario);
  if (cadastroFeito) return;

  // 3 — Identificar tipo da mensagem
  if (type === "chat") {
    return textoHandler(client, msg, body, usuario);
  }

  if (type === "image") {
    return imagemHandler(client, msg, usuario);
  }

  console.log(`ℹ️ Tipo de mensagem não suportado: ${type}`);
  return;
};


// --------------------------------------------------------
//  FUNÇÃO — Cadastro via comando: "cadastrar NOME / TELEFONE"
// --------------------------------------------------------
async function tentarCadastroViaComando(msg, usuarioAdmin) {
  let texto = (msg.body || "").trim();

  // Normalizar
  const textoUpper = texto.toUpperCase();

  // Não é comando de cadastro?
  if (!textoUpper.startsWith("CADASTRAR ")) return false;

  // Apenas admin pode cadastrar
  if (!usuarioAdmin.is_admin) {
    await msg.reply("❌ Você não tem permissão para cadastrar novos usuários.");
    return true;
  }

  // Formato: CADASTRAR NOME / TELEFONE
  const partes = textoUpper.replace("CADASTRAR", "").trim().split("/");
  if (partes.length < 2) {
    await msg.reply("❗ Formato inválido.\nUse: *cadastrar NOME / TELEFONE*");
    return true;
  }

  const nome = partes[0].trim();
  let telefone = partes[1].replace(/\D/g, "");

  // Normalizar telefone
  if (!telefone.startsWith("55")) telefone = "55" + telefone;

  // Validade 15 dias
  const validade = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 10);

  // Inserir no banco
  db.run(
    `INSERT INTO usuarios (nome, phone_number, validade, is_active, is_admin)
     VALUES (?, ?, ?, ?, 0)`,
    [nome, telefone, validade, 1],
    async (err) => {
      if (err) {
        console.error(err);
        await msg.reply("❌ Erro ao cadastrar usuário.");
        return;
      }

      // Mensagem de boas-vindas
      const wa = whatsappManager.getClientByName("BOT_1");
      if (wa) {
        try {
          await wa.sendMessage(
            `${telefone}@c.us`,
            `👋 *Bem-vindo ao BOT da Koyama Tecnologia!*\n\nSeu acesso está ativo por *15 dias*.`
          );
        } catch (e) {
          console.error("⚠️ Erro ao enviar boas-vindas:", e);
        }
      }

      await msg.reply(
        `✅ *Usuário cadastrado com sucesso!*\n\nNome: ${nome}\nTelefone: ${telefone}`
      );
    }
  );

  return true;
}



// --------------------------------------------------------
//  FUNÇÃO — Buscar usuário autorizado no SQLite
// --------------------------------------------------------
function buscarUsuarioAutorizado(numero) {
  return new Promise((resolve) => {
    const tel = numero.replace(/\D/g, ""); // normaliza

    db.get(
      `SELECT * FROM usuarios
       WHERE phone_number = ?
         AND is_active = 1
         AND date(valididade) >= date('now')`,
      [tel],
      (err, row) => {
        if (err) return resolve(null);
        resolve(row);
      }
    );
  });
}
