const db = require('../../../db/db');
const axios = require('axios');
const deltaApi = require('../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../logService");

module.exports = async function textoHandler(client, msg, body, usuario) {

    async function buscarPorCodigo(client, msg, cod) {
        console.log("🔎 Buscando por código:", cod);

        const row = await sqlGet(`
            SELECT * FROM produtos_delta 
            WHERE cod_base = ? OR cod_produto = ?
        `, [cod, cod]);

        if (!row) {
            return msg.reply("❌ Nenhum produto encontrado para esse código.");
        }
        
        return responderProduto(client, msg, row);
    }

    async function buscarPorReferencia(client, msg, ref) {
        console.log("🔎 Buscando por referência:", ref);

        ref = ref.trim().toUpperCase();

        // Se não tem -, adiciona -A
        if (!ref.includes('-')) {
            ref = ref + "-A";
        }

        // 1 — Tenta exata
        let row = await sqlGet(`
            SELECT * FROM produtos_delta 
            WHERE cod_produto = ?
        `, [ref]);

        // 2 — Se não achou, tenta pela base
        if (!row) {
            const base = ref.split('-')[0];
            row = await sqlGet(`
                SELECT * FROM produtos_delta 
                WHERE cod_produto LIKE ?
            `, [`${base}-%`]);
        }

        if (!row) {
            return msg.reply("❌ Referência não encontrada.");
        }

        return responderProduto(client, msg, row);
    }



    async function buscarPorEAN(client, msg, ean) {
        console.log("🔎 Buscando por EAN:", ean);

        const row = await sqlGet(`
            SELECT * FROM produtos_delta 
            WHERE it_cbarra = ?
        `, [ean]);

        if (!row) {
            return msg.reply("❌ Nenhum produto encontrado para esse EAN.");
        }

        return responderProduto(client, msg, row);
    }

    async function buscarPorNome(client, msg, nome) {
        console.log("🔎 Buscando por nome:", nome);

        const lista = await sqlAll(`
        SELECT cod_produto, nome_abreviado 
        FROM produtos_delta
        WHERE nome_abreviado LIKE ?
        LIMIT 10
        `, [`%${nome}%`]);

        if (!lista.length) {
        return msg.reply("❌ Nenhum produto encontrado.");
        }

        if (lista.length === 1) {
        return buscarPorReferencia(client, msg, lista[0].cod_produto);
        }

        let texto = "📦 Produtos encontrados:\n\n";
        lista.forEach((p, i) => texto += `${i+1}. *${p.cod_produto}* — ${p.nome_abreviado}\n`);

        return msg.reply(texto);
    }

    async function responderProduto(client, msg, row) {
        try {
            const det = await deltaApi.detalhes(row.cod_produto);

            // Monta legenda
            let texto = `📌 *${det.dsc_abreviado}*\n\n`;
            texto += `*Referência:* ${det.cod_produto}\n`;
            texto += `*Tamanho:* ${det.dsc_tamanho_produtos}\n`;
            texto += `*Superfície:* ${det.dsc_esp_superficie}\n`;
            texto += `*Marca:* ${det.dsc_marca}\n`;
            texto += `*Estoque:* ${det.sdo_saldo_estoque}\n`;
            texto += `*m² por Caixa:* ${det.prd_m2_caixa}\n\n`;
            texto += `${det.prd_link_produto}`;

            try {
                const media = await MessageMedia.fromUrl(det.prd_link_img_produto, { unsafeMime: true });
                
                registrarLog({
                    phone: msg.from.replace(/\D/g, ""),
                    tipo: "consulta_texto",
                    mensagem: body,
                    info: { termo: termo }
                });
                // Envia imagem + legenda juntos
                await client.sendMessage(msg.from, media, {
                    caption: texto
                });

            } catch (imgErr) {
                console.log("Erro ao carregar imagem:", imgErr.message);
                return msg.reply(texto); // fallback
            }

        } catch (e) {
            console.error("Erro na API Delta:", e.message);
            return msg.reply("❌ Erro ao consultar produto na API.");
        }
    }


    function sqlGet(sql, params) {
        return new Promise(resolve => {
            db.get(sql, params, (err, row) => {
            resolve(row || null);
            });
        });
    }

    function sqlAll(sql, params) {
        return new Promise(resolve => {
            db.all(sql, params, (err, rows) => {
            resolve(rows || []);
            });
        });
    }


  const termo = body.toLowerCase();

  console.log(`🔎 Handler texto recebeu: ${termo}`);

  // 1 — Consulta por CD (ex: cd 3186)
  if (termo.startsWith("cd ")) {
    const codigo = termo.replace("cd ", "").trim();
    return buscarPorCodigo(client, msg, codigo);
  }

  // 2 — Referência "3186-A"
  if (/^\d{3,5}-[a-zA-Z]$/.test(termo)) {
    return buscarPorReferencia(client, msg, termo.toUpperCase());
  }

  // 3 — EAN 13
  if (/^\d{13}$/.test(termo)) {
    return buscarPorEAN(client, msg, termo);
  }

  // 3.5 — Apenas número (ex: "2201") → tratar como referência
  if (/^\d{3,5}$/.test(termo)) {
    return buscarPorReferencia(client, msg, termo);
  }

  // 4 — Busca por NOME no SQLite
  return buscarPorNome(client, msg, termo);

};
