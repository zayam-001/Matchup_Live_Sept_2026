# Matchup Global Vision & Agent Instructions

This document defines the persistent architectural blueprint, development principles, and long-term vision of the **Matchup** ecosystem. It is designed to guide Google Gemini models and human developers in maintaining absolute alignment across current and future interconnected web applications.

---

## 🌌 The Grand Vision: Ecosystem Architecture

Our goal is to build a high-performance, globally professional sports tournament ecosystem. Rather than cramming all features into a single bloated codebase, the Matchup platform is split into a **federated multi-project micro-frontend network**, where each application has a dedicated role, but all share a single high-efficiency Firestore database.

### Phase 1: Core Padel Operations
This app serves as the **Control Tower and Command Center (Admin Dashboard)** for Padel Tournaments (`app.matchup.com.pk`).
- **Admin Dashboard**: Tournament configuration, match generation, manual onboarding, score entry, referee tools, and ELO calculations.
- **Player Merge Engine**: The profile-merging logic that detects manual tournament registries matching registered platform user profiles to consolidate game history.
- **Broadcast Exporter (StandingsOverlayExporter)**: Television-style overlay graphics for social streams, with automated GIF rendering and high-res ZIP slide PNG bulk downloads.

### Phase 2 & 3: Interconnected Micro-Apps
1. **Spectator Mode** (`live.matchup.com.pk`):
   - A client-only, lightweight spectator page optimized for low-latency OBS rendering.
   - Real-time Firestore socket listeners displaying scoreboards, group tables, and playoff bracket progress.
2. **Landing App** (`www.matchup.com.pk`):
   - Public-facing homepage designed with high-contrast display typography.
   - Self-signup interface for players, ELO leaderboards, dynamic tournament schedules, and interactive registration with custom payment options.
3. **Matchup Live Stream & Creator Platform**:
   - A highly regulated sports-only streaming system where verified creators match up with passionate fans.
   - Secure interactive live chats, instant highlights clipping, and direct tournament bracket integrations.

---

## 🛠️ Codebase Rules & Guardrails

To prevent regression and maintain extreme visual craft, the model must follow these strict operational rules:

1. **Do Not Overwrite Existing Workflows**:
   - The player merge engine and the automated ZIP/GIF export routines are fully validated and compiled. Do not modify or degrade their algorithms.
2. **Strict Firestore Data Schema Integrity**:
   - Always read and respect `types.ts` and `services/storage.ts` before modifying state or database schemas.
   - Ensure both local mock mode and live Firestore database operations are symmetrically supported.
   - Player records must retain parity with Landing App sign-up data (Name, Phone, Email, CNIC).
3. **No Decorative UI Slop**:
   - Avoid mock logs, port numbers, or system status lines. All elements must look fully professional, human-designed, and high-fidelity.
4. **Typography Standards**:
   - Keep heading text clean and high-contrast, utilizing "Space Grotesk" or "Outfit" for displaying metrics, and "Inter" for general UI.
5. **Cross-App Navigation Contract**:
   - Every cross-app link/button must open in a new tab (`target="_blank" rel="noopener noreferrer"`).
   - Carry context via URL query params (e.g., `?tournamentId=`).
