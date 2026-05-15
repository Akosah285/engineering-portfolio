# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual GitHub label strings used in this repo. Defaults are 1:1 with the matt-pocock vocabulary.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Project-specific labels (additive)

- `prd` — applied to product requirement documents
- `slice` — applied to vertical-slice implementation issues
- `epic` — applied to multi-slice parent issues (rare; PRDs usually serve this role)
- `phase:v0` … `phase:v10`, `phase:v∞` — build-phase tags from the plan
- `area:site`, `area:demo-kit`, `area:ocr-vault`, `area:ci`, `area:content` — codebase area tags

These are convenience tags applied alongside the canonical triage label.
