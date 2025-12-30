const estados = new Map();

function getEstado(lid) {
  return estados.get(lid) || 'inicio';
}

function setEstado(lid, estado) {
  estados.set(lid, estado);
}

module.exports = {
  getEstado,
  setEstado
};
