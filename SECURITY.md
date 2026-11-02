# Security

This document tells people how to report a security problem in Agent Policy Kit (APK), the published npm package `agent-policy-kit`. It is for users and security researchers.

## What APK can affect

APK changes local native configuration files of AI coding assistants. The role files and routing instructions that it writes are guidance for the main agent. They are not a universal security boundary or billing boundary. Higher-priority settings and explicit client options can override them.

## Report a defect

Open an issue with a minimal reproduction in a temporary profile. Never attach credentials, account configurations, backups or private state.

## Report a vulnerability

A vulnerability is a problem that can expose private data or corrupt settings. Do not describe it in a public issue.

GitHub private vulnerability reporting is not enabled for this repository.

1. Open an [issue](https://github.com/automatis-tools/agent-policy-kit/issues) that asks for a private contact. Do not include details of the problem in that issue.
2. Wait for the maintainer to give you a private channel.
3. Send the details only through the private channel.
