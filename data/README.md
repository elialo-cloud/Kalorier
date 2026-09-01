# Livsmedelsverket-data

Lägg den nedladdade Excel-filen från Livsmedelsverket här med namnet:

`livsmedelsdatabasen.xlsx`

Källa: Livsmedelsverkets Livsmedelsdatabas, version 2026-07-01.

Filen ska inte läggas i `public/` och ska inte deployas som en Worker asset. Den används som källdata för import till Cloudflare D1.

Importören finns i `scripts/import_livsmedelsverket.py` och körs via GitHub Actions-workflowet "Import Livsmedelsverket". Inga argument behövs; den läser `data/livsmedelsdatabasen.xlsx` automatiskt.
