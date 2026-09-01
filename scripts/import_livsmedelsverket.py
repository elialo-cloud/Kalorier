#!/usr/bin/env python3
from pathlib import Path
import os, re, sqlite3, subprocess, tempfile
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "livsmedelsdatabasen.xlsx"
VERSION = os.getenv("LIVSMEDELSVERKET_VERSION", "2026-07-01")
SOURCE = "Livsmedelsverket Livsmedelsdatabas"

def norm(v):
    return re.sub(r"\s+", " ", str(v or "").strip().lower())

def num(v):
    if v is None or v == "": return None
    try: return float(str(v).strip().replace(",", "."))
    except ValueError: return None

def find_header(ws):
    aliases = {
      "name": ["livsmedelsnamn", "namn", "livsmedel"],
      "id": ["livsmedelsnummer", "livsmedelsnr", "nummer"],
      "kcal": ["energi (kcal)", "energi kcal", "kcal"],
      "protein": ["protein"], "carbs": ["kolhydrater", "kolhydrat"],
      "fat": ["fett"], "fiber": ["fiber", "fibrer"],
      "category": ["kategori", "livsmedelsgrupp", "grupp"]}
    for r in range(1, min(ws.max_row, 60) + 1):
        vals = [norm(ws.cell(r,c).value) for c in range(1, ws.max_column+1)]
        found = {}
        for key, aa in aliases.items():
            for c,v in enumerate(vals,1):
                if any(a == v or a in v for a in aa): found[key]=c; break
        if "name" in found and ("kcal" in found or "id" in found): return r, found
    raise RuntimeError("Could not identify Livsmedelsverket header row/columns")

def main():
    if not XLSX.exists(): raise FileNotFoundError(XLSX)
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.active
    header, cols = find_header(ws)
    fd, dbpath = tempfile.mkstemp(suffix=".sqlite"); os.close(fd)
    con = sqlite3.connect(dbpath); cur = con.cursor()
    try:
        cur.executescript('''CREATE TABLE foods(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,name_normalized TEXT NOT NULL,category TEXT,kcal_per_100g REAL NOT NULL DEFAULT 0,protein_per_100g REAL NOT NULL DEFAULT 0,carbs_per_100g REAL NOT NULL DEFAULT 0,fat_per_100g REAL NOT NULL DEFAULT 0,fiber_per_100g REAL NOT NULL DEFAULT 0,edible_state TEXT,preparation TEXT,barcode TEXT,brand TEXT,source TEXT,source_id TEXT,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE portions(id INTEGER PRIMARY KEY AUTOINCREMENT,food_id INTEGER NOT NULL,name TEXT NOT NULL,grams REAL NOT NULL); CREATE TABLE import_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);''')
        cur.executemany("INSERT INTO import_metadata VALUES (?,?)", [("source",SOURCE),("version",VERSION)])
        n=0
        for row in ws.iter_rows(min_row=header+1, values_only=True):
            def get(k):
                c=cols.get(k); return row[c-1] if c and c<=len(row) else None
            name=get("name")
            if not name: continue
            cur.execute("INSERT INTO foods(name,name_normalized,category,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,source,source_id,verified) VALUES (?,?,?,?,?,?,?,?,?,?,1)", (str(name).strip(),norm(name),get("category"),num(get("kcal")) or 0,num(get("protein")) or 0,num(get("carbs")) or 0,num(get("fat")) or 0,num(get("fiber")) or 0,SOURCE,str(get("id")) if get("id") is not None else None))
            n+=1
        con.commit()
        out=ROOT/"build"/"livsmedelsverket-import.sql"; out.parent.mkdir(exist_ok=True)
        dump=subprocess.check_output(["sqlite3",dbpath,".dump"],text=True)
        lines=[x for x in dump.splitlines() if x.startswith("INSERT INTO foods") or x.startswith("INSERT INTO portions") or x.startswith("INSERT INTO import_metadata")]
        out.write_text("\n".join(lines)+"\n",encoding="utf-8")
        print(f"Prepared {n} foods -> {out}")
    finally:
        con.close(); os.unlink(dbpath)
if __name__ == "__main__": main()
