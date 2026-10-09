# Project Guidelines & Rules (Foresee Check-in)

## 1. Summary Format Requirement (CRITICAL)
- Whenever providing a summary of updates, fixes, or changelogs to the user:
  - **MUST provide the summary inside a copyable plain text block (````text ... ````)** so the user can easily copy with a single click (including headers and all text).
  - **MUST structure summaries by date / day-by-day (สรุปแยกเป็นวันๆ)**, clearly stating the date, key problem solved, and details of what was changed and verified.

## 2. Codebase Architecture & Constraints
- **File Length Limit:** Every source code file (`.js`, `.html`, etc.) in `src/` MUST remain strictly under 1,000 lines. If a file approaches 900+ lines, modularize it into submodules.
- **Verification Routine:** Before committing and pushing:
  1. Check line counts: All `.js` files < 1,000 lines.
  2. Verify HTML onclicks: `node scripts/verify_onclicks.cjs`.
  3. Verify build: `npm run build`.
- **Role Scoping Rules:**
  - **Admin (`admin`)**: ALWAYS sees 100% of all tasks across the company at all times (search, filter, view). Never show lock screens or unneeded login prompts to admin.
  - **Non-Admin (staff/operator)**: Only sees tasks assigned to them (`techs.includes(opName)`).
  - Never display intrusive, repetitive LINE login popup cards.
