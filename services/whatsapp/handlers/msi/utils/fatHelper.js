const { pool } = require('../../../../services/dbService');
const { createCanvas } = require('canvas');
const fs = require('fs');

async function gerarFaturamento(periodoTexto) {
    // 1) Interpretar datas
    const { dataInicio, dataFim } = parsePeriodo(periodoTexto);

    // 2) Buscar dados reais no banco
    const { rows } = await pool.query(
        `
        SELECT 
            SUM(saidas) AS saidas, 
            local, 
            TO_CHAR(SUM(faturamento), '9g999g999d99') AS faturamento 
        FROM vp_jlf_whatsapp_consulta_faturamento_local 
        WHERE dataoperacao::date BETWEEN $1 AND $2
        GROUP BY 2
        ORDER BY 1
        `,
        [dataInicio, dataFim]
    );

    // 3) Gerar imagem com os dados
    const filePath = await gerarImagemFaturamento(rows, dataInicio, dataFim);

    return filePath;
}

/* ---------------------------------------------------------------
   FUNÇÃO: interpretar o período enviado pelo usuário
-----------------------------------------------------------------*/
function parsePeriodo(texto) {
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    texto = texto.trim().toUpperCase();

    // HOJE
    if (texto === "HOJE") {
        const d = formatISO(hoje);
        return { dataInicio: d, dataFim: d };
    }

    // ONTEM
    if (texto === "ONTEM") {
        const d = formatISO(ontem);
        return { dataInicio: d, dataFim: d };
    }

    // Mais de uma data? Separar
    const partes = texto.split(" ").filter(x => x);

    if (partes.length === 1) {
        const unica = parseDataFlex(partes[0]);
        return { dataInicio: unica, dataFim: unica };
    }

    if (partes.length === 2) {
        const ini = parseDataFlex(partes[0]);
        const fim = parseDataFlex(partes[1]);
        return { dataInicio: ini, dataFim: fim };
    }

    throw new Error("Formato inválido. Use: FAT HOJE | FAT 15 | FAT 10/01 | FAT 01/01/2025 31/01/2025");
}

/* Conversão flexível de datas */
function parseDataFlex(d) {
    const hoje = new Date();
    const partes = d.split("/");

    let dia, mes, ano;

    if (partes.length === 1) {
        dia = partes[0].padStart(2, "0");
        mes = String(hoje.getMonth() + 1).padStart(2, "0");
        ano = String(hoje.getFullYear());
    } else if (partes.length === 2) {
        dia = partes[0].padStart(2, "0");
        mes = partes[1].padStart(2, "0");
        ano = String(hoje.getFullYear());
    } else if (partes.length === 3) {
        dia = partes[0].padStart(2, "0");
        mes = partes[1].padStart(2, "0");
        ano = partes[2];
    } else {
        throw new Error("Data inválida.");
    }

    return `${ano}-${mes}-${dia}`;
}

function formatISO(dateObj) {
    return dateObj.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------
   GERAR IMAGEM DO RELATÓRIO
-----------------------------------------------------------------*/
async function gerarImagemFaturamento(rows, dataInicio, dataFim) {
    const height = 300 + rows.length * 40;
    const width = 1100;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // fundo branco
    ctx.fillStyle = "#FFF";
    ctx.fillRect(0, 0, width, height);

    // título
    ctx.fillStyle = "#000";
    ctx.font = "bold 36px Arial";
    ctx.fillText("FATURAMENTO POR LOCAL", 30, 50);

    ctx.font = "22px Arial";
    ctx.fillText(`Período: ${formatBR(dataInicio)} até ${formatBR(dataFim)}`, 30, 100);

    // Cabeçalho
    let y = 150;
    ctx.font = "bold 22px Arial";
    ctx.fillText("Local", 30, y);
    ctx.fillText("Faturamento (R$)", 350, y);
    ctx.fillText("Saídas", 750, y);

    ctx.beginPath();
    ctx.moveTo(20, y + 10);
    ctx.lineTo(1080, y + 10);
    ctx.stroke();

    // linhas
    let totalFat = 0;
    let totalSai = 0;
    y += 40;
    ctx.font = "20px Arial";

    rows.forEach(r => {
        const fatNum = Number(String(r.faturamento).replace(/\./g, '').replace(',', '.'));

        ctx.fillText(r.local, 30, y);
        ctx.fillText(r.faturamento, 350, y);
        ctx.fillText(r.saidas, 750, y);

        totalFat += fatNum;
        totalSai += Number(r.saidas);

        y += 40;
    });

    // Totalização
    ctx.font = "bold 24px Arial";
    ctx.fillText("TOTAL", 30, y + 30);
    ctx.fillText(totalFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 350, y + 30);
    ctx.fillText(String(totalSai), 750, y + 30);

    // Salva arquivo
    const file = `/tmp/faturamento_${Date.now()}.png`;
    fs.writeFileSync(file, canvas.toBuffer("image/png"));

    return file;
}

function formatBR(dt) {
    const [y, m, d] = dt.split("-");
    return `${d}/${m}/${y}`;
}

module.exports = { gerarFaturamento };
