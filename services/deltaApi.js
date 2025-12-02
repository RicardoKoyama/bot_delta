const axios = require('axios');
require('dotenv').config();

const BASE = process.env.DELTA_API_URL;

async function listaCompleta(tokenUsuario = null) {
    const apikey = tokenUsuario || process.env.DELTA_API_KEY;

    const headers = {
        accept: "application/json",
        "content-type": "application/json",
        apikey,
        "User-Agent": "PostmanRuntime/7.32.3"
    };
  const res = await axios.get(`${BASE}`, { headers });
  return res.data;
}

async function detalhes(cod, tokenUsuario = null) {
    const apikey = tokenUsuario || process.env.DELTA_API_KEY;

    const headers = {
        accept: "application/json",
        "content-type": "application/json",
        apikey,
        "User-Agent": "PostmanRuntime/7.32.3"
    };

    const res = await axios.get(`${BASE}/${cod}`, { headers });
    return res.data;
}


module.exports = { listaCompleta, detalhes };
