const fs = require('fs');
let code = fs.readFileSync('components/BulkUploadTeamsModal.tsx', 'utf8');

code = code.replace(
    `const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));`,
    `const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const catMap = new Map();
            if (tournament.categories) {
                tournament.categories.forEach(c => {
                    catMap.set(c.name.toLowerCase().trim(), c.id);
                });
            }`
);

code = code.replace(
    `categoryId: categoryId || undefined,`,
    `categoryId: (row.category && catMap.get(row.category.toLowerCase().trim())) || (row.categoryname && catMap.get(row.categoryname.toLowerCase().trim())) || categoryId || undefined,`
);

code = code.replace(
    `categoryId: categoryId || undefined,`, // doing it again for the second instance (if-else block for americano vs regular)
    `categoryId: (row.category && catMap.get(row.category.toLowerCase().trim())) || (row.categoryname && catMap.get(row.categoryname.toLowerCase().trim())) || categoryId || undefined,`
);

fs.writeFileSync('components/BulkUploadTeamsModal.tsx', code);
console.log("Done");
