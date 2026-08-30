import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Failure {
  suite?: string;
  check_name?: string;
  detail?: string;
}

interface Props {
  failures?: Failure[];
  total?: number;
  ranAt?: string;
  environment?: string;
}

const Email = ({ failures = [], total = 0, ranAt, environment }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {`TradesmanFinder security scan: ${failures.length} failing check(s)`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>TRADESMANFINDER · SECURITY</Text>
        <Heading style={heading}>
          {failures.length} security check{failures.length === 1 ? "" : "s"}{" "}
          failed
        </Heading>
        <Text style={text}>
          The scheduled security regression scan ran{ranAt ? ` at ${ranAt}` : ""}
          {environment ? ` on ${environment}` : ""} and found problems in{" "}
          {failures.length} of {total} checks.
        </Text>
        <Hr style={rule} />
        {failures.map((f, i) => (
          <Text key={i} style={item}>
            <strong>
              {f.suite}/{f.check_name}
            </strong>
            <br />
            {f.detail}
          </Text>
        ))}
        <Hr style={rule} />
        <Text style={small}>
          Review the findings in the admin area under Plan settings → Security.
          This alert is sent automatically after each deployment scan.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: "#f6f4f1", fontFamily: "Helvetica, Arial, sans-serif", color: "#1b1a19" };
const container = { backgroundColor: "#ffffff", padding: "32px", maxWidth: "560px", margin: "24px auto" };
const eyebrow = { fontSize: "12px", letterSpacing: "0.12em", color: "#b4531f", margin: "0 0 12px", fontWeight: 700 };
const heading = { fontSize: "24px", lineHeight: "1.25", margin: "0 0 16px", color: "#1b1a19" };
const text = { fontSize: "16px", lineHeight: "1.6", margin: "0 0 16px" };
const item = { fontSize: "14px", lineHeight: "1.6", margin: "0 0 12px", color: "#3b3835" };
const small = { fontSize: "13px", lineHeight: "1.6", color: "#5c5854", margin: "0" };
const rule = { borderColor: "#e6e2dd", margin: "24px 0" };

export const template: TemplateEntry = {
  component: Email,
  subject: (data) =>
    `[TradesmanFinder] ${((data["failures"] as Failure[]) ?? []).length} security check(s) failing`,
  displayName: "Security scan alert",
  to: "office@allcare4u.co.uk",
  previewData: {
    total: 9,
    ranAt: new Date().toISOString(),
    environment: "production",
    failures: [
      {
        suite: "posture",
        check_name: "no_anon_writes_on_sensitive_tables",
        detail: "granted: pros.INSERT",
      },
    ],
  },
};
