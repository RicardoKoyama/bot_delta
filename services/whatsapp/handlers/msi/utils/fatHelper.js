const { pool } = require('../../../../../services/dbService');
const { gerarGraficoPizza } = require('./graphUtils'); 
const { MessageMedia } = require('whatsapp-web.js');

/* ============================================================
   FUNÇÃO PRINCIPAL: gera texto + gráfico
============================================================ */
async function gerarFaturamento(periodoTexto) {
    // 1) Interpretar datas
    const { dataInicio, dataFim } = parsePeriodo(periodoTexto);

    // 2) Consultar dados reais
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

    const rowsAnon = rows.map((item, index) => ({
        ...item,
        local_original: item.local,
        local: `Empresa ${index + 1}`
    }));

    // 3) Gerar texto bonito
    const texto = buildMensagem(rowsAnon, dataInicio, dataFim);

    // 4) Gerar gráfico (buffer)
    let buffer = null;
    if (rows.length > 0) {
        buffer = await gerarGraficoPizza(rowsAnon, "Faturamento por Local", "local");
    }

    return { texto, buffer };
}

/* ============================================================
   FORMATAÇÃO DE TEXTO
============================================================ */
function buildMensagem(lista, ini, fim) {
    const periodo = formatBR(ini) + (ini !== fim ? ` até ${formatBR(fim)}` : "");

    let msg = `🔍 *RESULTADOS DA CONSULTA*\n📅 Período: ${periodo}\n\n`;

    if (lista.length === 0) {
        msg += "Nenhum dado encontrado.";
        return msg;
    }

    lista.forEach((item) => {
        msg += `*${item.local.trim()}*\n`;
        msg += `💰 Faturamento: R$ ${item.faturamento}\n`;
        msg += `📦 Saídas: ${item.saidas}\n\n`;
    });

    return msg;
}

/* ============================================================
   INTERPRETAÇÃO DO PERÍODO
============================================================ */
function parsePeriodo(texto) {
    texto = texto.trim().toUpperCase();
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    if (texto === "HOJE") return fix(hoje, hoje);
    if (texto === "ONTEM") return fix(ontem, ontem);

    const partes = texto.split(" ").filter(Boolean);

    if (partes.length === 1) {
        const dt = parseDataFlex(partes[0]);
        return { dataInicio: dt, dataFim: dt };
    }

    if (partes.length === 2) {
        return {
            dataInicio: parseDataFlex(partes[0]),
            dataFim: parseDataFlex(partes[1])
        };
    }

    throw new Error("Período inválido.");
}

function fix(a, b) {
    return {
        dataInicio: a.toISOString().slice(0,10),
        dataFim: b.toISOString().slice(0,10)
    };
}

function parseDataFlex(str) {
    const hoje = new Date();
    const partes = str.split("/");
    let dia, mes, ano;

    if (partes.length === 1) {
        dia = partes[0].padStart(2, "0");
        mes = String(hoje.getMonth() + 1).padStart(2, "0");
        ano = hoje.getFullYear();
    } else if (partes.length === 2) {
        dia = partes[0].padStart(2, "0");
        mes = partes[1].padStart(2, "0");
        ano = hoje.getFullYear();
    } else {
        dia = partes[0].padStart(2, "0");
        mes = partes[1].padStart(2, "0");
        ano = partes[2];
    }

    return `${ano}-${mes}-${dia}`;
}

function formatBR(dt) {
    const [y, m, d] = dt.split("-");
    return `${d}/${m}/${y}`;
}

module.exports = { gerarFaturamento };
