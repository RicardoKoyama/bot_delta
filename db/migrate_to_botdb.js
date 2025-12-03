const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

console.log("🚀 Iniciando migração delta.db → bot.db\n");

// Caminhos absolutos
const oldDBPath = path.join(__dirname, "delta.db");
const newDBPath = path.join(__dirname, "bot.db");

// Verifica se banco antigo existe
if (!fs.existsSync(oldDBPath)) {
  console.error("❌ ERRO: delta.db não encontrado em /db/");
  process.exit(1);
}

console.log("📌 Banco antigo localizado:", oldDBPath);

// Remove bot.db antigo (se existir)
if (fs.existsSync(newDBPath)) {
  console.log("⚠️ bot.db existente encontrado — apagando...");
  fs.unlinkSync(newDBPath);
}

// Conexões
const oldDB = new sqlite3.Database(oldDBPath);
const newDB = new sqlite3.Database(newDBPath);

// Criar tabelas novas
function criarEstruturaNova() {
  return new Promise((resolve, reject) => {
    newDB.serialize(() => {
      console.log("📦 Criando estrutura do banco bot.db...");

      newDB.run(`
        CREATE TABLE IF NOT EXISTS produtos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE,
          referencia TEXT,
          nome TEXT,
          nome_abreviado TEXT,
          codigo_barra TEXT,
          tamanho TEXT,
          marca TEXT,
          superficie TEXT,
          m2_caixa REAL,
          peso_caixa REAL,
          caixas_pallet INTEGER,
          m2_pallet REAL,
          peso_pallet REAL,
          fora_linha INTEGER DEFAULT 0,
          url_produto TEXT,
          id_site INTEGER,
          imagem_url TEXT,
          atualizado_em TEXT
        );
      `);

      newDB.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT,
          telefone TEXT UNIQUE,
          validade TEXT,
          ativo INTEGER DEFAULT 0,
          administrador INTEGER DEFAULT 0,
          id_mensagem INTEGER,
          token TEXT,
          api TEXT
        );
      `);

      newDB.run(`
        CREATE TABLE IF NOT EXISTS contas_whatsapp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT,
          telefone TEXT,
          status TEXT,
          atualizado_em TEXT
        );
      `);

      newDB.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data_hora TEXT,
          telefone TEXT,
          tipo TEXT,
          mensagem TEXT,
          info TEXT
        );
      `);

      newDB.run(`
        CREATE TABLE IF NOT EXISTS whatsapp_lid_map (
          lid TEXT PRIMARY KEY,
          telefone TEXT NOT NULL,
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      resolve();
    });
  });
}

// MIGRAR PRODUTOS
function migrarProdutos() {
  return new Promise((resolve, reject) => {
    console.log("📥 Migrando produtos...");

    oldDB.all("SELECT * FROM delta_produtos", (err, rows) => {
      if (err) return reject(err);

      if (rows.length === 0) {
        console.log("⚠️ Nenhum produto encontrado no delta.db");
        return resolve();
      }

      const stmt = newDB.prepare(`
        INSERT INTO produtos (
          codigo, referencia, nome, nome_abreviado, codigo_barra,
          tamanho, marca, superficie, m2_caixa, peso_caixa,
          caixas_pallet, m2_pallet, peso_pallet, fora_linha,
          url_produto, id_site, imagem_url, atualizado_em
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of rows) {
        stmt.run([
          p.cod_produto,
          p.prd_referencia,
          p.nome,
          p.nome_abreviado,
          p.cod_barra,
          p.tamanho,
          p.marca,
          p.superficie,
          p.m2_caixa,
          p.peso_caixa,
          p.cx_pallet,
          p.m2_pallet,
          p.peso_pallet,
          p.fora_linha,
          p.url_produto,
          p.id_site,
          p.img_url,
          p.atualizado_em
        ]);
      }

      stmt.finalize();
      console.log(`✔ ${rows.length} produtos migrados com sucesso!`);
      resolve();
    });
  });
}

async function executarMigracao() {
  try {
    console.log("⏳ Preparando migração...\n");

    await criarEstruturaNova();
    await migrarProdutos();

    console.log("\n🎉 Migração concluída com sucesso!");
    console.log("🟢 Novo banco: bot.db");
    console.log("🟡 Banco antigo preservado: delta.db");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro na migração:", err);
    process.exit(1);
  }
}

executarMigracao();
