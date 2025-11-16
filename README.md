# HyperPay - x402 Facilitator for HyperEVM

![HyperPay](./hyperpay.png)

**HyperPay is the first x402 payment facilitator for HyperEVM**, enabling API services and content providers to monetize their offerings and receive onchain payments on HyperEVM

**built for the HyperEVM Hackathon hosted by Looping Collective & StakingRewards at Devconnect Buenos Aires, November 2025**

## what is HyperPay?

HyperPay is a self-hosted x402 facilitator that brings the x402 payment protocol to HyperEVM, starting on testnet but easily configurable for mainnet

it enables API providers to accept USDC payments on HyperEVM using the same dead-simple integration other facilitators provide on chains like Solana and Base

### features

✅ **EIP-3009 compatible** - gasless payments using `transferWithAuthorization`  
✅ **CDP Server Wallets** - secure key management and automatic nonce & retry handling 
✅ **standard x402 protocol** - works with existing x402 client libraries  
✅ **production-ready** - full verification and settlement logic  
✅ **open source** - template for adding x402 to any EVM chain  

## high-level architecture

my core contribution here is the x402 Facilitator for HyperEVM

**along with the facilitator, I've included an end-to-end, full-stack demo showcasing HyperEVM x402 payments in action**:

- web app lets the user sign in, get a CDP Embedded Wallet, and faucet USDC on HyperEVM testnet
- the user can one-click call a simple x402-enabled API running in the backend, which is x402-enabled using HyperPay's facilitator on HyperEVM
- the API will respond with 402 payment required, directing the user to pay $0.01 USDC on HyperEVM testnet to access its services
- the client wallet signs and retries using the X-PAYMENT header the x402 protocol expects
- the API server calls HyperPay's facilitator to verify and settle payment on HyperEVM
- with payment complete, the API provides the requested service/content to the user


```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    client    │         │   demo API   │         │   HyperPay   │
│              │◄───────►│              │◄───────►│ (facilitator)│
└──────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │ CDP Server   │
                                                   │   Wallet     │
                                                   └──────┬───────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  HyperEVM    │
                                                   │   testnet    │
                                                   └──────────────┘
```

## project structure

```
hyperpay/
├── packages/
│   └── hyperpay-facilitator/    # facilitator implementation
│       ├── src/
│       │   ├── server.ts        # express server with /verify & /settle
│       │   ├── verify.ts        # payment verification logic
│       │   ├── settle.ts        # settlement via CDP Server Wallets
│       │   ├── config.ts        # HyperEVM & USDC configuration
│       │   ├── types.ts         # TypeScript interfaces
│       │   └── index.ts         # exports facilitator instance
│       └── package.json
└── demo/
    ├── server/                   # demo API using HyperPay
    │   ├── index.js             # express API with x402 middleware
    │   └── package.json
    └── client/                   # web app
        ├── app/                 # next.js app with CDP Embedded Wallet
        └── package.json
```

## quickstart

### pre-reqs

1. Node.js v18+
2. CDP API Key from https://portal.cdp.coinbase.com/
3. CDP Server Wallet with HYPE on HyperEVM testnet to pay gas fees

### 1. install dependencies

```bash
npm install
```

### 2. configure HyperPay facilitator

```bash
cd packages/hyperpay-facilitator
cp .env.example .env
```

Edit `.env`:
```env
CDP_API_KEY_ID=your-api-key-id
CDP_API_KEY_SECRET=your-api-key-secret
PORT=3002
```

### 3. start HyperPay facilitator

```bash
npm run dev:facilitator
```

you should see:
```
🚀 HyperPay Facilitator running on http://localhost:3002
✅ Facilitator wallet initialized: 0x...
⚠️  Make sure this wallet has HYPE for gas!
```

**important:** fund the facilitator wallet with testnet HYPE for gas!

### 4. configure demo API

```bash
cd demo/server
cp .env.example .env
```

Edit `.env`:
```env
RECEIVER_WALLET=0xYourWalletAddressHere
HYPERPAY_FACILITATOR_URL=http://localhost:3002
```

### 5. start demo API server

```bash
npm run dev:server
```

### 6. configure client

```bash
cd demo/client
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_CDP_PROJECT_ID=your-project-id
NEXT_PUBLIC_API_URL=http://localhost:3003
```

### 7. start client

```bash
npm run dev:client
```

visit http://localhost:3004

## how it works

### for API providers

3 lines of code to accept payments on HyperEVM using HyperPay's facilitator:

```javascript
import { paymentMiddleware } from "x402-express";
import { facilitator } from "@hyperpay/facilitator";

app.use(paymentMiddleware(
  "0xYourWallet",
  {
    "GET /api": {
      price: "$0.01",
      network: "hyperevm-testnet"
    }
  },
  facilitator
));
```

### for users & agents

1. sign in with CDP Embedded Wallet (email/SMS/Google/X)
2. get HyperEVM testnet USDC from Circle's faucet
3. call paid APIs, paying via x402

## tech details

### HyperEVM testnet configuration

- **chain id:** 998
- **RPC:** https://rpc.hyperliquid-testnet.xyz/evm
- **native token:** HYPE (for gas)
- **USDC contract:** `0x2B3370eE501B4a559b57D449569354196457D8Ab`
- **explorer:** https://testnet.purrsec.com/

### payment flow

1. client requests API endpoint
2. server returns 402 with payment requirements
3. client creates EIP-3009 authorization (signed off-chain)
4. client retries with X-PAYMENT header
5. server calls HyperPay `/verify`
6. HyperPay verifies signature & checks balance
7. server calls HyperPay `/settle`
8. HyperPay calls `transferWithAuthorization` via CDP Server Wallet
9. CDP Server Wallet pays gas (HYPE)
10. USDC transfers from client to API provider
11. server returns protected content

### why HyperPay matters

**for the x402 ecosystem:**
- first facilitator beyond Base & Solana
- proves x402 works on any EVM chain
- reference implementation for other chains

**for HyperEVM:**
- enables API monetization on HyperEVM
- showcases EVM compatibility
- drives HYPE usage
- attracts developers building paid services

**for CDP:**
- demonstrates Server Wallets on HyperEVM
- shows Embedded Wallet flexibility

## deployment

I haven't deployed this to production yet, but here's how you would do it. Right now I'm focused on getting testnet HYPE so I can test this out locally, and don't want to deploy before doing that - but maybe you can!

### facilitator

environment variables:
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `HYPEREVM_RPC_URL`

### demo API

environment variables:
- `RECEIVER_WALLET`
- `HYPERPAY_FACILITATOR_URL`

### client

environment variables:
- `NEXT_PUBLIC_CDP_PROJECT_ID`
- `NEXT_PUBLIC_API_URL`

don't forget to allowlist your domain in CDP Portal under Embedded Wallets! The web app demo won't work without that

## roadmap

I mostly did this on the long flight from Seattle to Buenos Aires, so the scope is limited. There are a ton of future directions I might take this, or that you can feel free to explore! Some ideas below -

### immediate next steps

1. **🔥 find some f*cking testnet HYPE!** - The biggest blocker during the hackathon was actually getting testnet HYPE to test the facilitator. All public faucets required mainnet holdings to prevent abuse, and some even required the receiving wallet to have a mainnet history (not realistic for hackathon projects). For future development, we need either:
   - partnership with HyperLiquid for testnet token distribution
   - dedicated testnet faucet for builders

### production deployment

2. **Production HyperEVM facilitator** - Deploy HyperPay as a production-grade facilitator on HyperEVM mainnet with:
   - fleet of CDP Server Wallets for high throughput and redundancy while minimizing error rate
   - intelligent load balancing across multiple facilitator instances
   - monitoring, alerting, and analytics dashboard
   - rate limiting and abuse prevention
   - uptime SLA guarantees

3. **monetization features** - Turn HyperPay into a sustainable business:
   - optional facilitator fees (e.g., 0.1% of transaction value, or flat rate per settled txn)
   - premium tier with higher throughput guarantees
   - analytics and insights for API providers
   - webhook notifications for payment events

### advanced features

4. **multi-token support** - accept and disburse in any token:
   - native token swaps via HyperEVM DEXes
   - users pay in any HyperEVM-supported token they have (USDC, HYPE, wBTC, etc)
   - API providers receive in their preferred token
   - automatic conversion handled by facilitator; neither party has to think about the swap in between
   - route optimization for best swap rates

5. **Looping Collective integration** 🔄 - yield on API revenue:
   - enable API providers to auto-deposit a % of earnings into a liquid looping strategy like LHYPE
   - earn yield on revenue while maintaining liquidity
   - configurable allocation (e.g. 50% liquid, 50% looped or whatever)
   - dashboard showing revenue + accumulated yield
   - one-click withdrawal from looping positions

6. **HyperCore support** - extend HyperPay beyond HyperEVM:
   - implement x402 facilitator for HyperCore (Hyperliquid L1)
   - enable cross-chain payments (pay on HyperCore, settle on HyperEVM)
   - unified facilitator handling both chains with configurability
   - would demonstrate x402's multi-chain flexibility and drive more Hyperliquid usage

### ecosystem expansion

7. **discovery layer** - HyperEVM API marketplace:
   - catalog of x402-enabled APIs on HyperEVM
   - searchable by category, price, rating
   - one-click integration for developers
   - revenue leaderboard for top APIs

### community & governance

8. **open governance** - decentralize HyperPay:
    - DAO for facilitator parameters (fees, supported tokens)
    - community-run facilitator nodes
    - revenue sharing with node operators
    - grants for ecosystem development

the core contribution here — a working x402 facilitator for HyperEVM — is a foundation that can grow into critical infrastructure for a rich API economy settling on Hyperliquid & HyperEVM 🔥

## license

MIT

## links

- [x402 protocol](https://www.x402.org/)