# Data imports and exports

Glean stores your pantry in a local SQLite database. CSV is the only import and
export format. There is no account and no cloud import.

In the app: **Settings (Profile tab) → Import / Export**.

## Export

The export tab writes the current inventory to `glean-inventory.csv` in the app
cache and opens the system share sheet, so you can save or send the file.

The header is always:

```csv
Name,Quantity,Category,Location
```

Values containing a comma, a double quote or a newline are wrapped in double
quotes, and inner quotes are doubled. Rows are written in inventory order.
Barcodes, images and restock timestamps are not exported.

## Import

The import tab takes **pasted text**, not a file picker. Open the CSV in any
text editor, copy it, paste it into the box and tap **Import CSV**. The app
reports how many items were added and how many were updated.

### Columns

Headers are split on commas, trimmed and lowercased, so header case does not
matter. Unknown columns are ignored.

| Header     | Required | Meaning                                            |
| ---------- | -------- | -------------------------------------------------- |
| `name`     | yes      | Item name. Rows with an empty name are skipped.    |
| `quantity` | no       | Stock count. Missing, non-numeric or negative → 0. |
| `category` | no       | Free-text category. Missing or empty → `Other`.    |
| `location` | no       | Free-text location. Missing or empty → none.       |

Notes:

- A file needs a header line plus at least one data row; otherwise nothing is
  imported and the app reports no changes.
- `quantity` is read with `parseInt`, so `2.7` becomes `2` and `two` becomes `0`.
- Categories and locations are not validated against your existing options.
  Any string is accepted and shown as-is.
- Blank lines are ignored.
- The importer splits on commas naively. A quoted value that contains a comma
  or a newline is not parsed as one field, so files produced by the export can
  only be re-imported faithfully if no value contains those characters.

### Duplicate names

Matching is case-insensitive on `name` against the current inventory:

- **Existing item** — the imported quantity is **added** to the current
  quantity (`Milk` at 2 plus a row of 1 becomes 3). Category and location are
  left untouched. Counted as *updated*.
- **New item** — created with the imported quantity, category and location.
  Counted as *added*.
- **Repeated name inside one file** — the first row creates the item, later
  rows for the same name add to it, so the quantities accumulate.

Import never deletes anything and never overwrites quantities. Re-importing
your own export therefore doubles the stock counts instead of restoring them.

### Example

```csv
Name,Quantity,Category,Location
Milk,2,Dairy,Fridge
Rice,5,Grains,Pantry
Olive oil,1,Other,
Dish soap,3,Cleaning,Kitchen cabinet
```

This creates four items; `Olive oil` has no location. Running it a second time
leaves the four items in place with quantities 4, 10, 2 and 6.
