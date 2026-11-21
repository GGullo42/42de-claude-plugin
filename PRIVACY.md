# Privacy policy: 42de demo connector and plugin for Claude

Last updated: 21 November 2026

This policy covers the **42de demo connector** (the MCP server at `https://demo.42de.tech/mcp`) and
the **42de plugin for Claude** that uses it. It does not cover the 42de product or the 42de website;
see the general privacy policy at https://42de.tech/privacy for those.

This page is published at https://42de.tech/privacy/claude-demo.

## Who is responsible

42de GmbH
c/o Wayra Telefonica Germany GmbH & Co. OHG
Georg-Brauchle-Ring 50
80992 München
Germany

Email: jakob@42de.tech
Further details: https://42de.tech/imprint

## What the demo is

The demo answers questions about a **simulated** beverage-plant robot mission. Every answer comes from
fixed demo data that ships with the server. The demo has no user accounts, no sign-in, no cookies and
no tracking, and it does not connect to any real robot, plant or 42de installation.

## What data the demo processes

When you use the connector, Claude sends requests to the demo server on your behalf. These requests
contain only:

- the name of the demo tool being called, and
- its parameters, which are identifiers from the demo data: a scenario id (for example
  `cost-cascade`), a robot id (for example `a13`) or a what-if id (for example `drop:a12`).

The demo tools accept no free text, so your prompts and Claude's answers are not sent to the demo
server. Your conversation with Claude is handled by Anthropic under Anthropic's own privacy policy
(https://www.anthropic.com/legal/privacy). We do not receive it.

Like every web service, the demo also receives **technical connection data**: the IP address the
request comes from, the time, and HTTP headers such as the user agent. When you use Claude on the web
or in the desktop app, this is usually an Anthropic server address, not yours.

## What we store, and for how long

- **The demo server** keeps no record of requests. Its operational log (AWS CloudWatch, Frankfurt)
  holds only start-up messages, error types with a random request id (for example
  `request error: entity.parse.failed (400)`), and AWS platform records with per-minute request counts,
  CPU time and memory use. It contains no request content and no IP addresses. These logs are kept
  for **30 days**.
- **Rate limiting** counts requests per IP address in memory for one minute, to stop a single client
  from overloading the demo. The counts are not written anywhere.
- **Security filtering** (AWS WAF) inspects requests for attacks. AWS keeps a small sample of recent
  requests, including IP address and headers, for up to **3 hours** for troubleshooting.
- **Aggregated metrics** (request counts, error rates, latency) contain no personal data.

We do not use the data for advertising or profiling, we do not sell it, and we do not combine it
with other data.

## Service providers

The demo runs on **Amazon Web Services** (Amazon Web Services EMEA SARL, Luxembourg): the server in
the AWS Frankfurt region (Germany) and the CloudFront content-delivery network, whose edge locations
may be outside the EU. AWS processes the data on our behalf under its data processing addendum, which
includes the EU Standard Contractual Clauses for transfers outside the EU.

## Legal basis

We process the technical connection data to operate the demo and keep it secure and available. The
legal basis is our legitimate interest under Art. 6(1)(f) GDPR.

## Your rights

Under the GDPR you have the right to access, rectification, erasure, restriction of processing, data
portability and objection. To exercise them, write to jakob@42de.tech. Because we store no
request records, we usually hold no data that can be linked to you. You also have the right to lodge
a complaint with a data protection supervisory authority, for example the one in your country of
residence or the one responsible for us: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA),
Promenade 18, 91522 Ansbach, Germany (https://www.lda.bayern.de).

## Changes

If the demo changes in a way that affects this policy, we update this page and the date above.
