"""Small, dependency-free multipage PDF export, including CJK text."""
from decimal import Decimal
from unicodedata import east_asian_width

from app.workflow_catalog import CATALOG


def wrap_line(text, width=86):
    line, count = "", 0
    for char in str(text):
        size = 2 if east_asian_width(char) in {"W", "F"} else 1
        if count + size > width or char == "\n":
            yield line
            line, count = "", 0
        if char != "\n":
            line += char if ord(char) >= 32 else " "
            count += size
    yield line


def record_pdf(record, approvals=(), references=None):
    references = references or {}
    lines = ["NCT PMC - HR Administration", CATALOG[record.kind]["title"],
             record.number, f"Status: {record.status.replace('_', ' ').upper()}",
             f"Company: {record.company}", f"Title: {record.title}",
             f"Date / expiry: {record.due_date or '-'}", ""]
    fields = {f["key"]: f["label"] for f in CATALOG[record.kind]["fields"]}
    for key, value in record.data.items():
        if key == "items":
            lines += ["Items:"]
            total = Decimal("0")
            for index, item in enumerate(value, 1):
                amount = Decimal(item["quantity"]) * Decimal(item["unit_price"])
                total += amount
                lines += [f"{index}. {item['description']} {('Size: ' + item['size']) if item.get('size') else ''}",
                          f"   Qty: {item['quantity']}  Unit: RM {item['unit_price']}  Amount: RM {amount:.2f}"]
            lines += [f"TOTAL: RM {total:.2f}", ""]
        elif value is not None and key != "approval_completed":
            lines += [f"{fields.get(key, key.replace('_', ' ').title())}: {references.get(key, value)}"]
    lines += ["", "Approval history:"]
    for approval in approvals:
        lines += [f"Level {approval['position'] + 1}: {approval['approver']} - {approval['status']}",
                  f"  {approval.get('decided_at') or ''}  {approval.get('notes') or ''}"]
    flattened = [line for text in lines for line in wrap_line(text)]
    pages = [flattened[i:i + 47] for i in range(0, len(flattened), 47)] or [[]]
    # A standard PDF CJK font lets readers render both Latin and Chinese text.
    objects = [b"", b"",
        b"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>",
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 /W [1 95 500] >>"]
    page_ids = []
    for index, page in enumerate(pages):
        page_id, stream_id = len(objects) + 1, len(objects) + 2
        page_ids.append(page_id)
        stream = b"BT /F1 10 Tf 14 TL 1 0 0 1 42 796 Tm\n"
        for line in page + ["", f"Page {index + 1} of {len(pages)}"]:
            stream += b"<" + line.encode("utf-16-be", errors="replace").hex().encode("ascii") + b"> Tj T*\n"
        stream += b"ET"
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>".encode())
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Count {len(page_ids)} /Kids [{' '.join(f'{i} 0 R' for i in page_ids)}] >>".encode()
    pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(pdf)
    pdf += f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode()
    pdf += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    pdf += f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    return pdf
