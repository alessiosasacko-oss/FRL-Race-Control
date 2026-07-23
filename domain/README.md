# FRL domain

This directory is the framework-independent source of truth for FRL Race
Control domain contracts.

- Enums contain stable machine values. User-facing labels live in `labels.ts`.
- Every canonical model is inferred from its Zod schema.
- Relationships use IDs; relation views are composed by data adapters.
- Schemas validate fixture data now and will later validate API and database
  boundaries without changing the model contracts.
