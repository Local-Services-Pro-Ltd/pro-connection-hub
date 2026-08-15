import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  postcode?: string;
  role?: "homeowner" | "trader";
  confirmUrl?: string;
}

const Email = ({ name, postcode, role, confirmUrl }: Props) => {
  const who =
    role === "trader"
      ? "get you set up with local work"
      : "help you find a trusted local tradesman";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Confirm your TradesmanFinder waiting-list place</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>Confirm your waiting-list place</Heading>
          <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
          <Text style={text}>
            Thanks for joining the waiting list
            {postcode ? ` for ${postcode}` : ""}. One quick step and you're in —
            confirm your email address so we can {who} the moment we open in
            your area.
          </Text>
          {confirmUrl ? (
            <>
              <Button style={button} href={confirmUrl}>
                Confirm my place
              </Button>
              <Text style={small}>
                Or paste this into your browser:{" "}
                <Link href={confirmUrl} style={link}>
                  {confirmUrl}
                </Link>
              </Text>
            </>
          ) : null}
          <Hr style={rule} />
          <Text style={small}>
            Didn't sign up? Ignore this email and nothing happens — we won't add
            you or contact you again.
          </Text>
          <Text style={small}>
            TradesmanFinder is part of Local Services Pro and All Care 4 U
            Group.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: "Confirm your TradesmanFinder waiting-list place",
  displayName: "Waiting list — confirm email",
  previewData: {
    name: "Jane",
    postcode: "SE15 4TR",
    role: "homeowner",
    confirmUrl: "https://tradesmanfinder.org/waiting-list/confirm?token=demo",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: "#1b1a19",
};

const container = { maxWidth: "560px", margin: "0 auto", padding: "32px 24px" };

const eyebrow = {
  fontSize: "12px",
  letterSpacing: "0.16em",
  color: "#b4531f",
  margin: "0 0 24px",
  fontWeight: 700,
};

const heading = {
  fontSize: "24px",
  lineHeight: "1.25",
  margin: "0 0 16px",
  color: "#1b1a19",
};

const text = { fontSize: "16px", lineHeight: "1.6", margin: "0 0 16px" };

const button = {
  display: "inline-block",
  backgroundColor: "#b4531f",
  color: "#ffffff",
  borderRadius: "4px",
  padding: "12px 24px",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  margin: "8px 0 20px",
};

const small = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#5c5854",
  margin: "0 0 10px",
  wordBreak: "break-word" as const,
};

const link = { color: "#b4531f" };

const rule = { borderColor: "#e6e2dd", margin: "24px 0" };
