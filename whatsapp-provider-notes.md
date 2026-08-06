# Membba WhatsApp Provider Strategy

## Recommended model

Membba should use a hybrid provider model:

- Meta WhatsApp Cloud API for reliable 1:1 messaging, AI replies, invite delivery, reminders, payment confirmations, admin alerts, and digests.
- Baileys for optional advanced WhatsApp group automation such as joining groups, invite rotation, group metadata, and member add/remove attempts.

## Provider modes

```env
WHATSAPP_PROVIDER=baileys
WHATSAPP_PROVIDER=meta
WHATSAPP_PROVIDER=hybrid
```

### baileys
Uses the existing Baileys device-linked session for all WhatsApp sending.

### meta
Uses official Meta Cloud API for all 1:1 WhatsApp sending.

### hybrid
Uses Meta Cloud API for 1:1 messaging when configured, while keeping Baileys available for group automation.

## New environment variables

```env
META_GRAPH_VERSION=v20.0
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_VERIFY_TOKEN=
```

## New routes

```txt
GET  /api/meta/status
GET  /api/meta/webhook
POST /api/meta/webhook
POST /api/meta/send-test
```

## Current implementation

- `server/services/metaWhatsApp.js` handles Meta Cloud API messaging and webhook parsing.
- `server/services/whatsappProvider.js` selects Meta, Baileys, or hybrid sending.
- AI escalation alerts and daily digest now use the provider layer.
- Incoming Meta webhook messages can call the same Groq AI responder and reply through the provider.

## Important limitation

Meta Cloud API does not replace Baileys for normal WhatsApp group administration. It is best used as the reliable communication backbone. Baileys remains the experimental/advanced group automation layer.
