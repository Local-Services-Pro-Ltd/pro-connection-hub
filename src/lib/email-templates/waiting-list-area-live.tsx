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
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  areaName?: string;
  postcode?: string;
  role?: "homeowner" | "trader" | string;
  queuePosition?: number;
  actionUrl?: string;
}

const Email = ({
  name,
  areaName,
  postcode,
  role,
  queuePosition,
  actionUrl,
}: Props) => {
  const where = areaName || postcode || "your area";
  const isTrader = role === "trader";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`TradesmanFinder is now live in ${where}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>{`We're live in ${where}.`}</Heading>
          <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
          <Text style={text}>
            You asked to hear the moment we opened
            {postcode ? ` in ${postcode}` : ""} — that day is today.
            {typeof queuePosition === "number" && queuePosition > 0
              ? ` You were number ${queuePosition} in the queue for this area, so you're among the first in.`
              : ""}
          </Text>
          <Text style={text}>
            {isTrader
              ? "Get your profile in front of local homeowners before the first jobs land."
              : "Post your job and vetted local trades will come back to you with real quotes."}
          </Text>
          {actionUrl ? (
            <Button style={button} href={actionUrl}>
              {isTrader ? "Set up your profile" : "Post a job"}
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={small}>
            You're getting this because you joined the TradesmanFinder waiting
            list for this postcode area.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `TradesmanFinder is live in ${String(data["areaName"] ?? data["postcode"] ?? "your area")}`,
  displayName: "Waiting list — area is live",
  previewData: {
    name: "Sam",
    areaName: "Manchester",
    postcode: "M1 4BT",
    role: "homeowner",
    queuePosition: 12,
    actionUrl: "https://www.tradesmanfinder.org/post-job",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
};
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "2px",
  color: "#9a6b3f",
  fontWeight: 700 as const,
  margin: "0 0 12px",
};
const heading = {
  fontSize: "26px",
  lineHeight: "1.25",
  color: "#191919",
  margin: "0 0 20px",
};
const text = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#333333",
  margin: "0 0 16px",
};
const button = {
  backgroundColor: "#d2601a",
  color: "#ffffff",
  borderRadius: "4px",
  padding: "13px 26px",
  fontSize: "15px",
  fontWeight: 700 as const,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
};
const hr = { borderColor: "#e6e6e6", margin: "28px 0 16px" };
const small = { fontSize: "12px", lineHeight: "1.6", color: "#777777" };
