const fs = require("fs");
const child_process = require("child_process");
const db = require("../../../db/db");

module.exports = async function imagemHandler(client, msg, usuario) {
    console.log("🖼️ Recebida imagem. Baixando arquivo...");

    try {
        const media = await msg.downloadMedia();
        if (!media) {
            console.log("❌ Falha ao baixar imagem.");
            return msg.reply("❌ Não consegui baixar a imagem.");
        }

        const filename = `temp_${Date.now()}.jpg`;
        const filepath = `./temp/${filename}`;

        fs.mkdirSync("./temp", { recursive: true });
        fs.writeFileSync(filepath, media.data, { encoding: "base64" });

        console.log("📸 Imagem salva em:", filepath);

        const qr = await decodeCodigo(filepath);

        if (!qr) {
            return msg.reply("❌ Não consegui ler nenhum código dessa imagem.");
        }

        console.log("🔍 Código lido:", qr);

        const textoHandler = require("./textoHandler");

        // ============================================================
        // 🔥 1 — Se é EAN (12 a 13 dígitos)
        // ============================================================
        if (/^\d{12,13}$/.test(qr.trim())) {
            const ean = qr.trim();
            console.log("📦 Código reconhecido como EAN:", ean);

            const row = await sqlGet(
                `SELECT * FROM produtos_delta WHERE ean = ?`,
                [ean]
            );

            if (!row) {
                return msg.reply("❌ Nenhum produto encontrado para esse EAN.");
            }

            return textoHandler(client, msg, row.cod_produto, usuario);
        }

        // ============================================================
        // 🔥 2 — QR Delta contendo id=1234
        // ============================================================
        const id = extrairIdDoQR(qr);
        if (id) {
            console.log("🆔 ID extraído do QR:", id);

            const row = await sqlGet(
                `SELECT * FROM produtos_delta WHERE id_site = ?`,
                [id]
            );

            if (!row) {
                return msg.reply("❌ Produto não encontrado no banco local.");
            }

            return textoHandler(client, msg, row.cod_produto, usuario);
        }

        // ============================================================
        // 🔥 3 — Caso não seja EAN e nem QR Delta
        // ============================================================
        return msg.reply("❌ Código não reconhecido como EAN ou QR válido.");

    } catch (err) {
        console.error("❌ Erro no handler de imagem:", err);
        return msg.reply("❌ Erro ao processar imagem.");
    }
};


// ============================================================
// Função — Decode com Inlite CLI
// ============================================================
function decodeCodigo(filepath) {
    return new Promise((resolve) => {
        try {
            const path = require("path");
            const INLITE = path.join(__dirname, "../../../inlite/bin/BarcodeReaderCLI");

            const cmd = `${INLITE} "${filepath}"`;
            console.log("Executando CLI:", cmd);

            const result = child_process.execSync(cmd).toString();
            console.log("🔎 Saída do BarcodeReaderCLI:\n", result);

            try {
                const json = JSON.parse(result);
                const bc = json?.sessions?.[0]?.barcodes?.[0];
                if (bc?.text) return resolve(bc.text.trim());
            } catch (_) {}

            const linhas = result.split("\n").map(l => l.trim()).filter(Boolean);
            if (linhas.length) return resolve(linhas[linhas.length - 1]);

            resolve(null);

        } catch (err) {
            console.error("❌ Erro ao decodificar:", err);
            resolve(null);
        }
    });
}


// ============================================================
// Extrai id=XXXX do QR da Delta
// ============================================================
function extrairIdDoQR(texto) {
    const m = String(texto).match(/id=(\d+)/i);
    return m ? m[1] : null;
}


// ============================================================
// Query SQLite
// ============================================================
function sqlGet(sql, params) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row || null));
    });
}
