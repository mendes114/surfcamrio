# Surf Cam Rio

Painel open source com cameras de surf ao vivo do Rio de Janeiro.

## Praias cobertas

- **Recreio** — Macumba, Prainha, Recreio
- **Barra da Tijuca** — Reserva, Meio da Barra, Postinho, Posto 6
- **Zona Sul** — Sao Conrado, Leblon, Ipanema, Arpoador, Copacabana, Leme

## Como rodar

```bash
git clone <repo>
cd cameras-recreio-macumba
node src/server.mjs
```

Abre http://localhost:3456

Requer Node.js 18+. Sem dependencias externas.

## Como funciona

O servidor agrega streams HLS publicos de diversas fontes e o frontend toca direto no browser do usuario via hls.js. Nenhum stream passa pelo servidor — o browser conecta direto na origem.

- Lazy loading: maximo 8 players simultaneos, o resto mostra botao de play
- Deduplicacao automatica de cameras que aparecem em mais de uma fonte
- Atualiza a cada 2 minutos

## Aviso legal

Este projeto agrega links publicos de streams de cameras de surf disponibilizados abertamente na internet, sem autenticacao. Nao tem afiliacao com nenhum provedor de cameras. Os streams pertencem aos seus respectivos donos. Se voce eh dono de algum stream e quer que ele seja removido, abra uma issue.

## Licenca

MIT
