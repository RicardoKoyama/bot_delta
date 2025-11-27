const axios = require('axios');
require('dotenv').config();

const BASE = "https://portal-api.deltaceramica.com.br/api/v1/consulta_estoque";
const TOKEN = process.env.DELTA_API_KEY;

const headers = {
  "accept": "application/json",
  "content-type": "application/json",
  "apikey": TOKEN,
  "User-Agent": "PostmanRuntime/7.32.3"
};


async function listaCompleta() {
  const res = await axios.get(`${BASE}`, { headers });
  return res.data;
}

async function detalhes(cod) {
  const res = await axios.get(`${BASE}/${cod}`, { headers });
  return res.data;
}

module.exports = { listaCompleta, detalhes };
