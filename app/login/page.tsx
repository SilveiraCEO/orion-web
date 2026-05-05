"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      const params = new URLSearchParams(window.location.search);

      if (params.get("registered") === "1") {
        setInfoMessage(
          "Cadastro criado. Agora entre com seu e-mail e senha para acessar o ORION."
        );
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/app");
        return;
      }

      setIsCheckingSession(false);
    }

    checkSession();
  }, [router, supabase]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");

    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage("E-mail ou senha inválidos. Verifique e tente novamente.");
      return;
    }

    router.replace("/app");
    router.refresh();
  }

  return (
    <main className="authPage">
      <Background />

      <section className="authWrap">
        <div className="authSide">
          <Link href="/" className="brand">
            <div className="brandIcon">
              <span />
            </div>

            <div>
              <p>Autonomous Commerce Intelligence</p>
              <strong>ORION</strong>
            </div>
          </Link>

          <p className="eyebrow">Access your command center</p>

          <h1>
            Entre no núcleo <span>ORION</span>.
          </h1>

          <p className="sideText">
            Acesse sua IA, converse por voz, analise produtos, crie campanhas e
            opere seu e-commerce com mais inteligência.
          </p>

          <div className="sideCards">
            <div>
              <strong>AI Core</strong>
              <p>Acesse seu painel principal com os cérebros de IA.</p>
            </div>

            <div>
              <strong>Jarvis Mode</strong>
              <p>Entre no modo de conversa por voz quando quiser.</p>
            </div>
          </div>
        </div>

        <div className="authCard">
          <Link href="/" className="mobileBrand">
            <div className="brandIcon small">
              <span />
            </div>
            <strong>ORION</strong>
          </Link>

          <p className="cardEyebrow">Login</p>

          <h2>Acesse sua conta</h2>

          <p className="cardText">
            Entre para acessar o painel principal do ORION.
          </p>

          {isCheckingSession ? (
            <div className="loadingBox">Verificando sessão...</div>
          ) : (
            <form onSubmit={handleLogin} className="form">
              <div className="field">
                <label>E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="field">
                <label>Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                />
              </div>

              {infoMessage && <div className="message info">{infoMessage}</div>}

              {errorMessage && (
                <div className="message error">{errorMessage}</div>
              )}

              <button className="submitButton" type="submit" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar no ORION"}
                {!isLoading && <span>→</span>}
              </button>
            </form>
          )}

          <p className="switchText">
            Ainda não tem conta? <Link href="/register">Criar acesso</Link>
          </p>
        </div>
      </section>

      <AuthStyles />
    </main>
  );
}

function Background() {
  return (
    <>
      <div className="backgroundGrid" />
      <div className="backgroundGlow glowOne" />
      <div className="backgroundGlow glowTwo" />
    </>
  );
}

function AuthStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        background: #050816;
        color: white;
        overflow-x: hidden;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      input,
      button {
        font: inherit;
      }

      .authPage {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background: #050816;
        color: #ffffff;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system,
          BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .backgroundGrid {
        position: absolute;
        inset: 0;
        background-image: linear-gradient(
            rgba(97, 239, 255, 0.028) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(97, 239, 255, 0.028) 1px,
            transparent 1px
          );
        background-size: 44px 44px;
        opacity: 0.8;
      }

      .backgroundGlow {
        position: absolute;
        border-radius: 999px;
        filter: blur(90px);
        pointer-events: none;
      }

      .glowOne {
        top: 8%;
        left: 38%;
        width: 560px;
        height: 560px;
        background: rgba(97, 239, 255, 0.1);
      }

      .glowTwo {
        right: -120px;
        bottom: 5%;
        width: 480px;
        height: 480px;
        background: rgba(123, 97, 255, 0.12);
      }

      .authWrap {
        position: relative;
        z-index: 2;
        min-height: 100vh;
        width: min(100% - 48px, 1180px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 500px;
        gap: 56px;
        align-items: center;
        padding: 48px 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
        width: fit-content;
        margin-bottom: 62px;
      }

      .brandIcon {
        position: relative;
        width: 52px;
        height: 52px;
        border-radius: 18px;
        border: 1px solid rgba(97, 239, 255, 0.26);
        background: linear-gradient(
          135deg,
          rgba(97, 239, 255, 0.14),
          rgba(123, 97, 255, 0.1),
          rgba(255, 140, 90, 0.1)
        );
        box-shadow: 0 0 28px rgba(97, 239, 255, 0.14);
      }

      .brandIcon.small {
        width: 42px;
        height: 42px;
        border-radius: 14px;
      }

      .brandIcon::before {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: 13px;
        border: 1px solid rgba(97, 239, 255, 0.14);
        background: #030817;
      }

      .brandIcon span {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 12px;
        height: 12px;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        background: #61efff;
        box-shadow: 0 0 22px rgba(97, 239, 255, 1);
      }

      .brand p {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: rgba(97, 239, 255, 0.75);
      }

      .brand strong,
      .mobileBrand strong {
        display: block;
        margin-top: 6px;
        font-size: 22px;
        letter-spacing: 0.34em;
        color: #eaffff;
      }

      .eyebrow,
      .cardEyebrow {
        margin: 0;
        color: #61efff;
        font-size: 11px;
        letter-spacing: 0.34em;
        text-transform: uppercase;
        font-weight: 800;
      }

      .authSide h1 {
        margin: 26px 0 0;
        max-width: 680px;
        font-size: clamp(52px, 6vw, 82px);
        line-height: 1.02;
        letter-spacing: -0.055em;
        font-weight: 950;
      }

      .authSide h1 span {
        background: linear-gradient(135deg, #ffffff, #8df4ff, #bca8ff);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .sideText {
        margin: 28px 0 0;
        max-width: 620px;
        color: #8ea4c4;
        font-size: 18px;
        line-height: 1.75;
      }

      .sideCards {
        margin-top: 42px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 220px));
        gap: 16px;
      }

      .sideCards div {
        padding: 20px;
        border-radius: 24px;
        border: 1px solid rgba(97, 239, 255, 0.12);
        background: rgba(9, 23, 42, 0.72);
      }

      .sideCards strong {
        color: #dffcff;
      }

      .sideCards p {
        margin: 8px 0 0;
        color: #8ea4c4;
        font-size: 14px;
        line-height: 1.55;
      }

      .authCard {
        padding: 36px;
        border-radius: 34px;
        border: 1px solid rgba(97, 239, 255, 0.15);
        background: rgba(7, 18, 36, 0.78);
        backdrop-filter: blur(22px);
        box-shadow: 0 0 80px rgba(97, 239, 255, 0.08);
      }

      .mobileBrand {
        display: none;
        align-items: center;
        gap: 14px;
        margin-bottom: 32px;
      }

      .authCard h2 {
        margin: 14px 0 0;
        font-size: 36px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }

      .cardText {
        margin: 14px 0 0;
        color: #8ea4c4;
        font-size: 15px;
        line-height: 1.65;
      }

      .loadingBox {
        margin-top: 34px;
        border-radius: 18px;
        border: 1px solid rgba(97, 239, 255, 0.12);
        background: rgba(3, 8, 23, 0.64);
        padding: 18px;
        color: #8ea4c4;
        font-size: 14px;
      }

      .form {
        margin-top: 34px;
        display: grid;
        gap: 18px;
      }

      .field label {
        display: block;
        margin-bottom: 9px;
        color: rgba(220, 245, 255, 0.62);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .field input {
        width: 100%;
        height: 56px;
        border-radius: 18px;
        border: 1px solid rgba(97, 239, 255, 0.14);
        background: rgba(3, 8, 23, 0.82);
        color: white;
        outline: none;
        padding: 0 18px;
        transition: border-color 0.25s ease, box-shadow 0.25s ease,
          background 0.25s ease;
      }

      .field input::placeholder {
        color: rgba(142, 164, 196, 0.55);
      }

      .field input:focus {
        border-color: rgba(97, 239, 255, 0.45);
        background: rgba(3, 8, 23, 0.94);
        box-shadow: 0 0 0 4px rgba(97, 239, 255, 0.08);
      }

      .message {
        border-radius: 18px;
        padding: 14px 16px;
        font-size: 14px;
        line-height: 1.55;
      }

      .message.error {
        border: 1px solid rgba(248, 113, 113, 0.22);
        background: rgba(248, 113, 113, 0.1);
        color: #fecaca;
      }

      .message.info {
        border: 1px solid rgba(97, 239, 255, 0.22);
        background: rgba(97, 239, 255, 0.08);
        color: #d8fbff;
      }

      .submitButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 58px;
        border: 1px solid rgba(97, 239, 255, 0.75);
        border-radius: 20px;
        background: linear-gradient(135deg, #61efff, #21b7ff);
        color: #03101c;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 0 26px rgba(97, 239, 255, 0.18);
        transition: transform 0.25s ease, box-shadow 0.25s ease,
          opacity 0.25s ease;
      }

      .submitButton:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 34px rgba(97, 239, 255, 0.34);
      }

      .submitButton:disabled {
        cursor: not-allowed;
        opacity: 0.65;
        transform: none;
      }

      .submitButton span {
        transition: transform 0.25s ease;
      }

      .submitButton:hover span {
        transform: translateX(3px);
      }

      .switchText {
        margin: 24px 0 0;
        color: #8ea4c4;
        font-size: 14px;
      }

      .switchText a {
        color: #61efff;
        font-weight: 800;
      }

      @media (max-width: 980px) {
        .authWrap {
          grid-template-columns: 1fr;
          max-width: 560px;
        }

        .authSide {
          display: none;
        }

        .mobileBrand {
          display: flex;
        }
      }

      @media (max-width: 620px) {
        .authWrap {
          width: min(100% - 28px, 560px);
          padding: 28px 0;
        }

        .authCard {
          padding: 26px;
          border-radius: 28px;
        }
      }
    `}</style>
  );
}