/**
 * Câmeras via iframe — players públicos embeddáveis (JMVStream, etc.)
 */

const CAMERAS_IFRAME = [
  {
    id: 'iframe-praiabarra',
    titulo: 'Praia da Barra da Tijuca',
    iframeUrl: 'https://player.jmvstream.com/ipcam/qSFHf1xz4MbxfE6hHibOwxs5SwBgrw',
    zona: 'barra',
    fonte: 'praiabarra',
  },
];

export function buscarCamerasIframe() {
  return CAMERAS_IFRAME.map((cam) => ({
    ...cam,
    streamType: 'iframe',
  }));
}
