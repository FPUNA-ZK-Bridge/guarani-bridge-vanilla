<div align="center">

# 🪶 Guarani Bridge (Vanilla)

### *Implementación baseline del puente cross-chain — sin Zero-Knowledge*

[![Status](https://img.shields.io/badge/Status-Baseline-blue?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](#-licencia)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.x-363636?style=flat-square&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-FFF100?style=flat-square&logo=hardhat&logoColor=black)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-363636?style=flat-square)](https://book.getfoundry.sh/)

[**🚀 Quick Start**](#-quick-start) ·
[**🌉 Cómo funciona**](#-cómo-funciona) ·
[**⚖️ Comparación con la versión ZK**](#%EF%B8%8F-rol-en-la-investigación) ·
[**🐛 Troubleshooting**](#-troubleshooting)

</div>

---

## 🎓 Sobre este repositorio

Este repositorio es el **baseline experimental** del proyecto de investigación [**FPUNA-ZK-Bridge**](https://github.com/FPUNA-ZK-Bridge), desarrollado en la **Facultad Politécnica – Universidad Nacional de Asunción (FP-UNA)**.

`guarani-bridge-vanilla` implementa un puente de tokens entre dos cadenas (L1 ↔ L2) bajo el patrón **Lock-and-Mint**, **sin ninguna verificación criptográfica de Zero-Knowledge**. Es la versión "ingenua" del bridge — la que confía en el relayer.

> 💡 **Por qué existe:** *Para tener una referencia sin ZK contra la cual medir el costo, complejidad y beneficios de seguridad de [`zk-guarani-bridge`](https://github.com/FPUNA-ZK-Bridge/zk-guarani-bridge).*

---

## ⚖️ Rol en la investigación

Este es el **bridge baseline sin ZK** dentro de la organización. La existencia de este repo se justifica como punto de comparación con la versión que sí incorpora pruebas Groth16:

| Aspecto | `guarani-bridge-vanilla` (este) | [`zk-guarani-bridge`](https://github.com/FPUNA-ZK-Bridge/zk-guarani-bridge) |
|---|---|---|
| **Modelo de confianza** | Confía en que el relayer no miente | Verifica criptográficamente — el relayer no puede falsificar |
| **Verificación on-chain** | Solo `onlyRelayer` (control de roles) | `onlyRelayer` **+** `Groth16Verifier.verify(proof)` |
| **Gas en L2 (mint)** | Bajo — sólo escribir balances | Alto — verificar pairing BLS12-381 |
| **Tiempo del relayer** | Inmediato — solo reenviar evento | Lento — generar prueba Groth16 |
| **Trusted setup** | No requiere | Requiere Powers of Tau (`pot22`) |
| **Superficie de ataque** | Compromiso del relayer = pérdida de fondos | Compromiso del relayer = denegación de servicio (no robo) |
| **Complejidad de setup** | Mínima (3 comandos) | Alta (compilar circuito, ceremony, generar verifier) |

> ⚠️ **Importante:** este bridge **no debe usarse en producción**. Su seguridad depende enteramente de un relayer honesto. Su valor es académico, didáctico y comparativo.

---

## ✨ Características

- 🔒 **Lock-and-Mint** con protección anti-replay vía nonces incrementales
- 🤖 **Relayer automatizado** que escucha eventos y ejecuta transferencias en la cadena destino
- 🌐 **Doble entorno** — local (Hardhat + Anvil) y testnet (Ephemery + BlockDAG) controlado por una sola variable
- 🐳 **Docker Compose** para correr todo en contenedores
- 🖥️ **Frontend web** opcional para interactuar sin escribir scripts

---

## 🚀 Quick Start

Todo el proyecto se controla con una sola variable: `BRIDGE_ENV` en `.env`.

### Local (default)

```bash
npm install

# Terminal 1 — L1 (Hardhat, puerto 8545)
npm run node:n1

# Terminal 2 — L2 (Anvil, puerto 9545)
npm run node:n2

# Terminal 3 — Deploy y relayer
npm run deploy:n1        # despliega en localN1
npm run deploy:n2        # despliega en localN2
npm run relayer
```

Las cuentas locales se derivan automáticamente del mnemonic de Hardhat — **no se necesitan private keys** ni configurar nada más.

### Testnet

```bash
# 1. Cambiar en .env:
BRIDGE_ENV=testnet

# 2. Completar las private keys en .env (ver .env.example)

# 3. Deploy y relayer (no se necesitan nodos locales)
npm run deploy:n1        # despliega en Ephemery
npm run deploy:n2        # despliega en BlockDAG
npm run relayer
```

### Frontend *(opcional, ambos entornos)*

```bash
npm run config           # genera config del frontend desde deploy-*.json
npm run frontend         # http://localhost:3000
```

---

## 🌉 Cómo funciona

```text
    L1 (Chain N1)                              L2 (Chain N2)
    ┌─────────────────────────┐                ┌─────────────────────────┐
    │  GuaraniToken (ERC20)   │                │  GuaraniToken (ERC20)   │
    │  Sender Contract        │                │  Receiver Contract      │
    └────────────┬────────────┘                └────────────▲────────────┘
                 │                                          │
                 │ 1. lock(recipient, amount)               │ 3. mintRemote()
                 │    tokens bloqueados                     │    tokens creados en L2
                 │    emite evento "Locked"                 │    emite evento "Minted"
                 │                                          │
                 └──────────────┐                           │
                                ▼                           │
                       ┌─────────────────┐                  │
                       │    RELAYER      │──────────────────┘
                       │                 │
                       │ 2. Escucha      │
                       │    "Locked"     │
                       └─────────────────┘
```

### Flujo de una transferencia

1. El usuario aprueba tokens al contrato `Sender` en L1.
2. El usuario llama `lock(recipientL2, amount)` → los tokens se bloquean y se emite el evento `Locked`.
3. El relayer detecta el evento y ejecuta `mintRemote()` en el `Receiver` de L2.
4. Se acuñan tokens equivalentes para el destinatario en L2.

> 🔑 **El paso 3 es donde aparece la diferencia con la versión ZK.** Acá el `Receiver` confía en `onlyRelayer`. En [`zk-guarani-bridge`](https://github.com/FPUNA-ZK-Bridge/zk-guarani-bridge), el `Receiver` además exige una prueba Groth16 válida del estado de origen.

---

## ⚙️ Configuración de entorno

El archivo `.env` controla todo. Copiá `.env.example` como punto de partida:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `BRIDGE_ENV` | `local` o `testnet` — única variable requerida para cambiar de entorno |
| `EPHEMERY_RPC_URL` | RPC de Ephemery (solo testnet) |
| `EPHEMERY_PRIVATE_KEY` | Private key para Ephemery (solo testnet) |
| `BLOCKDAG_RPC_URL` | RPC de BlockDAG (solo testnet) |
| `BLOCKDAG_PRIVATE_KEY` | Private key para BlockDAG (solo testnet) |
| `PRIVATE_KEY_RELAYER` | Private key del relayer (solo testnet) |
| `RELAYER_ADDRESS` | Dirección del relayer (solo testnet) |

**En modo local** todas las cuentas (deployer, relayer, usuarios) se derivan automáticamente del mnemonic de Hardhat. No hace falta configurar nada más.

---

## 🌐 Redes soportadas

| Entorno | L1 (N1) | L2 (N2) |
|---|---|---|
| `local` | Hardhat — `localhost:8545`, chainId `31337` | Anvil — `localhost:9545`, chainId `1338` |
| `testnet` | Ephemery — configurable vía `.env` | BlockDAG — configurable vía `.env` |

---

## 🐳 Docker Compose (alternativa)

Para correr todo en contenedores (usa redes Docker internas, independiente de `BRIDGE_ENV`):

```bash
docker compose build
docker compose up -d hardhat-n1 anvil-n2

# Esperar a que hardhat-n1 esté healthy
docker compose ps

# Deploy
docker compose run --rm deployer npx hardhat run scripts/deployN1.js --network dockerN1
docker compose run --rm deployer npx hardhat run scripts/deployN2.js --network dockerN2

# Servicios
docker compose up -d relayer frontend
```

- **Frontend**: http://localhost:3000
- **L1 RPC**: http://localhost:8545
- **L2 RPC**: http://localhost:9545

---

## 📜 Contratos

| Contrato | Descripción |
|---|---|
| `GuaraniToken.sol` | Token ERC20 con mint/burn y roles |
| `Sender.sol` | Bloquea tokens en L1, emite evento `Locked` |
| `Receiver.sol` | Acuña tokens en L2 tras verificación del relayer |
| `Verifier.sol` | Verificación criptográfica adicional *(opcional, placeholder en esta versión)* |

> 💡 En la versión ZK, `Verifier.sol` es un `Groth16Verifier.sol` real generado por `snarkjs`. Acá está como placeholder para mantener una API similar entre ambas versiones del bridge.

---

## 🔒 Seguridad

Este bridge implementa los siguientes controles:

- 🔢 **Nonce incremental** — cada transferencia tiene un ID único monótonamente creciente
- 🛡️ **Replay protection** — un mapping de transacciones procesadas en `Receiver` evita que el mismo evento se mintee dos veces
- 🎭 **Role-based access** — solo el relayer autorizado puede invocar `mintRemote()` en L2

> ⚠️ **Modelo de amenazas — qué este bridge NO protege:**
>
> - 🚨 **Relayer comprometido o malicioso.** Si la clave privada del relayer es robada (o el operador es deshonesto), el atacante puede minar tokens en L2 sin que existan tokens bloqueados en L1. **Este es exactamente el problema que la versión ZK resuelve.**
> - 🚨 **Reorgs en L1.** El relayer asume finalidad inmediata; un reorg suficientemente profundo podría llevar a inconsistencias entre L1 y L2.
> - 🚨 **Censura del relayer.** Si el relayer no procesa un evento, los fondos quedan bloqueados en L1 sin recurso. No hay mecanismo de retiro de emergencia.
>
> **Por estas razones este bridge es solo un baseline académico.** Para uso real ver la versión con verificación ZK.

---

## 🛠 Scripts útiles

```bash
npm run compile          # Compilar contratos
npm run deploy:n1        # Deploy en N1 (según BRIDGE_ENV)
npm run deploy:n2        # Deploy en N2 (según BRIDGE_ENV)
npm run relayer          # Iniciar relayer
npm run config           # Generar config del frontend
npm run frontend         # Servidor frontend en :3000

npm test                 # Todos los tests
npm run test:bridge      # Tests del puente
```

---

## 🦊 MetaMask (modo local)

| Red | RPC URL | Chain ID |
|---|---|---|
| L1 Hardhat | http://localhost:8545 | 31337 |
| L2 Anvil | http://localhost:9545 | 1338 |

Cuenta de prueba (pre-funded):

```
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

> ⚠️ **Solo para desarrollo local.** No usar nunca esta clave en testnet ni mainnet — es pública y compartida por cualquiera que use Hardhat.

---

## 📁 Estructura del proyecto

```
guarani-bridge-vanilla/
├── contracts/              # Contratos Solidity
├── scripts/                # Deploy y utilidades
│   ├── deployN1.js         # Deploy L1
│   ├── deployN2.js         # Deploy L2
│   └── resolve-network.js  # Resuelve red según BRIDGE_ENV
├── relayer/                # Servicio relayer (Node.js)
├── public/                 # Frontend web
├── utils/                  # Utilidades (accounts, etc.)
├── bridge-env.js           # Configuración centralizada local/testnet
├── hardhat.config.js       # Config de Hardhat (redes dinámicas)
├── deploy-N1.json          # Direcciones desplegadas en N1 (generado)
├── deploy-N2.json          # Direcciones desplegadas en N2 (generado)
└── bridge-config.json      # Config del frontend (generado)
```

---

## 🐛 Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Contract not found` en el frontend | Los contratos no están desplegados | Ejecutar `npm run deploy:n1` y `npm run deploy:n2` |
| `Internal JSON-RPC error` en MetaMask | Nonce desincronizado o sin tokens | Reset account en MetaMask y/o mintear tokens |
| Relayer no procesa eventos | Direcciones desactualizadas en `deploy-*.json` | Re-deployar y reiniciar el relayer |
| `Frontend: Contract not found` tras re-deploy | Falta regenerar config del frontend | Ejecutar `npm run config` |

---

## 🔗 Repositorios relacionados

| Repositorio | Rol |
|---|---|
| 🌟 [`zk-guarani-bridge`](https://github.com/FPUNA-ZK-Bridge/zk-guarani-bridge) | Versión con verificación Groth16 — la "evolución" de este baseline |
| 🛰️ [`ethereum-sync-committee-validator`](https://github.com/FPUNA-ZK-Bridge/ethereum-sync-committee-validator) | Construcción de inputs desde el beacon node |
| 🔑 [`verify-headers`](https://github.com/FPUNA-ZK-Bridge/verify-headers) | PoC de verificación BLS del sync committee |
| 🧪 [`ephemery-ethereum-testnet`](https://github.com/FPUNA-ZK-Bridge/ephemery-ethereum-testnet) | Nodo Ephemery dockerizado |

---

## 📄 Licencia

Este proyecto se distribuye bajo licencia **MIT**. Ver el archivo [`LICENSE`](LICENSE) para más detalles.

---

<div align="center">

### 🎓 Facultad Politécnica – Universidad Nacional de Asunción

*Investigación en Zero-Knowledge Bridges · Asunción, Paraguay*

[![Universidad](https://img.shields.io/badge/FP--UNA-Investigación-blue?style=flat-square)](https://www.pol.una.py/)
[![Org](https://img.shields.io/badge/Org-FPUNA--ZK--Bridge-green?style=flat-square)](https://github.com/FPUNA-ZK-Bridge)

</div>
