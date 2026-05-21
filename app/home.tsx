import { useEffect, useState } from "react";
import { Image } from "react-native";
import logo from "../assets/logo.png";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
        <div style={styles.logoWrap}>
          <Image source={logo} style={styles.logoImg} resizeMode="contain" />
        </div>

        <div style={styles.navRight}>
          <a
            href="https://api.searlio.com/paid-leads"
            target="_blank"
            rel="noreferrer"
            style={styles.navLink}
          >
            Demo
          </a>
          <a
            href="https://api.searlio.com/docs"
            target="_blank"
            rel="noreferrer"
            style={styles.navLink}
          >
            API
          </a>
        </div>
      </div>

      <main style={styles.container}>
        <section
          style={{
            ...styles.hero,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s ease",
          }}
        >
          <h1 style={styles.heading}>
            Only What Matters. Right When You Need It.
          </h1>

          <p style={styles.subheading}>
            Searlio helps service businesses respond faster to paid leads by
            surfacing what matters and cutting through the noise.
          </p>

          <div style={styles.buttonRow}>
            <a
              href="/pending"
              target="_blank"
              rel="noreferrer"
              style={{
                ...styles.primaryBtn,
                transform:
                  hovered === "primary" ? "translateY(-2px)" : "translateY(0)",
                boxShadow:
                  hovered === "primary"
                    ? "0 8px 20px rgba(6,182,212,0.4)"
                    : "none",
              }}
              onMouseEnter={() => setHovered("primary")}
              onMouseLeave={() => setHovered(null)}
            >
              View Dashboard
            </a>

            <a
              href="https://api.searlio.com/paid-leads"
              target="_blank"
              rel="noreferrer"
              style={{
                ...styles.secondaryBtn,
                transform:
                  hovered === "secondary"
                    ? "translateY(-2px)"
                    : "translateY(0)",
                borderColor: hovered === "secondary" ? "#06b6d4" : "#334155",
              }}
              onMouseEnter={() => setHovered("secondary")}
              onMouseLeave={() => setHovered(null)}
            >
              Try Demo
            </a>
          </div>
        </section>

        <section style={styles.section}>
          <p style={{ ...styles.p, textAlign: "center", fontWeight: 600 }}>
            Faster response • Less noise • More jobs from the leads you already
            paid for
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Built for businesses that pay for leads</h2>
          <p style={styles.p}>
            If you use Angi, Thumbtack, or similar platforms — speed wins.
          </p>
          <p style={styles.p}>
            The first response gets the job. Everyone else wastes money.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Most leads are lost before you even see them</h2>
          <ul style={styles.ul}>
            <li>Notifications get buried under texts and calls</li>
            <li>You’re busy working when leads come in</li>
            <li>By the time you respond, someone else already won</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Searlio keeps you in the race</h2>
          <ul style={styles.ul}>
            <li>Flags new leads instantly</li>
            <li>Filters out everything that doesn’t matter</li>
            <li>Generates replies so you can respond fast</li>
          </ul>

          <p style={styles.p}>
            Optional hands-free voice alerts for leads that can’t wait.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>
            This isn’t about notifications. It’s about revenue.
          </h2>
          <p style={styles.p}>You already paid for the lead.</p>
          <p style={styles.p}>Searlio helps you win it.</p>

          <div style={styles.buttonRow}>
            <a
              href="/pending"
              target="_blank"
              rel="noreferrer"
              style={{
                ...styles.primaryBtn,
                transform:
                  hovered === "primary2" ? "translateY(-2px)" : "translateY(0)",
                boxShadow:
                  hovered === "primary2"
                    ? "0 8px 20px rgba(6,182,212,0.4)"
                    : "none",
              }}
              onMouseEnter={() => setHovered("primary2")}
              onMouseLeave={() => setHovered(null)}
            >
              View Dashboard
            </a>

            <a
              href="https://api.searlio.com/paid-leads"
              target="_blank"
              rel="noreferrer"
              style={{
                ...styles.secondaryBtn,
                transform:
                  hovered === "secondary2"
                    ? "translateY(-2px)"
                    : "translateY(0)",
                borderColor: hovered === "secondary2" ? "#06b6d4" : "#334155",
              }}
              onMouseEnter={() => setHovered("secondary2")}
              onMouseLeave={() => setHovered(null)}
            >
              Try Demo
            </a>
          </div>
        </section>

        <section style={styles.cta}>
          <h2 style={styles.h2}>Stop losing leads you already paid for</h2>

          <p style={styles.p}>
            The first response gets the job. We make sure it&apos;s yours.
          </p>

          <div style={styles.buttonRow}>
            <a
              href="https://api.searlio.com/paid-leads"
              target="_blank"
              rel="noreferrer"
              style={{
                ...styles.primaryBtn,
                transform:
                  hovered === "demo2" ? "translateY(-2px)" : "translateY(0)",
                boxShadow:
                  hovered === "demo2"
                    ? "0 8px 20px rgba(6,182,212,0.4)"
                    : "none",
              }}
              onMouseEnter={() => setHovered("demo2")}
              onMouseLeave={() => setHovered(null)}
            >
              Try Demo
            </a>

            <a
              href="mailto:jhnnywtsn@gmail.com"
              style={{
                ...styles.secondaryBtn,
                transform:
                  hovered === "setup" ? "translateY(-2px)" : "translateY(0)",
                borderColor: hovered === "setup" ? "#06b6d4" : "#334155",
                boxShadow:
                  hovered === "setup"
                    ? "0 8px 20px rgba(6,182,212,0.18)"
                    : "none",
              }}
              onMouseEnter={() => setHovered("setup")}
              onMouseLeave={() => setHovered(null)}
            >
              Book Setup
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    overflowY: "auto",
    background: "#0b0f14",
    color: "white",
    fontFamily: "system-ui, sans-serif",
  },

  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
  },

  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },

  logoWrap: {
    filter: "drop-shadow(0 0 10px rgba(6,182,212,0.5))",
  },

  logoImg: {
    width: 160,
    height: 100,
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },

  navLink: {
    color: "#9ca3af",
    textDecoration: "none",
    fontSize: "14px",
  },

  container: {
    padding: "60px 20px 40px",
  },

  hero: {
    textAlign: "center",
    marginBottom: "60px",
    background:
      "radial-gradient(circle at top, rgba(6,182,212,0.08), transparent 70%)",
    padding: "80px 20px",
    borderRadius: "16px",
  },

  heading: {
    fontSize: "42px",
    fontWeight: 700,
    marginBottom: "20px",
    letterSpacing: "-0.5px",
  },

  subheading: {
    fontSize: "18px",
    color: "#9ca3af",
    maxWidth: "600px",
    margin: "0 auto 30px",
  },

  section: {
    maxWidth: "700px",
    margin: "0 auto 50px",
  },

  h2: {
    fontSize: "26px",
    marginBottom: "15px",
  },

  p: {
    fontSize: "16px",
    color: "#cbd5e1",
    marginBottom: "10px",
  },

  ul: {
    paddingLeft: "20px",
    color: "#cbd5e1",
    lineHeight: 1.8,
  },

  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },

  primaryBtn: {
    padding: "12px 20px",
    background: "#06b6d4",
    color: "#0b0f14",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 600,
    transition: "all 0.18s ease",
  },

  secondaryBtn: {
    padding: "12px 20px",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "white",
    textDecoration: "none",
    transition: "all 0.18s ease",
  },

  cta: {
    textAlign: "center",
    marginTop: "60px",
    paddingBottom: "40px",
  },
};