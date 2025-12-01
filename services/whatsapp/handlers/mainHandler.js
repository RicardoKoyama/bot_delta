const db = require('../../../db/db');
const textoHandler = require('./textoHandler');
const imagemHandler = require('./imagemHandler');
const usuarioService = require("../../usuariosService");

// FUNÇÃO PRINCIPAL
module.exports = async function mainHandler(client, msg) {
  const from = msg.from;
  const body = (msg.body || "").trim();
  const type = msg.type;


  // Log básico da mensagem recebida
  registrarLog({
    phone: from.replace(/\D/g, ""),
    tipo: type,
    mensagem: body,
    info: {}
  });

  console.log(`📩 Mensagem recebida de ${from}: [${type}] ${body}`);

  // Validar usuário
  const usuario = await buscarUsuarioAutorizado(from);
  if (!usuario) {
    console.log(`❌ Não autorizado: ${from}`);
    return;
  }

  // Comando CADASTRAR
  const handled = await tentarCadastroViaComando(msg, usuario);
  if (handled) return;

  // Tipos
  if (type === "chat") return textoHandler(client, msg, body, usuario);
  if (type === "image") return imagemHandler(client, msg, usuario);

  console.log(`ℹ️ Tipo não suportado: ${type}`);
};

// --------------------------------------------------------
// CADASTRO VIA WHATSAPP
// --------------------------------------------------------
async function tentarCadastroViaComando(msg, usuarioAdmin) {
  let texto = (msg.body || "").trim().toUpperCase();

  if (!texto.startsWith("CADASTRAR ")) return false;

  if (!usuarioAdmin.is_admin) {
    await msg.reply("❌ Você não tem permissão para cadastrar usuários.");
    return true;
  }

  const partes = texto.replace("CADASTRAR", "").trim().split("/");
  if (partes.length < 2) {
    await msg.reply("❗ Use: *cadastrar NOME / TELEFONE*");
    return true;
  }

  const nome = partes[0].trim();
  const telefone = partes[1].trim();

  try {
    await usuarioService.cadastrarUsuario({
      nome,
      telefone,
      dias: 15,
      ativo: 1,
      admin: 0
    });

    registrarLog({
      phone: msg.from.replace(/\D/g, ""),
      tipo: "cadastro_comando",
      mensagem: msg.body,
      info: { nome, telefone }
    });

    await msg.reply(`✅ Usuário *${nome}* cadastrado com sucesso!`);

  } catch (e) {
    console.error(e);
    await msg.reply("❌ Erro ao cadastrar usuário.");
  }

  return true;
}

// --------------------------------------------------------
// BUSCAR AUTORIZADO
// --------------------------------------------------------
function buscarUsuarioAutorizado(numero) {
  return new Promise((resolve) => {
    const tel = numero.replace(/\D/g, "");

    db.get(
      `SELECT * FROM usuarios
       WHERE phone_number = ?
         AND is_active = 1
         AND date(validade) >= date('now')`,
      [tel],
      (err, row) => resolve(row || null)
    );
  });
}
