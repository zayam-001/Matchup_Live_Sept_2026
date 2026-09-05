cat << 'INNER_EOF' > firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
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

    // Users
    match /users/{userId} {
      allow read: if isOwner(userId) || isSuperAdmin();
      allow list: if isAuthenticated() && resource.data.email == request.auth.token.email || isSuperAdmin();
      allow write: if isOwner(userId) || isSuperAdmin();
    }

    // Players
    match /players/{userId} {
      allow read, list: if true;
      allow create: if isOwner(userId) || isSuperAdmin();
      allow update: if isAuthenticated(); // Allow referees (authenticated) to update stats
      allow delete: if isSuperAdmin();
    }

    // Venues
    match /venues/{venueId} {
      allow read: if true;
      allow write: if isSuperAdmin();
    }

    // Courts
    match /courts/{courtId} {
      allow read: if true;
      allow write: if isSuperAdmin();
    }

    // Organizers
    match /organizers/{organizerId} {
      allow read: if true;
      allow write: if isSuperAdmin();
    }

    // Referees
    match /referees/{refereeId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    match /matches/{matchId}/events/{eventId} {
      allow read: if true;
      allow create: if
        isAuthenticated()
        && request.resource.data.keys().hasAll([
            'type','scoringTeam','scoringPlayerId',
            'shotType','setNum','scoreAfter'
          ])
        && request.resource.data.type in [
            'point','fault','let','timeout','match_end'
          ];
      allow update, delete: if false; // immutable!
    }

    match /matches/{matchId} {
      allow read: if true;
      allow update, create: if isAuthenticated();
    }

    // Admin Users
    match /adminUsers/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId || isSuperAdmin();
      allow list: if isAuthenticated() && resource.data.email == request.auth.token.email || isSuperAdmin();
      allow write: if isSuperAdmin();
    }

    // Tournaments
    match /tournaments/{tournamentId} {
      allow get: if true;
      allow list: if true;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated() && (
        resource.data.organizerId == request.auth.uid || 
        resource.data.organizerEmail == request.auth.token.email ||
        resource.data.adminTag == request.auth.token.email ||
        isSuperAdmin()
      );

      // Public read, restricted write for general subcollections
      match /{document=**} {
        allow read: if true;
        allow write: if isAuthenticated();
      }
    }

    // OBS Index
    match /obsIndex/{matchId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Quickplay Sessions
    match /quickplaySessions/{sessionId} {
      allow read: if true; 
      allow create: if isAuthenticated();
      allow update: if isAuthenticated(); 
      allow delete: if isSuperAdmin();
    }

    // Promo Codes
    match /promoCodes/{code} {
      allow read: if true;
      allow create: if isAuthenticated() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isAuthenticated(); // Allow updates for incrementing uses
      allow delete: if isSuperAdmin();
    }
    
    // Teams
    match /teams/{teamId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // Quick Sessions
    match /quickSessions/{sessionId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Global Stats
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
