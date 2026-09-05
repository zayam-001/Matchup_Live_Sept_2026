sed -i '/const stageUpper = m.stage?.toUpperCase();/d' services/storage.ts
sed -i '/if (format === TournamentFormat.ROUND_ROBIN && stageUpper !== "GROUP") {/d' services/storage.ts
sed -i '/return;/d' services/storage.ts
