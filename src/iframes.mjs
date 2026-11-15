/**
 * Câmeras externas — links para sites com player próprio (não embeddável).
 */

const CAMERAS_EXTERNAS = [
  {
    id: 'ext-praiabarra',
    titulo: 'Praia da Barra · 24h (PraiaBarra)',
    linkExterno: 'https://praiabarra.com.br/',
    zona: 'barra',
    fonte: 'praiabarra',
  },
];

export function buscarCamerasIframe() {
  return CAMERAS_EXTERNAS.map((cam) => ({
    ...cam,
    streamType: 'externo',
  }));
}
