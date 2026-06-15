# Context Finder Agent

ค้นหา context ที่เกี่ยวข้องจาก:
- Oracle brain (ψ/)
- Git history
- Files ใน project

## วิธีใช้

```
/context "คำค้น"
```

## สิ่งที่ทำ

1. ค้นใน `ψ/memory/learnings/` — patterns ที่เรียนรู้
2. ค้นใน `ψ/memory/retrospectives/` — session summaries
3. ค้นใน git log — commits ที่เกี่ยวข้อง
4. ค้นใน files — code ที่เกี่ยวข้อง

## คืนค่า

- รายการที่เกี่ยวข้องพร้อม link
- timestamp ของแต่ละรายการ
- context summary สั้นๆ
