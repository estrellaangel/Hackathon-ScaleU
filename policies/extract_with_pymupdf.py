import argparse
import os
import re
import fitz  # PyMuPDF

def clean_text(t: str) -> str:
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", default="extracted.txt")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    with open(args.out, "w", encoding="utf-8") as f:
        for i in range(len(doc)):
            page = doc[i]
            text = page.get_text("text")  # simple text extraction
            text = clean_text(text)
            f.write(f"\n\n===== PAGE {i+1} =====\n\n")
            f.write(text if text else "[No text extracted]")
    print(f"Wrote: {args.out}")

if __name__ == "__main__":
    main()
