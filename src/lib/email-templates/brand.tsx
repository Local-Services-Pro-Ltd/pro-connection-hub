import * as React from "react";
import { Hr, Img, Link, Section, Text } from "@react-email/components";

/**
 * Shared TradesmanFinder branding for every transactional email: logo and
 * wordmark at the top, company details at the bottom. Images are absolute
 * PNG URLs because email clients don't load relative paths or SVG.
 */
const SITE = "https://tradesmanfinder.org";
const BRAND_ORANGE = "#F97316";

export function BrandHeader() {
  return (
    <Section style={header}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td style={{ verticalAlign: "middle", paddingRight: "10px" }}>
              <Link href={SITE}>
                <Img
                  src={`${SITE}/tradesmanfinder-v2-180.png`}
                  width="40"
                  height="40"
                  alt="TradesmanFinder"
                  style={{ display: "block", borderRadius: "4px" }}
                />
              </Link>
            </td>
            <td style={{ verticalAlign: "middle" }}>
              <Link href={SITE} style={wordmark}>
                Tradesman<span style={{ color: BRAND_ORANGE }}>Finder</span>
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function BrandFooter() {
  return (
    <Section>
      <Hr style={rule} />
      <Text style={footer}>
        <Link href={SITE} style={footerLink}>
          tradesmanfinder.org
        </Link>{" "}
        ·{" "}
        <Link href={`${SITE}/privacy`} style={footerLink}>
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="mailto:hello@tradesmanfinder.org" style={footerLink}>
          hello@tradesmanfinder.org
        </Link>
      </Text>
      <Text style={footer}>
        TradesmanFinder is run by Local Services Pro Ltd, registered in England &amp; Wales, company
        no. 12126782. Registered office: 38 Bloomfield Road, London, SE18 7JH.
      </Text>
    </Section>
  );
}

const header = {
  borderTop: `4px solid ${BRAND_ORANGE}`,
  padding: "18px 0 14px",
  marginBottom: "8px",
};
const wordmark = {
  fontFamily: "Arial, sans-serif",
  fontSize: "20px",
  fontWeight: 700,
  color: "#111827",
  textDecoration: "none",
};
const rule = { borderColor: "#e5e7eb", margin: "28px 0 14px" };
const footer = { fontSize: "12px", lineHeight: "18px", color: "#6b7280", margin: "0 0 6px" };
const footerLink = { color: "#6b7280", textDecoration: "underline" };
