cat << 'INNER_EOF' > firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isSuperAdmin() {
      return isAuthenticated() && 
         get(/databases/$(database)/documents/players/$(request.auth.uid)).data.role == 'superadmin';
    }

    match /users/{userId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /players/{userId} {
      allow read, list: if true;
      allow create, update, delete: if isAuthenticated();
    }

    match /venues/{venueId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /courts/{courtId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /organizers/{organizerId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /organisers/{organizerId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /referees/{refereeId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /{path=**}/matches/{document} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /matches/{matchId}/events/{eventId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /matches/{matchId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /adminUsers/{userId} {
      allow read: if true;
      allow write: if isSuperAdmin();
    }

    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if isAuthenticated();

      match /{document=**} {
        allow read: if true;
        allow write: if isAuthenticated();
      }
    }

    match /obsIndex/{matchId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /quickplaySessions/{sessionId} {
      allow read: if true; 
      allow write: if isAuthenticated();
    }

    match /promoCodes/{code} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    match /teams/{teamId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    match /quickSessions/{sessionId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /globalStats/{docId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /leaderboard/{playerId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /onboardedTeams/{teamId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /onboardedPlayers/{playerId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
  }
}
INNER_EOF
