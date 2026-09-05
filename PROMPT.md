# Bulk Upload Implementation Prompt

Please implement a secure **Bulk Upload Feature** for tournament teams in the Control Panel, adhering strictly to the Matchup.com.pk system architecture and data schemas.

## Core Objective
The bulk upload script must process CSV/Excel data and inject teams into the system strictly as **PENDING** requests within their respective tournament categories. It must *not* directly enroll teams, bypass the approval pipeline, or disrupt existing ELO/matching logic.

## Upload & Parsing Requirements
1. **Category Mapping**: The script must accurately map teams to their respective `categoryId` within the selected tournament.
2. **Schema Integrity**: The uploaded data must conform perfectly to the `Team` and `Player` interfaces defined in `types.ts`. Each imported team should generate:
   - Unique IDs for the team (`teamId`).
   - Standardized properties (`player1.name`, `player2.name`, `player1.phone`, etc.).
   - Initialized stats (`matchesPlayed: 0`, `wins: 0`, etc.).
3. **Pending Status**: Crucially, every bulk-uploaded team must be initialized with `status: RegistrationStatus.PENDING`.
4. **Visibility**: Uploaded teams must immediately appear in the **Admin Dashboard > Tournament > Team Management > Pending Requests** view, filtered accurately by their assigned category.

## Expected System Behavior on Admin Action

### Scenario A: Admin ACCEPTs a Pending Team
When an admin clicks "Accept" on a bulk-uploaded pending team:
1. **Database Action**: The team's `status` in the Firestore database must transition from `PENDING` to `ACCEPTED`.
2. **Enrollment**: The team officially becomes an active participant in the tournament's specific category.
3. **Profile Engine Validation**: The Player Merge Engine should evaluate the players' details against existing global player profiles (if applicable).
4. **Automated Communications**: The system must trigger the automated enrollment emails/notifications to both players, welcoming them to the tournament.

### Scenario B: Admin REJECTs a Pending Team
When an admin clicks "Reject" on a bulk-uploaded pending team:
1. **Database Action**: The team's `status` in the Firestore database must transition from `PENDING` to `REJECTED`.
2. **Exclusion**: The team remains explicitly excluded from active tournament operations, scheduling, and brackets.
3. **Automated Communications**: The system must trigger an automated email/notification respectfully informing the team of the rejection.
4. **Cleanup (Optional but recommended)**: Ensure that rejected records are excluded from category count limits and leaderboard statistics.

## Guardrails
- **No Direct Insertion**: Never bypass the `PENDING` state during upload.
- **Data Parity**: Ensure the uploaded CSV fields perfectly match the required fields for manual registration on the Landing App.
- **Performance**: Use Firestore batched writes (`writeBatch`) for the bulk upload to ensure atomic transactions and prevent partial failures.
