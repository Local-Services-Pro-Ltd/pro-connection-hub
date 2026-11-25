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
  company?: string;
  inviteUrl?: string;
  profileUrl?: string;
  email?: string;
  expiresOn?: string;
}

const Email = ({ company, inviteUrl, profileUrl, email, expiresOn }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Take over the TradesmanFinder listing for {company ?? "your firm"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>{company} is listed on TradesmanFinder</Heading>
        <Text style={text}>
          TradesmanFinder helps homeowners find local trades. We have a listing for{" "}
          <strong>{company}</strong> and would like you to manage it.
        </Text>
        <Text style={text}>With your own account you can:</Text>
        <Text style={item}>Edit your profile, services and the areas you cover</Text>
        <Text style={item}>See jobs homeowners post near you and register your interest</Text>
        <Text style={item}>Show before-and-after photos of your work</Text>
        <Text style={item}>Receive enquiries from homeowners by email</Text>
        {inviteUrl ? (
          <Button style={button} href={inviteUrl}>
            Take over your listing
          </Button>
        ) : null}
        <Text style={text}>
          It takes a couple of minutes. You will be asked to create a free account using{" "}
          <strong>{email}</strong>, the address this invitation was sent to.
        </Text>
        {profileUrl ? (
          <Text style={text}>
            You can see the listing as homeowners see it here: <a href={profileUrl}>{profileUrl}</a>
          </Text>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          This link is personal to {company} and can be used once
          {expiresOn ? `, until ${expiresOn}` : ""}. Please don't forward it. If this isn't your
          firm, or you would rather not be listed, reply to hello@tradesmanfinder.org and we will
          sort it out.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Take over the TradesmanFinder listing for ${(data["company"] as string) || "your firm"}`,
  displayName: "Firm — invitation to take over a listing",
  previewData: {
    company: "Smith Plumbing",
    inviteUrl: "https://tradesmanfinder.org/invite/example",
    profileUrl: "https://tradesmanfinder.org/pro/smith-plumbing",
    email: "office@smithplumbing.example",
    expiresOn: "25 December 2026",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
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
const item = { ...text, margin: "0 0 6px", paddingLeft: "12px", borderLeft: "3px solid #F97316" };
