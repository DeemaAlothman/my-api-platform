# Users Service Spec — v2.0.0

## Service Info
- Service: `users`
- Port: `4002`
- Global Prefix: `/api/v1`
- Base URL (local): `http://localhost:4002/api/v1`

## Global Rules (Must Follow)
1) Unified response shape:
### Success
```json
{
  "success": true,
  "data": {},
  "meta": { "timestamp": "ISO_DATE" }
}
