// decoder.js — módulo universal de decodificação GS1 / QR / EAN para o projeto DELTA

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DECODER_BIN = process.env.DECODER_BIN || "./inlite/bin/BarcodeReaderCLI";

// =========================
// Utilidades
// =========================
function writeTempImage(media) {
  const ext = (() => {
    const mt = (media.mimetype || "").toLowerCase();
    if (mt.includes("png")) return ".png";
    if (mt.includes("jpeg") || mt.includes("jpg")) return ".jpg";
    if (mt.includes("webp")) return ".webp";
    return ".img";
  })();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "delta-"));
  const file = path.join(dir, `img${ext}`);
  fs.writeFileSync(file, Buffer.from(media.data, "base64"));
  return { dir, file };
}

function cleanupTemp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function base64ToBinaryString(b64) {
  return Buffer.from(b64, "base64").toString("latin1");
}

function normalizeGTIN(gtin) {
  if (!gtin) return gtin;
  const s = String(gtin).trim();
  if (s.length === 14 && s.startsWith("0")) return s.substring(1);
  return s;
}

// =========================
// AIs GS1 suportados
// =========================
const AI_DEFS = {
  "01": { label: "GTIN", len: 14 },
  "11": { label: "Fabricação", len: 6 },
  "17": { label: "Validade", len: 6 },
  "10": { label: "Lote", len: null },        // variável
  "21": { label: "Série", len: null },
  "240": { label: "Tonalidade", len: null },
  "90": { label: "Bitola", len: null },
};

const AI_ORDER = ["240", "01", "11", "17", "10", "21", "90"];

// =========================
// Parser GS1 baseado em GS (0x1D)
// =========================
function parseGS1FromBinaryString(binStr) {
  const GS = String.fromCharCode(0x1D);
  const segments = binStr.split(GS);
  const out = {};

  for (const seg of segments) {
    let i = 0;
    while (i < seg.length) {
      let foundAI = null;
      for (const ai of AI_ORDER) {
        if (seg.startsWith(ai, i)) {
          foundAI = ai;
          break;
        }
      }
      if (!foundAI) {
        i += 1;
        continue;
      }

      const def = AI_DEFS[foundAI];
      i += foundAI.length;

      if (def.len != null) {
        if (i + def.len > seg.length) break;
        const value = seg.substring(i, i + def.len);
        i += def.len;
        if (!out[def.label]) out[def.label] = value;
      } else {
        const value = seg.substring(i);
        i = seg.length;
        if (!out[def.label]) out[def.label] = value;
      }
    }
  }

  return out;
}

// =========================
// Parser linear (fallback sem GS)
// =========================
function parseGS1FromBinaryLinear(s) {
  const out = {};
  let i = 0;

  while (i < s.length) {
    let foundAI = null;

    for (const ai of AI_ORDER) {
      if (s.startsWith(ai, i)) {
        foundAI = ai;
        break;
      }
    }

    if (!foundAI) break;

    const def = AI_DEFS[foundAI];
    i += foundAI.length;

    if (def.len != null) {
      if (i + def.len > s.length) break;
      const value = s.substring(i, i + def.len);
      i += def.len;
      if (!out[def.label]) out[def.label] = value;
    } else {
      let nextPos = s.length;
      for (const ai of AI_ORDER) {
        const pos = s.indexOf(ai, i);
        if (pos !== -1 && pos < nextPos) nextPos = pos;
      }
      const value = s.substring(i, nextPos);
      i = nextPos;
      if (!out[def.label]) out[def.label] = value;
    }
  }

  return out;
}

// =========================
// Detecta QR Delta (com ID)
// =========================
function extrairIdDoQR(text) {
  if (!text) return null;
  const match = String(text).match(/id=(\d+)/i);
  return match ? match[1] : null;
}

// =========================
// Detecta Digital Link GS1
// Exemplo: https://site.com/01/07899811223344/10/LOTEXYZ
// =========================
function parseDigitalLink(url) {
  if (!url.includes("/01/")) return null;

  const parts = url.split("/");
  const idx = parts.indexOf("01");
  if (idx === -1 || !parts[idx + 1]) return null;

  const gtin = parts[idx + 1];
  let lote = null;

  const idx10 = parts.indexOf("10");
  if (idx10 !== -1 && parts[idx10 + 1]) lote = parts[idx10 + 1];

  return {
    GTIN: normalizeGTIN(gtin),
    Lote: lote || null
  };
}

// =========================
// Função principal de decodificação
// =========================
async function decodeImage(media) {
  const tmp = writeTempImage(media);

  try {
    const args = [
      "-type=datamatrix,qr,ucc128,ean13,ean8,code128,code39",
      "-format=json",
      "-fields=text,data,type,length",
      tmp.file,
    ];

    const rawJson = await new Promise((resolve, reject) => {
      execFile(DECODER_BIN, args, { timeout: 15000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(String(stdout || "").trim());
      });
    });

    const payload = JSON.parse(rawJson);
    const bar = payload?.sessions?.[0]?.barcodes?.[0];

    if (!bar) return { type: "NONE" };

    const text = bar.text || "";
    const dataB64 = bar.data || "";
    const type = (bar.type || "").toUpperCase();

    // 1) QR Delta com id=XXXX
    const idDelta = extrairIdDoQR(text);
    if (idDelta) {
      return {
        type: "QR_DELTA",
        raw: text,
        id: idDelta
      };
    }

    // 2) Digital Link
    if (text.startsWith("http")) {
      const dl = parseDigitalLink(text);
      if (dl?.GTIN) {
        return {
          type: "DIGITAL_LINK",
          raw: text,
          gtin: dl.GTIN,
          lote: dl.Lote
        };
      }
    }

    // 3) EAN13 puro
    if (/^\d{12,13}$/.test(text)) {
      return {
        type: "EAN13",
        raw: text,
        gtin: normalizeGTIN(text)
      };
    }

    // 4) DataMatrix GS1 (via dataB64 com GS)
    if (dataB64) {
      const bin = base64ToBinaryString(dataB64);
      const parsed = parseGS1FromBinaryString(bin);
      if (parsed.GTIN) {
        return {
          type: "GS1",
          raw: text,
          gtin: normalizeGTIN(parsed.GTIN),
          lote: parsed.Lote || null,
          aiset: parsed
        };
      }
    }

    // 5) fallback linear (texto sem GS)
    if (text) {
      const parsed = parseGS1FromBinaryLinear(text.replace(/[^\x20-\x7E]+/g, ""));
      if (parsed.GTIN) {
        return {
          type: "GS1_LINEAR",
          raw: text,
          gtin: normalizeGTIN(parsed.GTIN),
          lote: parsed.Lote || null,
          aiset: parsed
        };
      }
    }

    return { type: "UNKNOWN", raw: text };
  } finally {
    cleanupTemp(tmp.dir);
  }
}

module.exports = {
  decodeImage
};
