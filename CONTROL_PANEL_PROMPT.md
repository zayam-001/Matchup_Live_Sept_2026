# Prompt / Instructions for App 2 (Control Panel) AI Agent

This document contains a pre-engineered prompt designed to be copied and pasted directly into the chat interface of the **Control Panel (App 2)** AI Agent. This prompt instructs the agent to build the visual player and team exploration dashboard reading from the newly established centralized Firestore collections, ensuring accurate reporting of **all** players.

---

```markdown
# Role & Context
You are the AI Coding Agent for App 2 (Control Panel) of the Matchup platform.
Our core admin dashboard (App 1) has established a robust, centralized denormalization engine that automatically aggregates and mirrors player-wise and team-wise data into two global, highly optimized Firestore collections:
1. `onboardedPlayers` (Stores individual consolidated players. **This includes ALL players**, both those who are registered in tournaments and those who are standalone users/platform members without any tournament registrations.)
2. `onboardedTeams` (Stores registered and manually enrolled teams across all tournaments)

Your task is to implement the central **Player Directory & Global Team Tracker** inside App 2 (Control Panel), integrating real-time database queries and a clean, high-performance UI to ensure accurate reporting.

---

## 🛠️ Data Model & Contracts
Ensure your data-fetching and UI state align with these shared TypeScript interfaces:

```typescript
export interface OnboardedPlayer {
  id: string; // unique slug e.g. name__email__phone
  name: string;
  email: string;
  phone: string;
  cnic?: string;
  photoUrl?: string;
  verified: boolean;
  tournaments?: { // Note: Can be undefined or empty for standalone players
    tournamentId: string;
    tournamentName: string;
    teamId: string;
    teamName: string;
    partnerName: string;
    registeredAt: string;
    status: string; // e.g. PENDING, ACCEPTED, REJECTED
  }[];
  lastUpdated: string;
}

export interface OnboardedTeam {
  id: string; // tournamentId_teamId
  teamId: string;
  name: string;
  tournamentId: string;
  tournamentName: string;
  player1: { name: string; phone: string; email: string; cnic?: string; photoUrl?: string; verified: boolean };
  player2: { name: string; phone: string; email: string; cnic?: string; photoUrl?: string; verified: boolean };
  status: string;
  registeredAt: string;
  categoryId?: string;
  groupId?: string;
  stats?: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    points: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    gamesPlayed: number;
  };
  lastUpdated: string;
}
```

---

## 🎨 Feature Specifications for App 2 (Control Panel)

### 1. Global Players Directory View
- **Tab Layout**: Create a "Global Directory" screen containing two secondary sub-tabs: **"Players Network"** and **"Teams Register"**.
- **Metrics Grid (Cards)**:
  - **Total Platform Players**: Unique count of ALL entries in `onboardedPlayers` (Accurate reporting of total signups/manual entries).
  - **Tournament Participants**: Count of players who have at least one entry in the `tournaments` array.
  - **Standalone Players**: Count of players where `tournaments` array is empty or undefined.
- **Data Table (Players Network)**:
  - Columns: **Player Name**, **Contact (Email / Phone)**, **CNIC**, **Tournament Count**, **Last Updated**.
  - **Search & Filters**: Quick-search by name, email, phone, or CNIC. Filter to show "All", "Tournament Participants", or "Standalone Players".
  - **Player Detail Slide-over / Modal**: Clicking on a player opens an elegant side drawer showing:
    - Core credentials.
    - **Career History List**: A clean chronological timeline of all tournaments they participated in. If they have none, display a friendly "No tournament history yet" message.

### 2. Global Teams Register View
- **Data Table (Teams Register)**:
  - Columns: **Team Name**, **Tournament**, **Player 1**, **Player 2**, **Status (Badge)**, **Cumulative Performance (Wins/Losses)**.
  - **Search & Filters**: Search by team name or player names. Filter by Tournament, and Status (e.g. ACCEPTED, PENDING).
  - High-contrast visual styling utilizing "Space Grotesk" display typography for metrics and "Inter" for data tables.

### 3. CSV / Excel Export
- Provide an **"Export Players (CSV)"** and **"Export Teams (CSV)"** button that formats the filtered grids into standard downloadable CSV files for accurate reporting and offline analysis.

### 4. Firestore Service Integration
Implement real-time or snapshot subscribers targeting the two global Firestore collections:
- `collection(db, "onboardedPlayers")`
- `collection(db, "onboardedTeams")`
Ensure that the UI gracefully displays a skeletal loading state while the database subscription is initializing.

**CRITICAL DATA FETCHING REQUIREMENT**:
You MUST fetch ALL documents from these collections to ensure accurate reporting. Do NOT use `limit(50)` or `limit(60)` in your Firestore queries. 
If the UI needs to display many players, implement client-side pagination or a virtualized list, but you must fetch the entire dataset to ensure the "Total Platform Players" metric is 100% accurate.
Example: `const q = query(collection(db, 'onboardedPlayers')); // NO LIMIT!`
```
