import {
  Html,
  Body,
  Container,
  Text,
  Button,
  Hr,
} from "@react-email/components";

export function WithdrawalRequestEmail({
  interviewerName,
  interviewerEmail,
  credits,
  platformFee,
  netAmount,
  paymentMethod,
  paymentDetail,
  reviewUrl,
}) {
  return (
    <Html>
      <Body
        style={{
          backgroundColor: "#0a0a0b",
          fontFamily: "Georgia, serif",
          padding: "32px 16px",
        }}
      >
        <Container style={{ maxWidth: "480px", margin: "0 auto" }}>
          <Text
            style={{ fontSize: "22px", color: "#fbbf24", margin: "0 0 4px" }}
          >
            MockMate
          </Text>
          <Text
            style={{
              fontSize: "11px",
              color: "#57534e",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "0 0 32px",
            }}
          >
            Withdrawal Request
          </Text>

          <Text
            style={{ fontSize: "14px", color: "#d6d3d1", margin: "0 0 4px" }}
          >
            <strong>{interviewerName}</strong> ({interviewerEmail}) has
            requested a withdrawal.
          </Text>

          <Hr
            style={{ borderColor: "rgba(255,255,255,0.06)", margin: "24px 0" }}
          />

          {[
            ["Credits", credits],
            ["Platform fee (20%)", `− $${platformFee.toFixed(2)}`],
            ["Net payout", `$${netAmount.toFixed(2)}`],
            ["Method", paymentMethod],
            ["Send to", paymentDetail],
          ].map(([k, v]) => (
            <Text
              key={k}
              style={{ fontSize: "13px", color: "#a8a29e", margin: "0 0 8px" }}
            >
              {k}:{" "}
              <span
                style={{
                  color: k === "Net payout" ? "#fbbf24" : "#d6d3d1",
                  fontWeight: k === "Net payout" ? "700" : "400",
                }}
              >
                {v}
              </span>
            </Text>
          ))}

          <Hr
            style={{ borderColor: "rgba(255,255,255,0.06)", margin: "24px 0" }}
          />

          <Button
            href={reviewUrl}
            style={{
              backgroundColor: "#fbbf24",
              color: "#0a0a0b",
              fontSize: "14px",
              fontWeight: "700",
              padding: "12px 28px",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Review &amp; Approve →
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
