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

interface Props {
  company?: string;
  contactName?: string;
  reference?: string;
  status?: string;
  reviewerNote?: string;
  statusUrl?: string;
}

const HEADLINES: Record<string, string> = {
  submitted: "We've got your certification application.",
  pending: "Your application is back in the queue.",
  in_review: "Your application is now being checked.",
  approved: "Your firm has passed our checks.",
  rejected: "We can't certify your firm yet.",
};

const BODIES: Record<string, string> = {
  submitted:
    "A human reads every application. We verify your insurance, registration and accreditations with the bodies that issued them — usually within two working days.",
  pending:
    "We've moved your application back to the queue while we wait on something. You don't need to do anything unless we ask.",
  in_review:
    "One of our team is checking your paperwork with the issuing bodies now. We'll come back to you as soon as it's done.",
  approved:
    "Everything checked out. We'll be in touch about getting your profile live and taking local work.",
  rejected:
    "We couldn't verify everything we need. The note below explains exactly what was missing — you're welcome to apply again once it's sorted.",
};

const Email = ({
  company,
  contactName,
  reference,
  status,
  reviewerNote,
  statusUrl,
}: Props) => {
  const key = status ?? "submitted";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${HEADLINES[key] ?? "Certification update"} (${reference ?? ""})`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>
            {HEADLINES[key] ?? "Certification update"}
          </Heading>
          <Text style={text}>
            {contactName ? `Hi ${contactName},` : "Hi there,"}
          </Text>
          <Text style={text}>{BODIES[key] ?? BODIES["submitted"]}</Text>
          <Text style={text}>
            {`Firm: ${company ?? "—"}`}
            <br />
            {`Reference: ${reference ?? "—"}`}
          </Text>
          {reviewerNote ? (
            <Text style={note}>{`Note from the reviewer: ${reviewerNote}`}</Text>
          ) : null}
          {statusUrl ? (
            <Button style={button} href={statusUrl}>
              Track your application
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={small}>
            You're getting this because your firm applied for TradesmanFinder
            certification. Keep the tracking link — it's the only way to see
            your progress.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#0f1113",
  fontFamily: "Helvetica, Arial, sans-serif",
};
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
const note = {
  color: "#f5f4f2",
  fontSize: "15px",
  lineHeight: "24px",
  backgroundColor: "#1f2226",
  borderLeft: "3px solid #e2703a",
  padding: "12px 16px",
};
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
  subject: (data: Record<string, unknown>) => {
    const status = String(data["status"] ?? "submitted");
    const ref = String(data["reference"] ?? "");
    const label =
      status === "approved"
        ? "Your firm passed our checks"
        : status === "rejected"
          ? "Update on your certification application"
          : status === "in_review"
            ? "We're checking your application"
            : status === "submitted"
              ? "We've received your application"
              : "Certification application update";
    return ref ? `${label} (${ref})` : label;
  },
  displayName: "Certification application status",
  previewData: {
    company: "Ember Plumbing Ltd",
    contactName: "Sam",
    reference: "TFC-1A2B3C4D",
    status: "in_review",
    reviewerNote: "Waiting on your public liability certificate.",
    statusUrl: "https://tradesmanfinder.org/application-status?token=demo",
  },
};
