# Guarani Bridge 🌉


# Local (default)
  BRIDGE_ENV=local
  npm run node:n1          # terminal 1
  npm run node:n2          # terminal 2
  npm run deploy:n1        # deploya a localN1 automáticamente
  npm run deploy:n2        # deploya a localN2 automáticamente
  npm run relayer

  # Testnet
  # Cambiar BRIDGE_ENV=testnet en .env y completar las PKs
  npm run deploy:n1        # deploya a ephemery
  npm run deploy:n2        # deploya a blockdag
  npm run relayer

Un puente de tokens descentralizado que permite transferir **GuaraniTokens** entre dos cadenas de bloques (L1 ↔ L2) de forma segura y eficiente. Implementa el patrón **lock-and-mint** con protección contra replay attacks y verificación criptográfica.

## ✨ Características Principales

- 🔒 **Lock-and-Mint Pattern**: Los tokens se bloquean en L1 y se acuñan equivalentes en L2
- 🛡️ **Replay Protection**: Previene el procesamiento duplicado de transacciones
- 🤖 **Relayer Automatizado**: Escucha eventos y ejecuta transferencias automáticamente
- 🔍 **Transparencia Total**: Todos los eventos son auditables en ambas cadenas
- 🎯 **Gas Optimizado**: Contratos eficientes con mínimo consumo de gas
- 🧪 **Entorno de Testing**: Configuración completa para desarrollo local

## 🌉 Cómo Funciona

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GUARANI BRIDGE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

    L1 (Hardhat - Puerto 31337)              L2 (Anvil - Puerto 1338)
    ┌─────────────────────────┐              ┌─────────────────────────┐
    │                         │              │                         │
    │  👤 Usuario             │              │  👤 Usuario (mismo)     │
    │  📦 GuaraniToken        │              │  📦 GuaraniToken        │
    │  🔒 Sender Contract     │              │  🏭 Receiver Contract   │
    │                         │              │                         │
    └─────────────────────────┘              └─────────────────────────┘
              │                                        ▲
              │ 1. lock(amount) 🔒                     │
              │    - Tokens bloqueados                 │
              │    - Emite evento "Locked"             │ 3. mintRemote() 🏭
              │                                        │    - Crea tokens en L2
              │                                        │    - Emite evento "Minted"
              └──────────────────┐                     │
                                 │                     │
                                 ▼                     │
                        ┌─────────────────────┐        │
                        │   🤖 RELAYER        │────────┘
                        │                     │
                        │ 2. Escucha "Locked" │
                        │    Ejecuta mint     │
                        │    en L2            │
                        └─────────────────────┘

Flujo Detallado:
1️⃣ **Preparación**: Usuario aprueba tokens al contrato Sender en L1
2️⃣ **Lock**: Usuario llama lock(recipientL2, amount) → tokens se bloquean
3️⃣ **Evento**: Se emite evento "Locked" con ID único y detalles
4️⃣ **Relayer**: Detecta evento y valida la transacción
5️⃣ **Mint**: Relayer ejecuta mintRemote() en contrato Receiver de L2
6️⃣ **Confirmación**: Se acuñan tokens equivalentes para el destinatario
```

## 🔧 Componentes Técnicos

### Contratos Inteligentes

- **`GuaraniToken.sol`**: Token ERC20 con funcionalidad de mint/burn y roles
- **`Sender.sol`**: Contrato en L1 que bloquea tokens y emite eventos
- **`Receiver.sol`**: Contrato en L2 que acuña tokens tras verificación
- **`Verifier.sol`**: (Opcional) Verificación criptográfica adicional

### Infraestructura

- **Relayer**: Servicio Node.js que monitorea eventos y ejecuta transferencias
- **Frontend**: Interfaz web para interactuar con el puente
- **Testing**: Suite completa de tests para validar funcionalidad

## 🛡️ Seguridad

- **Nonce System**: Cada transferencia tiene un ID único incremental
- **Replay Protection**: Mapping de transacciones procesadas previene duplicados
- **Role-Based Access**: Solo el relayer autorizado puede acuñar tokens
- **Event Validation**: Verificación completa de eventos antes del procesamiento

## 🚀 Guía de Setup Completa (Desde Cero)

### ⚠️ Importante: Setup Paso a Paso

Para evitar errores comunes como "Contract not found", sigue **exactamente** estos pasos en orden:

### Prerrequisitos

- Node.js v18+
- npm o yarn  
- Docker & Docker Compose (Recomendado)
- MetaMask u otro wallet compatible

### 🐳 Método Recomendado: Docker Compose

#### 1️⃣ Clonar y preparar el proyecto

```bash
git clone <repository-url>
cd guarani-bridge
```

#### 2️⃣ Levantar servicios base

```bash
# Construir todas las imágenes
docker compose build

# Iniciar L1 (Hardhat) y L2 (Anvil)
docker compose up -d hardhat-n1 anvil-n2

# Verificar que están saludables (IMPORTANTE)
docker compose ps
# Debe mostrar hardhat-n1 como "healthy"
```

#### 3️⃣ Desplegar contratos (CRÍTICO)

```bash
# Desplegar en L1 (Hardhat)
docker compose run --rm deployer npx hardhat run scripts/deployN1.js --network dockerN1

# Desplegar en L2 (Anvil)
docker compose run --rm deployer npx hardhat run scripts/deployN2.js --network dockerN2

# Verificar que deploy-N1.json y deploy-N2.json se generaron
ls -la deploy-*.json
```

#### 4️⃣ Mintear tokens iniciales (para testing)

```bash
# Mintear tokens al deployer
docker compose run --rm deployer npx hardhat run scripts/mintTokens.js --network dockerN1

# Mintear tokens a cuenta específica (opcional)
docker compose run --rm deployer node scripts/mintToFrontendAccount.js
```

#### 5️⃣ Iniciar servicios adicionales

```bash
# Iniciar el relayer
docker compose up -d relayer

# Iniciar el frontend (opcional)
docker compose up -d frontend

# Verificar que todo esté corriendo
docker compose ps
```

#### 6️⃣ Acceder a la aplicación

- **Frontend**: http://localhost:3000
- **L1 RPC**: http://localhost:8545 
- **L2 RPC**: http://localhost:9545

### 🔧 Configuración de MetaMask

1. Agregar red L1 (Hardhat):
   - **Network Name**: Hardhat Local
   - **RPC URL**: http://localhost:8545
   - **Chain ID**: 31337
   - **Currency Symbol**: ETH

2. Agregar red L2 (Anvil):
   - **Network Name**: Anvil Local  
   - **RPC URL**: http://localhost:9545
   - **Chain ID**: 1338
   - **Currency Symbol**: ETH

3. Importar cuenta de prueba:
   - **Private Key**: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - Esta cuenta tiene tokens GUA pre-minteados

### 🚨 Troubleshooting Común

#### Problema: "Contract not found" en el frontend

**Causa**: Los contratos no están desplegados o los servicios se reiniciaron.

**Solución**:
```bash
# 1. Verificar que los servicios estén corriendo
docker compose ps

# 2. Redesplegar contratos
docker compose run --rm deployer npx hardhat run scripts/deployN1.js --network dockerN1
docker compose run --rm deployer npx hardhat run scripts/deployN2.js --network dockerN2

# 3. Reiniciar relayer y frontend
docker compose restart relayer frontend
```

#### Problema: "Internal JSON-RPC error" en transacciones

**Causa**: Problemas de nonce o falta de tokens.

**Solución**:
```bash
# Mintear tokens a tu cuenta
docker compose run --rm deployer node scripts/mintToFrontendAccount.js
```

#### Problema: Relayer no procesa eventos

**Causa**: Error en el listener de eventos.

**Solución**:
```bash
# Ver logs del relayer
docker logs guarani-relayer --tail 20

# Reiniciar relayer
docker compose restart relayer
```

### ⚡ Reset Completo (cuando algo sale mal)

```bash
# Detener todo y limpiar volúmenes
docker compose down -v

# Reconstruir imágenes
docker compose build --no-cache

# Volver a empezar desde el paso 2
docker compose up -d hardhat-n1 anvil-n2
# ... continuar con los pasos de deploy
```

## 🚀 Instalación Alternativa (Sin Docker)

### Prerrequisitos

- Node.js v18+
- npm o yarn
- MetaMask u otro wallet compatible

### 1️⃣ Instalar dependencias

```bash
npm install
```

### 2️⃣ Arrancar cadenas locales

Necesitas **dos terminales** para ejecutar ambas cadenas:

```bash
# Terminal 1 - L1 (Hardhat)
npm run node:n1   # Puerto 31337

# Terminal 2 - L2 (Anvil)
npm run node:n2   # Puerto 1338
```

### 3️⃣ Compilar y desplegar contratos

```bash
npm run compile      # Compila todos los contratos
npm run deploy:n1    # Despliega en L1 (Hardhat)
npm run deploy:n2    # Despliega en L2 (Anvil)
```

Los archivos `deploy-N1.json` y `deploy-N2.json` contendrán las direcciones de los contratos desplegados.

### 4️⃣ Configurar Frontend (Opcional)

Edita las direcciones de los contratos en `public/index.html` y lanza el servidor:

```bash
npm run frontend     # Abre http://localhost:3000
```

### 5️⃣ Iniciar Relayer

```bash
npm run relayer      # Inicia el servicio de relaying
```

## 🐳 Información Adicional de Docker

### Requisitos

- Docker 20.10+
- Docker Compose 2.0+

### Detalles de la Arquitectura

Docker Compose gestiona automáticamente:
- **L1 (Hardhat)**: Red local en puerto 8545
- **L2 (Anvil)**: Red local en puerto 9545
- **Relayer**: Servicio que sincroniza ambas redes
- **Frontend**: Interfaz web en puerto 3000

### Configuración Avanzada

#### Variables de Entorno

Puedes personalizar el comportamiento creando un archivo `.env`:

```bash
# .env
RPC_URL_N1=http://hardhat-n1:8545
RPC_URL_N2=http://anvil-n2:9545
START_BLOCK_N1=0
NODE_OPTIONS=--max-old-space-size=2048
```

### Comandos Útiles para Desarrollo

```bash
# Ver estado de todos los servicios
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Logs de un servicio específico
docker compose logs -f hardhat-n1
docker compose logs -f anvil-n2
docker compose logs -f relayer

# Verificar que los contratos existen
curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["DIRECCION_CONTRATO","latest"],"id":1}' http://localhost:8545

# Ejecutar comando en un contenedor
docker compose exec hardhat-n1 bash

# Mintear tokens de prueba
docker compose run --rm deployer npx hardhat run scripts/mintTokens.js --network dockerN1

# Detener servicios
docker compose stop

# Detener y eliminar (limpia volúmenes)
docker compose down -v

# Reconstruir imágenes (después de cambios)
docker compose build --no-cache

# Reset completo del proyecto
docker compose down -v && docker compose build --no-cache && docker compose up -d
```

### Verificación del Deployment

Después de seguir los pasos, verifica que todo funcione:

```bash
# 1. Verificar servicios activos
docker compose ps
# Debe mostrar: hardhat-n1 (healthy), anvil-n2 (running), relayer (running), frontend (running)

# 2. Verificar archivos de deploy
cat deploy-N1.json
cat deploy-N2.json
# Deben contener direcciones de contratos

# 3. Verificar contratos en L1
curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["$(cat deploy-N1.json | jq -r .token)","latest"],"id":1}' http://localhost:8545 | jq -r .result
# Debe devolver código del contrato (no "0x")

# 4. Probar el frontend
# Ir a http://localhost:3000
# Las tablas deben mostrar balances de ETH (no "Contract not found")
```

### Archivos Docker

- **`Dockerfile`**: Imagen base con Node.js, dependencias y contratos compilados
- **`Dockerfile.anvil`**: Imagen con Foundry/Anvil para L2
- **`docker-compose.yml`**: Orquestación de servicios y networking
- **`.dockerignore`**: Archivos excluidos del build

## 💡 Uso

### ⚠️ Antes de usar, asegúrate de:

1. ✅ Haber seguido la "Guía de Setup Completa" anterior
2. ✅ Todos los servicios Docker estén corriendo
3. ✅ Los contratos estén desplegados (deploy-N1.json y deploy-N2.json existen)
4. ✅ El relayer esté activo y sin errores

### Via Frontend Web

1. **Abre**: http://localhost:3000
2. **Conecta MetaMask** a la red L1 (Hardhat - puerto 8545, Chain ID 31337)
3. **Importa una cuenta con tokens** (usa la private key proporcionada arriba)
4. **Verifica** que las tablas muestren balances (no "Contract not found")
5. **Ingresa** la dirección de destino en L2
6. **Especifica** la cantidad de tokens a transferir
7. **Haz clic** en "BRIDGE →"
8. **Confirma** en MetaMask
9. **Espera** que el relayer procese automáticamente la transferencia

### Via Scripts

```bash
# Mintear tokens iniciales
npm run script scripts/mintTokens.js

# Aprobar tokens al contrato Sender
npm run script scripts/approveTokens.js

# Bloquear tokens en L1
npm run script scripts/lockTokens.js

# Verificar balances
npm run script scripts/checkBalance.js
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests específicos
npm run test:bridge           # Tests del puente
npm run test:infrastructure   # Tests de infraestructura
npm run test:diagnostics      # Diagnósticos de red
```

## 📁 Estructura del Proyecto

```
guarani-bridge/
├── contracts/           # Contratos Solidity
├── scripts/            # Scripts de deployment y utilidades
├── test/              # Suite de tests
├── relayer/           # Servicio relayer
├── public/            # Frontend web
├── utils/             # Utilidades compartidas
└── artifacts/         # Contratos compilados
```
