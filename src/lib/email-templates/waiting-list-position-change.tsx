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
  previousPosition?: number;
  actionUrl?: string;
}

const Email = ({
  name,
  areaName,
  postcode,
  role,
  queuePosition,
  previousPosition,
  actionUrl,
}: Props) => {
  const where = areaName || postcode || "your area";
  const isTrader = role === "trader";
  const moved =
    typeof queuePosition === "number" && typeof previousPosition === "number"
      ? previousPosition - queuePosition
      : 0;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`You're now number ${queuePosition ?? ""} in the queue for ${where}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>
            {moved > 0
              ? `You've moved up the queue in ${where}.`
              : `Your place in ${where} has changed.`}
          </Heading>
          <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
          <Text style={text}>
            {`Now that ${where} is live we're working through the queue in order. You're currently number ${queuePosition ?? "—"}`}
            {typeof previousPosition === "number"
              ? ` (you were ${previousPosition})`
              : ""}
            .
          </Text>
          <Text style={text}>
            {isTrader
              ? "Finish your profile now so you're ready when the first local jobs land."
              : "You can post your job whenever you're ready — vetted local trades will come back to you."}
          </Text>
          {actionUrl ? (
            <Button style={button} href={actionUrl}>
              {isTrader ? "Finish your profile" : "Post a job"}
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={small}>
            You're getting this because you asked for launch updates for this
            postcode area. You can change that from the link in your
            confirmation email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = { backgroundColor: "#0f1113", fontFamily: "Helvetica, Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "32px 28px",
  maxWidth: "560px",
  backgroundColor: "#17191c",
  borderRadius: "10px",
};
const eyebrow = {
  color: "#e2703a",
  fontSize: "11px",
  letterSpacing: "2px",
  margin: "0 0 12px",
};
const heading = { color: "#f5f4f2", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#cfcdc9", fontSize: "15px", lineHeight: "24px" };
const small = { color: "#8b8885", fontSize: "12px", lineHeight: "18px" };
const hr = { borderColor: "#2a2d31", margin: "28px 0 16px" };
const button = {
  backgroundColor: "#e2703a",
  borderRadius: "6px",
  color: "#12100e",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `You're number ${String(data["queuePosition"] ?? "")} in the queue for ${String(
      data["areaName"] ?? data["postcode"] ?? "your area",
    )}`,
  displayName: "Waiting list — queue position changed",
  previewData: {
    name: "Sam",
    areaName: "Maidstone",
    postcode: "ME14 1AA",
    role: "homeowner",
    queuePosition: 4,
    previousPosition: 9,
    actionUrl: "https://www.tradesmanfinder.org/post-job",
  },
} satisfies TemplateEntry;
