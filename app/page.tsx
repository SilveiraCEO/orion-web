"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const Orb3D = dynamic(() => import("@/components/Orb3D"), {
  ssr: false,
});

export default function HomePage() {
  return (
    <main className="orionLanding">
      <div className="backgroundGrid" />
      <div className="backgroundGlow glowOne" />
      <div className="backgroundGlow glowTwo" />

      <div className="pageWrap">
        <header className="header">
          <Link href="/" className="brand">
            <div className="brandIcon">
              <span />
            </div>

            <div>
              <p>Autonomous Commerce Intelligence</p>
              <strong>ORION</strong>
            </div>
          </Link>

          <nav className="nav">
            <Link href="/login" className="btn ghost">
              Entrar
            </Link>

            <Link href="/register" className="btn primary">
              Criar conta <span>→</span>
            </Link>
          </nav>
        </header>

        <section className="hero">
          <div className="heroText">
            <p className="eyebrow">Command center for modern commerce</p>

            <h1>
              A IA que pensa, fala e opera como seu{" "}
              <span>núcleo de comando.</span>
            </h1>

            <p className="subtitle">
              Um assistente com voz, memória, múltiplos modelos de IA e uma
              central premium para análise, criação e operação de e-commerce.
            </p>

            <div className="actions">
              <Link href="/register" className="btn big primary">
                Começar agora <span>→</span>
              </Link>

              <Link href="/login" className="btn big ghost">
                Já tenho conta
              </Link>
            </div>

            <div className="features">
              <FeatureCard
                title="Multi-IA"
                text="Roteamento inteligente entre modelos conforme a tarefa."
              />

              <FeatureCard
                title="Voice Mode"
                text="Conversas por voz com experiência natural e fluida."
              />

              <FeatureCard
                title="Command UI"
                text="Interface premium para tomar decisões e executar ações."
              />
            </div>
          </div>

          <div className="orbPanel">
            <Orb3D speakingLevel={0.08} />
          </div>
        </section>
      </div>

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

        .orionLanding {
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
          filter: blur(80px);
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

        .pageWrap {
          position: relative;
          z-index: 2;
          width: min(100% - 48px, 1280px);
          min-height: 100vh;
          margin: 0 auto;
          padding: 28px 0;
          display: flex;
          flex-direction: column;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 24px;
          border: 1px solid rgba(97, 239, 255, 0.13);
          border-radius: 30px;
          background: rgba(7, 18, 36, 0.74);
          backdrop-filter: blur(22px);
          box-shadow: 0 0 60px rgba(97, 239, 255, 0.045);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
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

        .brand strong {
          display: block;
          margin-top: 6px;
          font-size: 22px;
          letter-spacing: 0.34em;
          color: #eaffff;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 17px;
          font-size: 14px;
          font-weight: 800;
          transition: transform 0.25s ease, box-shadow 0.25s ease,
            background 0.25s ease, border-color 0.25s ease;
          white-space: nowrap;
        }

        .btn span {
          transition: transform 0.25s ease;
        }

        .btn:hover {
          transform: translateY(-2px);
        }

        .btn:hover span {
          transform: translateX(3px);
        }

        .btn.primary {
          border: 1px solid rgba(97, 239, 255, 0.75);
          background: linear-gradient(135deg, #61efff, #21b7ff);
          color: #03101c;
          box-shadow: 0 0 26px rgba(97, 239, 255, 0.18);
        }

        .btn.primary:hover {
          box-shadow: 0 0 34px rgba(97, 239, 255, 0.34);
        }

        .btn.ghost {
          border: 1px solid rgba(97, 239, 255, 0.16);
          background: rgba(97, 239, 255, 0.055);
          color: #d8fbff;
        }

        .btn.ghost:hover {
          border-color: rgba(97, 239, 255, 0.38);
          background: rgba(97, 239, 255, 0.095);
          box-shadow: 0 0 24px rgba(97, 239, 255, 0.11);
        }

        .btn.big {
          min-height: 58px;
          padding: 0 28px;
          border-radius: 20px;
          font-size: 16px;
        }

        .hero {
          flex: 1;
          display: grid;
          grid-template-columns: 1.02fr 0.98fr;
          gap: 56px;
          align-items: center;
          padding: 72px 0 48px;
        }

        .heroText {
          max-width: 720px;
        }

        .eyebrow {
          margin: 0;
          color: #61efff;
          font-size: 11px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
        }

        h1 {
          margin: 28px 0 0;
          font-size: clamp(48px, 6vw, 86px);
          line-height: 1.02;
          letter-spacing: -0.05em;
          font-weight: 950;
        }

        h1 span {
          background: linear-gradient(135deg, #ffffff, #8df4ff, #bca8ff);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          margin: 26px 0 0;
          max-width: 650px;
          color: #8ea4c4;
          font-size: 18px;
          line-height: 1.75;
        }

        .actions {
          margin-top: 38px;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .features {
          margin-top: 52px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .featureCard {
          padding: 22px;
          border-radius: 26px;
          border: 1px solid rgba(97, 239, 255, 0.13);
          background: rgba(9, 23, 42, 0.76);
          box-shadow: 0 0 28px rgba(97, 239, 255, 0.04);
          transition: transform 0.25s ease, border-color 0.25s ease,
            box-shadow 0.25s ease, background 0.25s ease;
        }

        .featureCard:hover {
          transform: translateY(-5px);
          border-color: rgba(97, 239, 255, 0.3);
          background: rgba(97, 239, 255, 0.055);
          box-shadow: 0 0 32px rgba(97, 239, 255, 0.1);
        }

        .featureLine {
          width: 44px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #61efff, #7b61ff);
          margin-bottom: 16px;
        }

        .featureCard h3 {
          margin: 0;
          color: #dffcff;
          font-size: 16px;
        }

        .featureCard p {
          margin: 10px 0 0;
          color: #8ea4c4;
          font-size: 14px;
          line-height: 1.65;
        }

        .orbPanel {
  position: relative;
  min-height: 620px;
  border-radius: 38px;
  border: 1px solid rgba(97, 239, 255, 0.12);
  background: rgba(7, 18, 36, 0.62);
  backdrop-filter: blur(22px);
  overflow: hidden;
  box-shadow: 0 0 70px rgba(97, 239, 255, 0.06);

  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

        .orbPanel::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 35%, rgba(97, 239, 255, 0.08), transparent 34%),
    radial-gradient(circle at 72% 72%, rgba(123, 97, 255, 0.08), transparent 24%);
  pointer-events: none;
}

.orbPanel > :global(*) {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

        @media (max-width: 1024px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .orbPanel {
            min-height: 520px;
          }
        }

        @media (max-width: 760px) {
          .pageWrap {
            width: min(100% - 28px, 1280px);
          }

          .header {
            flex-direction: column;
            align-items: stretch;
          }

          .nav {
            width: 100%;
          }

          .nav .btn {
            flex: 1;
          }

          .features {
            grid-template-columns: 1fr;
          }

          .hero {
            padding-top: 46px;
          }

          h1 {
            font-size: clamp(42px, 13vw, 64px);
          }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="featureCard">
      <div className="featureLine" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}