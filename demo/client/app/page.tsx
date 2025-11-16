"use client";

import { useState, useEffect } from "react";
import { 
  useCurrentUser,
  useIsSignedIn,
  useSignInWithEmail,
  useVerifyEmailOTP,
  useSignInWithSms,
  useVerifySmsOTP,
  useSignInWithOAuth,
  useSignOut
} from "@coinbase/cdp-hooks";
import { toViemAccount } from "@coinbase/cdp-core";
import { createWalletClient, http, publicActions } from "viem";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

// HyperEVM testnet config
const hyperEvmTestnet = {
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
    public: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
  },
  blockExplorers: {
    default: { 
      name: "PurrSec Explorer", 
      url: "https://testnet.purrsec.com" 
    },
  },
};

interface ApiResponse {
  quote: string;
  timestamp: string;
  paid: boolean;
}

interface PaymentResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

export default function Home() {
  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { signInWithSms } = useSignInWithSms();
  const { verifySmsOTP } = useVerifySmsOTP();
  const { signInWithOAuth } = useSignInWithOAuth();
  const { signOut } = useSignOut();
  
  const [quote, setQuote] = useState<string>("");
  const [paymentInfo, setPaymentInfo] = useState<PaymentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [showAuthMethods, setShowAuthMethods] = useState(false);
  const [authStep, setAuthStep] = useState<"method" | "email" | "sms" | "otp">("method");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState("");
  const [authType, setAuthType] = useState<"email" | "sms">("email");

  const address = currentUser?.evmAccounts?.[0];

  // fetch balance when connected
  useEffect(() => {
    if (address) {
      fetchBalance();
    }
  }, [address]);

  const fetchBalance = async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`${API_URL}/balance/${address}`);
      
      if (!response.ok) {
        throw new Error("failed to fetch balance");
      }
      
      const data = await response.json();
      setBalance(data.balance);
      console.log(`balance updated: ${data.balance} USDC for ${address}`);
    } catch (err) {
      console.error("error fetching balance:", err);
    }
  };

  // handle email sign in
  const handleEmailSignIn = async () => {
    if (!emailOrPhone) return;
    
    setLoading(true);
    setError("");
    
    try {
      const result = await signInWithEmail({ email: emailOrPhone });
      setFlowId(result.flowId);
      setAuthType("email");
      setAuthStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to send email");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // handle mobile SMS sign in
  const handleSmsSignIn = async () => {
    if (!emailOrPhone) return;
    
    setLoading(true);
    setError("");
    
    try {
      const result = await signInWithSms({ phoneNumber: emailOrPhone });
      setFlowId(result.flowId);
      setAuthType("sms");
      setAuthStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to send SMS");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // verify OTP
  const handleVerifyOtp = async () => {
    if (!otp || !flowId) return;
    
    setLoading(true);
    setError("");
    
    try {
      if (authType === "email") {
        await verifyEmailOTP({ flowId, otp });
      } else {
        await verifySmsOTP({ flowId, otp });
      }
      // user now authenticated; reset state
      setShowAuthMethods(false);
      setAuthStep("method");
      setEmailOrPhone("");
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to verify OTP");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // handle OAuth sign in
  const handleOAuthSignIn = async (provider: "google" | "x") => {
    setLoading(true);
    setError("");
    
    try {
      await signInWithOAuth(provider);
      setShowAuthMethods(false);
      setAuthStep("method");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to sign in");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // call the x402-enabled API endpoint
  const handleCallApi = async () => {
    if (!address || !currentUser) return;
    
    setLoading(true);
    setError("");
    setQuote("");
    setPaymentInfo(null);
    
    try {
      // convert CDP Embedded Wallet to viem account
      const evmAddress = currentUser.evmAccounts?.[0];
      if (!evmAddress) {
        throw new Error("no EVM account found");
      }
      
      const viemAccount = await toViemAccount(evmAddress as `0x${string}`);
      const walletClient = createWalletClient({
        account: viemAccount,
        chain: hyperEvmTestnet,
        transport: http(),
      }).extend(publicActions);
      
      // wrap fetch with x402 payment handling
      // @ts-ignore - viem type compatibility between x402-fetch and latest viem
      const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);
      
      // make the paid request
      const response = await fetchWithPayment(`${API_URL}/motivate`, {
        method: "GET",
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      setQuote(data.quote);
      
      const paymentResponseHeader = response.headers.get("x-payment-response");
      if (paymentResponseHeader) {
        const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
        setPaymentInfo(paymentResponse);
      }
      
      setTimeout(fetchBalance, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to call API");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>HyperPay demo</h1>
        <p>showcasing the first x402 facilitator for HyperEVM</p>
      </div>

      <div className="wallet-section">
        <h2 style={{ marginBottom: "16px", fontSize: "20px" }}>sign in</h2>
        
        {!isSignedIn ? (
          <>
            {!showAuthMethods ? (
              <button 
                className="button button-primary"
                onClick={() => setShowAuthMethods(true)}
                disabled={loading}
              >
                sign in
              </button>
            ) : authStep === "method" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  className="button button-primary"
                  onClick={() => setAuthStep("email")}
                  disabled={loading}
                >
                  email
                </button>
                <button
                  className="button button-primary"
                  onClick={() => setAuthStep("sms")}
                  disabled={loading}
                >
                  mobile
                </button>
                <button
                  className="button button-primary"
                  onClick={() => handleOAuthSignIn("google")}
                  disabled={loading}
                >
                  google
                </button>
                <button
                  className="button button-primary"
                  onClick={() => handleOAuthSignIn("x")}
                  disabled={loading}
                >
                  X
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => setShowAuthMethods(false)}
                  disabled={loading}
                >
                  cancel
                </button>
              </div>
            ) : authStep === "email" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="email"
                  placeholder="enter your email"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
                <button
                  className="button button-primary"
                  onClick={handleEmailSignIn}
                  disabled={loading || !emailOrPhone}
                >
                  {loading ? "sending..." : "send OTP"}
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => { setAuthStep("method"); setEmailOrPhone(""); }}
                  disabled={loading}
                >
                  back
                </button>
              </div>
            ) : authStep === "sms" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="tel"
                  placeholder="Enter phone (+1234567890)"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
                <button
                  className="button button-primary"
                  onClick={handleSmsSignIn}
                  disabled={loading || !emailOrPhone}
                >
                  {loading ? "sending..." : "send OTP"}
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => { setAuthStep("method"); setEmailOrPhone(""); }}
                  disabled={loading}
                >
                  back
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                  enter the 6-digit code sent to {emailOrPhone}
                </p>
                <input
                  type="text"
                  placeholder="Enter OTP code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
                <button
                  className="button button-primary"
                  onClick={handleVerifyOtp}
                  disabled={loading || !otp}
                >
                  {loading ? "verifying..." : "verify OTP"}
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => { setAuthStep("method"); setEmailOrPhone(""); setOtp(""); }}
                  disabled={loading}
                >
                  back
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="wallet-info">
            <p>connected:</p>
            <div className="address">{address}</div>
            <p style={{ marginTop: "16px" }}>USDC balance:</p>
            <div className="balance">{balance} USDC</div>
            <button 
              className="button button-secondary" 
              onClick={() => signOut()}
              style={{ marginTop: "16px" }}
            >
              sign out
            </button>
          </div>
        )}
      </div>

      {isSignedIn && (
        <>
          <div className="action-section">
            <h2 style={{ marginBottom: "16px", fontSize: "20px" }}>get testnet USDC</h2>
            
            <div style={{ marginBottom: "12px", padding: "12px", background: "#f8f9fa", borderRadius: "8px" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                your wallet address:
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  value={address}
                  readOnly
                  style={{ 
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    background: "white"
                  }}
                />
                <button
                  className="button button-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(address || "");
                    alert("address copied!");
                  }}
                  style={{ padding: "8px 16px", margin: 0, width: "auto" }}
                >
                  copy
                </button>
              </div>
            </div>

            <button
              className="button button-primary"
              onClick={() => window.open("https://faucet.circle.com/", "_blank")}
              style={{ marginBottom: "8px" }}
            >
              open Circle faucet →
            </button>
            <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.5" }}>
              1. click above to open Circle's faucet<br />
              2. select "HyperEVM Testnet"<br />
              3. paste your address (copy button above)<br />
              4. claim USDC & return here
            </p>
          </div>

          <div className="action-section">
            <h2 style={{ marginBottom: "16px", fontSize: "20px" }}>call x402-enabled API</h2>
            <button
              className="button button-primary"
              onClick={handleCallApi}
              disabled={loading || parseFloat(balance) < 0.01}
            >
              {loading ? "processing..." : "Get Motivational Quote (0.01 USDC)"}
            </button>
            {parseFloat(balance) < 0.01 && (
              <div className="info-box">
                you need at least 0.01 USDC to call the API - use the faucet above
              </div>
            )}
          </div>

          {error && (
            <div className="error">
              <strong>error:</strong> {error}
            </div>
          )}

          {quote && (
            <div className="response-section">
              <h3>API response:</h3>
              <div className="quote-display">"{quote}"</div>
              
              {paymentInfo && (
                <div className="payment-info">
                  <p><strong>payment status:</strong> {paymentInfo.success ? "✅ Successful" : "❌ Failed"}</p>
                  {paymentInfo.transaction && (
                    <>
                      <p><strong>transaction:</strong></p>
                      <div className="tx-hash">
                        <a 
                          href={`https://testnet.purrsec.com/tx/${paymentInfo.transaction}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {paymentInfo.transaction}
                        </a>
                      </div>
                    </>
                  )}
                  <p><strong>network:</strong> {paymentInfo.network}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="steps" style={{ marginTop: "32px" }}>
        <h3>about this demo:</h3>
        <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#666" }}>
          this demo showcases <strong>HyperPay</strong> - the first x402 payment facilitator for HyperEVM
        </p>
        <ul style={{ fontSize: "14px", lineHeight: "1.8", color: "#666", marginTop: "12px", listStyle: "none", paddingLeft: "0" }}>
          <li>sign in to get a CDP Embedded Wallet</li>
          <li>get testnet USDC from Circle's faucet</li>
          <li>call x402-enabled APIs with automatic payment on HyperEVM</li>
          <li>no gas fees - HyperPay facilitator sponsors gas in HYPE</li>
        </ul>
        <p style={{ fontSize: "13px", marginTop: "16px", color: "#888" }}>
          built for the HyperEVM Hackathon • <a href="https://github.com/jnix2007/hyperpay" target="_blank" rel="noopener noreferrer" style={{ color: "#0052ff" }}>GitHub →</a>
        </p>
      </div>
    </div>
  );
}
