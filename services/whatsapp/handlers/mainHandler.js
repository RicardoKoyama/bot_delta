const db = require('../../../db/db');
const textoHandler = require('./textoHandler');
const imagemHandler = require('./imagemHandler');
const usuarioService = require("../../usuariosService");
const { registrarLog } = require("../../logService");

// Normaliza número (LID → telefone real)
async function normalizarNumero(raw) {
  const clean = (raw || "")
    .replace("@c.us", "")
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")
    .replace(/\D/g, "");

  if (clean.startsWith("55") && clean.length >= 12) return clean;

  // Procura no lid_map novo
  return new Promise(resolve => {
    db.get(
      `SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1`,
      [clean],
      (err, row) => {
        resolve(row?.telefone || clean);
      }
    );
  });
}

module.exports = async function mainHandler(client, msg) {
  const from = await normalizarNumero(msg.from);
  const body = (msg.body || "").trim();
  const type = msg.type;

  registrarLog({
    telefone: from,
    tipo: type,
    mensagem: body,
    info: {}
  });

  console.log(`📩 Mensagem recebida de ${from}: [${type}] ${body}`);

  const usuario = await buscarUsuarioAutorizado(from);
  if (!usuario) {
    console.log(`❌ Não autorizado: ${from}`);
    return;
  }

  // Comando CADASTRAR
  const handled = await tentarCadastroViaComando(msg, usuario);
  if (handled) return;

  if (type === "chat") return textoHandler(client, msg, body, usuario);
  if (type === "image") return imagemHandler(client, msg, usuario);

  console.log(`ℹ️ Tipo não suportado: ${type}`);
};

// --------------------------------------------------------
// BUSCAR AUTORIZADO — versão nova
// --------------------------------------------------------
function buscarUsuarioAutorizado(numero) {
  return new Promise(resolve => {
    db.get(
      `SELECT * FROM usuarios 
       WHERE telefone = ?
       AND ativo = 1
       AND date(validade) >= date('now')`,
      [numero],
      (err, row) => resolve(row || null)
    );
  });
}

// --------------------------------------------------------
// CADASTRAR VIA WHATSAPP
// --------------------------------------------------------
async function tentarCadastroViaComando(msg, usuarioAdmin) {

  if (!usuarioAdmin.administrador) return false;

  const texto = (msg.body || "").trim().toUpperCase();
  if (!texto.startsWith("CADASTRAR ")) return false;

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
      telefone: msg.from.replace(/\D/g, ""),
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
