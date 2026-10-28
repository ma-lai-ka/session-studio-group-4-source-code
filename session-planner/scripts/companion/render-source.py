"""Render explicitly requested DDG scan pages for the local companion; no OCR guesses."""
import json
import sys
from pathlib import Path
import pypdfium2 as pdfium

source, destination, *pages = sys.argv[1:]
target = Path(destination)
target.mkdir(parents=True, exist_ok=True)
document = pdfium.PdfDocument(source)
result = []
for value in pages:
    number = int(value)
    if number < 1 or number > len(document):
        raise ValueError("Source page is out of range")
    output = target / f"page-{number}.png"
    if not output.exists():
        page = document[number - 1]
        bitmap = page.render(scale=2)
        bitmap.to_pil().save(output)
        bitmap.close()
        page.close()
    result.append(str(output.resolve()))
document.close()
print(json.dumps(result))
