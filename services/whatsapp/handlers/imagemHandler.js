const fs = require("fs");
const { MessageMedia } = require("whatsapp-web.js");
const child_process = require("child_process");
const db = require("../../../db/db");
const deltaApi = require("../../deltaApi");

module.exports = async function imagemHandler(client, msg, usuario) {
    console.log("🖼️ Recebida imagem. Baixando arquivo...");

    try {
        // 1 — Baixa a imagem
        const media = await msg.downloadMedia();

        if (!media) {
            console.log("❌ Falha ao baixar imagem.");
            return msg.reply("❌ Não consegui baixar a imagem.");
        }

        // 2 — Salva temporariamente
        const filename = `temp_${Date.now()}.jpg`;
        const filepath = `./temp/${filename}`;

        fs.mkdirSync("./temp", { recursive: true });
        fs.writeFileSync(filepath, media.data, { encoding: "base64" });

        console.log("📸 Imagem salva em:", filepath);

        // 3 — Decodificar QR usando Inlite CLI
        const qr = await decodeQR(filepath);

        if (!qr) {
            return msg.reply("❌ Não foi possível ler o QR Code dessa imagem.");
        }

        console.log("🔍 QR decodificado:", qr);

        // 4 — Extrair ID do QR Delta
        const id = extrairIdDoQR(qr);

        if (!id) {
            return msg.reply("❌ Não encontrei ID de produto no QR.");
        }

        console.log("🆔 ID extraído do QR:", id);

        // 5 — Buscar no SQLite
        const row = await sqlGet(
            `SELECT * FROM produtos_delta WHERE id_site = ?`,
            [id]
        );

        if (!row) {
            return msg.reply("❌ Produto não encontrado no banco local.");
        }

        // 6 — Reusar responderProduto do textoHandler
        const textoHandler = require("./textoHandler");
        return textoHandler(client, msg, row.cod_produto, usuario);

    } catch (err) {
        console.error("❌ Erro no handler de imagem:", err);
        return msg.reply("❌ Erro ao processar imagem.");
    }
};


function decodeQR(filepath) {
    return new Promise((resolve) => {
        try {
            const path = require("path");
            const INLITE = path.join(__dirname, "../../../inlite/bin/BarcodeReaderCLI");

            const cmd = `${INLITE} decode "${filepath}" --json`;

            console.log("Executando CLI:", cmd);

            const result = child_process.execSync(cmd).toString();

            const json = JSON.parse(result);

            if (json?.Barcodes?.length) {
                resolve(json.Barcodes[0].Text);
            } else {
                resolve(null);
            }
        } catch (err) {
            resolve(null);
        }
    });
}

function extrairIdDoQR(text) {
    const match = text.match(/id=(\d+)/i);
    return match ? match[1] : null;
}

function sqlGet(sql, params) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row || null));
    });
}
