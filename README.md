# Orbi — Sua direção, nosso compromisso.

Plataforma de mobilidade: site institucional, aplicativo do passageiro, aplicativo do motorista e painel administrativo, todos com os mesmos dados.

## Como rodar

Requer Node 22 ou mais novo.

```bash
npm install
npm run admin:create -- "Seu Nome" voce@empresa.com admin   # mostra a senha uma única vez
npm run dev                                                 # http://localhost:3000
```

O banco embutido (PGlite) fica em `.data/` e é criado sozinho. Pare o servidor antes de rodar `admin:create`, porque esse banco aceita um processo por vez.

| Endereço | O que é |
|---|---|
| `/` | Site |
| `/identidade` | As 4 identidades visuais, lado a lado, para escolher |
| `/status` | O que funciona, o que depende de terceiros e o que é demonstração |
| `/entrar` | Entrada única: o celular identifica quem já tem conta e leva quem é novo ao cadastro |
| `/passageiro`, `/motorista` | Aplicativos |
| `/admin` | Painel administrativo |

Para testar uma corrida sem GPS, entre como motorista e marque "Modo de teste", que deixa escolher a posição no mapa. Esse modo fica desligado em produção. A corrida exige um motorista com documentos, veículo e cadastro aprovados em `/admin/motoristas`.

## Testes

```bash
npm test                              # regras de preço, distribuição, permissões e estados
npx next build && npm run test:e2e    # corrida completa em navegador real, com banco descartável
```

Os testes de ponta a ponta usam `.data-e2e/`, apagado a cada execução, e nunca tocam no banco de desenvolvimento.

## Organização

```
src/domain/      Regras puras: preço, distribuição de corridas, permissões, estados da corrida
src/server/      Motor de corridas, autenticação, mapas, pagamentos, eventos em tempo real
src/db/          Esquema, migrações e configuração inicial
src/app/api/     APIs REST
src/app/(site)/  Site institucional
src/app/passageiro, motorista, admin/   Aplicativos
src/lib/identities.ts + src/app/globals.css   As 4 identidades visuais
```

## Decisões que valem saber

- **Comissão:** nunca é fixa no código. Fica em cada tarifa (cidade + categoria), e um plano ativo pode substituí-la. As tarifas iniciais são marcadas como pendentes até um gestor revisá-las.
- **Quem paga o quê:** a comissão incide só sobre o valor bruto. Cupom é custeado pela Orbi e não reduz o líquido do motorista. A taxa de serviço é paga pelo passageiro.
- **Corrida em dinheiro:** o motorista recebe tudo em mãos, e a parte da Orbi vira débito no saldo dele. Por isso o saldo pode ficar negativo.
- **Distribuição:** cada critério vira uma nota de 0 a 1, com pesos ajustáveis em `/admin/configuracoes`. Motorista novo começa com valores neutros, sem punição por falta de histórico.
- **Sem dados inventados:** a configuração inicial cria só cidades, modalidades, categorias e tarifas. Motoristas, corridas, pagamentos e parceiros só existem quando alguém os cadastra.
- **Conferência de dados:** `src/domain/validation.ts` confere CPF, CNH, CNPJ, placa, celular e chave Pix sem serviço externo; `src/server/verify.ts` consulta o domínio do e-mail (DNS) e o CEP (ViaCEP). Isso barra erros e números inventados, mas não prova que o dado é da pessoa: para isso faltam SMS, link por e-mail e consulta a bases oficiais.
- **Novas cidades e modalidades:** cidade nova se resolve no painel (região + tarifas). Moto, motofrete, entregas e corporativo já existem como modalidades desligadas, com documentos próprios, mas ainda precisam das telas específicas.

## Antes de operar de verdade

1. Definir `DATABASE_URL` (há um `docker-compose.yml` com PostgreSQL) e `AUTH_SECRET`. O projeto só foi executado com o banco embutido: rode os testes contra o PostgreSQL real antes de confiar nele.
2. Guardar os documentos em armazenamento privado e criptografado. Hoje ficam no disco do servidor, em `.data/uploads`.
3. Contratar ou hospedar mapas, rotas e busca de endereços. Os serviços públicos usados agora (OpenFreeMap, OSRM, Photon) têm limites e não servem para produção.
4. Testar o Pix com credencial de sandbox e implementar cartão e transferência de saque.
5. Trocar o canal de eventos (`src/server/bus.ts`) e o limite de tentativas de login (`src/server/auth.ts`) por Redis se houver mais de uma instância: os dois funcionam em um único processo.
6. Revisar juridicamente os termos e a política de privacidade, que são minutas, e checar a regulamentação municipal de transporte por aplicativo.

## Créditos

Modelo 3D: "Car Concept", de Eric Chadwick / Darmstadt Graphics Group, CC BY 4.0, de um modelo original em domínio público de Unity Fan. Modificado pela Orbi: cores, remoção de marcas de terceiros e compressão (`scripts/build-car-model.ts`). Mapas © colaboradores do OpenStreetMap.
