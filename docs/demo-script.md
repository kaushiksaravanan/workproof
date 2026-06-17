# WorkProof — Demo Script

## Elevator Pitch (3 lines)

WorkProof turns scattered work artifacts — commits, docs, tickets, chats — into verifiable proof of what you actually shipped.
One click generates a signed, timestamped summary your manager, client, or compliance team can trust.
No more screenshot collages or status-update theater: your work proves itself.

## 30-Second Short Version

"Every week you spend hours assembling status updates from Git, Jira, Slack, and Google Docs. WorkProof connects to those sources, pulls the artifacts you produced, and renders a tamper-evident weekly proof — with links, diffs, and cryptographic signatures. Managers stop nagging, auditors stop digging, and you stop writing the same update twice. Demo takes 90 seconds."

## 90-Second Demo Script

| Time | What user does (on-stage) | What to say | Risk + fallback |
|---|---|---|---|
| 0:00–0:10 | Open landing page; cursor hovers the "Generate Proof" button | "This is WorkProof. Under the hood it's already connected to my GitHub, Linear, and Slack. I haven't written a status update in six weeks." | Wi-Fi flake — keep a screenshot of the landing page in slide 2 of the deck; cmd-tab if the page stalls. |
| 0:10–0:20 | Click "Generate Proof — Last 7 Days" | "One click. It's pulling commits, merged PRs, closed tickets, and the docs I edited." | Backend cold start could take 4–6s. Fill the silence: "Cold start the first time, instant after that." Have a pre-warmed tab in window 2 as fallback. |
| 0:20–0:35 | Proof renders: timeline view with 4 swimlanes (code / docs / tickets / decisions) | "Notice the swimlanes — code, docs, tickets, decisions. Every item is a real artifact with a permalink. Nothing is invented, nothing is paraphrased." | If timeline overflows on projector resolution, hit cmd-minus once before clicking generate. |
| 0:35–0:50 | Hover over a commit card; tooltip shows diff stats + signed hash | "Each card carries a SHA, a timestamp, and a signature from the source system. This isn't a summary — it's evidence." | Tooltip can lag on first hover. Hover once during setup so the asset is cached. |
| 0:50–1:05 | Click "Export → Signed PDF"; PDF preview slides in | "Export as a signed PDF. The signature chains back to the source — your manager or auditor can verify any line item independently." | PDF generation is the slowest step (~3s). Narrate the value during the wait; do not silently watch the spinner. |
| 1:05–1:20 | Switch to Slack tab; paste the WorkProof link into #standup | "Drop the link in standup. Teammates see the same proof, no screen-share gymnastics." | Slack auth could prompt re-login on demo machine. Stay logged in; disable Slack auto-update the morning of. |
| 1:20–1:30 | Cut back to WorkProof; click "Schedule weekly auto-send" toggle | "Flip this and it sends itself every Friday at 4pm. That's the demo — receipts, not reports." | If the toggle animation glitches, just say the line — the visual is nice-to-have, not load-bearing. |

## Pre-Demo Checklist

- Pre-warm: open WorkProof, generate one proof, leave the tab idle (not closed). Cold start is the #1 risk.
- Disable notifications: Slack, Teams, Mail, calendar, system updates.
- Display: 1080p mirrored, 125% zoom in the browser, dev tools closed.
- Backup: 60-second screen recording of a successful run on the desktop, named `workproof-demo-backup.mp4`. If anything dies past 0:30, switch to it and narrate live.
- Network: tether to phone hotspot as failover; have it paired before you walk on.

## Recovery Lines (if something breaks)

- Generation fails: "That's the live system being honest with us — let me show you the recorded run, same flow."
- PDF won't export: "I'll skip the export step — the signed link is the primary artifact anyway."
- Slack post fails: "Pretend I pasted it; the point is the link is portable — Slack, email, Notion, anywhere."
