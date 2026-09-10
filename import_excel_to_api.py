import os
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parent
EXCEL_CANDIDATES = sorted(BASE_DIR.glob("DataServiceDR*.xlsx"))
EXCEL_FILE = str(EXCEL_CANDIDATES[0]) if EXCEL_CANDIDATES else str(BASE_DIR / "DataServiceDR.xlsx")
API_URL = os.getenv("API_URL", "http://localhost:4001/api/requests")

FIELD_ALIASES = {
    "customer": ["ลูกค้า", "Customer", "Customer Name"],
    "ref": ["Ref.", "Ref", "ref", "ระดับ", "Level"],
    "source": ["ช่องทาง", "Source", "Channel"],
    "receivedAt": ["วันเวลารับแจ้ง", "Received At", "Date Received", "วันที่รับแจ้ง"],
    "ticket": ["เลขติดตาม", "Ticket", "Tracking Number", "เลขติดตามงาน"],
    "location": ["สถานที่", "Location", "Site", "สถานที่ติดตั้ง"],
    "contact": ["ผู้ติดต่อ", "Contact", "Contact Name"],
    "phone": ["Phone", "เบอร์โทร", "โทรศัพท์"],
    "description": ["รายละเอียด", "Description", "Issue Detail"],
    "jobType": ["ลักษณะงาน", "Job Type", "ประเภทงาน"],
    "status": ["สถานะ", "Status"],
    "assignee": ["ผู้ดำเนินการ", "Assignee", "Technician"],
    "appointment": ["วันเวลานัดหมาย", "Appointment", "Scheduled Time"],
    "completedAt": ["วันเวลาเสร็จ", "Completed At", "Finished At"],
    "action": ["การดำเนินการ", "Action", "Work Done"],
    "notes": ["หมายเหตุ", "Notes", "Remark"],
}


def normalize_string(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def normalize_datetime(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).isoformat()
        except Exception:
            try:
                return pd.to_datetime(text).isoformat()
            except Exception:
                return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return None
    try:
        return pd.to_datetime(value).isoformat()
    except Exception:
        return None


def get_value(row, names):
    for name in names:
        if name in row and not pd.isna(row.get(name)):
            return row.get(name)
    return None


def build_payload(row):
    payload = {}
    for field, aliases in FIELD_ALIASES.items():
        value = get_value(row, aliases)
        if field in {"receivedAt", "appointment", "completedAt"}:
            payload[field] = normalize_datetime(value)
        else:
            payload[field] = normalize_string(value)
    return payload


def load_excel_rows(path):
    xls = pd.ExcelFile(path)
    all_rows = []

    for sheet in xls.sheet_names:
        try:
            df = pd.read_excel(path, sheet_name=sheet)
        except Exception as exc:
            print(f"Skip sheet '{sheet}' due to read error: {exc}")
            continue

        if df.empty:
            continue

        for _, row in df.iterrows():
            normalized_row = row.to_dict()
            all_rows.append(build_payload(normalized_row))

    return all_rows


def main():
    if not os.path.exists(EXCEL_FILE):
        raise FileNotFoundError(f"ไม่พบไฟล์ Excel: {EXCEL_FILE}")

    print(f"กำลังอ่านไฟล์: {EXCEL_FILE}")
    rows = load_excel_rows(EXCEL_FILE)
    print(f"พบข้อมูลทั้งหมด {len(rows)} rows")

    success = 0
    failed = 0
    for index, payload in enumerate(rows, start=1):
        try:
            response = requests.post(API_URL, json=payload, timeout=30)
            if response.status_code >= 400:
                print(f"Row {index} failed: status={response.status_code} payload={payload}")
                print(response.text)
                failed += 1
                continue
            success += 1
            if index % 50 == 0:
                print(f"ส่งแล้ว {index}/{len(rows)} rows")
        except Exception as exc:
            failed += 1
            print(f"Row {index} exception: {exc}")
            print(payload)

    print(f"Import complete: success={success}, failed={failed}")


if __name__ == "__main__":
    main()
