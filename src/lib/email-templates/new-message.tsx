import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { BrandFooter, BrandHeader } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  greeting?: string;
  from?: string;
  reference?: string;
  title?: string;
  snippet?: string;
  url?: string;
  action?: string;
  where?: string;
}

const Email = ({ greeting, from, reference, title, snippet, url, action, where }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      New message from {from ?? "TradesmanFinder"} about job {reference ?? ""}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>You have a message from {from}</Heading>
        <Text style={text}>{greeting ? `Hello ${greeting},` : "Hello,"}</Text>
        <Text style={item}>Job: {reference}</Text>
        {title ? <Text style={item}>{title}</Text> : null}
        <Text style={quote}>{snippet}</Text>
        {url ? (
          <Button style={button} href={url}>
            {action ?? "Read and reply"}
          </Button>
        ) : null}
        <Text style={text}>
          Please reply on TradesmanFinder, in {where}. Replies to this email are not delivered to
          the other person.
        </Text>
        <Hr style={rule} />
        <Text style={small}>
          Keep what you agree, especially price, dates and payments, in writing. If further messages
          arrive in the next few minutes we won't email you again straight away, so check the page.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `New message from ${(data["from"] as string) || "TradesmanFinder"} about job ${(data["reference"] as string) ?? ""}`.trim(),
  displayName: "Message — new message notification",
  previewData: {
    greeting: "Alex",
    from: "Smith Plumbing",
    reference: "E704189A",
    title: "Replace a leaking kitchen tap",
    snippet: "Could you send a photo of the pipework under the sink?",
    url: "https://tradesmanfinder.org/job-status?t=example",
    action: "Read and reply",
    where: "your private job page",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const item = { ...text, margin: "0 0 6px" };
const quote = { ...text, borderLeft: "3px solid #e5e7eb", paddingLeft: "12px" };
const small = { fontSize: "13px", lineHeight: "21px", color: "#6b7280" };
const button = {
  backgroundColor: "#c2410c",
  color: "#ffffff",
  borderRadius: "6px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "18px 0",
};
const rule = { borderColor: "#e5e7eb", margin: "24px 0" };
